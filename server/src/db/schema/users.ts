import { bigint, boolean, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  password: varchar("password", { length: 255 }),

  role: varchar("role", { length: 2 })
    .notNull()
    .default("2"), // Admin: '1', User: '2'

  provider: varchar("provider", { length: 255 }).notNull().default("email"), // 'email', 'google', 'github', etc.
  providerToken: varchar("provider_token", { length: 255 }), // Token from the provider
  is_active: boolean("is_active").notNull().default(true),

  image: varchar("image", { length: 255 }), // URL to the user's profile image
  storageUsed: bigint("storage_used", { mode: "number" })
    .notNull()
    .default(0),

  storageLimit: bigint("storage_limit", { mode: "number" })
    .notNull()
    .default(1073741824), // 1 GB (Free Tier)

  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "date",
  })
    .notNull()
    .defaultNow(),

  deletedAt: timestamp("deleted_at", {
    withTimezone: true,
    mode: "date",
  })
});