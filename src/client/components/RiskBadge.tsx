import { riskLabel } from "../utils/formatting";

export function RiskBadge({ level, score }: { level: string; score?: number }) {
  const tone = level === "high" || level === "medium" || level === "low" ? level : "info";
  return (
    <span className={`badge ${tone}`}>
      {riskLabel(level)}
      {typeof score === "number" ? ` ${score}` : ""}
    </span>
  );
}
