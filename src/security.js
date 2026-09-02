import crypto from 'node:crypto';
import { AppError } from './errors.js';

export function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  // E.164 allows up to 15 digits. International destinations are accepted so the
  // service can reach non-NANP contacts; carrier/provider coverage is enforced upstream.
  if (digits.length >= 11 && digits.length <= 15 && !digits.startsWith('0')) return `+${digits}`;
  throw new AppError(400, 'INVALID_PHONE', 'A valid E.164 phone number is required.');
}
export const newId = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
export function safeTokenEqual(expected, actual) {
  if (!expected || !actual) return false;
  const a = Buffer.from(String(expected)); const b = Buffer.from(String(actual));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function verifyHmacSha256(secret, raw, supplied) {
  if (!secret || !supplied) return false;
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const actual = String(supplied).replace(/^sha256=/i, '').trim();
  return safeTokenEqual(expected, actual);
}
export function localClock(timezone, at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(at);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}
export function insideCallingWindow(timezone, start, end, at = new Date()) {
  const clock = localClock(timezone, at);
  const current = Number(clock.hour) * 60 + Number(clock.minute);
  const [sh, sm] = start.split(':').map(Number); const [eh, em] = end.split(':').map(Number);
  return current >= sh * 60 + sm && current < eh * 60 + em;
}
export function redact(value) {
  return String(value ?? '').replace(/\+?1?[\s().-]*\d{3}[\s).-]*\d{3}[\s.-]*\d{4}/g, '[PHONE]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]');
}

export function verifyRetellSignature(apiKey, raw, supplied, { at = Date.now(), toleranceMs = 5 * 60 * 1000 } = {}) {
  if (!apiKey || !supplied) return false;
  const match = /^v=(\d+),d=(.*)$/.exec(String(supplied).trim());
  if (!match) return false;
  const [, timestamp, digest] = match;
  if (Math.abs(at - Number(timestamp)) > toleranceMs) return false;
  const expected = crypto.createHmac('sha256', apiKey).update(Buffer.concat([Buffer.from(raw), Buffer.from(timestamp)])).digest('hex');
  return safeTokenEqual(expected, digest.trim());
}
