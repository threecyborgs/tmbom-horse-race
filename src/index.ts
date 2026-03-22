/**
 * @tmbom/game-horse-race
 * 
 * Self-contained horse race game package containing:
 * - Engine: Server-side game logic (HorseRaceGame class)
 * - Client: Player-side client for UI integration
 * - DB: Horse race specific database tables (placeholder)
 * 
 * RECOMMENDED: Import from subpaths to avoid type conflicts:
 *   import { HorseRaceGame } from '@tmbom/game-horse-race/engine';
 *   import { createHorseRaceClient } from '@tmbom/game-horse-race/client';
 * 
 * The engine and client have different type definitions for Horse, Bet, etc.
 * (server-side vs wire protocol shapes).
 */

// Engine exports (server-side game logic)
export { HorseRaceGame } from './engine/index';
export type {
  HorseRaceConfig,
  HorseRaceState as EngineHorseRaceState,
  Horse as EngineHorse,
  Bet as EngineBet,
  RaceResult as EngineRaceResult,
  HorseRacePhase as EngineHorseRacePhase,
} from './engine/index';

// Client exports (player-side)
export { createHorseRaceClient } from './client/index';
export type {
  IHorseRaceClient,
  HorseRaceState as ClientHorseRaceState,
  HorseRaceActions,
  HorseRacePhase as ClientHorseRacePhase,
  Horse as ClientHorse,
  Bet as ClientBet,
  RaceResult as ClientRaceResult,
  BettingOpenData,
} from './client/index';
export { INITIAL_HORSE_RACE_STATE } from './client/index';

// No DB exports yet

// Game manifest for dynamic loading
export { manifest } from './manifest';
