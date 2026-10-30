import { useEffect, useId, useRef } from "react";

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="dialog-back" role="presentation" onClick={onCancel}>
      <div className="panel dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <h2 id={titleId}>{title}</h2>
        <p className="lede">{body}</p>
        <div className="row" style={{ marginTop: 16 }}>
          <button type="button" onClick={onConfirm} disabled={pending}>{pending ? "Working…" : confirmLabel}</button>
          <button ref={cancelRef} type="button" className="secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
