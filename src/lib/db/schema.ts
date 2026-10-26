import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  customType,
  serial,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  // Null for an account that has only ever signed in with Google; "Forgot your password?" can add one.
  passwordHash: text('password_hash'),
  // Google's permanent id for the person ("sub"), once they have signed in with Google.
  googleSub: text('google_sub').unique(),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  credits: integer('credits').notNull().default(0),
  bannedAt: timestamp('banned_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(), // sha256 of the cookie token — the raw token is never stored
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const emailTokens = pgTable('email_tokens', {
  id: text('id').primaryKey(), // sha256 of the emailed token
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  purpose: text('purpose', { enum: ['verify', 'reset'] }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
});

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  domain: text('domain'),
  website: text('website'),
  status: text('status', { enum: ['unverified', 'pending', 'verified', 'rejected'] }).notNull().default('unverified'),
  dnsToken: text('dns_token').notNull(),
  dnsCheckedAt: timestamp('dns_checked_at', { withTimezone: true }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  reviewNote: text('review_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['signature', 'logo', 'seal', 'background', 'image'] }).notNull(),
    name: text('name').notNull(),
    mime: text('mime', { enum: ['image/png', 'image/jpeg'] }).notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    size: integer('size').notNull(),
    bytes: bytea('bytes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Soft delete: issued certificates may still reference the image for re-downloads.
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('assets_user_idx').on(t.userId)],
);

export const templates = pgTable(
  'templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    design: jsonb('design').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('templates_user_idx').on(t.userId)],
);

export const batches = pgTable(
  'batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'set null' }),
    templateId: uuid('template_id').references(() => templates.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    design: jsonb('design').notNull(), // snapshot used to render every certificate in this batch
    designHash: text('design_hash').notNull(),
    mode: text('mode', { enum: ['single', 'bulk'] }).notNull(),
    count: integer('count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('batches_user_idx').on(t.userId)],
);

export const certificates = pgTable(
  'certificates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serial: text('serial').notNull(),
    batchId: uuid('batch_id').notNull().references(() => batches.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'set null' }),
    recipientName: text('recipient_name').notNull(),
    recipientEmail: text('recipient_email'),
    values: jsonb('values').notNull(),
    nameDisplay: text('name_display', { enum: ['partial', 'full', 'hidden'] }).notNull().default('partial'),
    indexable: boolean('indexable').notNull().default(true),
    payload: text('payload').notNull(), // the exact canonical JSON that was signed
    contentHash: text('content_hash').notNull(),
    signature: text('signature').notNull(),
    keyId: text('key_id').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokeReason: text('revoke_reason'),
    deindexed: boolean('deindexed').notNull().default(false),
  },
  (t) => [
    uniqueIndex('certificates_serial_idx').on(t.serial),
    index('certificates_user_issued_idx').on(t.userId, t.issuedAt),
    index('certificates_batch_idx').on(t.batchId),
  ],
);

export const guestUsage = pgTable(
  'guest_usage',
  {
    id: serial('id').primaryKey(),
    guestId: text('guest_id').notNull(),
    ipHash: text('ip_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('guest_usage_guest_idx').on(t.guestId), index('guest_usage_ip_idx').on(t.ipHash, t.createdAt)],
);

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
});

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    packageId: text('package_id').notNull(),
    credits: integer('credits').notNull(),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull(),
    method: text('method').notNull(),
    trxId: text('trx_id').notNull(),
    sender: text('sender').notNull(),
    status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by'),
  },
  (t) => [uniqueIndex('payments_method_trx_idx').on(t.method, t.trxId), index('payments_status_idx').on(t.status)],
);

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  certificateId: uuid('certificate_id').references(() => certificates.id, { onDelete: 'cascade' }),
  serial: text('serial').notNull(),
  kind: text('kind', { enum: ['mismatch', 'deindex', 'other'] }).notNull(),
  message: text('message').notNull(),
  contact: text('contact'),
  status: text('status', { enum: ['open', 'resolved'] }).notNull().default('open'),
  ipHash: text('ip_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id'),
    action: text('action').notNull(),
    target: text('target'),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_created_idx').on(t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Certificate = typeof certificates.$inferSelect;
