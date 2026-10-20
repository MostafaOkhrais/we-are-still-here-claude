// Transactional email through Resend (https://resend.com). Optional: without RESEND_API_KEY the
// site still works, it just stores data and sends nothing (newsletter then needs no confirmation).
// EMAIL_DRY_RUN=1 logs emails to the console instead of sending (local testing).

import { escapeHtml } from './util.js';

const COLORS = { olive: '#3A4D2A', cream: '#FAF9F6', gold: '#C9B48A', ink: '#1E1E1E', muted: '#5C5C5C' };

export function emailEnabled(env) {
  return !!(env.RESEND_API_KEY || env.EMAIL_DRY_RUN);
}

function fromAddress(env) {
  return env.EMAIL_FROM || 'We Are Still Here <noreply@wearestillhere.uk>';
}

async function resend(env, path, payload) {
  if (env.EMAIL_DRY_RUN) {
    console.log('[email:dry-run]', path, JSON.stringify(payload, null, 1).slice(0, 1800));
    return { ok: true };
  }
  const res = await fetch('https://api.resend.com' + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    console.error('[email] resend failed', res.status);
    return { ok: false, status: res.status };
  }
  return { ok: true };
}

export function sendEmail(env, msg) {
  if (!emailEnabled(env)) return Promise.resolve({ ok: false, status: 0 });
  const payload = { from: fromAddress(env), to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text };
  if (msg.replyTo) payload.reply_to = msg.replyTo;
  if (msg.headers) payload.headers = msg.headers;
  return resend(env, '/emails', payload).catch((e) => {
    console.error('[email] error', e && e.message);
    return { ok: false, status: 0 };
  });
}

// Up to 100 messages per call.
export function sendBatch(env, messages) {
  const payload = messages.map((m) => ({
    from: fromAddress(env),
    to: [m.to],
    subject: m.subject,
    html: m.html,
    text: m.text,
    headers: m.headers,
  }));
  return resend(env, '/emails/batch', payload).catch((e) => {
    console.error('[email] batch error', e && e.message);
    return { ok: false, status: 0 };
  });
}

export function layout(lang, bodyHtml, footerHtml) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  return (
    '<!doctype html><html lang="' + lang + '" dir="' + dir + '"><body style="margin:0;background:' + COLORS.cream + ';font-family:Arial,Helvetica,sans-serif;color:' + COLORS.ink + ';">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #E8E0D0;border-radius:16px;overflow:hidden;" cellpadding="0" cellspacing="0">' +
    '<tr><td style="background:' + COLORS.olive + ';color:#fff;padding:18px 24px;font-weight:bold;font-size:16px;">We Are Still Here | باقون</td></tr>' +
    '<tr><td style="padding:24px;font-size:15px;line-height:1.7;">' + bodyHtml + '</td></tr>' +
    '<tr><td style="padding:16px 24px;border-top:1px solid #E8E0D0;font-size:12px;color:' + COLORS.muted + ';">' + (footerHtml || '') + '</td></tr>' +
    '</table></td></tr></table></body></html>'
  );
}

export function button(href, label) {
  return '<p style="margin:24px 0;"><a href="' + escapeHtml(href) + '" style="display:inline-block;background:' + COLORS.olive + ';color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;">' + escapeHtml(label) + '</a></p>';
}

