/**
 * Horse Race UI types.
 * These are the data shapes that the presenter and player views consume.
 */

/** Horse data for display */
export interface Horse {
  id: string;
  name: string;
  position: number;
}

/** Bet data */
export interface Bet {
  horseId: string;
  amount: number;
}

/** Race result data */
export interface RaceResult {
  raceNumber: number;
  winnerId: string;
  winnerName: string;
  playerBet: Bet | null;
  won: boolean;
  pointsChange: number;
  newScore: number;
}

/** Leaderboard data sent to the presenter */
export interface LeaderboardData {
  rankings: {
    rank: number;
    playerId: string;
    displayName: string;
    score: number;
  }[];
  isGameOver: boolean;
}

/** Game over data sent to a player */
export interface GameOverData {
  finalRank: number;
  finalScore: number;
  winner: {
    displayName: string;
    score: number;
  };
  totalPlayers: number;
}
