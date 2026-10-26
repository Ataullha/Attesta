import { describe, expect, it } from 'vitest';
import { Browser } from './helpers';

describe('GET /api/health', () => {
  it('reports a working database and working signing keys, to anyone', async () => {
    const res = await new Browser().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true, checks: { database: 'ok', signing: 'ok' } });
  });

  it('is never cached, so a monitor sees the present', async () => {
    const res = await new Browser().get('/api/health');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
