import * as p from "drizzle-orm/pg-core";
import { timestamps } from "./column.helper";


export const users = p.pgTable('users', {
    id: p.uuid('id').primaryKey().defaultRandom(),
    avatar: p.varchar({ length: 255 }).notNull(),
    nickname: p.varchar({ length: 255 }).notNull(),
    phone: p.varchar({ length: 255 }).notNull(),
    verificationStatus: p.varchar({ length: 50 }).notNull().default('unverified'),
    ...timestamps,
})