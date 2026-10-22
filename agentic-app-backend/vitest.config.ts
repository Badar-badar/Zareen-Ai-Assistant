import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    // The DB test files share one database and wipe it before each test,
    // so they must not run at the same time.
    fileParallelism: false,
    env: {
      JWT_SECRET: "test-secret-test-secret-test-secret-1234",
    },
  },
});