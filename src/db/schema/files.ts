import { boolean, index, pgTable, timestamp, uuid, varchar, bigint } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { folders } from "./folders.js";

export const files = pgTable("files", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    size: bigint("size", { mode: "number" }).notNull(),

    s3Key: varchar("s3_key", { length: 512 }).unique().notNull(),

    folderId: uuid("folder_id").references(() => folders.id, {
        onDelete: "set null",
    }),

    ownerId: uuid("owner_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),

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
        index("idx_files_owner_folder").on(
            table.ownerId,
            table.folderId,
            table.isTrashed,
        ),
        index("idx_files_owner_trashed_date").on(
            table.ownerId,
            table.isTrashed,
            table.createdAt.desc(),
        ),
        index("idx_files_owner_trashed_name").on(
            table.ownerId,
            table.isTrashed,
            table.name,
        ),
    ],
);