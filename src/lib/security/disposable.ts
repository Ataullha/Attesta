// A short list of the most common throwaway inbox domains. Extend as abuse shows up in the admin panel.
const DOMAINS = new Set([
  'mailinator.com', '10minutemail.com', 'guerrillamail.com', 'guerrillamail.info', 'sharklasers.com', 'yopmail.com',
  'tempmail.com', 'temp-mail.org', 'trashmail.com', 'getnada.com', 'dispostable.com', 'maildrop.cc', 'fakeinbox.com',
  'throwawaymail.com', 'mintemail.com', 'mohmal.com', 'emailondeck.com', 'tempail.com', 'moakt.com', 'mail.tm',
]);

export function isDisposableEmail(email: string) {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return DOMAINS.has(domain);
}
