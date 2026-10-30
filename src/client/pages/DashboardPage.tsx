import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboard } from "../api/analyses";
import { ApiClientError } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage } from "../components/ErrorMessage";
import { LoadingState } from "../components/LoadingState";
import { RiskBadge } from "../components/RiskBadge";
import type { DashboardResponse } from "../../shared/types";
import { formatWhen } from "../utils/dates";
import { reviewLabel } from "../utils/formatting";

export function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void getDashboard().then(setData).catch((caught) => setError(caught instanceof ApiClientError ? caught.message : "Dashboard failed."));
  }, []);
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <LoadingState label="Loading dashboard" />;
  const empty = data.counts.totalAnalyzed === 0 && data.counts.vendorsTracked === 0;
  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">Workspace</p>
          <h1>Dashboard</h1>
          <p className="lede">Counts come from the investigation record. A score is a heuristic, not a fraud verdict.</p>
        </div>
        <Link className="button" to="/analyze">Analyze email</Link>
      </header>
      <section className="grid cards" aria-label="Summary">
        <article className="card"><span>Analyzed</span><strong>{data.counts.totalAnalyzed}</strong></article>
        <article className="card"><span>High</span><strong>{data.counts.highRisk}</strong></article>
        <article className="card"><span>Medium</span><strong>{data.counts.mediumRisk}</strong></article>
        <article className="card"><span>Needs review</span><strong>{data.counts.needsReview}</strong></article>
        <article className="card"><span>Vendors</span><strong>{data.counts.vendorsTracked}</strong></article>
      </section>
      {empty ? (
        <div className="stack">
          <EmptyState title="No investigations yet" action={{ to: "/settings", label: "Open settings" }}>
            Load the synthetic demo, or analyze an .eml file. Demo records use reserved example domains and are not evidence of real-world detection accuracy.
          </EmptyState>
        </div>
      ) : (
        <div className="stack">
          <section className="panel">
            <h2>High priority</h2>
            {data.highPriority.length === 0 ? <p className="note">No high-scoring analyses are stored.</p> : <AnalysisTable rows={data.highPriority} />}
          </section>
          <section className="panel">
            <h2>Recent analyses</h2>
            {data.recent.length === 0 ? <p className="note">No analyses yet.</p> : <AnalysisTable rows={data.recent} />}
          </section>
        </div>
      )}
    </>
  );
}

function AnalysisTable({ rows }: { rows: DashboardResponse["recent"] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>When</th><th>From</th><th>Subject</th><th>Risk</th><th>Review</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{formatWhen(row.createdAt)}</td>
              <td>{row.fromAddress ?? "Unknown"}</td>
              <td><Link to={`/analyses/${row.id}`}>{row.subject || row.originalFilename}</Link></td>
              <td><RiskBadge level={row.riskLevel} score={row.riskScore} /></td>
              <td>{reviewLabel(row.reviewStatus)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
