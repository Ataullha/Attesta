import { audit } from '@/lib/audit';
import { currentSessionId, endOtherSessions, requireUser } from '@/lib/auth/session';
import { json, route } from '@/lib/security/request';

/** "Sign out everywhere else": ends every session except the one making this request. */
export const DELETE = route(async () => {
  const user = await requireUser();
  const ended = await endOtherSessions(user.id, await currentSessionId());
  await audit(user.id, 'auth.sessions_ended', user.id, { sessionsEnded: ended });
  return json({ ok: true, ended });
});
