import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchValidation,
  findValidPayment,
  GatewayError,
  judgeValidation,
  newTranId,
  sessionFields,
  sslcommerzBase,
  sslcommerzConfigured,
  startSession,
  type Validation,
} from '@/lib/payments/sslcommerz';
import { payByInWords } from '@/lib/payments/methods';
import { packages, site } from '@/lib/site';

// Whatever the shell running the tests has set, each test starts with online payment off.
beforeEach(() => {
  for (const name of ['SSLCOMMERZ_STORE_ID', 'SSLCOMMERZ_STORE_PASSWORD', 'SSLCOMMERZ_LIVE', 'SSLCOMMERZ_API_URL']) vi.stubEnv(name, '');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const store = () => {
  vi.stubEnv('SSLCOMMERZ_STORE_ID', 'teststore');
  vi.stubEnv('SSLCOMMERZ_STORE_PASSWORD', 'teststore@ssl');
};
const growth = packages.find((p) => p.id === 'growth')!;
const customer = { name: 'Nusrat Jahan', email: 'nusrat@example.com', phone: '01712345678' };

/** Answers every fetch with this JSON (or a function of the request), and records what was asked. */
function gateway(answer: unknown | ((url: string, init?: RequestInit) => unknown), status = 200) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      const body = typeof answer === 'function' ? (answer as (u: string, i?: RequestInit) => unknown)(String(url), init) : answer;
      return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    }),
  );
  return calls;
}

describe('the settings', () => {
  it('turn online payment on only with both the store id and its password', () => {
    expect(sslcommerzConfigured()).toBe(false);
    vi.stubEnv('SSLCOMMERZ_STORE_ID', 'teststore');
    expect(sslcommerzConfigured()).toBe(false);
    vi.stubEnv('SSLCOMMERZ_STORE_PASSWORD', 'teststore@ssl');
    expect(sslcommerzConfigured()).toBe(true);
  });

  it('use the sandbox until SSLCOMMERZ_LIVE is "true"', () => {
    expect(sslcommerzBase()).toBe('https://sandbox.sslcommerz.com');
    vi.stubEnv('SSLCOMMERZ_LIVE', '1');
    expect(sslcommerzBase()).toBe('https://sandbox.sslcommerz.com');
    vi.stubEnv('SSLCOMMERZ_LIVE', 'true');
    expect(sslcommerzBase()).toBe('https://securepay.sslcommerz.com');
    vi.stubEnv('SSLCOMMERZ_API_URL', 'http://127.0.0.1:4000/');
    expect(sslcommerzBase()).toBe('http://127.0.0.1:4000');
  });
});

describe('a transaction id', () => {
  it('is unguessable and fits SSLCommerz’s 30 characters', () => {
    const ids = new Set(Array.from({ length: 500 }, newTranId));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(/^ATT[A-HJ-NP-Z2-9]{16}$/);
  });
});

describe('opening a checkout', () => {
  it('sends what SSLCommerz requires, with the price to the paisa and our return addresses', () => {
    store();
    const f = sessionFields('ATTABC', growth, customer);
    expect(f).toMatchObject({
      store_id: 'teststore',
      store_passwd: 'teststore@ssl',
      tran_id: 'ATTABC',
      total_amount: '5000.00',
      currency: 'BDT',
      success_url: `${site.url}/api/billing/sslcommerz/success`,
      fail_url: `${site.url}/api/billing/sslcommerz/fail`,
      cancel_url: `${site.url}/api/billing/sslcommerz/cancel`,
      ipn_url: `${site.url}/api/billing/sslcommerz/ipn`,
      cus_name: customer.name,
      cus_email: customer.email,
      cus_phone: customer.phone,
      shipping_method: 'NO',
      product_profile: 'non-physical-goods',
    });
    expect(f.product_name).toContain('2000 certificates');
    for (const key of ['cus_add1', 'cus_city', 'cus_postcode', 'cus_country', 'product_category', 'num_of_item']) expect(f[key], key).toBeTruthy();
  });

  it('posts them as a form and returns SSLCommerz’s payment page', async () => {
    store();
    const calls = gateway({ status: 'SUCCESS', sessionkey: 'KEY1', GatewayPageURL: 'https://sandbox.sslcommerz.com/EasyCheckOut/testcdeKEY1' });
    await expect(startSession('ATTABC', growth, customer)).resolves.toEqual({ gatewayUrl: 'https://sandbox.sslcommerz.com/EasyCheckOut/testcdeKEY1', sessionkey: 'KEY1' });
    expect(calls[0].url).toBe('https://sandbox.sslcommerz.com/gwprocess/v4/api.php');
    const sent = calls[0].init?.body as FormData;
    expect(sent.get('tran_id')).toBe('ATTABC');
    expect(sent.get('total_amount')).toBe('5000.00');
  });

  it('fails with SSLCommerz’s reason, and never sends the customer to a page that is not SSLCommerz’s', async () => {
    store();
    gateway({ status: 'FAILED', failedreason: 'Store Credential Error Or Store is De-active' });
    await expect(startSession('ATTABC', growth, customer)).rejects.toThrow(/Store Credential Error/);
    gateway({ status: 'SUCCESS', GatewayPageURL: 'http://evil.example/pay' });
    await expect(startSession('ATTABC', growth, customer)).rejects.toBeInstanceOf(GatewayError);
    gateway({ status: 'SUCCESS', GatewayPageURL: 'javascript:alert(1)' });
    await expect(startSession('ATTABC', growth, customer)).rejects.toBeInstanceOf(GatewayError);
    gateway({ status: 'SUCCESS' });
    await expect(startSession('ATTABC', growth, customer)).rejects.toBeInstanceOf(GatewayError);
    gateway('not json at all', 500);
    await expect(startSession('ATTABC', growth, customer)).rejects.toBeInstanceOf(GatewayError);
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('fetch failed'))));
    await expect(startSession('ATTABC', growth, customer)).rejects.toThrow(/could not be reached/);
  });
});

