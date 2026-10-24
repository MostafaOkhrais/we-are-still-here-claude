// Public endpoints: contact form, newsletter (double opt-in), news feed.

import {
  EMAIL_RE, HttpError, json, redirect, readJson, requireSameOrigin, rateLimit, ipHash, emailHash, siteUrl, randomToken,
  cleanLine, cleanText, countLinks, nowIso,
} from './util.js';
import {
  emailEnabled, sendEmail, confirmEmail, welcomeEmail, receiptEmail, adminNotifyEmail, unsubscribeHeaders,
} from './email.js';

const HOUR = 3600;
const DAY = 86400;
const TOKEN_RE = /^[a-f0-9]{64}$/;

// Messages that look automated are accepted silently so bots learn nothing.
function looksLikeBot(b) {
  if (String(b.website == null ? '' : b.website).trim() !== '') return true;
  const ts = Number(b.ts);
  if (Number.isFinite(ts) && ts > 0) {
    const elapsed = Date.now() - ts;
    if (elapsed >= 0 && elapsed < 1500) return true;
  }
  return false;
}

export async function contact(context) {
  const { request, env } = context;
  requireSameOrigin(request);
  const hash = await ipHash(request, env);
  if (!(await rateLimit(env, 'contact:' + hash, 5, HOUR))) throw new HttpError(429, 'rate_limited');

  const b = await readJson(request, 16384);
  if (looksLikeBot(b)) return json(200, { ok: true });

  const name = cleanLine(b.name, 120);
  const email = cleanLine(b.email, 254).toLowerCase();
  const subjectRaw = cleanLine(b.subject, 200);
  const message = cleanText(b.message, 5000);
  const lang = b.lang === 'ar' ? 'ar' : 'en';

  if (name.length < 2) throw new HttpError(400, 'invalid_name');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'invalid_email');
  if (message.length < 10) throw new HttpError(400, 'invalid_message');
  if (countLinks(message) > 3) return json(200, { ok: true });

  const subject = subjectRaw || null;
  const ua = cleanLine(request.headers.get('user-agent') || '', 100) || null;
  await env.DB.prepare(
    'INSERT INTO contact_messages (name, email, subject, message, lang, ip_hash, user_agent, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)'
  ).bind(name, email, subject, message, lang, hash, ua, nowIso()).run();

  if (emailEnabled(env)) {
    const jobs = [];
    if (env.NOTIFY_EMAIL) {
      const n = adminNotifyEmail({ name, email, subject, message, lang });
      jobs.push(sendEmail(env, { to: env.NOTIFY_EMAIL, replyTo: email, subject: n.subject, html: n.html, text: n.text }));
    }
    // The receipt goes to an address the visitor typed: cap it per address so the form cannot be used to mail-bomb someone.
    if (env.CONTACT_RECEIPT === '1' && (await rateLimit(env, 'receipt:' + (await emailHash(env, email)), 3, DAY))) {
      const r = receiptEmail(lang);
      jobs.push(sendEmail(env, { to: email, subject: r.subject, html: r.html, text: r.text }));
    }
    if (jobs.length) context.waitUntil(Promise.all(jobs));
  }
  return json(200, { ok: true });
}

export async function subscribe(context) {
  const { request, env } = context;
  requireSameOrigin(request);
  const hash = await ipHash(request, env);
  if (!(await rateLimit(env, 'news:' + hash, 10, HOUR))) throw new HttpError(429, 'rate_limited');

  const b = await readJson(request, 8192);
  if (looksLikeBot(b)) return json(200, { ok: true });

  const email = cleanLine(b.email, 254).toLowerCase();
  const nameRaw = cleanLine(b.name, 120);
  const lang = b.lang === 'ar' ? 'ar' : 'en';
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'invalid_email');

  // Every address must prove ownership through the confirmation email, so sign-ups need a mail provider.
  if (!emailEnabled(env)) throw new HttpError(503, 'newsletter_unavailable');
  // At most 3 confirmation emails per address per day (counted only when one would really be sent).
  // The reply stays the same either way, so nothing is revealed.
  const mayEmail = async () => rateLimit(env, 'news-addr:' + (await emailHash(env, email)), 3, DAY);

  const base = siteUrl(request, env);
  const now = nowIso();
  const confirmToken = randomToken(32);
  const unsubToken = randomToken(32);
  let sendConfirm = false;

  const inserted = await env.DB.prepare(
    `INSERT INTO subscribers (email, name, lang, status, confirm_token, unsub_token, ip_hash, created_at, confirm_sent_at)
     VALUES (?1, ?2, ?3, 'pending', ?4, ?5, ?6, ?7, ?7)
     ON CONFLICT(email) DO NOTHING RETURNING id`
  ).bind(email, nameRaw || null, lang, confirmToken, unsubToken, hash, now).first();

  if (inserted) {
    sendConfirm = await mayEmail();
  } else {
    // Existing address: never change state without proof of ownership (confirmation link).
    const row = await env.DB.prepare('SELECT status, confirm_sent_at, unsub_token FROM subscribers WHERE email = ?1').bind(email).first();
    if (row && row.status !== 'active') {
      // Pending addresses get a new email at most every 10 minutes; an unsubscribed one may re-subscribe at once.
      const last = row.confirm_sent_at ? Date.parse(row.confirm_sent_at) : 0;
      if ((row.status === 'unsubscribed' || Date.now() - last > 10 * 60 * 1000) && (await mayEmail())) {
        await env.DB.prepare(
          "UPDATE subscribers SET status = 'pending', confirm_token = ?1, confirm_sent_at = ?2, unsubscribed_at = NULL, lang = ?3 WHERE email = ?4"
        ).bind(confirmToken, now, lang, email).run();
        sendConfirm = true;
      }
    }
  }

  if (sendConfirm) {
    const url = base + '/api/newsletter/confirm?token=' + confirmToken;
    const m = confirmEmail(lang, url);
    context.waitUntil(sendEmail(env, { to: email, subject: m.subject, html: m.html, text: m.text }));
  }
  // Same answer in every case: no way to tell whether an address is already subscribed.
  return json(200, { ok: true, pending: true });
}

