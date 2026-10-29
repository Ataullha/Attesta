import type { Metadata } from 'next';
import { site } from '@/lib/site';
import { sslcommerzConfigured } from '@/lib/payments/sslcommerz';

export const metadata: Metadata = { title: 'Privacy policy', alternates: { canonical: '/privacy' } };

export default function Privacy() {
  return (
    <div className="prose-body mx-auto max-w-3xl px-5 py-14">
      <h1 className="font-display text-[38px] leading-tight">Privacy policy</h1>
      <p>This policy explains what {site.name} stores and why. Have it reviewed by a lawyer for your jurisdiction before launch.</p>
      <h2>What we store</h2>
      <ul>
        <li>Your account: name, email address and a salted scrypt hash of your password. We never store your password itself.</li>
        <li>Templates you save and images you upload (signatures, logos, backgrounds). Uploaded images are re-encoded to remove hidden metadata and are only ever served to you.</li>
        <li>For each certificate you issue: its serial number, the field values you entered, the date, and a digitally signed record of those details.</li>
        <li>Payment requests: package, amount, payment method, transaction ID and the number or account you paid from.</li>
        {sslcommerzConfigured() && (
          <li>
            Online payments: SSLCommerz, the payment gateway, receives your name, email address and mobile number with each one. Your card or account
            details go to SSLCommerz, never to us; we keep what it reports back: its reference numbers, the kind of card or account used and its risk rating.
          </li>
        )}
        <li>For abuse prevention: a random cookie identifying your browser and a keyed hash of your IP address. We do not store raw IP addresses.</li>
      </ul>
      <h2>What is public</h2>
      <p>Each registered certificate has a verification page. It shows the issuer, the issue date, the fields the issuer marked as public, and the recipient’s name in the form the issuer chose (by default, first name and last initial). Email fields are never shown.</p>
      <p>A visiting card’s page is a contact card: it shows the details the issuer chose to share on it, such as a phone number and an email address, and offers them to save. An invitation’s page shows the guest’s name and the details the host chose to share. Pages for visiting cards and invitations are kept out of search engines unless the issuer chooses otherwise.</p>
      <p>Recipients can ask for a verification page to be removed from search engines using the report form on that page.</p>
      <h2>CSV files and photos</h2>
      <p>CSV files used for bulk issuing are read in your browser. We receive only the values needed to register each certificate, card or invitation.</p>
      <p>Photos for ID cards are placed on the cards in your browser and never uploaded. We keep only each photo’s file name, so that a card can be matched to its photo again when you download it later.</p>
      <h2>Advertising</h2>
      <p>Public pages may show ads from Google AdSense, which may use cookies. Ads are never shown in the editor or your dashboard.</p>
      <h2>Contact</h2>
      <p>Questions or deletion requests: <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.</p>
    </div>
  );
}
