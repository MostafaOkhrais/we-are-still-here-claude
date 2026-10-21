// Builds the Arabic pages (public/ar/*.html) and sitemap.xml from the English pages.
//
// The English pages in public/ are the source. Every element that carries data-ar / data-en gets its Arabic text,
// so the Arabic URLs (/ar/, /ar/about, ...) serve real Arabic HTML to visitors and to search engines.
// Run through `npm run build`; do not edit public/ar/*.html by hand.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://wearestillhere.uk';
const LASTMOD = '2026-10-21'; // update when page content changes
const OG_ALT_AR = 'باقون | We Are Still Here: مبادرة طلابية فلسطينية لدعم طلاب الجامعات في غزة';
const ORG_DESC_AR = 'مبادرة طلابية فلسطينية لدعم وتمكين طلاب الجامعات في غزة.';

const PAGES = [
  { name: 'index', en: '/', ar: '/ar/', priority: '1.0', desc: 'مبادرة طلابية فلسطينية تدعم طلاب الجامعات في غزة وتمكّنهم عبر التعليم والدعم الطلابي والثقافة والشراكات.' },
  { name: 'about', en: '/about', ar: '/ar/about', priority: '0.8', crumb: 'عن المبادرة وبرامجها', desc: 'قصة مبادرة باقون: رؤيتنا ورسالتنا وقيمنا، وبرامجنا الأربعة، وهيكلنا التنظيمي، وشراكاتنا.' },
  { name: 'shop', en: '/shop', ar: '/ar/shop', priority: '0.7', crumb: 'المتجر', desc: 'منتجات Teemill وكتابا المبادرة الصادران عن دار دراجا برس ورابط التبرع عبر Chuffed.' },
  { name: 'team', en: '/team', ar: '/ar/team', priority: '0.7', crumb: 'الفريق', desc: 'الفريق وراء مبادرة باقون: مجالات العمل والقيادة والمسؤوليات في مبادرة طلابية لدعم طلاب غزة.' },
  { name: 'news', en: '/news', ar: '/ar/news', priority: '0.8', crumb: 'الأخبار والفعاليات', desc: 'آخر أخبار مبادرة باقون وتحديثات برامجها والفعاليات القادمة لدعم طلاب الجامعات في غزة.' },
  { name: 'contact', en: '/contact', ar: '/ar/contact', priority: '0.6', crumb: 'تواصل معنا', desc: 'نموذج التواصل والبريد الرسمي وواتساب وروابط منصات التواصل لمبادرة باقون.' },
  { name: 'privacy', en: '/privacy', ar: '/ar/privacy', priority: '0.3', crumb: 'سياسة الخصوصية', desc: 'كيف تجمع مبادرة باقون بياناتك الشخصية وتستخدمها وتحميها: نموذج التواصل والنشرة البريدية وملفات الارتباط وحقوقك.' },
];

const attr = (tag, name) => {
  const m = new RegExp('\\s' + name + '="([^"]*)"').exec(tag);
  return m ? m[1] : null;
};

function setAttr(tag, name, value) {
  const re = new RegExp('(\\s' + name + '=")[^"]*(")');
  if (re.test(tag)) return tag.replace(re, (_, a, b) => a + value + b);
  return tag.replace(/\s*\/?>$/, (end) => ' ' + name + '="' + value + '"' + end);
}

const esc = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// <meta name|property="key" content="..."> -> new content
function setMeta(html, key, value) {
  const re = new RegExp('(<meta (?:name|property)="' + key.replace(/[.:]/g, '\\$&') + '" content=")[^"]*(")');
  if (!re.test(html)) throw new Error('missing meta ' + key);
  return html.replace(re, (_, a, b) => a + esc(value) + b);
}

