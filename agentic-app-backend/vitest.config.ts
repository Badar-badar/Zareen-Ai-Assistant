import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    env: { JWT_SECRET: "test-secret-test-secret-test-secret-1234" },
  },
});
