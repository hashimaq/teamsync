import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const webUrl = env.VITE_WEB_URL || "http://localhost:3000";

  return {
    plugins: [react(), tailwindcss()],
    publicDir: "public",
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    define: {
      __WEB_URL__: JSON.stringify(webUrl),
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      modulePreload: false,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, "popup.html"),
          background: resolve(__dirname, "src/background/index.ts"),
        },
        output: {
          entryFileNames: (chunk) =>
            chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
    },
  };
});
