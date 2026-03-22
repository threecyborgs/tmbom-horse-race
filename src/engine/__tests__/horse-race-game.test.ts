import { describe, it, expect, beforeEach } from 'vitest';
import { HorseRaceGame } from '../horse-race-game';
import type { PlayerState } from '@threecyborgs/game-sdk';

function makePlayer(id: string, name?: string): PlayerState {
  return {
    id,
    username: name ?? `user_${id}`,
    displayName: name ?? `User ${id}`,
    score: 0,
    connected: true,
  };
}

const SMALL_CONFIG = {
  totalRaces: 2,
  bettingTimeMs: 5000,
  racingTimeMs: 3000,
  pointsPerRace: 100,
};

describe('HorseRaceGame', () => {
  let game: HorseRaceGame;

  beforeEach(() => {
    game = new HorseRaceGame('test-session', SMALL_CONFIG);
  });

  // ── Identity ──────────────────────────────────────────────────────────────

  describe('game properties', () => {
    it('has correct gameType and displayName', () => {
      expect(game.gameType).toBe('horse-race');
      expect(game.displayName).toBe('Horse Race');
    });
  });

  // ── Lobby phase ───────────────────────────────────────────────────────────

  describe('lobby phase', () => {
    it('starts in lobby phase', () => {
      expect(game.getPhase()).toBe('lobby');
      expect(game.getPhaseCategory()).toBe('lobby');

      const state = game.getStateForPresenter() as Record<string, unknown>;
      expect(state.phase).toBe('lobby');
    });

    it('allows players to join', () => {
      const events = game.onPlayerJoin(makePlayer('p1', 'Alice'));
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('player:joined');
      expect(game.getPlayerCount()).toBe(1);
    });

    it('allows players to leave', () => {
      game.onPlayerJoin(makePlayer('p1'));
      const events = game.onPlayerLeave('p1');
      expect(events[0].type).toBe('player:left');
    });
  });

  // ── Game start / betting phase ────────────────────────────────────────────

  describe('start — betting phase', () => {
    beforeEach(() => {
      game.onPlayerJoin(makePlayer('p1', 'Alice'));
      game.onPlayerJoin(makePlayer('p2', 'Bob'));
    });

    it('transitions to betting phase and emits race:betting_open', () => {
      const events = game.onStart();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('race:betting_open');
      expect(events[0].target).toBe('all');

      expect(game.getPhase()).toBe('betting');
      expect(game.getPhaseCategory()).toBe('active');
    });

    it('credits each player with per-race points on start', () => {
      game.onStart();
      expect(game.getPlayer('p1')!.score).toBe(SMALL_CONFIG.pointsPerRace);
      expect(game.getPlayer('p2')!.score).toBe(SMALL_CONFIG.pointsPerRace);
    });

    it('includes race metadata in the betting_open payload', () => {
      const events = game.onStart();
      const payload = events[0].payload as Record<string, unknown>;
      expect(payload.raceNumber).toBe(1);
      expect(payload.totalRaces).toBe(SMALL_CONFIG.totalRaces);
      expect(Array.isArray(payload.horses)).toBe(true);
      expect(payload.bettingTimeMs).toBe(SMALL_CONFIG.bettingTimeMs);
    });

    it('exposes betting timer duration via getTimerMs()', () => {
      game.onStart();
      expect(game.getTimerMs()).toBe(SMALL_CONFIG.bettingTimeMs);
    });
  });

  // ── Betting ───────────────────────────────────────────────────────────────

  describe('placing bets', () => {
    beforeEach(() => {
      game.onPlayerJoin(makePlayer('p1', 'Alice'));
      game.onPlayerJoin(makePlayer('p2', 'Bob')); // Two players so single bet doesn't trigger all_bets_in
      game.onStart();
    });

    it('accepts a valid bet', () => {
      const events = game.onPlayerAction('p1', { horseId: 'lightning', amount: 50 });
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('race:bet_placed');
      expect(events[1].type).toBe('race:bet_ack');
      expect(events[1].target).toBe('p1');
    });

    it('emits game:all_bets_in when all players have bet', () => {
      game.onPlayerAction('p1', { horseId: 'lightning', amount: 50 });
      const events = game.onPlayerAction('p2', { horseId: 'thunder', amount: 50 });
      expect(events).toHaveLength(3);
      expect(events[2].type).toBe('game:all_bets_in');
    });

    it('deducts wager from player score', () => {
      game.onPlayerAction('p1', { horseId: 'lightning', amount: 50 });
      expect(game.getPlayer('p1')!.score).toBe(50); // 100 − 50
    });

    it('refunds previous bet when placing a new one', () => {
      game.onPlayerAction('p1', { horseId: 'lightning', amount: 60 });
      game.onPlayerAction('p1', { horseId: 'thunder', amount: 40 });
      // Should end up at 100 − 40 = 60 (60 was refunded, 40 deducted)
      expect(game.getPlayer('p1')!.score).toBe(60);
    });

    it('rejects bets outside the betting phase', () => {
      game.onTimerExpired(); // move to racing
      const events = game.onPlayerAction('p1', { horseId: 'lightning', amount: 10 });
      expect(events[0].type).toBe('game:error');
    });

    it('rejects bets for unknown horses', () => {
      const events = game.onPlayerAction('p1', { horseId: 'unicorn', amount: 10 });
      expect(events[0].type).toBe('game:error');
    });

    it('rejects bets from unknown players', () => {
      const events = game.onPlayerAction('nobody', { horseId: 'lightning', amount: 10 });
      expect(events[0].type).toBe('game:error');
    });

    it('clamps bet amount to [1, pointsPerRace]', () => {
      game.onPlayerAction('p1', { horseId: 'lightning', amount: 9999 });
      const remaining = game.getPlayer('p1')!.score;
      // Max bet is pointsPerRace (100), so score should be 100 − 100 = 0
      expect(remaining).toBe(0);
    });
  });

  // ── Timer expiration → race runs ──────────────────────────────────────────

  describe('timer expiration — betting phase', () => {
    beforeEach(() => {
      game.onPlayerJoin(makePlayer('p1', 'Alice'));
      game.onStart();
      game.onPlayerAction('p1', { horseId: 'lightning', amount: 50 });
    });

    it('transitions to racing phase and emits race:started', () => {
      const events = game.onTimerExpired();
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('race:started');
      expect(game.getPhase()).toBe('racing');
      expect(game.getPhaseCategory()).toBe('active');
    });

    it('uses racingTimeMs for timer after betting expires', () => {
      game.onTimerExpired(); // move to racing
      expect(game.getTimerMs()).toBe(SMALL_CONFIG.racingTimeMs);
    });
  });

  // ── Racing phase with live ticks ─────────────────────────────────────────────

  describe('racing phase with ticks', () => {
    beforeEach(() => {
      game.onPlayerJoin(makePlayer('p1', 'Alice'));
      game.onPlayerJoin(makePlayer('p2', 'Bob'));
      game.onStart();
      game.onPlayerAction('p1', { horseId: 'lightning', amount: 50 });
      game.onTimerExpired(); // betting → racing
    });

    it('enables tick interval during racing', () => {
      expect(game.getTickInterval()).toBe(100);
    });

    it('emits position updates on tick', () => {
      const events = game.onTick(100);
      expect(events).toBeDefined();
      expect(events!.length).toBeGreaterThan(0);
      expect(events![0].type).toBe('race:positions');
    });

    it('finishes race when a horse reaches 100 and transitions to results', () => {
      // Tick until race finishes (horses gradually move to 100+)
      let allEvents: ReturnType<typeof game.onTick> = [];
      let raceFinished = false;
      for (let i = 0; i < 200 && !raceFinished; i++) {
        const events = game.onTick(100);
        if (events) {
          allEvents = events;
          if (events.some(e => e.type === 'race:finished')) {
            raceFinished = true;
          }
        }
      }
      expect(raceFinished).toBe(true);
      expect(allEvents.some(e => e.type === 'race:finished')).toBe(true);
    });

    it('sends race:results and race:player_result after race finishes via onTimerExpired', () => {
      // First tick the race to completion
      for (let i = 0; i < 200; i++) {
        const events = game.onTick(100);
        if (events?.some(e => e.type === 'race:finished')) break;
      }
      
      // Now call onTimerExpired to transition to results phase
      const events = game.onTimerExpired();
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('race:results');
      expect(game.getPhase()).toBe('results');
      expect(game.getPhaseCategory()).toBe('reveal');
      
      const p1Result = events.find((e) => e.type === 'race:player_result' && e.target === 'p1');
      const p2Result = events.find((e) => e.type === 'race:player_result' && e.target === 'p2');
      expect(p1Result).toBeDefined();
      expect(p2Result).toBeDefined();
    });
  });

  // ── nextRound ─────────────────────────────────────────────────────────────

  describe('nextRound', () => {
    function completeOneRace() {
      game.onStart();
      game.onTimerExpired(); // betting → racing
      // Tick until race finishes
      for (let i = 0; i < 200; i++) {
        const events = game.onTick(100);
        if (events?.some(e => e.type === 'race:finished')) break;
      }
      game.onTimerExpired(); // racing → results
    }

    it('starts a new betting phase', () => {
      game.onPlayerJoin(makePlayer('p1', 'Alice'));
      completeOneRace();

      const events = game.nextRound();
      expect(events[0].type).toBe('race:betting_open');
      expect(game.getPhase()).toBe('betting');
      expect(game.getPhaseCategory()).toBe('active');
    });

    it('tracks current race number', () => {
      game.onPlayerJoin(makePlayer('p1'));
      completeOneRace();

      game.nextRound();
      expect(game.getCurrentRoundNumber()).toBe(2);
    });

    it('finishes the game after all races', () => {
      game.onPlayerJoin(makePlayer('p1', 'Alice'));

      // Complete race 1
      completeOneRace();
      game.nextRound(); // race 2 starts

      // Complete race 2
      game.onTimerExpired();
      game.onTimerExpired();

      // All totalRaces (2) are done → game over
      const events = game.nextRound();
      expect(events[0].type).toBe('game:leaderboard');
      expect(game.getPhase()).toBe('finished');
      expect(game.getPhaseCategory()).toBe('finished');
    });
  });

  // ── Leaderboard ───────────────────────────────────────────────────────────

  describe('leaderboard', () => {
    it('is sorted by score descending', () => {
      game.onPlayerJoin(makePlayer('p1', 'Alice'));
      game.onPlayerJoin(makePlayer('p2', 'Bob'));
      game.onStart();

      // Manually set scores to make the assertion deterministic
      game.getPlayer('p1')!.score = 300;
      game.getPlayer('p2')!.score = 100;

      const lb = game.getLeaderboard();
      expect(lb[0].id).toBe('p1');
      expect(lb[0].rank).toBe(1);
      expect(lb[1].id).toBe('p2');
      expect(lb[1].rank).toBe(2);
    });
  });

  // ── State snapshots ───────────────────────────────────────────────────────

  describe('getStateForPlayer', () => {
    it('returns null for unknown players', () => {
      expect(game.getStateForPlayer('nobody')).toBeNull();
    });

    it('includes player-specific bet and score', () => {
      game.onPlayerJoin(makePlayer('p1'));
      game.onStart();
      game.onPlayerAction('p1', { horseId: 'lightning', amount: 30 });

      const state = game.getStateForPlayer('p1') as Record<string, unknown>;
      expect(state.score).toBe(70); // 100 − 30
      expect((state.myBet as Record<string, unknown>).horseId).toBe('lightning');
    });
  });

});
