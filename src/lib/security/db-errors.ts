/** Postgres `unique_violation`, whether the driver or the ORM wrapped it. */
export function isUniqueViolation(err: unknown) {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === '23505' || e?.cause?.code === '23505';
}