describe('asking SSLCommerz about a payment', () => {
  it('sends the validation id with the store’s credentials', async () => {
    store();
    const calls = gateway({ status: 'VALID', tran_id: 'ATTABC', APIConnect: 'DONE' });
    await expect(fetchValidation('VAL1')).resolves.toMatchObject({ status: 'VALID', tran_id: 'ATTABC' });
    const url = new URL(calls[0].url);
    expect(url.pathname).toBe('/validator/api/validationserverAPI.php');
    expect(Object.fromEntries(url.searchParams)).toEqual({ val_id: 'VAL1', store_id: 'teststore', store_passwd: 'teststore@ssl', v: '1', format: 'json' });
  });

  it('treats an answer that says nothing about the payment as no answer', async () => {
    store();
    gateway({ APIConnect: 'INACTIVE' });
    await expect(fetchValidation('VAL1')).rejects.toThrow(/INACTIVE/);
    gateway({}, 503);
    await expect(fetchValidation('VAL1')).rejects.toBeInstanceOf(GatewayError);
    // An unknown validation id is an answer: there is no such payment.
    gateway({ status: 'INVALID_TRANSACTION', APIConnect: 'DONE' });
    await expect(fetchValidation('NOPE')).resolves.toMatchObject({ status: 'INVALID_TRANSACTION' });
  });

  it('finds a payment that went through for a checkout, by our transaction id', async () => {
    store();
    const calls = gateway({
      APIConnect: 'DONE',
      no_of_trans_found: 2,
      element: [
        { status: 'FAILED', tran_id: 'ATTABC', val_id: '' },
        { status: 'VALIDATED', tran_id: 'ATTABC', val_id: 'VAL2' },
      ],
    });
    await expect(findValidPayment('ATTABC')).resolves.toBe('VAL2');
    expect(new URL(calls[0].url).searchParams.get('tran_id')).toBe('ATTABC');
    gateway({ APIConnect: 'DONE', no_of_trans_found: 0, element: [] });
    await expect(findValidPayment('ATTABC')).resolves.toBeNull();
    gateway({ APIConnect: 'FAILED' });
    await expect(findValidPayment('ATTABC')).rejects.toBeInstanceOf(GatewayError);
  });
});

describe('judging a validated payment', () => {
  const expected = { tranId: 'ATTABC', amount: 5000, currency: 'BDT' };
  const valid: Validation = { status: 'VALID', tran_id: 'ATTABC', val_id: 'VAL1', amount: '5000.00', currency: 'BDT', currency_type: 'BDT', risk_level: '0', risk_title: 'Safe' };
  const judge = (changes: Partial<Validation>) => judgeValidation({ ...valid, ...changes }, expected);

  it('calls it paid when SSLCommerz does, for our transaction and the full amount', () => {
    expect(judge({})).toEqual({ outcome: 'paid' });
    expect(judge({ status: 'VALIDATED' })).toEqual({ outcome: 'paid' }); // asked about before
    expect(judge({ tran_id: ' ATTABC ' })).toEqual({ outcome: 'paid' });
    expect(judge({ amount: '4999.50' }).outcome).toBe('paid'); // within a taka, as SSLCommerz’s libraries allow
    expect(judge({ currency_type: undefined }).outcome).toBe('paid');
  });

  it('refuses anything else', () => {
    for (const status of ['FAILED', 'CANCELLED', 'INVALID_TRANSACTION', 'PENDING', undefined]) expect(judge({ status }).outcome, String(status)).toBe('invalid');
    expect(judge({ tran_id: 'ATTXYZ' }).outcome).toBe('invalid');
    expect(judge({ tran_id: undefined }).outcome).toBe('invalid');
    expect(judge({ amount: '50.00' })).toEqual({ outcome: 'invalid', reason: 'amount 50.00' });
    expect(judge({ amount: '4999.00' }).outcome).toBe('invalid');
    expect(judge({ amount: '50000.00' }).outcome).toBe('invalid');
    expect(judge({ amount: 'lots' }).outcome).toBe('invalid');
    expect(judge({ amount: undefined }).outcome).toBe('invalid');
    expect(judge({ currency_type: 'USD' }).outcome).toBe('invalid');
  });

  it('holds a payment SSLCommerz rates risky', () => {
    expect(judge({ risk_level: '1', risk_title: 'Not Safe' })).toEqual({ outcome: 'held', reason: 'Not Safe' });
    expect(judge({ risk_level: '1', risk_title: '' }).outcome).toBe('held');
  });
});

describe('the ways to pay, in words', () => {
  it('add the online methods only when online payment is on', () => {
    expect(payByInWords()).toBe('bKash, Nagad or bank transfer');
    store();
    expect(payByInWords()).toBe('card, bKash, Nagad, Rocket, internet banking or bank transfer');
  });
});
