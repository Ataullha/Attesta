// Generates an Ed25519 key pair for signing certificates.
//
// stdout carries only KEY=value lines, so it can be appended straight to an env file:
//   npm run -s keys:generate >> .env.local
// Guidance goes to stderr and is not captured by the redirect.
import { generateKeyPairSync, randomBytes } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const priv = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
const pub = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
const keyId = 'k' + new Date().toISOString().slice(0, 10).replace(/-/g, '');

console.log(`SIGNING_KEY_ID=${keyId}`);
console.log(`SIGNING_PRIVATE_KEY=${priv}`);
console.log(`SIGNING_PUBLIC_KEY=${pub}`);
console.log(`SECRET_SALT=${randomBytes(32).toString('base64url')}`);

console.error('\nKeep SIGNING_PRIVATE_KEY secret and backed up. If you rotate keys later, move the old public key into');
console.error('SIGNING_PUBLIC_KEYS_OLD as JSON, e.g. {"k20260101":"MCowBQYDK2VwAyEA..."}, so older certificates still verify.');
