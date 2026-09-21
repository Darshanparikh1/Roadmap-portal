import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://localhost:5000";
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    build: { chunkSizeWarningLimit: 700 },
    server: {
      port: 5173,
      // Same-origin in dev: the httpOnly cookies just work, and there are no CORS preflights.
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
        // The server also answers on /v1, so a stripped prefix still reaches it.
        "/v1": { target: apiTarget, changeOrigin: true },
      },
    },
  };
});
