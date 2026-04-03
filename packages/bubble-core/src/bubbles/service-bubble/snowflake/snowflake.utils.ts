import crypto from 'crypto';
import { decodeCredentialPayload } from '@bubblelab/shared-schemas';

export interface SnowflakeCredentials {
  account: string;
  username: string;
  privateKey: string;
  privateKeyPassword?: string;
  warehouse?: string;
  database?: string;
  schema?: string;
  role?: string;
}

/**
 * Normalize a PEM private key so crypto.createPrivateKey() can always parse it.
 *
 * Handles every common way the key gets mangled:
 *  - Newlines stripped entirely (single-line paste into <input>)
 *  - Literal "\n" or "\\n" strings instead of real newlines
 *  - Windows \r\n line endings
 *  - Extra leading/trailing whitespace or Unicode BOM
 *  - Mixed whitespace inside the base64 body
 *  - Both PKCS#8 (BEGIN PRIVATE KEY) and PKCS#1 (BEGIN RSA PRIVATE KEY)
 *  - Keys that are already correctly formatted (no-op)
 */
function normalizePemKey(key: string): string {
  const tag = '[Snowflake:PEM]';
  console.log(
    `${tag} input: len=${key.length}, first80=${JSON.stringify(key.slice(0, 80))}, last40=${JSON.stringify(key.slice(-40))}`
  );

  // Strip BOM and outer whitespace
  let cleaned = key.replace(/^\uFEFF/, '').trim();

  // Replace literal backslash-n sequences with real newlines
  cleaned = cleaned.replace(/\\n/g, '\n');

  // Normalize Windows line endings
  cleaned = cleaned.replace(/\r\n/g, '\n');

  // Extract header, body, footer — works for any PEM label
  const match = cleaned.match(
    /^(-----BEGIN [A-Z0-9 ]+-----)\s*([\s\S]*?)\s*(-----END [A-Z0-9 ]+-----)$/
  );
  if (!match) {
    console.log(
      `${tag} NO PEM MATCH — returning as-is, first80=${JSON.stringify(cleaned.slice(0, 80))}`
    );
    return cleaned; // Not recognizable PEM — return as-is, let crypto throw a clear error
  }

  const header = match[1];
  const footer = match[3];

  // Strip ALL whitespace from the base64 body then re-wrap at 64 chars
  const body = match[2].replace(/\s+/g, '');
  const wrapped = body.match(/.{1,64}/g)?.join('\n') ?? body;

  const result = `${header}\n${wrapped}\n${footer}\n`;
  console.log(
    `${tag} normalized: header=${header}, bodyLen=${body.length}, totalLen=${result.length}, lines=${result.split('\n').length}`
  );
  return result;
}

/**
 * Parse a multi-field credential value into typed Snowflake fields.
 * Uses the shared decodeCredentialPayload() which handles both
 * base64 (injection path) and raw JSON (validator path).
 */
export function parseSnowflakeCredential(value: string): SnowflakeCredentials {
  const tag = '[Snowflake:parse]';
  console.log(
    `${tag} raw value: len=${value.length}, isBase64=${!/^{/.test(value.trim())}, first40=${JSON.stringify(value.slice(0, 40))}`
  );

  const parsed = decodeCredentialPayload<Record<string, string>>(value);
  console.log(
    `${tag} decoded: account=${parsed.account}, username=${parsed.username}, hasPrivateKey=${!!parsed.privateKey}, pkLen=${parsed.privateKey?.length ?? 0}`
  );

  if (!parsed.account || !parsed.username || !parsed.privateKey) {
    throw new Error(
      'Snowflake credential is missing required fields: account, username, privateKey'
    );
  }

  const normalizedKey = normalizePemKey(parsed.privateKey);
  console.log(
    `${tag} after normalize: pkLen=${normalizedKey.length}, startsWithHeader=${normalizedKey.startsWith('-----BEGIN')}`
  );

  return {
    account: parsed.account,
    username: parsed.username,
    privateKey: normalizedKey,
    privateKeyPassword: parsed.privateKeyPassword || undefined,
    warehouse: parsed.warehouse || undefined,
    database: parsed.database || undefined,
    schema: parsed.schema || undefined,
    role: parsed.role || undefined,
  };
}

/**
 * Generate a JWT token for Snowflake key-pair authentication.
 *
 * The JWT contains:
 * - iss: <ACCOUNT>.<USER>.SHA256:<public_key_fingerprint>
 * - sub: <ACCOUNT>.<USER>
 * - iat: current timestamp
 * - exp: current timestamp + 1 hour
 */
export function generateSnowflakeJWT(creds: SnowflakeCredentials): string {
  const tag = '[Snowflake:JWT]';
  // Snowflake JWT requires the account identifier as-is (keep hyphens)
  const accountUpper = creds.account.toUpperCase();
  const userUpper = creds.username.toUpperCase();

  console.log(
    `${tag} generating: account=${accountUpper}, user=${userUpper}, pkLen=${creds.privateKey.length}, hasPassphrase=${!!creds.privateKeyPassword}`
  );

  // Create key object from PEM private key
  let keyObject: crypto.KeyObject;
  try {
    keyObject = crypto.createPrivateKey({
      key: creds.privateKey,
      ...(creds.privateKeyPassword && {
        passphrase: creds.privateKeyPassword,
      }),
    });
    console.log(
      `${tag} createPrivateKey succeeded: type=${keyObject.asymmetricKeyType}`
    );
  } catch (err) {
    console.error(
      `${tag} createPrivateKey FAILED: ${err instanceof Error ? err.message : String(err)}`,
      `pkFirst80=${JSON.stringify(creds.privateKey.slice(0, 80))}`,
      `pkLast40=${JSON.stringify(creds.privateKey.slice(-40))}`
    );
    throw err;
  }

  // Extract public key and compute SHA-256 fingerprint
  const publicKey = crypto.createPublicKey(keyObject);
  const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
  const fingerprint = crypto
    .createHash('sha256')
    .update(publicKeyDer)
    .digest('base64');

  // Build JWT claims
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: `${accountUpper}.${userUpper}.SHA256:${fingerprint}`,
    sub: `${accountUpper}.${userUpper}`,
    iat: now,
    exp: now + 3600,
  };

  // Encode header and payload
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
    'base64url'
  );
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url'
  );
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // Sign with RSA-SHA256
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(
    {
      key: creds.privateKey,
      ...(creds.privateKeyPassword && {
        passphrase: creds.privateKeyPassword,
      }),
    },
    'base64url'
  );

  return `${signingInput}.${signature}`;
}

/**
 * Build the Snowflake SQL API base URL from the account identifier.
 */
export function getSnowflakeBaseUrl(account: string): string {
  return `https://${account.toLowerCase()}.snowflakecomputing.com`;
}

/**
 * Find a column index by name in a SHOW command result.
 * SHOW commands return variable column layouts — this finds by name safely.
 */
export function findColumnIndex(
  rowType: Array<{ name: string }>,
  columnName: string
): number {
  return rowType.findIndex(
    (col) => col.name.toLowerCase() === columnName.toLowerCase()
  );
}

/**
 * Get a cell value from a row by column name, returning undefined if not found.
 */
export function getCellByName(
  row: Array<string | null>,
  rowType: Array<{ name: string }>,
  columnName: string
): string | undefined {
  const idx = findColumnIndex(rowType, columnName);
  if (idx === -1) return undefined;
  return row[idx] ?? undefined;
}
