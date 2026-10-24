// Admin API: cookie sessions (HttpOnly, SameSite=Strict, hashed in D1), CSRF checks, CRUD, newsletter sending.

import {
  EMAIL_RE, HttpError, json, readJson, requireSameOrigin, rateLimit, ipHash, siteUrl, randomToken, sha256Hex,
  verifyPassword, DUMMY_HASH, cleanLine, cleanText, parseCookies, parseId, nowIso, nowSec,
} from './util.js';
import { emailEnabled, sendBatch, campaignEmail, unsubscribeHeaders } from './email.js';

const SESSION_TTL = 12 * 3600;
const MAX_RECIPIENTS = 2000; // 20 batches of 100: stays under the 50-subrequest limit of the Workers free plan
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

function secure(request) {
  return new URL(request.url).protocol === 'https:';
}

function cookieName(request) {
  return secure(request) ? '__Host-wash_session' : 'wash_session';
}

function sessionCookie(request, value, maxAge) {
  return cookieName(request) + '=' + value + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + maxAge + (secure(request) ? '; Secure' : '');
}

async function currentAdmin(context) {
  const { request, env } = context;
  const token = parseCookies(request)[cookieName(request)] || '';
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await env.DB.prepare(
    `SELECT a.id, a.email FROM sessions s JOIN admins a ON a.id = s.admin_id
      WHERE s.token_hash = ?1 AND s.expires_at > ?2`
  ).bind(await sha256Hex(token), nowSec()).first();
  return row || null;
}

async function requireAdmin(context) {
  const { request } = context;
  const admin = await currentAdmin(context);
  if (!admin) throw new HttpError(401, 'unauthorized');
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    requireSameOrigin(request);
    if (request.headers.get('x-requested-with') !== 'wash') throw new HttpError(403, 'forbidden');
  }
  return admin;
}

// ---------- session ----------

export async function login(context) {
  const { request, env } = context;
  requireSameOrigin(request);
  const hash = await ipHash(request, env);
  const b = await readJson(request, 2048);
  const email = cleanLine(b.email, 254).toLowerCase();
  const password = String(b.password == null ? '' : b.password).slice(0, 256);

  // Every attempt is counted BEFORE the slow password check (the counter is an atomic upsert), so parallel
  // requests cannot all slip under the limit. A successful login clears the per-account counter below.
  // The per-account counter is scoped to the caller's IP, so a stranger cannot lock the real admin out.
  const ipKey = 'login-ip:' + hash;
  const accKey = 'login-acc:' + (await sha256Hex(email + '|' + hash));
  if (!(await rateLimit(env, ipKey, 20, 900)) || !(await rateLimit(env, accKey, 5, 900))) throw new HttpError(429, 'rate_limited');

  const fail = () => { throw new HttpError(401, 'invalid_credentials'); };
  if (!EMAIL_RE.test(email) || !password) await fail();

  const admin = await env.DB.prepare('SELECT id, email, password_hash FROM admins WHERE email = ?1').bind(email).first();
  const ok = await verifyPassword(password, admin ? admin.password_hash : DUMMY_HASH);
  if (!admin || !ok) await fail();

  const token = randomToken(32);
  const now = nowSec();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?1').bind(now),
    env.DB.prepare('DELETE FROM rate_limits WHERE key = ?1').bind(accKey),
    env.DB.prepare('INSERT INTO sessions (token_hash, admin_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)').bind(await sha256Hex(token), admin.id, now, now + SESSION_TTL),
    env.DB.prepare('UPDATE admins SET last_login_at = ?1 WHERE id = ?2').bind(nowIso(), admin.id),
  ]);
  return json(200, { ok: true, email: admin.email }, { 'Set-Cookie': sessionCookie(request, token, SESSION_TTL) });
}

export async function logout(context) {
  const { request, env } = context;
  requireSameOrigin(request);
  const token = parseCookies(request)[cookieName(request)] || '';
  if (/^[a-f0-9]{64}$/.test(token)) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(await sha256Hex(token)).run();
  }
  return json(200, { ok: true }, { 'Set-Cookie': sessionCookie(request, '', 0) });
}

export async function me(context) {
  const admin = await currentAdmin(context);
  if (!admin) throw new HttpError(401, 'unauthorized');
  return json(200, { email: admin.email, emailEnabled: emailEnabled(context.env) });
}

// ---------- stats ----------

export async function stats(context) {
  await requireAdmin(context);
  const { env } = context;
  const [m, s, p] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n FROM contact_messages WHERE status = 'new'").first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM subscribers WHERE status = 'active'").first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM subscribers WHERE status = 'pending'").first(),
  ]);
  return json(200, { newMessages: m.n, activeSubscribers: s.n, pendingSubscribers: p.n });
}

// ---------- messages ----------

