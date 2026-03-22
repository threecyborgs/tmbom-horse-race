"use client";

import type { PresenterViewProps } from "@threecyborgs/game-sdk";
import { Leaderboard } from "../../shims/ui";
import type { LeaderboardData, Horse } from "../types";

/**
 * Horse Race presenter view component.
 * Handles all horse race game phases for the presenter/host display.
 */
export function HorseRacePresenterView({
  gameState,
  presenterEvents,
}: PresenterViewProps) {
  const phase = gameState.phase;

  // Extract horse-race specific data from the generic game state
  const horses = (gameState.data.horses ?? []) as Horse[];
  const raceNumber = (gameState.data.currentRace ?? 0) as number;
  const totalRaces = (gameState.data.totalRaces ?? 5) as number;
  const leaderboardData = presenterEvents["game:leaderboard"] as LeaderboardData | undefined;

  // Betting phase
  if (phase === "betting") {
    return (
      <BettingPhaseDisplay 
        horses={horses} 
        raceNumber={raceNumber} 
        totalRaces={totalRaces}
        playerCount={gameState.playerCount}
      />
    );
  }

  // Racing phase
  if (phase === "racing") {
    return (
      <RacingPhaseDisplay 
        horses={horses}
        raceNumber={raceNumber}
        totalRaces={totalRaces}
      />
    );
  }

  // Results phase (showing race outcome)
  if (phase === "results") {
    const sortedHorses = [...horses].sort((a, b) => b.position - a.position);
    const winner = sortedHorses[0];
    return (
      <ResultPhaseDisplay 
        horses={horses}
        winner={winner}
        raceNumber={raceNumber}
      />
    );
  }

  // Finished phase (game over)
  if (phase === "finished" && leaderboardData) {
    return <FinishedDisplay leaderboardData={leaderboardData} />;
  }

  // Default / unknown phase
  return (
    <div className="flex items-center justify-center">
      <p className="text-gray-500 text-xl">Horse Race — Phase: {phase}</p>
    </div>
  );
}

function BettingPhaseDisplay({ 
  horses, 
  raceNumber, 
  totalRaces,
  playerCount 
}: { 
  horses: Horse[]; 
  raceNumber: number; 
  totalRaces: number;
  playerCount: number;
}) {
  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-4xl mx-auto px-4">
      <div className="text-center">
        <span className="text-sm uppercase tracking-widest text-gray-400">
          Race {raceNumber} of {totalRaces}
        </span>
        <h2 className="font-display text-5xl md:text-7xl font-bold mt-2 text-white">
          Place Your Bets!
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
        {horses.map((horse) => (
          <div
            key={horse.id}
            className="bg-white/5 border border-white/10 rounded-xl p-6 text-center"
          >
            <span className="text-4xl mb-2 block">🏇</span>
            <p className="font-bold text-white text-lg">{horse.name}</p>
          </div>
        ))}
      </div>

      <p className="text-gray-400 text-lg">
        <span className="font-semibold text-white">{playerCount}</span> players betting
      </p>
    </div>
  );
}

function RacingPhaseDisplay({ 
  horses,
  raceNumber,
  totalRaces 
}: { 
  horses: Horse[];
  raceNumber: number;
  totalRaces: number;
}) {
  const sortedHorses = [...horses].sort((a, b) => b.position - a.position);

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-4xl mx-auto px-4">
      <div className="text-center">
        <span className="text-sm uppercase tracking-widest text-gray-400">
          Race {raceNumber} of {totalRaces}
        </span>
        <h2 className="font-display text-5xl md:text-7xl font-bold mt-2 text-white">
          Race in Progress!
        </h2>
      </div>

      <div className="w-full space-y-4">
        {sortedHorses.map((horse, idx) => (
          <div key={horse.id} className="flex items-center gap-4">
            <span className="text-2xl w-8">
              {idx === 0 && "🥇"}
              {idx === 1 && "🥈"}
              {idx === 2 && "🥉"}
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-white">{horse.name}</span>
                <span className="text-gray-400">{horse.position}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                  style={{ width: `${horse.position}%` }}
                />
              </div>
            </div>
            <span className="text-3xl">🏇</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultPhaseDisplay({
  horses,
  winner,
  raceNumber,
}: {
  horses: Horse[];
  winner: Horse | undefined;
  raceNumber: number;
}) {
  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-4xl mx-auto px-4">
      <div className="text-center">
        <h2 className="font-display text-6xl md:text-8xl font-bold text-yellow-400 drop-shadow-lg">
          Race {raceNumber} Complete!
        </h2>
      </div>

      {winner && (
        <div className="flex flex-col items-center gap-4 animate-scale-in">
          <span className="text-6xl">🏆</span>
          <p className="text-2xl text-gray-300">Winner</p>
          <p className="font-display text-5xl font-bold text-white">{winner.name}</p>
        </div>
      )}

      <div className="w-full space-y-2 mt-4">
        {[...horses].sort((a, b) => b.position - a.position).map((horse, idx) => (
          <div
            key={horse.id}
            className={`flex items-center justify-between p-4 rounded-xl ${
              horse.id === winner?.id
                ? "bg-yellow-500/20 ring-2 ring-yellow-400"
                : "bg-white/5"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-gray-400">#{idx + 1}</span>
              <span className="font-bold text-white">{horse.name}</span>
            </div>
            <span className="text-2xl">🏇</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinishedDisplay({ leaderboardData }: { leaderboardData: LeaderboardData }) {
  const winner = leaderboardData.rankings[0];
  return (
    <div className="flex flex-col items-center gap-8 animate-fade-in">
      <h2 className="font-display text-6xl md:text-8xl font-bold text-yellow-400 drop-shadow-lg">
        Race Day Complete!
      </h2>
      {winner && (
        <div className="flex flex-col items-center gap-3 animate-scale-in">
          <img src="/icons/trophy.svg" alt="" width={64} height={64} className="invert drop-shadow-lg" />
          <p className="text-2xl text-gray-300">Top Bettor</p>
          <p className="font-display text-5xl font-bold text-white">{winner.displayName}</p>
          <p className="text-xl text-yellow-400 font-semibold">{winner.score} pts</p>
        </div>
      )}
      <div className="w-full max-w-3xl">
        <Leaderboard
          rankings={leaderboardData.rankings.slice(0, 10).map((r) => ({
            rank: r.rank,
            displayName: r.displayName,
            score: r.score,
          }))}
        />
      </div>
    </div>
  );
}

/** Phases supported by the horse race presenter view */
export const HORSE_RACE_PRESENTER_PHASES = [
  "betting",
  "racing",
  "results",
  "finished",
] as const;
