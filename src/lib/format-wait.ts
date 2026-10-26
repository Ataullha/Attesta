/** "a minute", "7 minutes", "2 hours": a wait in seconds, rounded up so it is never an underestimate. */
export function waitText(seconds: number) {
  if (seconds <= 60) return 'a minute';
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.ceil(minutes / 60);
  return hours === 1 ? 'an hour' : `${hours} hours`;
}