export async function listMessages(context) {
  await requireAdmin(context);
  const { results } = await context.env.DB.prepare(
    'SELECT id, name, email, subject, message, lang, status, created_at FROM contact_messages ORDER BY created_at DESC, id DESC LIMIT 500'
  ).all();
  return json(200, results);
}

export async function updateMessage(context, idRaw) {
  await requireAdmin(context);
  const id = parseId(idRaw);
  const b = await readJson(context.request, 1024);
  if (!['new', 'read', 'replied', 'archived'].includes(b.status)) throw new HttpError(400, 'invalid_status');
  const r = await context.env.DB.prepare('UPDATE contact_messages SET status = ?1 WHERE id = ?2').bind(b.status, id).run();
  if (!r.meta.changes) throw new HttpError(404, 'not_found');
  return json(200, { ok: true });
}

export async function deleteMessage(context, idRaw) {
  await requireAdmin(context);
  const r = await context.env.DB.prepare('DELETE FROM contact_messages WHERE id = ?1').bind(parseId(idRaw)).run();
  if (!r.meta.changes) throw new HttpError(404, 'not_found');
  return json(200, { ok: true });
}

// ---------- subscribers ----------

export async function listSubscribers(context) {
  await requireAdmin(context);
  const { results } = await context.env.DB.prepare(
    'SELECT id, email, name, lang, status, created_at, confirmed_at FROM subscribers ORDER BY created_at DESC, id DESC LIMIT 5000'
  ).all();
  return json(200, results);
}

export async function updateSubscriber(context, idRaw) {
  await requireAdmin(context);
  const id = parseId(idRaw);
  const b = await readJson(context.request, 1024);
  let r;
  if (b.status === 'unsubscribed') {
    r = await context.env.DB.prepare("UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = ?1 WHERE id = ?2").bind(nowIso(), id).run();
  } else if (b.status === 'active') {
    r = await context.env.DB.prepare("UPDATE subscribers SET status = 'active', unsubscribed_at = NULL, confirmed_at = COALESCE(confirmed_at, ?1) WHERE id = ?2").bind(nowIso(), id).run();
  } else {
    throw new HttpError(400, 'invalid_status');
  }
  if (!r.meta.changes) throw new HttpError(404, 'not_found');
  return json(200, { ok: true });
}

export async function deleteSubscriber(context, idRaw) {
  await requireAdmin(context);
  const r = await context.env.DB.prepare('DELETE FROM subscribers WHERE id = ?1').bind(parseId(idRaw)).run();
  if (!r.meta.changes) throw new HttpError(404, 'not_found');
  return json(200, { ok: true });
}

// ---------- news posts ----------

function postFields(b, partial) {
  const out = {};
  const need = (k, max, min) => {
    if (b[k] === undefined && partial) return;
    const v = cleanText(b[k], max);
    if (v.length < (min || 1)) throw new HttpError(400, 'invalid_' + k);
    out[k] = v;
  };
  need('title_ar', 200, 3);
  need('title_en', 200, 3);
  need('body_ar', 20000);
  need('body_en', 20000);
  if (b.category !== undefined || !partial) {
    if (!['news', 'update', 'event'].includes(b.category || 'news')) throw new HttpError(400, 'invalid_category');
    out.category = b.category || 'news';
  }
  if (b.event_date !== undefined || !partial) {
    const d = b.event_date ? String(b.event_date) : null;
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new HttpError(400, 'invalid_event_date');
    out.event_date = d;
  }
  if (b.location !== undefined || !partial) out.location = cleanLine(b.location, 200) || null;
  if (b.published !== undefined || !partial) out.published = b.published ? 1 : 0;
  return out;
}

export async function listPosts(context) {
  await requireAdmin(context);
  const { results } = await context.env.DB.prepare(
    `SELECT id, title_ar, title_en, body_ar, body_en, category, event_date, location, published, published_at, created_at
       FROM news_posts ORDER BY created_at DESC, id DESC LIMIT 500`
  ).all();
  return json(200, results.map((r) => Object.assign(r, { published: !!r.published })));
}

export async function createPost(context) {
  await requireAdmin(context);
  const f = postFields(await readJson(context.request, 200000), false);
  const now = nowIso();
  const r = await context.env.DB.prepare(
    `INSERT INTO news_posts (title_ar, title_en, body_ar, body_en, category, event_date, location, published, published_at, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10) RETURNING id`
  ).bind(f.title_ar, f.title_en, f.body_ar, f.body_en, f.category, f.event_date, f.location, f.published, f.published ? now : null, now).first();
  return json(201, { ok: true, id: r.id });
}

