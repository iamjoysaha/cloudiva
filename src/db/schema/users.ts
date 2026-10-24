import { bigint, boolean, pgTable, timestamp, uuid, varchar, text } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  password: varchar("password", { length: 255 }),
  role: varchar("role", { length: 2 }).notNull().default("2"), // Admin: '1', User: '2'
  provider: varchar("provider", { length: 255 }).notNull().default("email"), // 'email', 'google', 'github', etc.
  providerId: varchar("provider_id", { length: 255 }), // ID from the provider
  providerToken: text("provider_token"), // Token from the provider
  isActive: boolean("is_active").notNull().default(true),
  picture: varchar("picture", { length: 255 }), // URL to the user's profile image
  storageUsed: bigint("storage_used", { mode: "number" }).notNull().default(0),
  storageLimit: bigint("storage_limit", { mode: "number" }).notNull().default(16106127360), // 15 GB (Free Tier)

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