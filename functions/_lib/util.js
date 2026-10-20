// Shared helpers for the API. No framework: plain Workers runtime + D1.

export const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

export function json(status, body, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign(
      {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
      extra || {}
    ),
  });
}

export function redirect(location, status) {
  return new Response(null, { status: status || 303, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

export class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function nowSec() {
  return Math.floor(Date.now() / 1000);
}

// ---------- encoding / crypto ----------

const enc = new TextEncoder();

export function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function b64(buf) {
  let s = '';
  new Uint8Array(buf).forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

export function unb64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256Hex(input) {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(input)));
}

export function randomToken(bytes) {
  const a = new Uint8Array(bytes || 32);
  crypto.getRandomValues(a);
  return toHex(a);
}

export function safeEqual(a, b) {
  a = String(a);
  b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// PBKDF2-SHA256 (Workers cap iterations at 100000).
const PBKDF2_ITER = 100000;

async function pbkdf2(password, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await pbkdf2(password, salt, PBKDF2_ITER);
  return 'pbkdf2$' + PBKDF2_ITER + '$' + b64(salt) + '$' + b64(bits);
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iter = parseInt(parts[1], 10);
  if (!(iter > 0 && iter <= PBKDF2_ITER)) return false;
  const bits = await pbkdf2(password, unb64(parts[2]), iter);
  return safeEqual(b64(bits), parts[3]);
}

// Verified against a throwaway hash when the account does not exist, so response time does not reveal it.
export const DUMMY_HASH = 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

// ---------- request helpers ----------

export function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || '';
}

// Cloudflare always sets CF-Connecting-IP. If it is missing (local dev) everyone shares one bucket: fail closed.
export async function ipHash(request, env) {
  return sha256Hex((env.IP_SALT || 'wash-default-salt') + ':' + (clientIp(request) || 'unknown'));
}

export function siteUrl(request, env) {
  const configured = String(env.SITE_URL || '').replace(/\/+$/, '');
  return configured || new URL(request.url).origin;
}

// State-changing requests must come from our own origin (defence in depth on top of SameSite cookies).
export function requireSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin) {
    let host;
    try {
      host = new URL(origin).host;
    } catch (e) {
      throw new HttpError(403, 'forbidden');
    }
    if (host !== new URL(request.url).host) throw new HttpError(403, 'forbidden');
  } else if (request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new HttpError(403, 'forbidden');
  }
}

export async function readJson(request, maxBytes) {
  const ct = request.headers.get('content-type') || '';
  if (!ct.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'unsupported_media_type');
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > (maxBytes || 65536)) throw new HttpError(413, 'too_large');
  const text = await request.text();
  if (text.length > (maxBytes || 65536)) throw new HttpError(413, 'too_large');
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw 0;
    return v;
  } catch (e) {
    throw new HttpError(400, 'bad_request');
  }
}

// Read-only check: has this key already reached the limit in the current window?
export async function rateExceeded(env, key, limit, windowSec) {
  const row = await env.DB.prepare('SELECT count FROM rate_limits WHERE key = ?1 AND window_start > ?2')
    .bind(key, nowSec() - windowSec).first();
  return !!row && row.count >= limit;
}

// Fixed-window counter in D1. Returns true while the caller is under the limit.
export async function rateLimit(env, key, limit, windowSec) {
  const now = nowSec();
  const cutoff = now - windowSec;
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN window_start <= ?3 THEN 1 ELSE count + 1 END,
       window_start = CASE WHEN window_start <= ?3 THEN ?2 ELSE window_start END
     RETURNING count`
  )
    .bind(key, now, cutoff)
    .first();
  return !!row && row.count <= limit;
}

// ---------- text helpers ----------

export function cleanLine(v, max) {
  return String(v == null ? '' : v)
    .replace(/[\u0000-\u001F\u007F\u2028\u2029]+/g, ' ')
    .trim()
    .slice(0, max);
}

export function cleanText(v, max) {
  return String(v == null ? '' : v)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function countLinks(s) {
  const m = String(s).match(/https?:\/\/|www\./gi);
  return m ? m.length : 0;
}

export function parseId(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 2147483647) throw new HttpError(404, 'not_found');
  return n;
}

// ---------- cookies ----------

export function parseCookies(request) {
  const out = {};
  (request.headers.get('cookie') || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });
  return out;
}
