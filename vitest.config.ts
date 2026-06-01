import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/*.d.ts",
      ],
      /** 不把未 import 的 UI/入口算进分母；gate 约束「被单测触及的代码」 */
      all: false,
      thresholds: {
        lines: 48,
        functions: 51,
        branches: 38,
        statements: 46,
      },
    },
  },
});
