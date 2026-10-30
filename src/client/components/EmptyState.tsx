import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: { to: string; label: string } }) {
  return (
    <div className="panel empty">
      <h2>{title}</h2>
      <p className="lede">{children}</p>
      {action ? <p style={{ marginTop: 12 }}><Link className="button" to={action.to}>{action.label}</Link></p> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading records" }: { label?: string }) {
  return <p className="loading" role="status">{label}…</p>;
}

export function ErrorMessage({ message }: { message: string }) {
  return <p className="alert" role="alert">{message}</p>;
}
