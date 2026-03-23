import type { GameConfig, GameEvent, PhaseCategory } from '@threecyborgs/game-sdk';
import { BaseGame } from '@threecyborgs/game-sdk';
import type { LeaderboardEntry } from '@threecyborgs/game-sdk';

// ── Phase types ──────────────────────────────────────────────────────────────

/**
 * Horse-race specific phases:
 *  - `lobby`   – waiting for players to join
 *  - `betting` – players place bets on a horse (timer running)
 *  - `racing`  – horses run; outcome is revealed (timer running for animation)
 *  - `results` – winner shown; leaderboard displayed before next race
 *  - `finished`– all races complete, final standings shown
 */
export type HorseRacePhase = 'lobby' | 'betting' | 'racing' | 'results' | 'finished';

// ── Supporting types ─────────────────────────────────────────────────────────

export interface Horse {
  id: string;
  name: string;
  /** 0–100 representing distance covered on the track. */
  position: number;
}

export interface Bet {
  playerId: string;
  horseId: string;
  /** Points wagered (deducted on bet, returned × 2 on win). */
  amount: number;
}

export interface RaceResult {
  raceNumber: number;
  winner: Horse;
  finalPositions: Horse[];
}

// ── Game state ───────────────────────────────────────────────────────────────

export interface HorseRaceState {
  phase: HorseRacePhase;
  currentRace: number;
  totalRaces: number;
  horses: Horse[];
  /** Key: `${playerId}` — one active bet per player per race. */
  bets: Map<string, Bet>;
  pastResults: RaceResult[];
  config: HorseRaceConfig;
  /** Speed multiplier per horse for the current race (set when race starts). */
  horseSpeeds: Map<string, number>;
  /** Timestamp when racing phase started. */
  raceStartTime: number;
}

// ── Configuration ────────────────────────────────────────────────────────────

/**
 * Horse-race specific configuration.
 * Passed via the generic `rawConfig` channel — does not pollute `GameConfig`.
 */
export interface HorseRaceConfig {
  /** Duration of the betting phase (ms). */
  bettingTimeMs: number;
  /** Duration of the race animation phase (ms). */
  racingTimeMs: number;
  /** Number of races to run. */
  totalRaces: number;
  /** Points each player starts a race with as a bet budget (per race). */
  pointsPerRace: number;
  /** Horse roster for every race. */
  horses: Pick<Horse, 'id' | 'name'>[];
}

const DEFAULT_HORSE_RACE_CONFIG: HorseRaceConfig = {
  bettingTimeMs: 20_000,
  racingTimeMs: 10_000,
  totalRaces: 5,
  pointsPerRace: 100,
  horses: [
    { id: 'lightning', name: 'Lightning' },
    { id: 'thunder', name: 'Thunder' },
    { id: 'storm', name: 'Storm' },
    { id: 'bolt', name: 'Bolt' },
  ],
};

function resolveHorseRaceConfig(raw: Record<string, unknown>): HorseRaceConfig {
  return {
    bettingTimeMs: typeof raw.bettingTimeMs === 'number' ? raw.bettingTimeMs : DEFAULT_HORSE_RACE_CONFIG.bettingTimeMs,
    racingTimeMs: typeof raw.racingTimeMs === 'number' ? raw.racingTimeMs : DEFAULT_HORSE_RACE_CONFIG.racingTimeMs,
    totalRaces: typeof raw.totalRaces === 'number' ? raw.totalRaces : DEFAULT_HORSE_RACE_CONFIG.totalRaces,
    pointsPerRace: typeof raw.pointsPerRace === 'number' ? raw.pointsPerRace : DEFAULT_HORSE_RACE_CONFIG.pointsPerRace,
    horses: Array.isArray(raw.horses) ? (raw.horses as Pick<Horse, 'id' | 'name'>[]) : DEFAULT_HORSE_RACE_CONFIG.horses,
  };
}

// ── Game class ───────────────────────────────────────────────────────────────

export class HorseRaceGame extends BaseGame<HorseRaceState> {
  readonly gameType = 'horse-race';
  readonly displayName = 'Horse Race';

  // ── BaseGame abstract implementations ────────────────────────────────────