const T = {
  confirm: {
    en: { subject: 'Confirm your subscription', hi: 'Thank you for subscribing to our newsletter.', ask: 'Please confirm your email address to start receiving updates:', cta: 'Confirm subscription', ign: 'If you did not request this, you can ignore this email and nothing will happen.' },
    ar: { subject: 'أكّد اشتراكك في النشرة', hi: 'شكرًا لاشتراكك في نشرتنا البريدية.', ask: 'يرجى تأكيد بريدك الإلكتروني لبدء استلام الأخبار:', cta: 'تأكيد الاشتراك', ign: 'إن لم تطلب هذا الاشتراك فتجاهل هذه الرسالة ولن يحدث شيء.' },
  },
  welcome: {
    en: { subject: 'You are subscribed', hi: 'Your subscription is confirmed. Welcome!', more: 'We will write to you with news from the initiative and Gaza\'s university students.' },
    ar: { subject: 'تم تأكيد اشتراكك', hi: 'تم تأكيد اشتراكك. أهلًا بك!', more: 'سنراسلك بأخبار المبادرة وطلبة جامعات غزة.' },
  },
  unsub: { en: 'Unsubscribe', ar: 'إلغاء الاشتراك' },
  receipt: {
    en: { subject: 'We received your message', hi: 'Thank you for contacting us.', more: 'We received your message and will reply as soon as we can.' },
    ar: { subject: 'استلمنا رسالتك', hi: 'شكرًا لتواصلك معنا.', more: 'استلمنا رسالتك وسنرد عليك في أقرب وقت.' },
  },
};

export function confirmEmail(lang, confirmUrl) {
  const t = T.confirm[lang] || T.confirm.en;
  const body = '<p>' + t.hi + '</p><p>' + t.ask + '</p>' + button(confirmUrl, t.cta) + '<p style="font-size:12px;color:' + COLORS.muted + ';">' + t.ign + '</p>';
  return { subject: t.subject, html: layout(lang, body), text: t.hi + '\n\n' + t.ask + '\n' + confirmUrl + '\n\n' + t.ign };
}

export function welcomeEmail(lang, unsubUrl) {
  const t = T.welcome[lang] || T.welcome.en;
  const u = T.unsub[lang] || T.unsub.en;
  const body = '<p><strong>' + t.hi + '</strong></p><p>' + t.more + '</p>';
  const footer = '<a href="' + escapeHtml(unsubUrl) + '" style="color:' + COLORS.muted + ';">' + u + '</a>';
  return { subject: t.subject, html: layout(lang, body, footer), text: t.hi + '\n\n' + t.more + '\n\n' + u + ': ' + unsubUrl };
}

export function receiptEmail(lang) {
  const t = T.receipt[lang] || T.receipt.en;
  return { subject: t.subject, html: layout(lang, '<p><strong>' + t.hi + '</strong></p><p>' + t.more + '</p>'), text: t.hi + '\n\n' + t.more };
}

export function adminNotifyEmail(m) {
  const row = (k, v) => '<tr><td style="padding:4px 12px 4px 0;color:' + COLORS.muted + ';vertical-align:top;">' + k + '</td><td style="padding:4px 0;">' + escapeHtml(v) + '</td></tr>';
  const body =
    '<p><strong>New contact message</strong></p><table role="presentation" cellpadding="0" cellspacing="0">' +
    row('Name', m.name) + row('Email', m.email) + row('Subject', m.subject || '-') + row('Language', m.lang) +
    '</table><p style="white-space:pre-wrap;border-inline-start:3px solid ' + COLORS.gold + ';padding-inline-start:12px;">' + escapeHtml(m.message) + '</p>';
  return {
    subject: 'New message: ' + (m.subject || m.name),
    html: layout('en', body, 'Sent from the website contact form. Reply to this email to answer the sender.'),
    text: 'New contact message\n\nName: ' + m.name + '\nEmail: ' + m.email + '\nSubject: ' + (m.subject || '-') + '\n\n' + m.message,
  };
}

// Admin newsletter: plain text body (paragraphs) rendered into the branded layout.
export function campaignEmail(lang, subject, bodyText, unsubUrl) {
  const paras = String(bodyText).split(/\n{2,}/).map((p) => '<p>' + escapeHtml(p).replace(/\n/g, '<br>') + '</p>').join('');
  const u = T.unsub[lang] || T.unsub.en;
  const footer = '<a href="' + escapeHtml(unsubUrl) + '" style="color:' + COLORS.muted + ';">' + u + '</a>';
  return { subject, html: layout(lang, paras, footer), text: bodyText + '\n\n' + u + ': ' + unsubUrl };
}

export function unsubscribeHeaders(unsubUrl) {
  return { 'List-Unsubscribe': '<' + unsubUrl + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
}
