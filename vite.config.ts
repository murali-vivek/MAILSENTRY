import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const workerOrigin = "http://127.0.0.1:8787";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: workerOrigin,
        changeOrigin: true,
        headers: { origin: workerOrigin },
      },
    },
  },
});
