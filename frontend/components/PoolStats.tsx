interface PoolStatsProps {
  totalBets: number;
  yesCount: number;
  noCount: number;
  poolBalance?: string;
  hideVotes?: boolean;
}

export const PoolStats = ({ totalBets, yesCount, noCount, poolBalance, hideVotes }: PoolStatsProps) => {
  const yesPercent = totalBets > 0 ? Math.round((yesCount / totalBets) * 100) : 50;
  const noPercent = 100 - yesPercent;

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex gap-0.5 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#30363d" }}>
        {hideVotes ? (
          <div
            className="h-full w-full transition-all duration-500"
            style={{ backgroundColor: "#58a6ff", opacity: 0.4 }}
          />
        ) : totalBets > 0 ? (
          <>
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${yesPercent}%`, backgroundColor: "#3fb950" }}
            />
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${noPercent}%`, backgroundColor: "#f85149" }}
            />
          </>
        ) : (
          <>
            <div className="h-full w-1/2" style={{ backgroundColor: "#3fb950", opacity: 0.3 }} />
            <div className="h-full w-1/2" style={{ backgroundColor: "#f85149", opacity: 0.3 }} />
          </>
        )}
      </div>

      {/* Stats row */}
      <div className="flex justify-between text-xs">
        <div className="flex items-center gap-3">
          {hideVotes ? (
            <span style={{ color: "#8b949e" }}>Votes hidden until reveal</span>
          ) : (
            <>
              <span style={{ color: "#3fb950" }}>YES {yesCount}</span>
              <span style={{ color: "#f85149" }}>NO {noCount}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3" style={{ color: "#8b949e" }}>
          <span>{totalBets} bets</span>
          {poolBalance && <span>{poolBalance}</span>}
        </div>
      </div>
    </div>
  );
};
