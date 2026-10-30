import { mkdirSync, writeFileSync, existsSync } from "node:fs";

if (!existsSync("dist/index.html")) {
  mkdirSync("dist", { recursive: true });
  writeFileSync(
    "dist/index.html",
    "<!doctype html><title>MailSentry</title><p>Build the client with npm run build for the full interface.</p>",
  );
}
