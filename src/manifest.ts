/**
 * Horse Race game manifest.
 * Exports the complete game definition for dynamic loading.
 */

import type { GameManifest, IPresenterView, IPlayerView } from "@threecyborgs/game-sdk";
import { HorseRaceGame } from "./engine";
import { createHorseRaceClient } from "./client";
import { HORSE_RACE_PRESENTER_PHASES } from "./ui/presenter";
import { HORSE_RACE_PLAYER_PHASES } from "./ui/player";

export const manifest: GameManifest = {
  gameType: "horse-race",
  displayName: "Horse Race",
  description: "Bet on horses and watch them race! The best gamblers win.",
  icon: "🏇",
  minPlayers: 1,
  maxPlayers: 1000,

  presenterView: async (): Promise<IPresenterView> => {
    const { HorseRacePresenterView } = await import("./ui/presenter");
    return {
      component: HorseRacePresenterView,
      phases: [...HORSE_RACE_PRESENTER_PHASES],
    };
  },

  playerView: async (): Promise<IPlayerView> => {
    const { HorseRacePlayerView } = await import("./ui/player");
    return {
      component: HorseRacePlayerView,
      phases: [...HORSE_RACE_PLAYER_PHASES],
    };
  },

  engineFactory: (sessionId, config) => new HorseRaceGame(sessionId, config),

  clientFactory: (channel) => createHorseRaceClient(channel),

  defaultConfig: {
    timerMs: 20000,
    racesPerGame: 5,
    startingPoints: 100,
  },
};
