import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals:     true,
    environment: "node",
    setupFiles:  ["./__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "lib/logger.ts",
        "lib/security/**/*.ts",
      ],
      exclude: [
        "**/*.d.ts",
        "**/node_modules/**",
        "lib/security/apiAuth.ts",
      ],
      thresholds: {
        lines:     75,
        functions: 50,
        branches:  50,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});