// Public endpoints: contact form, newsletter (double opt-in), news feed.

import {
  EMAIL_RE, HttpError, json, redirect, readJson, requireSameOrigin, rateLimit, ipHash, siteUrl, randomToken,
  cleanLine, cleanText, countLinks, nowIso,
} from './util.js';
import {
  emailEnabled, sendEmail, confirmEmail, welcomeEmail, receiptEmail, adminNotifyEmail, unsubscribeHeaders,
} from './email.js';

const HOUR = 3600;
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
  if (hash && !(await rateLimit(env, 'contact:' + hash, 5, HOUR))) throw new HttpError(429, 'rate_limited');
  if (!(await rateLimit(env, 'contact:all', 300, HOUR))) throw new HttpError(429, 'rate_limited');

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
  const ua = cleanLine(request.headers.get('user-agent') || '', 300) || null;
  await env.DB.prepare(
    'INSERT INTO contact_messages (name, email, subject, message, lang, ip_hash, user_agent, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)'
  ).bind(name, email, subject, message, lang, hash, ua, nowIso()).run();

  if (emailEnabled(env)) {
    const jobs = [];
    if (env.NOTIFY_EMAIL) {
      const n = adminNotifyEmail({ name, email, subject, message, lang });
      jobs.push(sendEmail(env, { to: env.NOTIFY_EMAIL, replyTo: email, subject: n.subject, html: n.html, text: n.text }));
    }
    if (env.CONTACT_RECEIPT === '1') {
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
  if (hash && !(await rateLimit(env, 'news:' + hash, 10, HOUR))) throw new HttpError(429, 'rate_limited');
  if (!(await rateLimit(env, 'news:all', 400, HOUR))) throw new HttpError(429, 'rate_limited');

  const b = await readJson(request, 8192);
  if (looksLikeBot(b)) return json(200, { ok: true });

  const email = cleanLine(b.email, 254).toLowerCase();
  const nameRaw = cleanLine(b.name, 120);
  const lang = b.lang === 'ar' ? 'ar' : 'en';
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'invalid_email');

  const withEmail = emailEnabled(env);
  const base = siteUrl(request, env);
  const now = nowIso();
  let confirmToken = randomToken(32);
  const unsubToken = randomToken(32);
  let sendConfirm = false;

  const inserted = await env.DB.prepare(
    `INSERT INTO subscribers (email, name, lang, status, confirm_token, unsub_token, ip_hash, created_at, confirm_sent_at, confirmed_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
     ON CONFLICT(email) DO NOTHING RETURNING id`
  ).bind(email, nameRaw || null, lang, withEmail ? 'pending' : 'active', confirmToken, unsubToken, hash, now, withEmail ? now : null, withEmail ? null : now).first();

  if (inserted) {
    sendConfirm = withEmail;
  } else if (withEmail) {
    // Existing address: never change state without proof of ownership (confirmation link).
    const row = await env.DB.prepare('SELECT status, confirm_sent_at, unsub_token FROM subscribers WHERE email = ?1').bind(email).first();
    if (row && row.status !== 'active') {
      // Pending addresses get a new email at most every 10 minutes; an unsubscribed one may re-subscribe at once.
      const last = row.confirm_sent_at ? Date.parse(row.confirm_sent_at) : 0;
      if (row.status === 'unsubscribed' || Date.now() - last > 10 * 60 * 1000) {
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
  return json(200, { ok: true, pending: withEmail });
}

export async function confirm(context) {
  const { request, env } = context;
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!TOKEN_RE.test(token)) return redirect('/subscription?status=invalid');
  const found = await env.DB.prepare('SELECT status FROM subscribers WHERE confirm_token = ?1').bind(token).first();
  if (!found || found.status === 'unsubscribed') return redirect('/subscription?status=invalid');
  if (found.status === 'active') return redirect('/subscription?status=confirmed');
  const row = await env.DB.prepare(
    `UPDATE subscribers SET status = 'active', confirmed_at = ?1, unsubscribed_at = NULL
     WHERE confirm_token = ?2 AND status = 'pending' RETURNING email, lang, unsub_token`
  ).bind(nowIso(), token).first();
  if (!row) return redirect('/subscription?status=confirmed');
  if (emailEnabled(env)) {
    const unsubUrl = siteUrl(request, env) + '/api/newsletter/unsubscribe?token=' + row.unsub_token;
    const m = welcomeEmail(row.lang, unsubUrl);
    context.waitUntil(sendEmail(env, { to: row.email, subject: m.subject, html: m.html, text: m.text, headers: unsubscribeHeaders(unsubUrl) }));
  }
  return redirect('/subscription?status=confirmed');
}

// GET (link in an email): show a confirmation page, so mail scanners that prefetch links cannot unsubscribe anyone.
// POST (page button, or RFC 8058 one-click from the mail client): performs the unsubscribe.
export async function unsubscribe(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const t = url.searchParams.get('token') || '';
    return redirect(TOKEN_RE.test(t) ? '/subscription?status=unsubscribe&token=' + t : '/subscription?status=invalid');
  }
  requireSameOrigin(request);
  let token = url.searchParams.get('token') || '';
  if (!TOKEN_RE.test(token) && (request.headers.get('content-type') || '').startsWith('application/json')) {
    const b = await readJson(request, 1024);
    token = String(b.token || '');
  }
  if (!TOKEN_RE.test(token)) throw new HttpError(400, 'invalid_token');
  const hash = await ipHash(request, env);
  if (hash && !(await rateLimit(env, 'unsub:' + hash, 30, HOUR))) throw new HttpError(429, 'rate_limited');
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
