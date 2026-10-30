import type { FindingResponse } from "../../shared/types";

export function FindingCard({ finding }: { finding: FindingResponse }) {
  const tone = finding.severity === "high" || finding.severity === "medium" || finding.severity === "low" ? finding.severity : "info";
  return (
    <article className={`panel finding ${tone}`}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3>{finding.title}</h3>
        <span className={`badge ${tone}`}>{finding.status.replaceAll("_", " ")} · weight {finding.weight}</span>
      </div>
      <p style={{ marginTop: 8 }}><strong>Evidence. </strong>{finding.evidence}</p>
      <p className="note" style={{ marginTop: 6 }}>{finding.explanation}</p>
      <p className="note" style={{ marginTop: 6 }}><strong>Limitation. </strong>{finding.limitation}</p>
      <p style={{ marginTop: 8 }}>{finding.recommendation}</p>
    </article>
  );
}
