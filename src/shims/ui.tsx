/**
 * Shim for @tmbom/ui — minimal UI components used by this game.
 */

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  score: number;
}

export function Leaderboard({ rankings }: { rankings: LeaderboardEntry[] }) {
  return (
    <div className="w-full space-y-2">
      {rankings.map((entry) => (
        <div
          key={entry.rank}
          className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-400 w-6">#{entry.rank}</span>
            <span className="font-semibold text-white">{entry.displayName}</span>
          </div>
          <span className="font-bold text-purple-400">{entry.score} pts</span>
        </div>
      ))}
    </div>
  );
}
