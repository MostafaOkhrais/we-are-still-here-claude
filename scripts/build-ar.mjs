// Builds the Arabic pages (public/ar/*.html), sitemap.xml, llms.txt and llms-full.txt from the English pages.
//
// The English pages in public/ are the source. Every element that carries data-ar / data-en gets its Arabic text,
// so the Arabic URLs (/ar/, /ar/about, ...) serve real Arabic HTML to visitors and to search engines.
// It also keeps the generated search metadata of the English pages up to date (JSON-LD, the About FAQ): see scripts/seo.mjs.
// Run through `npm run build`; do not edit public/ar/*.html by hand.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, loadData, lastModified, pageGraph, jsonLdScript, faqSection, FAQ_START, FAQ_END, llmsTxt, llmsFullTxt } from './seo.mjs';
import { TEAM_START, TEAM_END, SHOP_START, SHOP_END, teamHtml, shopHtml, insertBlock } from './prerender.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OG_ALT_AR = 'باقون | We Are Still Here: مبادرة طلابية فلسطينية لدعم طلاب الجامعات في غزة';

// data: files whose content appears on the page (they decide its sitemap date)
const PAGES = [
  { name: 'index', en: '/', ar: '/ar/', priority: '1.0', type: 'WebPage', data: [], desc: 'مبادرة طلابية فلسطينية تدعم طلاب الجامعات في غزة وتمكّنهم عبر التعليم والدعم الطلابي والثقافة والشراكات.' },
  { name: 'about', en: '/about', ar: '/ar/about', priority: '0.8', type: 'AboutPage', crumbEn: 'About and Programmes', crumb: 'عن المبادرة وبرامجها', data: [], desc: 'قصة مبادرة باقون: من الدعم الأكاديمي التطوعي عام 2024 إلى مبادرة طلابية ببرامجها الأربعة لطلاب الجامعات في غزة، مع الرؤية والرسالة والقيم والشراكات.' },
  { name: 'shop', en: '/shop', ar: '/ar/shop', priority: '0.7', type: 'CollectionPage', crumbEn: 'Shop', crumb: 'المتجر', data: ['public/js/shop-data.js'], desc: 'مطبوعات فنية وحقائب وبطاقات من Teemill وكتابان صادران عن دار Daraja Press. تدعم العائدات برامج الطلاب في غزة.' },
  { name: 'team', en: '/team', ar: '/ar/team', priority: '0.7', type: 'CollectionPage', crumbEn: 'Team', crumb: 'الفريق', data: ['public/js/team-data.js'], desc: 'تعرّف على فريق مبادرة باقون: قيادة ميدانية فلسطينية في غزة ومتطوعون في المملكة المتحدة، بإشراف المؤسس العام.' },
  { name: 'news', en: '/news', ar: '/ar/news', priority: '0.8', type: 'CollectionPage', crumbEn: 'News and Events', crumb: 'الأخبار والفعاليات', data: [], desc: 'أخبار مبادرة باقون وتحديثات برامجها والفعاليات القادمة لدعم طلاب الجامعات في غزة.' },
  { name: 'contact', en: '/contact', ar: '/ar/contact', priority: '0.6', type: 'ContactPage', crumbEn: 'Contact', crumb: 'تواصل معنا', data: [], desc: 'تواصل مع مبادرة باقون عبر نموذج التواصل أو البريد info@wearestillhere.uk أو واتساب أو منصات التواصل. نسعى إلى الرد خلال 24 إلى 48 ساعة.' },
  { name: 'privacy', en: '/privacy', ar: '/ar/privacy', priority: '0.3', type: 'WebPage', crumbEn: 'Privacy Policy', crumb: 'سياسة الخصوصية', data: [], desc: 'كيف تجمع مبادرة باقون بياناتك الشخصية وتستخدمها وتحميها: نموذج التواصل والنشرة البريدية وملفات الارتباط وحقوقك.' },
  // One page for both languages (no /ar/ twin): only its structured data and its sitemap entry are generated here.
  { name: 'links', en: '/links', noAr: true, priority: '0.5', type: 'WebPage', inLanguage: ['ar', 'en-GB'], data: [], desc: '' },
];

const data = loadData(root);
const info = [];

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

const LD = /<script type="application\/ld\+json">[\s\S]*?<\/script>/;
const titleOf = (html) => /<title>([^<]*)<\/title>/.exec(html)[1].replace(/&amp;/g, '&');
const descOf = (html) => (/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '';

// The English source page: write the FAQ (About) and the JSON-LD into it, and only when they changed.
function prepare(page) {
  const file = resolve(root, 'public', page.name + '.html');
  const original = readFileSync(file, 'utf8');
  let html = original;

  if (page.name === 'about') {
    const faq = faqSection();
    const a = html.indexOf(FAQ_START);
    const b = html.indexOf(FAQ_END);
    if (a >= 0 && b > a) html = html.slice(0, a) + faq + html.slice(b + FAQ_END.length);
    else html = html.replace('</main>', () => faq + '\n</main>');
  }
  if (page.name === 'team') html = insertBlock(html, '<div id="team-sections" class="space-y-12">', TEAM_START, TEAM_END, teamHtml(data.team));
  if (page.name === 'shop') html = insertBlock(html, '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5" id="shop-grid">', SHOP_START, SHOP_END, shopHtml(data.shop));

  const title = titleOf(html);
  const desc = descOf(html);
  const script = jsonLdScript(pageGraph(page, 'en', { title, desc, html, data }));
  html = LD.test(html) ? html.replace(LD, () => script) : html.replace('</head>', () => script + '\n</head>');

  if (html !== original) writeFileSync(file, html);
  const modified = lastModified(root, ['public/' + page.name + '.html', ...page.data]);
  const titleAr = (/data-title-ar="([^"]*)"/.exec(html) || [])[1];
  info.push({ ...page, title, desc, titleAr, descAr: page.desc, modified });
}

function build(page) {
  let html = readFileSync(resolve(root, 'public', page.name + '.html'), 'utf8');
  const sourceHtml = html;
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
    // A tooltip repeats the element's label (icon links).
    const label = attr(t, 'data-ar-label');
    if (label != null && attr(t, 'title') != null) t = setAttr(t, 'title', label);
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

  // 5. Structured data: the same generator as the English page, in Arabic.
  html = html.replace(LD, () => jsonLdScript(pageGraph(page, 'ar', { title: titleAr, desc: page.desc, html: sourceHtml, data })));

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
  for (const p of info) {
    if (p.noAr) {
      rows.push('  <url><loc>' + SITE + p.en + '</loc><lastmod>' + p.modified + '</lastmod><priority>' + p.priority + '</priority></url>');
      continue;
    }
    for (const loc of [p.en, p.ar]) {
      rows.push('  <url><loc>' + SITE + loc + '</loc><lastmod>' + p.modified + '</lastmod><priority>' + p.priority + '</priority>' + alt(p) + '</url>');
    }
  }
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + rows.join('\n') + '\n</urlset>\n';
  writeFileSync(resolve(root, 'public', 'sitemap.xml'), xml);
  console.log('sitemap.xml:', rows.length, 'urls');
}

function llms() {
  const aboutHtml = readFileSync(resolve(root, 'public', 'about.html'), 'utf8');
  writeFileSync(resolve(root, 'public', 'llms.txt'), llmsTxt(info));
  writeFileSync(resolve(root, 'public', 'llms-full.txt'), llmsFullTxt({ aboutHtml, data, pages: info }));
  console.log('llms.txt, llms-full.txt');
}

PAGES.forEach(prepare);
PAGES.filter((p) => !p.noAr).forEach(build);
sitemap();
llms();
