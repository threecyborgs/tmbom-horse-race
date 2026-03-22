import type { IPlayerChannel, JsonObject } from "../shims/transport-types";
import type { IHorseRaceClient, HorseRaceState, HorseRaceActions, RaceResult, Horse, GameOverData } from "./types";
import { INITIAL_HORSE_RACE_STATE } from "./types";

/**
 * Message types expected from the host.
 */
interface GameJoinedMessage {
  type: "game:joined";
}

interface RaceBettingOpenMessage {
  type: "race:betting_open";
  payload: {
    raceNumber: number;
    totalRaces: number;
    horses: { id: string; name: string }[];
    bettingTimeMs: number;
    pointsPerRace: number;
  };
}

interface BetAckMessage {
  type: "race:bet_ack";
  payload: { horseId: string; amount: number; newScore: number };
}

interface RaceStartedMessage {
  type: "race:started";
  payload: { raceNumber: number; horses: Horse[]; racingTimeMs: number };
}

interface RacePositionsMessage {
  type: "race:positions";
  payload: {
    horses: { id: string; name: string; position: number }[];
  };
}

interface RaceFinishedMessage {
  type: "race:finished";
  payload: {
    winnerId: string;
    winnerName: string;
  };
}

interface RaceResultsMessage {
  type: "race:results";
  payload: {
    raceNumber: number;
    winner: Horse;
    finalPositions: Horse[];
    leaderboard: { id: string; displayName: string; score: number; rank: number }[];
  };
}

interface RacePlayerResultMessage {
  type: "race:player_result";
  payload: {
    won: boolean;
    horseId: string | null;
    pointsChange: number;
    newScore: number;
    rank: number;
  };
}

interface GameOverMessage {
  type: "game:over";
  payload: GameOverData;
}

interface GameResetMessage {
  type: "game:reset";
}

interface StateSnapshotMessage {
  type: "session:state_snapshot";
  payload: {
    phase: string;
    currentRace?: number;
    totalRaces?: number;
    horses?: Horse[];
    timerMs?: number;
  };
}

type IncomingMessage =
  | GameJoinedMessage
  | RaceBettingOpenMessage
  | BetAckMessage
  | RaceStartedMessage
  | RacePositionsMessage
  | RaceFinishedMessage
  | RaceResultsMessage
  | RacePlayerResultMessage
  | GameOverMessage
  | GameResetMessage
  | StateSnapshotMessage;

/**
 * Creates a HorseRaceClient that manages player-side game state.
 *
 * The client is pure game logic - it doesn't know about:
 * - Connection state (connected/disconnected)
 * - Transport type (WebRTC, WebSocket, mock)
 * - Serialization format
 * - Channel names or priorities
 *
 * @param channel - The player channel from the bus
 * @returns A HorseRaceClient instance
 */
export function createHorseRaceClient(channel: IPlayerChannel): IHorseRaceClient {
  let state: HorseRaceState = { ...INITIAL_HORSE_RACE_STATE };
  const listeners = new Set<(state: HorseRaceState) => void>();
  let unsubscribe: (() => void) | null = null;

  const updateState = (patch: Partial<HorseRaceState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) {
      listener(state);
    }
  };

  const handleMessage = (msg: JsonObject) => {
    const message = msg as unknown as IncomingMessage;

    switch (message.type) {
      case "game:joined":
        updateState({ phase: "waiting" });
        break;

      case "race:betting_open":
        updateState({
          phase: "betting",
          raceNumber: message.payload.raceNumber,
          totalRaces: message.payload.totalRaces,
          horses: message.payload.horses.map(h => ({ ...h, position: 0 })),
          finishOrder: [], // Reset finish order for new race
          myBet: null,
          betPending: false,
          betConfirmed: false,
          result: null,
          winner: null,
        });
        break;

      case "race:bet_ack":
        updateState({
          betPending: false,
          betConfirmed: true,
          score: message.payload.newScore,
        });
        break;

      case "race:started":
        updateState({
          phase: "racing",
          horses: message.payload.horses,
        });
        break;

      case "race:positions": {
        // Live position updates during racing
        // Track finish order - when a horse reaches 100, add to finish order
        const newHorses = message.payload.horses;
        const currentFinishOrder = [...state.finishOrder];
        
        for (const horse of newHorses) {
          if (horse.position >= 100 && !currentFinishOrder.includes(horse.id)) {
            currentFinishOrder.push(horse.id);
          }
        }
        
        updateState({
          horses: newHorses,
          finishOrder: currentFinishOrder,
        });
        break;
      }

      case "race:finished":
        // All horses have crossed the line - show winner, wait for full results
        updateState({
          phase: "raceFinished",
          winner: { id: message.payload.winnerId, name: message.payload.winnerName },
        });
        break;

      case "race:results":
        // This is the broadcast results - just update positions
        updateState({
          horses: message.payload.finalPositions,
        });
        break;

      case "race:player_result":
        // This is the individual player result
        updateState({
          phase: "result",
          result: {
            won: message.payload.won,
            pointsChange: message.payload.pointsChange,
            newScore: message.payload.newScore,
            rank: message.payload.rank,
          },
          score: message.payload.newScore,
          rank: message.payload.rank,
        });
        break;

      case "game:over":
        updateState({
          phase: "gameover",
          gameOver: message.payload,
          score: message.payload.finalScore ?? state.score,
          rank: message.payload.finalRank ?? state.rank,
        });
        break;

      case "game:reset":
        updateState({
          ...INITIAL_HORSE_RACE_STATE,
        });
        break;

      case "session:state_snapshot":
        handleStateSnapshot(message.payload);
        break;

      default:
        break;
    }
  };

  const handleStateSnapshot = (snapshot: StateSnapshotMessage["payload"]) => {
    const { phase, currentRace, totalRaces, horses } = snapshot;

    if (phase === "betting" && horses) {
      updateState({
        phase: "betting",
        raceNumber: currentRace ?? state.raceNumber,
        totalRaces: totalRaces ?? state.totalRaces,
        horses,
        myBet: null,
        betPending: false,
        betConfirmed: false,
      });
    } else if (phase === "racing" && horses) {
      updateState({
        phase: "racing",
        horses,
      });
    } else if (phase === "lobby") {
      updateState({ phase: "waiting" });
    } else if (phase === "finished") {
      updateState({ phase: "gameover" });
    }
  };

  unsubscribe = channel.on(handleMessage);

  const actions: HorseRaceActions = {
    placeBet(horseId: string, amount: number) {
      updateState({
        myBet: { horseId, amount },
        betPending: true,
        betConfirmed: false,
      });

      // Send in the format the game engine expects (onPlayerAction receives { horseId, amount })
      channel.send({
        type: "player:action",
        payload: {
          horseId,
          amount,
        },
      });
    },
  };

  return {
    getState: () => state,

    subscribe(listener: (state: HorseRaceState) => void): () => void {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },

    actions,

    destroy() {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      listeners.clear();
    },
  };
}
