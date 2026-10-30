import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { uploadAnalysis } from "../api/analyses";
import { ApiClientError } from "../api/client";
import { ErrorMessage } from "../components/ErrorMessage";

const MAX_BYTES = 512 * 1024;

export function AnalyzePage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose an .eml file.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".eml")) {
      setError("Only .eml files can be analyzed.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("The file is larger than 512 KiB.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const detail = await uploadAnalysis(file);
      navigate(`/analyses/${detail.id}`);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "The analysis failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">Ingest</p>
          <h1>Analyze email</h1>
          <p className="lede">The file is parsed in memory. Raw MIME and the full body are discarded after the rules run. Links are not opened.</p>
        </div>
      </header>
      <form className="panel" onSubmit={onSubmit}>
        {error ? <ErrorMessage message={error} /> : null}
        <label>
          Email file
          <input
            type="file"
            name="file"
            accept=".eml,message/rfc822"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <p className="note">{file ? `${file.name} · ${file.size} bytes` : "Maximum size 512 KiB. Extension must be .eml."}</p>
        <button type="submit" disabled={pending}>{pending ? "Analyzing…" : "Run analysis"}</button>
        <p className="note">MailSentry is decision support for accounts payable. It does not block mail, approve payments, or contact the vendor.</p>
      </form>
    </>
  );
}
