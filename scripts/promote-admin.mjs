// Usage: npm run admin:promote -- someone@example.com
import postgres from 'postgres';

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run admin:promote -- someone@example.com');
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL, { max: 1, prepare: false });
const rows = await sql`update users set role = 'admin', email_verified_at = coalesce(email_verified_at, now()) where email = ${email} returning id`;
console.log(rows.length ? `${email} is now an admin.` : `No user with email ${email}. Register first, then run this again.`);
await sql.end();
