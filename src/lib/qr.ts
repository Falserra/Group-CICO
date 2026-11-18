// Payment QR codes: cico://pay?to=<username>&merchant=<name printed in the QR>&amount=<optional>
// A personal wallet QR carries only `to`; a store's counter QR also names the store, which lets the
// scanner warn when a sticker claims to be one shop but actually pays a different account.
export type QrPayload = { to: string; merchant?: string; amount?: number };

export function buildQr(p: QrPayload) {
  const q = [`to=${encodeURIComponent(p.to)}`];
  if (p.merchant) q.push(`merchant=${encodeURIComponent(p.merchant)}`);
  if (p.amount) q.push(`amount=${p.amount}`);
  return `cico://pay?${q.join('&')}`;
}

export function parseQr(data: string): QrPayload | null {
  const m = /^cico:\/\/pay\?(.+)$/i.exec(data.trim());
  if (!m) return null;
  const params: Record<string, string> = {};
  for (const part of m[1].split('&')) {
    const [k, v = ''] = part.split('=');
    try {
      params[k] = decodeURIComponent(v.replace(/\+/g, ' '));
    } catch {
      return null;
    }
  }
  if (!params.to) return null;
  const amount = Number(params.amount);
  return { to: params.to, merchant: params.merchant || undefined, amount: amount > 0 ? amount : undefined };
}
