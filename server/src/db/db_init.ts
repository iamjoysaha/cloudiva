import { drizzle } from "drizzle-orm/node-postgres";
import dotenv from "dotenv";
dotenv.config();

const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL!,
    ssl: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  },
});

export default db;