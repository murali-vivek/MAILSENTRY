import { useEffect, useState } from "react";
import { listRules, type RuleCatalogueItem } from "../api/rules";
import { ApiClientError } from "../api/client";
import { ErrorMessage } from "../components/ErrorMessage";
import { LoadingState } from "../components/LoadingState";

export function RulesPage() {
  const [items, setItems] = useState<RuleCatalogueItem[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void listRules().then((result) => setItems(result.items)).catch((caught) => setError(caught instanceof ApiClientError ? caught.message : "Rules failed."));
  }, []);
  if (error) return <ErrorMessage message={error} />;
  if (!items) return <LoadingState label="Loading rules" />;
  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">Catalogue</p>
          <h1>Detection rules</h1>
          <p className="lede">Rules are fixed and deterministic. The score adds triggered weights and caps at 100. It is not a probability.</p>
        </div>
      </header>
      <section className="panel table-wrap">
        <table>
          <thead><tr><th>Rule</th><th>Category</th><th>Weight</th><th>What it means</th><th>Limitation</th></tr></thead>
          <tbody>
            {items.map((rule) => (
              <tr key={rule.id}>
                <td><strong>{rule.title}</strong><div className="note">{rule.id}</div></td>
                <td>{rule.category}</td>
                <td>{rule.weight}</td>
                <td>{rule.description}</td>
                <td>{rule.limitation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
