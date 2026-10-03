import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 64 }).notNull().default('Default key'),
    keyHash: text('key_hash').notNull(),
    masked: varchar('masked', { length: 32 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('api_keys_key_hash_idx').on(t.keyHash),
    index('api_keys_user_id_idx').on(t.userId),
  ],
);

export const dailyUsage = pgTable(
  'daily_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: varchar('date', { length: 10 }).notNull(),
    tokens: integer('tokens').notNull().default(0),
    calls: integer('calls').notNull().default(0),
  },
  (t) => [uniqueIndex('daily_usage_user_date_idx').on(t.userId, t.date)],
);

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
  dailyUsage: many(dailyUsage),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}));

export const dailyUsageRelations = relations(dailyUsage, ({ one }) => ({
  user: one(users, { fields: [dailyUsage.userId], references: [users.id] }),
}));

export type UserRow = typeof users.$inferSelect;
export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type DailyUsageRow = typeof dailyUsage.$inferSelect;