import { json } from "../http";

export function health(): Response {
  return json({ status: "ok", app: "mailsentry" });
}
