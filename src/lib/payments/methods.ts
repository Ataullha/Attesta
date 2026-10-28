import 'server-only';
import { onlinePaymentMethods, orList, paymentMethods, paymentMethodsInWords } from '@/lib/site';
import { sslcommerzConfigured } from './sslcommerz';

/**
 * Every way to pay, as a phrase for a sentence: the methods on SSLCommerz's page when online payment
 * is on, then any way to send money yourself that it doesn't already cover. Pages built ahead of time
 * read the setting when the site is built.
 */
export function payByInWords() {
  if (!sslcommerzConfigured()) return paymentMethodsInWords();
  const names = [...onlinePaymentMethods];
  for (const m of paymentMethods) {
    const name = m.id === 'bank' ? m.label.toLowerCase() : m.label;
    if (!names.some((n) => n.toLowerCase() === name.toLowerCase())) names.push(name);
  }
  return orList(names);
}