// The page that follows an email link opens in the subscriber's language.
async function pageLang(env, column, token) {
  const row = await env.DB.prepare('SELECT lang FROM subscribers WHERE ' + column + ' = ?1').bind(token).first();
  return row && row.lang === 'ar' ? '&lang=ar' : '&lang=en';
}

// GET (link in an email): show a page with a button, so mail scanners that prefetch links cannot confirm anyone.
// POST (page button): activates the subscription.
export async function confirm(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const t = url.searchParams.get('token') || '';
    if (!TOKEN_RE.test(t)) return redirect('/subscription?status=invalid');
    return redirect('/subscription?status=confirm&token=' + t + (await pageLang(env, 'confirm_token', t)));
  }
  requireSameOrigin(request);
  const b = await readJson(request, 1024);
  const token = String(b.token || '');
  if (!TOKEN_RE.test(token)) throw new HttpError(400, 'invalid_token');
  const hash = await ipHash(request, env);
  if (!(await rateLimit(env, 'confirm:' + hash, 30, HOUR))) throw new HttpError(429, 'rate_limited');
  const found = await env.DB.prepare('SELECT status FROM subscribers WHERE confirm_token = ?1').bind(token).first();
  if (!found || found.status === 'unsubscribed') throw new HttpError(404, 'not_found');
  if (found.status === 'active') return json(200, { ok: true });
  const row = await env.DB.prepare(
    `UPDATE subscribers SET status = 'active', confirmed_at = ?1, unsubscribed_at = NULL
     WHERE confirm_token = ?2 AND status = 'pending' RETURNING email, lang, unsub_token`
  ).bind(nowIso(), token).first();
  if (row && emailEnabled(env)) {
    const unsubUrl = siteUrl(request, env) + '/api/newsletter/unsubscribe?token=' + row.unsub_token;
    const m = welcomeEmail(row.lang, unsubUrl);
    context.waitUntil(sendEmail(env, { to: row.email, subject: m.subject, html: m.html, text: m.text, headers: unsubscribeHeaders(unsubUrl) }));
  }
  return json(200, { ok: true });
}

// GET (link in an email): show a confirmation page, so mail scanners that prefetch links cannot unsubscribe anyone.
// POST (page button, or RFC 8058 one-click from the mail client): performs the unsubscribe.
export async function unsubscribe(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const t = url.searchParams.get('token') || '';
    if (!TOKEN_RE.test(t)) return redirect('/subscription?status=invalid');
    return redirect('/subscription?status=unsubscribe&token=' + t + (await pageLang(env, 'unsub_token', t)));
  }
  requireSameOrigin(request);
  let token = url.searchParams.get('token') || '';
  if (!TOKEN_RE.test(token) && (request.headers.get('content-type') || '').startsWith('application/json')) {
    const b = await readJson(request, 1024);
    token = String(b.token || '');
  }
  if (!TOKEN_RE.test(token)) throw new HttpError(400, 'invalid_token');
  const hash = await ipHash(request, env);
  if (!(await rateLimit(env, 'unsub:' + hash, 30, HOUR))) throw new HttpError(429, 'rate_limited');
  const row = await env.DB.prepare(
    "UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = ?1 WHERE unsub_token = ?2 RETURNING id"
  ).bind(nowIso(), token).first();
  if (!row) throw new HttpError(404, 'not_found');
  return json(200, { ok: true });
}

export async function news(context) {
  const { env } = context;
  const { results } = await env.DB.prepare(
    `SELECT id, title_ar, title_en, body_ar, body_en, category, event_date, location, published_at, created_at
       FROM news_posts WHERE published = 1
      ORDER BY published_at IS NULL, published_at DESC, created_at DESC LIMIT 50`
  ).all();
  return json(200, results, { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' });
}
