import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { getSession, login } from "../api/auth";
import { ApiClientError } from "../api/client";
import { ErrorMessage } from "../components/ErrorMessage";
import { useAuth } from "../App";

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (auth.status === "in") return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await login(password);
      const session = await getSession();
      auth.markSignedIn(session.demoEnabled);
      navigate("/", { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Sign in failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login">
      <form className="panel" onSubmit={onSubmit}>
        <p className="kicker">MailSentry</p>
        <h1>Sign in</h1>
        <p className="lede">One shared password protects this portfolio workspace. It is not a multi-user identity system.</p>
        {error ? <ErrorMessage message={error} /> : null}
        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={pending || auth.status === "loading"}>{pending ? "Checking…" : "Continue"}</button>
        <p className="note">The password is not stored in the browser. A successful sign-in uses an HttpOnly session cookie.</p>
      </form>
    </main>
  );
}
