import { STATUS_COLORS } from "~~/lib/constants";

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const bgColor = STATUS_COLORS[status] || "bg-[#8b949e]";
  return (
    <span className={`status-badge ${bgColor}`}>
      {status}
    </span>
  );
};
