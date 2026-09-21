import 'server-only';
import { cookies } from 'next/headers';
import { randomToken } from './crypto';

const GUEST_COOKIE = 'att_gid';

export async function guestId() {
  const jar = await cookies();
  let id = jar.get(GUEST_COOKIE)?.value;
  if (!id || !/^[A-Za-z0-9_-]{20,64}$/.test(id)) {
    id = randomToken(18);
    jar.set(GUEST_COOKIE, id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 400,
    });
  }
  return id;
}
