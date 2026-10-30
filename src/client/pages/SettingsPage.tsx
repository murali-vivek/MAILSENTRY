import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../api/auth";
import { resetDemo, seedDemo } from "../api/rules";
import { ApiClientError } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ErrorMessage } from "../components/ErrorMessage";
import { useAuth } from "../App";

export function SettingsPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  async function signOut() {
    await logout();
    auth.markSignedOut();
    navigate("/login", { replace: true });
  }

  async function seed() {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await seedDemo();
      setMessage(`Loaded ${result.vendors} synthetic vendors and ${result.analyses} synthetic analyses.`);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Demo data could not be loaded.");
    } finally {
      setPending(false);
    }
  }

  async function reset() {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await resetDemo();
      setMessage(`Removed ${result.vendors} synthetic vendors and ${result.analyses} synthetic analyses. User-created records were kept.`);
      setConfirmReset(false);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Demo reset failed.");
      setConfirmReset(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">Workspace</p>
          <h1>Settings</h1>
        </div>
        <button type="button" className="secondary" onClick={() => void signOut()}>Sign out</button>
      </header>
      <section className="panel">
        <h2>Privacy</h2>
        <p className="lede">MailSentry stores normalized metadata, short evidence, findings, and review history. It does not keep the raw .eml, the full body, attachments, or bank account numbers. It does not render original HTML, fetch links, or send message contents to another service.</p>
        <p className="note">This is an educational decision-support tool. It is not a replacement for mail authentication, a gateway, or a company's payment-change verification policy. Live mailbox monitoring is not implemented.</p>
      </section>
      <section className="panel">
        <h2>Synthetic demo</h2>
        {auth.demoEnabled ? (
          <>
            <p className="lede">Demo records use reserved .example domains and documentation addresses. They are not proof of real-world detection accuracy. Reset deletes only seeded rows.</p>
            {error ? <ErrorMessage message={error} /> : null}
            {message ? <p role="status">{message}</p> : null}
            <div className="row">
              <button type="button" onClick={() => void seed()} disabled={pending}>Load synthetic demo</button>
              <button type="button" className="secondary" onClick={() => setConfirmReset(true)} disabled={pending}>Reset synthetic demo</button>
            </div>
          </>
        ) : (
          <p className="note">Demo seed and reset are disabled in this environment. Production leaves them off unless MAILSENTRY_ENABLE_DEMO_RESET is explicitly true.</p>
        )}
      </section>
      {confirmReset ? (
        <ConfirmDialog
          title="Reset synthetic demo data?"
          body="This deletes only records marked as seeded demo data. Vendors and analyses you created stay in place."
          confirmLabel="Reset demo data"
          pending={pending}
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => void reset()}
        />
      ) : null}
    </>
  );
}
