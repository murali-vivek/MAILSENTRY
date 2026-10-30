import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["test/detection/**/*.ts", "test/email/**/*.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "client",
          environment: "jsdom",
          include: ["test/client/**/*.tsx"],
          setupFiles: ["test/client/setup.ts"],
        },
      },
    ],
  },
});