  /**
   * `rawConfig` (set by `BaseGame` before this is called) contains the
   * horse-race–specific fields; no constructor override needed.
   */
  getInitialState(_config: GameConfig): HorseRaceState {
    const hrConfig = resolveHorseRaceConfig(this.rawConfig);
    return {
      phase: 'lobby',
      currentRace: 0,
      totalRaces: hrConfig.totalRaces,
      horses: hrConfig.horses.map((h) => ({ ...h, position: 0 })),
      bets: new Map(),
      pastResults: [],
      config: hrConfig,
      horseSpeeds: new Map(),
      raceStartTime: 0,
    };
  }

  onStart(): GameEvent[] {
    return this.startBettingPhase();
  }

  /**
   * Handles a player placing or updating their bet.
   *
   * Expected action shape:
   * ```json
   * { "horseId": "lightning", "amount": 50 }
   * ```
   *
   * `amount` is clamped to `[1, pointsPerRace]`.
   * A player may re-bet before the timer expires; the previous wager is refunded.
   */
  onPlayerAction(playerId: string, action: unknown): GameEvent[] {
    if (this.state.phase !== 'betting') {
      return [
        {
          type: 'game:error',
          payload: { message: 'Bets are only accepted during the betting phase' },
          target: playerId,
        },
      ];
    }

    const player = this.getPlayer(playerId);
    if (!player) {
      return [
        {
          type: 'game:error',
          payload: { message: 'Player not found' },
          target: playerId,
        },
      ];
    }

    const { horseId, amount } = action as { horseId: string; amount: number };

    const horse = this.state.horses.find((h) => h.id === horseId);
    if (!horse) {
      return [
        {
          type: 'game:error',
          payload: { message: `Unknown horse: ${horseId}` },
          target: playerId,
        },
      ];
    }

    const clampedAmount = Math.max(1, Math.min(this.state.config.pointsPerRace, Math.trunc(amount)));

    // Refund previous bet if any
    const existingBet = this.state.bets.get(playerId);
    if (existingBet) {
      player.score += existingBet.amount;
    }

    // Deduct new wager
    player.score -= clampedAmount;

    const bet: Bet = { playerId, horseId, amount: clampedAmount };
    this.state.bets.set(playerId, bet);

    const events: GameEvent[] = [
      {
        type: 'race:bet_placed',
        payload: { playerId, horseId, amount: clampedAmount, totalBets: this.state.bets.size },
        target: 'presenter',
      },
      {
        type: 'race:bet_ack',
        payload: { horseId, amount: clampedAmount, newScore: player.score },
        target: playerId,
      },
    ];

    // Check if all connected players have bet - if so, start race immediately
    const connectedPlayers = this.getAllPlayers().filter((p) => p.connected);
    const allPlayersBet = connectedPlayers.length > 0 && 
      connectedPlayers.every((p) => this.state.bets.has(p.id));
    
    if (allPlayersBet) {
      // Signal to skip the betting timer and start race now
      events.push({
        type: 'game:all_bets_in',
        payload: { totalBets: this.state.bets.size },
        target: 'presenter',
      });
    }

    return events;
  }

  /**
   * Called when either the betting or racing timer expires:
   *  - `betting` phase → simulate the race and emit results
   *  - `racing`  phase → (no-op; the race result was already emitted in the betting callback)
   */
  onTimerExpired(): GameEvent[] {
    if (this.state.phase === 'betting') {
      return this.runRace();
    }
    // racing phase timeout: just move to results (race was already resolved)
    if (this.state.phase === 'racing') {
      return this.resolveResults();
    }
    return [];
  }

  /** Advance to the next race (or finish the game if all races are done). */
  nextRound(): GameEvent[] {
    if (this.state.currentRace >= this.state.totalRaces) {
      return this.finishGame();
    }
    return this.startBettingPhase();
  }

  getStateForPresenter(): unknown {
    return {
      gameType: this.gameType,
      phase: this.state.phase,
      currentRace: this.state.currentRace,
      totalRaces: this.state.totalRaces,
      horses: this.state.horses,
      betCount: this.state.bets.size,
      playerCount: this.getPlayerCount(),
      leaderboard: this.getLeaderboard(),
      pastResults: this.state.pastResults,
      bettingTimeMs: this.state.config.bettingTimeMs,
      racingTimeMs: this.state.config.racingTimeMs,
    };
  }

  getStateForPlayer(playerId: string): unknown {
    const player = this.getPlayer(playerId);
    if (!player) return null;
    const myBet = this.state.bets.get(playerId);
    return {
      phase: this.state.phase,
      currentRace: this.state.currentRace,
      totalRaces: this.state.totalRaces,
      horses: this.state.horses,
      myBet: myBet ?? null,
      score: player.score,
      rank: this.getPlayerRank(playerId),
    };
  }

