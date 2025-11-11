import crypto from 'crypto';

type GenerateTokenOptions = {
  expiresInSeconds?: number;
  audience?: 'v' | 'a' | 't'; // video, audio, thumbnail
};

/**
 * Generate a Mux signed playback token (JWT RS256).
 * Env:
 * - MUX_SIGNING_KEY_ID
 * - MUX_SIGNING_PRIVATE_KEY (PEM)
 */
export function generateMuxPlaybackToken(playbackId: string, opts: GenerateTokenOptions = {}): string {
  const keyId = process.env.MUX_SIGNING_KEY_ID || '';
  let privateKey = process.env.MUX_SIGNING_PRIVATE_KEY || '';
  if (!keyId || !privateKey) {
    throw new Error('Mux signing env not configured');
  }
  // Handle escaped newlines in private key
  privateKey = privateKey.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n').trim();

  const now = Math.floor(Date.now() / 1000);
  const exp = now + (opts.expiresInSeconds ?? 15 * 60); // default 15 minutes
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: keyId,
  };
  const payload: Record<string, any> = {
    sub: playbackId,
    aud: opts.audience ?? 'v',
    exp,
    iat: now,
  };

  const base64url = (input: Buffer | string) =>
    Buffer.from(input)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = signer.sign(privateKey);
  const encodedSignature = base64url(signature);
  return `${signingInput}.${encodedSignature}`;
}


