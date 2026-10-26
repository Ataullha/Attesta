/**
 * Everything a site owner is expected to change lives in this file.
 * Prices and payment account numbers below are placeholders — replace them
 * before going live.
 */

export const site = {
  name: 'Attesta',
  shortDescription: 'Issue certificates anyone can verify in one scan.',
  description:
    'Design certificates from a template or your own artwork, add signatures, QR codes and barcodes, issue one or thousands from a CSV, and give every certificate a permanent verification page.',
  url: (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  serialPrefix: 'ATT',
  supportEmail: 'support@example.com',
  operatedFrom: 'Dhaka, Bangladesh',
} as const;

export const limits = {
  /** Certificates a visitor can issue without an account, per browser. */
  guestLifetime: 2,
  /** Guest certificates allowed from one IP per day (shared mobile IPs are common, so this is generous). */
  guestPerIpPerDay: 10,
  /** Free certificates per calendar month for a registered account. */
  freeMonthly: 5,
  bulkMaxRows: 5000,
  /** Recipients per issue request. Keeps each request far below serverless time and body limits. */
  issueChunk: 100,
  /** Vercel rejects request bodies above 4.5 MB, so uploads are capped below that. */
  uploadMaxBytes: 4 * 1024 * 1024,
  /** Re-encoding can enlarge a file, and the stored copy is served back through the same 4.5 MB limit. */
  storedImageMaxBytes: 4 * 1024 * 1024,
  templatesPerUser: 100,
  assetsPerUser: 200,
  fieldValueMax: 300,
} as const;

export type PackageDef = {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: 'BDT';
  note: string;
};

/** Certificate packages. Credits never expire. Change prices to your own. */
export const packages: PackageDef[] = [
  { id: 'starter', name: 'Starter', credits: 500, price: 1500, currency: 'BDT', note: 'A single cohort or event' },
  { id: 'growth', name: 'Growth', credits: 2000, price: 5000, currency: 'BDT', note: 'A training centre running monthly batches' },
  { id: 'scale', name: 'Scale', credits: 10000, price: 20000, currency: 'BDT', note: 'Institutions issuing all year' },
];

/** Where customers send money. Replace the account details with your own. */
export const paymentMethods = [
  { id: 'bkash', label: 'bKash', instructions: 'Send Money to 01XXXXXXXXX (Personal). Use your email as the reference.' },
  { id: 'nagad', label: 'Nagad', instructions: 'Send Money to 01XXXXXXXXX. Use your email as the reference.' },
  { id: 'bank', label: 'Bank transfer', instructions: 'Account name: [YOUR COMPANY] · Account no: [ACCOUNT NUMBER] · Bank: [BANK, BRANCH]' },
] as const;

export type PaymentMethodId = (typeof paymentMethods)[number]['id'];

/** The payment methods as a phrase for a sentence: "bKash, Nagad or bank transfer". */
export function paymentMethodsInWords() {
  // Brand names keep their capitals; a generic method reads in lower case mid-sentence.
  const names = paymentMethods.map((m) => (m.id === 'bank' ? m.label.toLowerCase() : m.label));
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0];
}

export function formatMoney(amount: number, currency = 'BDT') {
  return `${currency === 'BDT' ? '৳' : currency + ' '}${amount.toLocaleString('en-US')}`;
}

/** What one certificate costs in a package, to the paisa. */
export function perCertificate(p: PackageDef) {
  return Math.round((p.price / p.credits) * 100) / 100;
}

/** How much less each certificate costs than in the smallest package, as a whole percentage. */
export function savingVersusSmallest(p: PackageDef) {
  return Math.round((1 - perCertificate(p) / perCertificate(packages[0])) * 100);
}
