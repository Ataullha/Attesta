import 'server-only';
import { site } from './site';

export function emailConfigured() {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/**
 * Sends through Resend's HTTP API when configured. Without it, links are printed to the
 * server log, which is enough for local development.
 */
export async function sendEmail(to: string, subject: string, text: string) {
  if (!emailConfigured()) {
    console.info(`[email:not-configured] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
  });
  if (!res.ok) console.error('Email failed', res.status, await res.text().catch(() => ''));
}

export function verifyEmailText(name: string, link: string) {
  return `Hi ${name},\n\nConfirm your email address for ${site.name} by opening this link:\n\n${link}\n\nThe link works for 24 hours. If you didn't create an account, ignore this email.\n`;
}

export function resetEmailText(name: string, link: string) {
  return `Hi ${name},\n\nSomeone asked to reset the password for your ${site.name} account. To choose a new password, open:\n\n${link}\n\nThe link works for 1 hour. If this wasn't you, ignore this email — your password hasn't changed.\n`;
}
