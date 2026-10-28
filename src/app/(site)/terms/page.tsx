import type { Metadata } from 'next';
import { site } from '@/lib/site';
import { sslcommerzConfigured } from '@/lib/payments/sslcommerz';

export const metadata: Metadata = { title: 'Terms of use', alternates: { canonical: '/terms' } };

export default function Terms() {
  return (
    <div className="prose-body mx-auto max-w-3xl px-5 py-14">
      <h1 className="font-display text-[38px] leading-tight">Terms of use</h1>
      <p>These terms are a starting point. Have them reviewed by a lawyer before launch.</p>
      <h2>Your responsibility as an issuer</h2>
      <p>You may only issue certificates you are entitled to issue, in your own name or your organisation’s. You are responsible for the accuracy of what you issue and for having permission to use any signature, logo or seal you upload.</p>
      <h2>What we do</h2>
      <p>{site.name} records who issued each certificate and when, and shows that record on its verification page. We confirm that a certificate was issued through {site.name} by a given account; we do not independently confirm the achievement it describes, except that a verified organisation badge means the issuer proved control of the stated domain.</p>
      <h2>Prohibited use</h2>
      <ul>
        <li>Impersonating another institution or person, or issuing certificates for achievements that did not happen.</li>
        <li>Uploading content you do not have rights to.</li>
        <li>Attempting to bypass usage limits or access other accounts’ data.</li>
      </ul>
      <p>We may revoke certificates and suspend accounts that break these terms.</p>
      <h2>Packages and payments</h2>
      <p>Package credits are added after payment is confirmed and do not expire.{sslcommerzConfigured() && ' Online payments are processed by SSLCommerz.'} Refunds for unused credits are handled on request at <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.</p>
      <h2>Records</h2>
      <p>Verification records are kept so that certificates remain checkable. Revoked certificates keep their page, showing the revocation.</p>
    </div>
  );
}
