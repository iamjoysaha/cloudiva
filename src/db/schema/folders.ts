import { boolean, index, pgTable, timestamp, uuid, varchar, type AnyPgColumn } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const folders = pgTable("folders", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  parentId: uuid("parent_id").references((): AnyPgColumn => folders.id, { onDelete: "set null" }),

  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  path: uuid("path").array().notNull().default([]),

  isTrashed: boolean("is_trashed").notNull().default(false),
  trashedAt: timestamp("trashed_at", {
    withTimezone: true,
    mode: "date",
  }),

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
    .defaultNow()
},
  (table) => [
    index("idx_folders_owner_parent").on(
      table.ownerId,
      table.parentId,
      table.isTrashed,
    ),
    index("idx_folders_owner_trashed").on(
      table.ownerId,
      table.isTrashed,
    ),
    index("idx_folders_path").using("gin", table.path),
  ],
);