import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Each file gets its own database, so suites can't tread on each other.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    setupFiles: ["./tests/setup.js"],
  },
});
