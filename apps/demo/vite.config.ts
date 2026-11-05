import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@mukhiya-mining/core": new URL("../../packages/core/src/index.ts", import.meta.url).pathname,
      "@mukhiya-mining/react/styles.css": new URL(
        "../../packages/react/src/styles.css",
        import.meta.url,
      ).pathname,
      "@mukhiya-mining/react": new URL("../../packages/react/src/index.ts", import.meta.url)
        .pathname,
    },
  },
});
