import type { FormEvent } from "react";
import type { VendorSummary } from "../../shared/types";

export function VendorForm({
  vendor,
  pending,
  onSubmit,
}: {
  vendor?: VendorSummary;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} style={{ marginTop: 12 }}>
      <div className="form-grid">
        <label>Display name
          <input name="displayName" required minLength={2} maxLength={120} defaultValue={vendor?.displayName ?? ""} />
        </label>
        <label>Canonical domain
          <input name="canonicalDomain" placeholder="northwind.example" defaultValue={vendor?.canonicalDomain ?? ""} />
        </label>
        <label>Known sender addresses
          <textarea name="senderAddresses" placeholder="billing@northwind.example" defaultValue={vendor?.senderAddresses.join("\n") ?? ""} />
        </label>
        <label>Known sender domains
          <textarea name="domains" placeholder="northwind.example" defaultValue={vendor?.domains.join("\n") ?? ""} />
        </label>
        <label className="span-2">Internal recipients
          <textarea name="internalRecipients" placeholder="accounts@acme-pay.example" defaultValue={vendor?.internalRecipients.join("\n") ?? ""} />
        </label>
      </div>
      <button type="submit" disabled={pending} style={{ marginTop: 12 }}>{pending ? "Saving…" : vendor ? "Save vendor" : "Create vendor"}</button>
    </form>
  );
}
