"use client";

import { useState, useEffect } from "react";
import { timeRemaining } from "~~/lib/utils";

interface CountdownTimerProps {
  deadline: number;
  label?: string;
}

export const CountdownTimer = ({ deadline, label }: CountdownTimerProps) => {
  const [remaining, setRemaining] = useState(timeRemaining(deadline));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(timeRemaining(deadline));
    }, 30000);
    return () => clearInterval(interval);
  }, [deadline]);

  const isEnded = remaining === "Ended";

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {label && <span style={{ color: "#8b949e" }}>{label}</span>}
      <span
        className="font-medium"
        style={{ color: isEnded ? "#f85149" : "#e6edf3" }}
      >
        {remaining}
      </span>
    </div>
  );
};
