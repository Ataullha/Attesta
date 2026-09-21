import { destroySession } from '@/lib/auth/session';
import { json, route } from '@/lib/security/request';

export const POST = route(async () => {
  await destroySession();
  return json({ ok: true });
});
