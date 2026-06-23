/**
 * External app URLs (auth / signals). Marketing site only links out.
 */
const trimTrail = (s: string) => s.replace(/\/$/, '');

export function getAppBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || '';
  return raw ? trimTrail(raw) : '';
}

export function getLoginUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_LOGIN_URL?.trim();
  if (explicit) return explicit;
  const base = getAppBaseUrl();
  if (base) return `${base}/login`;
  // Fallback: when no external app is configured, pricing page is at least
  // a relevant destination (it explains the product and has a CTA).
  return '/pricing';
}

export function getDashboardUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_DASHBOARD_URL?.trim();
  if (explicit) return explicit;
  const base = getAppBaseUrl();
  return base ? `${base}/dashboard` : '/pricing';
}

export function getRegisterUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_REGISTER_URL?.trim();
  if (explicit) return explicit;
  const base = getAppBaseUrl();
  return base ? `${base}/register` : getLoginUrl();
}

export function getSignalsUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SIGNALS_URL?.trim();
  if (explicit) return explicit;
  const base = getAppBaseUrl();
  return base ? `${base}/signals` : getLoginUrl();
}
