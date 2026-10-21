import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/unit/server-only-stub.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    // Safety net: code that opens the database before a test calls freshDb() never reaches the real data/ folder.
    env: { SANTOS_DATA_DIR: path.join(os.tmpdir(), "santos-vitest-default"), SANTOS_DATABASE_PATH: "" },
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