  getLeaderboard(): LeaderboardEntry[] {
    return this.getAllPlayers()
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({
        id: p.id,
        displayName: p.displayName,
        username: p.username,
        score: p.score,
        rank: i + 1,
      }));
  }

  getPhase(): string {
    return this.state.phase;
  }

  getPhaseCategory(): PhaseCategory {
    switch (this.state.phase) {
      case 'lobby':
        return 'lobby';
      case 'betting':
      case 'racing':
        return 'active';
      case 'results':
        return 'reveal';
      case 'finished':
        return 'finished';
      default:
        return 'lobby';
    }
  }

  getCurrentRoundNumber(): number | null {
    return this.state.currentRace > 0 ? this.state.currentRace : null;
  }

  getTotalRounds(): number {
    return this.state.totalRaces;
  }

  /**
   * Build horse race-specific player result for final submission.
   * Returns the player's betting history across all races.
   */
  override buildPlayerResult(playerId: string): Record<string, unknown> {
    const bets: Array<{
      raceNumber: number;
      horseId: string;
      amount: number;
      won: boolean;
    }> = [];

    // Reconstruct betting history from past results
    // Note: This is a simplified version - in production you might want to track bets more explicitly
    for (const result of this.state.pastResults) {
      // For now, we don't have historical bet tracking per race, just the current race bets
      // This would need enhancement to properly track historical bets
      const bet = this.state.bets.get(playerId);
      if (bet && result.raceNumber === this.state.currentRace) {
        bets.push({
          raceNumber: result.raceNumber,
          horseId: bet.horseId,
          amount: bet.amount,
          won: bet.horseId === result.winner.id,
        });
      }
    }

    return { bets };
  }

  /**
   * Build horse race-specific game summary for final submission.
   */
  override buildGameSummary(): Record<string, unknown> {
    return {
      totalRaces: this.state.totalRaces,
      completedRaces: this.state.currentRace,
      raceResults: this.state.pastResults.map((r) => ({
        raceNumber: r.raceNumber,
        winnerHorseId: r.winner.id,
        winnerHorseName: r.winner.name,
      })),
    };
  }

  /** Timer duration depends on the current phase (betting vs racing). */
  getTimerMs(): number {
    return this.state.phase === 'racing'
      ? this.state.config.racingTimeMs
      : this.state.config.bettingTimeMs;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private startBettingPhase(): GameEvent[] {
    this.state.currentRace += 1;
    this.state.phase = 'betting';
    this.state.bets.clear();
    // Reset horse positions for a fresh race
    this.state.horses = this.state.config.horses.map((h) => ({ ...h, position: 0 }));

    // Give each connected player their per-race budget
    for (const player of this.getAllPlayers()) {
      if (player.connected) {
        player.score += this.state.config.pointsPerRace;
      }
    }

    return [
      {
        type: 'race:betting_open',
        payload: {
          raceNumber: this.state.currentRace,
          totalRaces: this.state.totalRaces,
          horses: this.state.horses.map((h) => ({ id: h.id, name: h.name })),
          bettingTimeMs: this.state.config.bettingTimeMs,
          pointsPerRace: this.state.config.pointsPerRace,
        },
        target: 'all',
      },
    ];
  }

  private runRace(): GameEvent[] {
    this.state.phase = 'racing';
    this.state.raceStartTime = Date.now();

    // Reset horse positions to start line
    for (const horse of this.state.horses) {
      horse.position = 0;
    }

    // Assign random speeds to each horse (determines who wins)
    // Speed = how much position they gain per 100ms tick
    // Range: 0.8 - 1.5 per tick, so over ~10 seconds (100 ticks) they reach 80-150
    this.state.horseSpeeds.clear();
    for (const horse of this.state.horses) {
      const speed = 0.8 + Math.random() * 0.7; // 0.8 to 1.5
      this.state.horseSpeeds.set(horse.id, speed);
    }

    return [
      {
        type: 'race:started',
        payload: {
          raceNumber: this.state.currentRace,
          horses: this.state.horses,
          racingTimeMs: this.state.config.racingTimeMs,
        },
        target: 'all',
      },
    ];
  }

  /**
   * Enable ticking during the racing phase for live position updates.
   */
  override getTickInterval(): number | null {
    if (this.state.phase === 'racing') {
      return 100; // Update every 100ms
    }
    return null;
  }

  /**
   * Update horse positions during the race.
   */
  override onTick(_deltaMs: number): GameEvent[] | null {
    if (this.state.phase !== 'racing') {
      return null;
    }

    // Update each horse's position based on its speed
    for (const horse of this.state.horses) {
      if (horse.position < 100) {
        const speed = this.state.horseSpeeds.get(horse.id) ?? 1;
        // Add some randomness to each tick for excitement
        const jitter = 0.5 + Math.random(); // 0.5 - 1.5 multiplier
        horse.position = Math.min(100, horse.position + speed * jitter);
      }
    }

    const positionPayload = {
      horses: this.state.horses.map((h) => ({ id: h.id, name: h.name, position: Math.round(h.position) })),
    };

    // Emit position update to players (via WebRTC broadcast) and presenter separately
    const events: GameEvent[] = [
      { type: 'race:positions', payload: positionPayload, target: 'all' },
      { type: 'race:positions', payload: positionPayload, target: 'presenter' },
    ];

    // Check if ALL horses have finished (reached 100)
    const allHorsesFinished = this.state.horses.every((h) => h.position >= 100);

    if (allHorsesFinished) {
      // Finalize all horses at their current positions (order by finish)
      const sorted = [...this.state.horses].sort((a, b) => b.position - a.position);
      const winner = sorted[0];

      if (winner) {
        // Award winnings (2× the wager for picking the winning horse)
        for (const bet of this.state.bets.values()) {
          if (bet.horseId === winner.id) {
            const player = this.getPlayer(bet.playerId);
            if (player) {
              player.score += bet.amount * 2;
            }
          }
        }

        const result: RaceResult = {
          raceNumber: this.state.currentRace,
          winner,
          finalPositions: sorted,
        };
        this.state.pastResults.push(result);

        // Signal that race is complete (HostGameAuthority will wait 3s then show results)
        events.push({
          type: 'race:finished',
          payload: { winnerId: winner.id, winnerName: winner.name },
          target: 'all', // Broadcast to all so clients can show "race finished" state
        });
      }
    }

    return events;
  }

  private resolveResults(): GameEvent[] {
    this.state.phase = 'results';

    const lastResult = this.state.pastResults[this.state.pastResults.length - 1];
    if (!lastResult) return [];

    const leaderboard = this.getLeaderboard();

    const events: GameEvent[] = [
      {
        type: 'race:results',
        payload: {
          raceNumber: lastResult.raceNumber,
          winner: lastResult.winner,
          finalPositions: lastResult.finalPositions,
          leaderboard,
        },
        target: 'all',
      },
    ];

    // Tell each player individually whether they won
    for (const player of this.getAllPlayers()) {
      const bet = this.state.bets.get(player.id);
      const won = bet?.horseId === lastResult.winner.id;
      events.push({
        type: 'race:player_result',
        payload: {
          won,
          horseId: bet?.horseId ?? null,
          pointsChange: won ? (bet?.amount ?? 0) : -(bet?.amount ?? 0),
          newScore: player.score,
          rank: leaderboard.find((e) => e.id === player.id)?.rank ?? -1,
        },
        target: player.id,
      });
    }

    return events;
  }

  private finishGame(): GameEvent[] {
    this.state.phase = 'finished';
    const leaderboard = this.getLeaderboard();

    const events: GameEvent[] = [
      {
        type: 'game:leaderboard',
        payload: { rankings: leaderboard, isGameOver: true },
        target: 'presenter',
      },
    ];

    const topEntry = leaderboard[0];
    const winnerSummary = topEntry
      ? { displayName: topEntry.displayName, score: topEntry.score }
      : { displayName: 'Nobody', score: 0 };

    for (const player of this.getAllPlayers()) {
      const rank = leaderboard.find((e) => e.id === player.id)?.rank ?? -1;
      events.push({
        type: 'game:over',
        payload: {
          finalRank: rank,
          finalScore: player.score,
          winner: winnerSummary,
          totalPlayers: this.getPlayerCount(),
        },
        target: player.id,
      });
    }

    return events;
  }

  private getPlayerRank(playerId: string): number {
    return this.getLeaderboard().find((e) => e.id === playerId)?.rank ?? -1;
  }
}