function build(page) {
  let html = readFileSync(resolve(root, 'public', page.name + '.html'), 'utf8');
  const htmlTag = /<html [^>]*>/.exec(html)[0];
  const titleAr = attr(htmlTag, 'data-title-ar');
  if (!titleAr) throw new Error(page.name + ': data-title-ar missing');
  const stats = { text: 0, attrs: 0 };

  // 1. Text of every element with data-ar and no child elements (the same rule main.js uses in the browser).
  html = html.replace(/(<([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*?\sdata-ar="([^"]*)"[^<>]*>)([^<]*)(<\/\2>)/g, (m, open, tag, ar, old, close) => {
    stats.text++;
    return open + ar + close;
  });

  // 2. Placeholder, alt text and aria-label.
  html = html.replace(/<[a-zA-Z][^<>]*>/g, (tag) => {
    let t = tag;
    for (const [from, to] of [['data-ar-ph', 'placeholder'], ['data-ar-alt', 'alt'], ['data-ar-label', 'aria-label']]) {
      const v = attr(t, from);
      if (v != null) {
        t = setAttr(t, to, v);
        stats.attrs++;
      }
    }
    return t;
  });

  // Text for visitors without JavaScript (not covered by data-ar, because main.js never runs for them).
  html = html.replace('To subscribe, please turn on JavaScript or email us at ', 'للاشتراك في النشرة يُرجى تفعيل جافاسكربت أو مراسلتنا على ');

  // 3. Document language and direction.
  html = html.replace('<html lang="en" dir="ltr"', '<html lang="ar" dir="rtl"');
  html = html.replace(/aria-label="Switch to Arabic"/g, 'aria-label="Switch to English"');

  // 4. Head: title, description, canonical, social tags.
  const url = SITE + page.ar;
  html = html.replace(/<title>[^<]*<\/title>/, '<title>' + titleAr + '</title>');
  html = setMeta(html, 'description', page.desc);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, (_, a, b) => a + url + b);
  html = setMeta(html, 'og:title', titleAr);
  html = setMeta(html, 'og:description', page.desc);
  html = setMeta(html, 'og:url', url);
  html = setMeta(html, 'og:locale', 'ar_AR');
  html = setMeta(html, 'og:locale:alternate', 'en_GB');
  html = setMeta(html, 'og:image:alt', OG_ALT_AR);
  html = setMeta(html, 'twitter:title', titleAr);
  html = setMeta(html, 'twitter:description', page.desc);
  html = setMeta(html, 'twitter:image:alt', OG_ALT_AR);

  // Arabic visitors need the Arabic faces first, not Inter.
  html = html.replace('/assets/fonts/inter/Inter-Regular.woff2', '/assets/fonts/thmanyah/thmanyahsans-Regular.woff2')
    .replace('/assets/fonts/inter/Inter-ExtraBold.woff2', '/assets/fonts/thmanyah/thmanyahsans-Black.woff2');

  // 5. Structured data.
  html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (m, body) => {
    const data = JSON.parse(body);
    for (const node of data['@graph'] || [data]) {
      if (node['@type'] === 'BreadcrumbList') {
        node.itemListElement[0].name = 'الرئيسية';
        node.itemListElement[0].item = SITE + '/ar/';
        node.itemListElement[1].name = page.crumb;
        node.itemListElement[1].item = url;
      }
      if (Array.isArray(node['@type']) && node['@type'].includes('Organization')) node.description = ORG_DESC_AR;
    }
    return '<script type="application/ld+json">' + JSON.stringify(data) + '</script>';
  });

  // 6. Internal links point to the Arabic pages.
  html = html.replace(/href="(\/(?:about|shop|team|news|contact|privacy)?)(?=["#?])/g, (m, p) => 'href="/ar' + (p === '/' ? '/' : p));

  html = html.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n<!-- Generated by scripts/build-ar.mjs from ' + page.name + '.html. Edit that file, not this one. -->');

  const out = resolve(root, 'public', 'ar', page.name + '.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log('ar/' + page.name + '.html', stats);
}

function sitemap() {
  const alt = (p) =>
    '<xhtml:link rel="alternate" hreflang="en" href="' + SITE + p.en + '"/>' +
    '<xhtml:link rel="alternate" hreflang="ar" href="' + SITE + p.ar + '"/>' +
    '<xhtml:link rel="alternate" hreflang="x-default" href="' + SITE + p.en + '"/>';
  const rows = [];
  for (const p of PAGES) {
    for (const loc of [p.en, p.ar]) {
      rows.push('  <url><loc>' + SITE + loc + '</loc><lastmod>' + LASTMOD + '</lastmod><priority>' + p.priority + '</priority>' + alt(p) + '</url>');
    }
  }
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + rows.join('\n') + '\n</urlset>\n';
  writeFileSync(resolve(root, 'public', 'sitemap.xml'), xml);
  console.log('sitemap.xml:', PAGES.length * 2, 'urls');
}

PAGES.forEach(build);
sitemap();
