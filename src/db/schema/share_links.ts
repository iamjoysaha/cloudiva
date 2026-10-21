import { index, pgTable, timestamp, uuid, varchar, integer } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { unique } from "drizzle-orm/cockroach-core";

export const shareLinks = pgTable("share_links", {
    id: uuid("id").defaultRandom().primaryKey(),
    token: varchar("token", { length: 255 }).unique().notNull(),

    resourceType: varchar("resource_type", { length: 255 }).notNull(),
    resourceId: uuid("resource_id").notNull(),

    ownerId: uuid("owner_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),

    permission: varchar("permission", { length: 255 })
        .notNull()
        .default("download"),

    expiresAt: timestamp("expires_at", {
        withTimezone: true,
        mode: "date",
    }),

    accessCount: integer("access_count").notNull().default(0),

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
},
    (table) => [
        unique("unique_resource_owner").on(
            table.resourceId,
            table.ownerId,
        ),
        index("idx_shares_owner").on(
            table.ownerId,
            table.createdAt.desc(),
        ),
        index("idx_shares_resource").on(table.resourceId),
    ],
);