import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { createVendor, listVendors } from "../api/vendors";
import { ApiClientError } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage } from "../components/ErrorMessage";
import { LoadingState } from "../components/LoadingState";
import type { VendorSummary } from "../../shared/types";
import { VendorForm } from "./VendorForm";
import { baselineLabel, splitList } from "../utils/formatting";

export function VendorsPage() {
  const [items, setItems] = useState<VendorSummary[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  function reload() {
    setError("");
    void listVendors().then((result) => setItems(result.items)).catch((caught) => setError(caught instanceof ApiClientError ? caught.message : "Vendors failed."));
  }
  useEffect(reload, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setCreating(true);
    setError("");
    try {
      await createVendor(readVendorForm(form));
      event.currentTarget.reset();
      reload();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Vendor could not be created.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">Baseline</p>
          <h1>Vendors</h1>
          <p className="lede">Known senders are explicit. Imported mail never updates this list by itself.</p>
        </div>
      </header>
      {error ? <ErrorMessage message={error} /> : null}
      {!items ? <LoadingState /> : null}
      {items && items.length === 0 ? <EmptyState title="No vendors yet">Create a vendor before historical comparisons can match.</EmptyState> : null}
      {items && items.length > 0 ? (
        <section className="panel table-wrap">
          <table>
            <thead><tr><th>Vendor</th><th>Domain</th><th>Baseline</th><th>Observations</th></tr></thead>
            <tbody>
              {items.map((vendor) => (
                <tr key={vendor.id}>
                  <td><Link to={`/vendors/${vendor.id}`}>{vendor.displayName}</Link>{vendor.isDemo ? " · synthetic" : ""}</td>
                  <td>{vendor.canonicalDomain ?? "None"}</td>
                  <td>{baselineLabel(vendor.baselineStatus)}</td>
                  <td>{vendor.historyEmailCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      <section className="panel">
        <h2>Create vendor</h2>
        <VendorForm pending={creating} onSubmit={onCreate} />
      </section>
    </>
  );
}

export function readVendorForm(form: FormData) {
  return {
    displayName: String(form.get("displayName") ?? ""),
    canonicalDomain: String(form.get("canonicalDomain") ?? "") || null,
    senderAddresses: splitList(String(form.get("senderAddresses") ?? "")),
    domains: splitList(String(form.get("domains") ?? "")),
    internalRecipients: splitList(String(form.get("internalRecipients") ?? "")),
  };
}
