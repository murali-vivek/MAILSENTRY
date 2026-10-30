import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { addToHistory, getAnalysis, reviewAnalysis } from "../api/analyses";
import { ApiClientError } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ErrorMessage } from "../components/ErrorMessage";
import { FindingCard } from "../components/FindingCard";
import { LoadingState } from "../components/LoadingState";
import { RiskBadge } from "../components/RiskBadge";
import type { AnalysisDetail, ReviewStatus } from "../../shared/types";
import { formatList, formatWhen } from "../utils/dates";
import { contextLabel, formatAuth, reviewLabel } from "../utils/formatting";

export function AnalysisDetailPage() {
  const { id = "" } = useParams();
  const [detail, setDetail] = useState<AnalysisDetail | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<ReviewStatus>("needs_verification");
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    setDetail(null);
    setError("");
    void getAnalysis(id).then((next) => {
      setDetail(next);
      setStatus(next.reviewStatus === "unreviewed" ? "needs_verification" : next.reviewStatus);
    }).catch((caught) => setError(caught instanceof ApiClientError ? caught.message : "Analysis not found."));
  }, [id]);

  async function saveReview() {
    setPending(true);
    setError("");
    try {
      setDetail(await reviewAnalysis(id, status, note));
      setNote("");
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Review could not be saved.");
    } finally {
      setPending(false);
    }
  }

  async function confirmHistory() {
    setPending(true);
    setError("");
    try {
      await addToHistory(id);
      setDetail(await getAnalysis(id));
      setConfirm(false);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "History update failed.");
      setConfirm(false);
    } finally {
      setPending(false);
    }
  }

  if (error && !detail) return <ErrorMessage message={error} />;
  if (!detail) return <LoadingState label="Loading analysis" />;
  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">Analysis {detail.analysisVersion}</p>
          <h1>{detail.subject || detail.originalFilename}</h1>
          <p className="lede">{detail.summary}</p>
        </div>
        <RiskBadge level={detail.riskLevel} score={detail.riskScore} />
      </header>
      {error ? <ErrorMessage message={error} /> : null}
      <section className="panel">
        <div className="row" style={{ marginBottom: 12 }}>
          <span className="badge info">{contextLabel(detail.contextStatus)}</span>
          <span className="badge info">{reviewLabel(detail.reviewStatus)}</span>
          <span className="badge info">{detail.vendorMatchStatus}</span>
        </div>
        <dl className="meta">
          <dt>From</dt><dd>{detail.fromDisplayName ? `${detail.fromDisplayName} ` : ""}{detail.fromAddress ?? "Unknown"}</dd>
          <dt>Domain</dt><dd>{detail.senderDomain ?? "Unknown"}</dd>
          <dt>Reply-To</dt><dd>{formatList(detail.replyToAddresses)}</dd>
          <dt>To</dt><dd>{formatList(detail.toAddresses)}</dd>
          <dt>Cc</dt><dd>{formatList(detail.ccAddresses)}</dd>
          <dt>Received</dt><dd>{formatWhen(detail.receivedAt)}</dd>
          <dt>Imported</dt><dd>{formatWhen(detail.importedAt)}</dd>
          <dt>Vendor</dt><dd>{detail.vendorId ? <Link to={`/vendors/${detail.vendorId}`}>{detail.vendorName}</Link> : "None"}</dd>
          <dt>Categories</dt><dd>{formatList(detail.requestCategories)}</dd>
          <dt>Source IPs</dt><dd>{formatList(detail.observedSourceIps)}</dd>
          <dt>Reported auth</dt><dd>{formatAuth(detail.authenticationResults)}. These values were read from the file and were not independently checked.</dd>
          <dt>HTML body</dt><dd>{detail.bodyHtmlPresent ? "Present, stripped, and not rendered." : "No HTML part recorded."}</dd>
        </dl>
      </section>
      <section className="stack">
        <h2>Next steps</h2>
        <ul>{detail.recommendations.map((item) => <li key={item}>{item}</li>)}</ul>
        <h2>Findings</h2>
        <div className="findings">
          {detail.findings.length === 0 ? <p className="note">No triggered findings or important unknowns were stored.</p> : detail.findings.map((finding) => <FindingCard key={finding.id} finding={finding} />)}
        </div>
      </section>
      <section className="panel">
        <h2>Review</h2>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label>Status
            <select value={status} onChange={(event) => setStatus(event.target.value as ReviewStatus)}>
              <option value="unreviewed">Unreviewed</option>
              <option value="needs_verification">Needs verification</option>
              <option value="benign_after_review">Benign after review</option>
            </select>
          </label>
          <label className="span-2">Note
            <textarea value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
          </label>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" onClick={() => void saveReview()} disabled={pending}>Save review</button>
          <button type="button" className="secondary" disabled={!detail.historyEligibility.eligible || pending} title={detail.historyEligibility.reasons.join(" ")} onClick={() => setConfirm(true)}>
            Add to vendor history after verification
          </button>
        </div>
        {detail.historyEligibility.reasons.length > 0 ? <p className="note">{detail.historyEligibility.reasons.join(" ")}</p> : <p className="note">This message can be added to the matched vendor baseline.</p>}
        <h3 style={{ marginTop: 16 }}>Review history</h3>
        {detail.reviewHistory.length === 0 ? <p className="note">No review events yet.</p> : (
          <ul>{detail.reviewHistory.map((event) => <li key={event.id}>{formatWhen(event.createdAt)}: {reviewLabel(event.previousStatus)} → {reviewLabel(event.newStatus)}{event.note ? ` — ${event.note}` : ""}</li>)}</ul>
        )}
      </section>
      {confirm ? (
        <ConfirmDialog
          title="Add to vendor history?"
          body="This records the sender, recipients, categories, and source addresses as an eligible observation. It does not make a bank-detail change normal."
          confirmLabel="Add to history"
          pending={pending}
          onCancel={() => setConfirm(false)}
          onConfirm={() => void confirmHistory()}
        />
      ) : null}
    </>
  );
}
