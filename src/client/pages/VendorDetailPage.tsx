import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { getVendor, updateVendor } from "../api/vendors";
import { ApiClientError } from "../api/client";
import { ErrorMessage } from "../components/ErrorMessage";
import { LoadingState } from "../components/LoadingState";
import { RiskBadge } from "../components/RiskBadge";
import type { VendorDetail } from "../../shared/types";
import { formatList, formatWhen } from "../utils/dates";
import { baselineLabel } from "../utils/formatting";
import { readVendorForm, } from "./VendorsPage";
import { VendorForm } from "./VendorForm";

export function VendorDetailPage() {
  const { id = "" } = useParams();
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);

  function reload() {
    setError("");
    void getVendor(id).then(setVendor).catch((caught) => setError(caught instanceof ApiClientError ? caught.message : "Vendor not found."));
  }
  useEffect(reload, [id]);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await updateVendor(id, readVendorForm(new FormData(event.currentTarget)));
      setEditing(false);
      reload();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Vendor could not be saved.");
    } finally {
      setPending(false);
    }
  }

  if (error && !vendor) return <ErrorMessage message={error} />;
  if (!vendor) return <LoadingState label="Loading vendor" />;
  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">{vendor.isDemo ? "Synthetic vendor" : "Vendor"}</p>
          <h1>{vendor.displayName}</h1>
          <p className="lede">{baselineLabel(vendor.baselineStatus)} baseline · {vendor.historyEmailCount} eligible observations.</p>
        </div>
        <button type="button" className="secondary" onClick={() => setEditing((value) => !value)}>{editing ? "Close editor" : "Edit vendor"}</button>
      </header>
      {error ? <ErrorMessage message={error} /> : null}
      <section className="panel">
        <dl className="meta">
          <dt>Domain</dt><dd>{vendor.canonicalDomain ?? "None"}</dd>
          <dt>Sender addresses</dt><dd>{formatList(vendor.senderAddresses)}</dd>
          <dt>Sender domains</dt><dd>{formatList(vendor.domains)}</dd>
          <dt>Internal recipients</dt><dd>{formatList(vendor.internalRecipients)}</dd>
          <dt>First seen</dt><dd>{formatWhen(vendor.firstSeenAt)}</dd>
          <dt>Last seen</dt><dd>{formatWhen(vendor.lastSeenAt)}</dd>
        </dl>
      </section>
      {editing && vendor ? <section className="panel"><h2>Edit identities</h2><VendorForm vendor={vendor} pending={pending} onSubmit={onSave} /></section> : null}
      <section className="panel">
        <h2>Eligible observations</h2>
        {vendor.observations.length === 0 ? <p className="note">No eligible history yet. A reviewed, non-bank-change analysis can be added explicitly.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Observed</th><th>Sender</th><th>Categories</th><th>Source</th></tr></thead>
              <tbody>
                {vendor.observations.map((item) => (
                  <tr key={item.id}>
                    <td><Link to={`/analyses/${item.analysisId}`}>{formatWhen(item.observedAt)}</Link></td>
                    <td>{item.senderAddress ?? "Unknown"}</td>
                    <td>{formatList(item.categories)}</td>
                    <td>{formatList(item.sourceIps)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel">
        <h2>Related analyses</h2>
        {vendor.recentAnalyses.length === 0 ? <p className="note">No analyses are linked to this vendor.</p> : (
          <ul>
            {vendor.recentAnalyses.map((item) => (
              <li key={item.id}>
                <Link to={`/analyses/${item.id}`}>{item.subject || item.originalFilename}</Link> <RiskBadge level={item.riskLevel} score={item.riskScore} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
