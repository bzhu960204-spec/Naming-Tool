import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Ports are dynamic: the dev launcher (start-dev.ps1) picks free ports and
// passes them through as env vars so the frontend proxy always targets the
// backend port that is actually in use. Falls back to the historical defaults
// when the env vars are absent (e.g. running `vite` directly).
const frontendPort = Number(process.env.FRONTEND_PORT ?? 5173);
const backendPort = Number(process.env.BACKEND_PORT ?? 8787);

export default defineConfig({
  plugins: [react()],
  server: {
    port: frontendPort,
    proxy: {
      "/api": {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
});
