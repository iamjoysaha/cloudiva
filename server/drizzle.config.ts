import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: "./src/db/schema/*",
  dialect: process.env.DATABASE_DIALECT as
    | 'postgresql'
    | 'mysql'
    | 'sqlite'
    | 'turso'
    | 'singlestore'
    | 'mssql'
    | 'cockroach'
    | 'duckdb',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
