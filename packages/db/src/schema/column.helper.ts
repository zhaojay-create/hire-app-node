import * as p from "drizzle-orm/pg-core";

export const timestamps = {
    updatedAt: p.timestamp(),
    createdAt: p.timestamp().defaultNow().notNull(),
    deletedAt: p.timestamp(),
}