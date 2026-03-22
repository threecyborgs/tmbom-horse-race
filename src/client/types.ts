/**
 * Horse Race wire-protocol types — the data shapes exchanged between the host
 * and player clients over the WebRTC data channel.
 */

export type { GameOverData } from "@threecyborgs/game-sdk";
import type { GameOverData } from "@threecyborgs/game-sdk";
import type { IGameClient } from "@threecyborgs/game-sdk";

/** A horse participating in a race. */
export interface Horse {
  id: string;
  name: string;
  /** 0–100 representing distance covered on the track. */
  position: number;
}

/** A bet placed by a player. */
export interface Bet {
  horseId: string;
  amount: number;
}

/** Result of a single race for a player. */
export interface RaceResult {
  won: boolean;
  pointsChange: number;
  newScore: number;
  rank: number;
}

/** Data sent when betting phase starts (from race:betting_open). */
export interface BettingOpenData {
  raceNumber: number;
  totalRaces: number;
  horses: { id: string; name: string }[];
  bettingTimeMs: number;
  pointsPerRace: number;
}

/**
 * Game phases from the player's perspective.
 */
export type HorseRacePhase =
  | "waiting"
  | "betting"
  | "racing"
  | "raceFinished"  // All horses crossed the line, waiting for results
  | "result"
  | "gameover";

/**
 * Complete horse race game state for a player.
 */
export interface HorseRaceState {
  /** Current game phase */
  phase: HorseRacePhase;

  /** Current race number */
  raceNumber: number;

  /** Total races in this game */
  totalRaces: number;

  /** Available horses to bet on */
  horses: Horse[];

  /** Order that horses finished (IDs in finish order, first = winner) */
  finishOrder: string[];

  /** Player's current bet for this race */
  myBet: Bet | null;

  /** True after placeBet called, false after server confirms */
  betPending: boolean;

  /** True when server has acknowledged the bet */
  betConfirmed: boolean;

  /** Result from last race */
  result: RaceResult | null;

  /** Winner info (set when race finishes, before full results) */
  winner: { id: string; name: string } | null;

  /** Player's current score */
  score: number;

  /** Player's current rank */
  rank: number;

  /** Game over data when game ends */
  gameOver: GameOverData | null;
}

/**
 * Actions available to the player.
 */
export interface HorseRaceActions extends Record<string, (...args: any[]) => void> {
  /** Place a bet on a horse */
  placeBet(horseId: string, amount: number): void;
}

/**
 * HorseRaceClient interface - pure game logic, no connection awareness.
 */
export interface IHorseRaceClient extends IGameClient<HorseRaceState> {
  /** Available actions (narrowed to horse-race-specific) */
  actions: HorseRaceActions;
}

/**
 * Initial state for a new horse race client.
 */
export const INITIAL_HORSE_RACE_STATE: HorseRaceState = {
  phase: "waiting",
  raceNumber: 0,
  totalRaces: 0,
  horses: [],
  finishOrder: [],
  myBet: null,
  betPending: false,
  betConfirmed: false,
  result: null,
  winner: null,
  score: 0,
  rank: 0,
  gameOver: null,
};
