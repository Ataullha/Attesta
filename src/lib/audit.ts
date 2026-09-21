import 'server-only';
import { db, schema } from '@/lib/db';

export async function audit(actorUserId: string | null, action: string, target?: string, meta?: Record<string, unknown>) {
  try {
    await db().insert(schema.auditLogs).values({ actorUserId, action, target, meta: meta ?? null });
  } catch (err) {
    console.error('audit log failed', err);
  }
}
