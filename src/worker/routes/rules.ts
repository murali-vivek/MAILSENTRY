import { json } from "../http";
import { RULES } from "../detection/rules";

export function listRules(): Response {
  return json({
    items: RULES.map((rule) => ({
      id: rule.id,
      title: rule.title,
      category: rule.category,
      severity: rule.severity,
      description: rule.description,
      weight: rule.weight,
      limitation: rule.limitation,
    })),
  });
}