export async function updatePost(context, idRaw) {
  await requireAdmin(context);
  const id = parseId(idRaw);
  const f = postFields(await readJson(context.request, 200000), true);
  const keys = Object.keys(f);
  if (!keys.length) throw new HttpError(400, 'nothing_to_update');
  const now = nowIso();
  const sets = keys.map((k, i) => k + ' = ?' + (i + 1));
  const vals = keys.map((k) => f[k]);
  let sql = 'UPDATE news_posts SET ' + sets.join(', ') + ', updated_at = ?' + (keys.length + 1);
  vals.push(now);
  if (f.published === 1) {
    sql += ', published_at = COALESCE(published_at, ?' + (keys.length + 2) + ')';
    vals.push(now);
  }
  sql += ' WHERE id = ?' + (vals.length + 1);
  vals.push(id);
  const r = await context.env.DB.prepare(sql).bind(...vals).run();
  if (!r.meta.changes) throw new HttpError(404, 'not_found');
  return json(200, { ok: true });
}

export async function deletePost(context, idRaw) {
  await requireAdmin(context);
  const r = await context.env.DB.prepare('DELETE FROM news_posts WHERE id = ?1').bind(parseId(idRaw)).run();
  if (!r.meta.changes) throw new HttpError(404, 'not_found');
  return json(200, { ok: true });
}

// ---------- newsletter campaigns ----------

export async function listCampaigns(context) {
  await requireAdmin(context);
  const { results } = await context.env.DB.prepare(
    'SELECT id, subject, sent_count, failed_count, created_by, created_at FROM campaigns ORDER BY id DESC LIMIT 20'
  ).all();
  return json(200, results);
}

export async function sendCampaign(context) {
  const admin = await requireAdmin(context);
  const { request, env } = context;
  if (!emailEnabled(env)) throw new HttpError(400, 'email_disabled');

  const b = await readJson(request, 100000);
  const subject = cleanLine(b.subject, 150);
  const body = cleanText(b.body, 20000);
  const audience = ['all', 'ar', 'en'].includes(b.audience) ? b.audience : 'all';
  if (subject.length < 3) throw new HttpError(400, 'invalid_subject');
  if (body.length < 10) throw new HttpError(400, 'invalid_body');
  const base = siteUrl(request, env);

  const build = (sub) => {
    const url = base + '/api/newsletter/unsubscribe?token=' + sub.unsub_token;
    const m = campaignEmail(sub.lang, subject, body, url);
    return { to: sub.email, subject: m.subject, html: m.html, text: m.text, headers: unsubscribeHeaders(url) };
  };

  if (b.test) {
    if (!(await rateLimit(env, 'campaign-test:' + admin.id, 20, 3600))) throw new HttpError(429, 'rate_limited');
    const res = await sendBatch(env, [build({ email: admin.email, lang: 'en', unsub_token: 'test' })]);
    return json(res.ok ? 200 : 502, res.ok ? { ok: true, sent: 1, test: true } : { error: 'send_failed' });
  }
  if (!(await rateLimit(env, 'campaign:' + admin.id, 5, 3600))) throw new HttpError(429, 'rate_limited');

  // Refuse instead of silently leaving the later subscribers out.
  const where = "status = 'active'" + (audience === 'all' ? '' : ' AND lang = ?1');
  const countStmt = env.DB.prepare('SELECT COUNT(*) AS n FROM subscribers WHERE ' + where);
  const { n } = await (audience === 'all' ? countStmt : countStmt.bind(audience)).first();
  if (!n) throw new HttpError(400, 'no_recipients');
  if (n > MAX_RECIPIENTS) return json(409, { error: 'too_many_recipients', count: n, max: MAX_RECIPIENTS });

  // A double click or a retry after a timeout must not mail everyone twice.
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const dup = await env.DB.prepare('SELECT id FROM campaigns WHERE subject = ?1 AND body = ?2 AND created_at > ?3').bind(subject, body, since).first();
  if (dup) throw new HttpError(409, 'duplicate_campaign');

  const listStmt = env.DB.prepare('SELECT email, lang, unsub_token FROM subscribers WHERE ' + where + ' ORDER BY id');
  const { results } = await (audience === 'all' ? listStmt : listStmt.bind(audience)).all();

  // Recorded before sending, so an interrupted send still leaves a trace and blocks an immediate repeat.
  const { id } = await env.DB.prepare('INSERT INTO campaigns (subject, body, sent_count, failed_count, created_by, created_at) VALUES (?1, ?2, 0, 0, ?3, ?4) RETURNING id')
    .bind(subject, body, admin.email, nowIso()).first();

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < results.length; i += 100) {
    const chunk = results.slice(i, i + 100);
    const res = await sendBatch(env, chunk.map(build));
    if (res.ok) sent += chunk.length;
    else failed += chunk.length;
  }
  await env.DB.prepare('UPDATE campaigns SET sent_count = ?1, failed_count = ?2 WHERE id = ?3').bind(sent, failed, id).run();
  if (!sent) return json(502, { error: 'send_failed', sent, failed });
  return json(200, { ok: true, sent, failed });
}
