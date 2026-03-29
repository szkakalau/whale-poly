import { google } from 'googleapis';

export type GooglePlayVerifyResult = {
  expiryTimeMillis: number;
  paymentState?: number | null;
  orderId?: string | null;
};

function loadServiceAccountJson(): Record<string, unknown> | null {
  const b64 = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_B64?.trim();
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim();
  try {
    if (b64) {
      return JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as Record<string, unknown>;
    }
    if (raw) {
      return JSON.parse(raw) as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

export function hasGooglePlayVerificationConfig(): boolean {
  return Boolean(process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim() && loadServiceAccountJson());
}

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

/**
 * Calls Google Play Developer API `purchases.subscriptions.get`.
 * Requires a Play Console–linked service account with Android Publisher API enabled.
 */
export async function verifyPlaySubscription(params: {
  packageName: string;
  productId: string;
  purchaseToken: string;
}): Promise<GooglePlayVerifyResult> {
  const creds = loadServiceAccountJson();
  if (!creds) {
    throw new Error('google_play_credentials_missing');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });

  const androidpublisher = google.androidpublisher({ version: 'v3', auth });

  try {
    const res = await androidpublisher.purchases.subscriptions.get({
      packageName: params.packageName,
      subscriptionId: params.productId,
      token: params.purchaseToken,
    });
    const data = res.data;
    const expiryRaw = data.expiryTimeMillis;
    const expiryTimeMillis =
      typeof expiryRaw === 'string' ? parseInt(expiryRaw, 10) : Number(expiryRaw ?? 0);
    if (!Number.isFinite(expiryTimeMillis) || expiryTimeMillis <= 0) {
      throw new Error('google_play_invalid_expiry');
    }
    return {
      expiryTimeMillis,
      paymentState: data.paymentState ?? null,
      orderId: data.orderId ?? null,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`google_play_verify_failed: ${msg}`);
  }
}
