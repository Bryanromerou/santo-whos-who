import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.SANTOS_DATABASE_PATH || `${process.env.SANTOS_DATA_DIR || "./data"}/santos.sqlite`,
  },
});
