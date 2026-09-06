import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      // Mirror next.config.mjs: import `.md` files as raw strings.
      name: "raw-md",
      load(id) {
        const path = id.split("?")[0];
        if (path.endsWith(".md")) {
          return `export default ${JSON.stringify(readFileSync(path, "utf-8"))};`;
        }
      },
    },
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
