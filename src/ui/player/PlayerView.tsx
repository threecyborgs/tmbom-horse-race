"use client";

import { useState } from "react";
import type { PlayerViewProps } from "@threecyborgs/game-sdk";
import type { HorseRaceState } from "../../client/types";
import type { GameOverData } from "../types";
import { HorseTrack } from "../shared/HorseTrack";

/**
 * Horse Race player view component.
 * Handles all horse race game phases for the player's mobile device.
 */
export function HorseRacePlayerView({ state, actions }: PlayerViewProps) {
  // Cast generic state to horse-race specific state
  const hrState = (state as unknown as { gameData?: HorseRaceState })?.gameData ?? null;
  // Use hrState phase if available (more accurate for horse-race specific phases)
  const gamePhase = hrState?.phase ?? state.phase;
  const score = hrState?.score ?? state.score;
  const rank = hrState?.rank ?? state.rank;
  const gameOver = state.gameOver;

  const horses = hrState?.horses ?? [];
  const raceNumber = hrState?.raceNumber ?? 1;
  const totalRaces = hrState?.totalRaces ?? 5;
  const myBet = hrState?.myBet ?? null;
  const betConfirmed = hrState?.betConfirmed ?? false;
  const result = hrState?.result ?? null;
  const winner = hrState?.winner ?? null;
  const finishOrder = hrState?.finishOrder ?? [];


  const [selectedHorse, setSelectedHorse] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<number>(50);

  const handlePlaceBet = () => {
    if (selectedHorse && actions.placeBet) {
      actions.placeBet(selectedHorse, betAmount);
    }
  };

  // Betting phase
  if (gamePhase === "betting") {
    return (
      <div className="w-full max-w-md text-center">
        <div className="mb-4">
          <span className="text-xs font-medium text-purple-400 uppercase tracking-wide">
            Race {raceNumber} of {totalRaces}
          </span>
        </div>
        
        <h2 className="text-xl font-bold text-white mb-4">Place Your Bet!</h2>
        
        {!betConfirmed ? (
          <>
            <div className="space-y-2 mb-6">
              {horses.map((horse) => (
                <button
                  key={horse.id}
                  onClick={() => setSelectedHorse(horse.id)}
                  className={`w-full p-3 rounded-lg border-2 transition-all ${
                    selectedHorse === horse.id
                      ? "border-purple-500 bg-purple-600/20 text-white"
                      : "border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600"
                  }`}
                >
                  🏇 {horse.name}
                </button>
              ))}
            </div>
            
            <div className="mb-4">
              <label className="text-sm text-gray-400 block mb-2">Bet Amount</label>
              <div className="flex items-center justify-center gap-2">
                {[25, 50, 75, 100].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setBetAmount(amount)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      betAmount === amount
                        ? "bg-purple-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>
            
            <button
              onClick={handlePlaceBet}
              disabled={!selectedHorse}
              className="w-full py-3 bg-purple-600 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700 transition-colors"
            >
              Place Bet ({betAmount} pts)
            </button>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✓</span>
            </div>
            <p className="text-white font-bold">Bet Placed!</p>
            <p className="text-gray-400">
              {myBet?.amount} pts on {horses.find(h => h.id === myBet?.horseId)?.name}
            </p>
          </div>
        )}
        
        <p className="text-gray-400 mt-4">Score: {score}</p>
      </div>
    );
  }

  // Racing phase (includes raceFinished and result to keep horses visible)
  if (gamePhase === "racing" || gamePhase === "raceFinished" || gamePhase === "result") {
    const isFinished = gamePhase === "raceFinished" || gamePhase === "result";
    
    return (
      <div style={{ width: '100%', maxWidth: '400px', margin: '0 auto', padding: '16px' }}>
        <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center' }}>
          {isFinished ? "🏁 Race Complete!" : "Race in Progress!"}
        </h2>
        
        <HorseTrack
          horses={horses}
          finishOrder={finishOrder}
          highlightedHorseId={myBet?.horseId ?? null}
        />
        
        {myBet && !result && (
          <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: '16px' }}>
            Your bet: {myBet.amount} pts on {horses.find(h => h.id === myBet.horseId)?.name}
          </p>
        )}
        
        {/* Show result inline when race is finished */}
        {result && (
          <div style={{ 
            marginTop: '16px', 
            padding: '16px', 
            backgroundColor: result.won ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            border: `2px solid ${result.won ? '#22c55e' : '#ef4444'}`,
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>
              {result.won ? '🎉' : '😢'}
            </div>
            <p style={{ 
              color: result.won ? '#22c55e' : '#ef4444', 
              fontWeight: 'bold',
              fontSize: '18px',
              marginBottom: '8px'
            }}>
              {result.won ? 'You Won!' : 'Better Luck Next Time'}
            </p>
            <p style={{ 
              color: result.pointsChange >= 0 ? '#22c55e' : '#ef4444',
              fontWeight: 'bold',
              fontSize: '24px'
            }}>
              {result.pointsChange >= 0 ? '+' : ''}{result.pointsChange} pts
            </p>
            <p style={{ color: '#9ca3af', marginTop: '8px' }}>
              Score: {score} • Rank #{result.rank}
            </p>
            <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '8px' }}>
              Waiting for next race...
            </p>
          </div>
        )}
      </div>
    );
  }

  // Game over phase
  if (gamePhase === "gameover" && gameOver) {
    return <GameOverPhase gameOver={gameOver} rank={rank} score={score} />;
  }

  // Default / unknown phase
  return (
    <div className="text-center">
      <h2 className="text-xl font-bold text-white mb-2">Horse Race</h2>
      <p className="text-gray-400">Phase: {gamePhase}</p>
      <p className="text-gray-400">Score: {score}</p>
    </div>
  );
}

function GameOverPhase({
  gameOver,
  rank,
  score,
}: {
  gameOver: GameOverData;
  rank: number;
  score: number;
}) {
  const isWinner = gameOver.finalRank === 1;

  return (
    <div className="text-center w-full max-w-md">
      <h2 className="text-3xl font-extrabold text-white mb-2">Race Day Over!</h2>

      {isWinner ? (
        <p className="text-2xl font-bold text-yellow-400 mb-4">You're the Top Bettor!</p>
      ) : (
        <p className="text-lg text-gray-400 mb-4">
          Top Bettor: <span className="text-white font-semibold">{gameOver.winner.displayName}</span>{" "}
          with {gameOver.winner.score} pts
        </p>
      )}

      <div className="bg-gray-800 rounded-2xl p-6 space-y-3">
        <div>
          <p className="text-gray-400 text-sm">Your Rank</p>
          <p className="text-3xl font-bold text-purple-400">
            #{gameOver.finalRank}{" "}
            <span className="text-base text-gray-500">of {gameOver.totalPlayers}</span>
          </p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Final Score</p>
          <p className="text-2xl font-bold text-white">{gameOver.finalScore}</p>
        </div>
      </div>

      <p className="mt-6 text-gray-500 text-sm">Stay put — next game starting soon!</p>
    </div>
  );
}

/** Phases supported by the horse race player view */
export const HORSE_RACE_PLAYER_PHASES = [
  "betting",
  "racing",
  "result",
  "gameover",
] as const;
