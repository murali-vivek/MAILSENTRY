import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          MAILSENTRY_ACCESS_PASSWORD: "test-password-should-be-long",
          MAILSENTRY_SESSION_SECRET: "test-session-secret-at-least-32-bytes-long",
          MAILSENTRY_ENABLE_DEMO_RESET: "true",
          APP_ENV: "development",
        },
      },
    }),
  ],
  test: {
    include: ["test/worker/**/*.test.ts"],
    setupFiles: ["test/worker/setup.ts"],
  },
});
