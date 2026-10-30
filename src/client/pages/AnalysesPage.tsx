import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listAnalyses } from "../api/analyses";
import { ApiClientError } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage } from "../components/ErrorMessage";
import { LoadingState } from "../components/LoadingState";
import { RiskBadge } from "../components/RiskBadge";
import type { AnalysisListResponse } from "../../shared/types";
import { formatWhen } from "../utils/dates";
import { contextLabel, reviewLabel } from "../utils/formatting";

export function AnalysesPage() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<AnalysisListResponse | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState(params.get("q") ?? "");
  const query = params.toString();
  useEffect(() => {
    setError("");
    setData(null);
    void listAnalyses(params).then(setData).catch((caught) => setError(caught instanceof ApiClientError ? caught.message : "The list failed."));
  }, [query, params]);

  function apply(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(params);
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    next.delete("offset");
    setParams(next);
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">History</p>
          <h1>Analyses</h1>
        </div>
      </header>
      <form className="filters" onSubmit={apply}>
        <label>Search
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Subject, sender, or filename" />
        </label>
        <label>Risk
          <select
            value={params.get("riskLevel") ?? ""}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              if (event.target.value) next.set("riskLevel", event.target.value);
              else next.delete("riskLevel");
              next.delete("offset");
              setParams(next);
            }}
          >
            <option value="">Any</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label>Review
          <select
            value={params.get("reviewStatus") ?? ""}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              if (event.target.value) next.set("reviewStatus", event.target.value);
              else next.delete("reviewStatus");
              next.delete("offset");
              setParams(next);
            }}
          >
            <option value="">Any</option>
            <option value="unreviewed">Unreviewed</option>
            <option value="needs_verification">Needs verification</option>
            <option value="benign_after_review">Benign after review</option>
          </select>
        </label>
        <button type="submit">Search</button>
      </form>
      {error ? <ErrorMessage message={error} /> : null}
      {!data && !error ? <LoadingState /> : null}
      {data && data.items.length === 0 ? <EmptyState title="No matching analyses">Adjust the filters or analyze an .eml file.</EmptyState> : null}
      {data && data.items.length > 0 ? (
        <section className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>When</th><th>From</th><th>Subject</th><th>Risk</th><th>Context</th><th>Review</th></tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatWhen(item.createdAt)}</td>
                    <td>{item.fromAddress ?? "Unknown"}</td>
                    <td><Link to={`/analyses/${item.id}`}>{item.subject || item.originalFilename}</Link></td>
                    <td><RiskBadge level={item.riskLevel} score={item.riskScore} /></td>
                    <td>{contextLabel(item.contextStatus)}</td>
                    <td>{reviewLabel(item.reviewStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="secondary" disabled={data.offset === 0} onClick={() => page(-data.limit)}>Previous</button>
            <span className="note">{data.offset + 1}-{Math.min(data.offset + data.items.length, data.total)} of {data.total}</span>
            <button type="button" className="secondary" disabled={data.offset + data.limit >= data.total} onClick={() => page(data.limit)}>Next</button>
          </div>
        </section>
      ) : null}
    </>
  );

  function page(delta: number) {
    const next = new URLSearchParams(params);
    const offset = Math.max(0, Number(params.get("offset") ?? "0") + delta);
    if (offset) next.set("offset", String(offset));
    else next.delete("offset");
    setParams(next);
  }
}
