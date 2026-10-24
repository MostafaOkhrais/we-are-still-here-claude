// Search and AI-answer-engine metadata, generated from one place so the English and Arabic pages always agree.
//
// Used by scripts/build-ar.mjs. It produces:
//   - the JSON-LD graph of every page (Organization, WebSite, WebPage, BreadcrumbList, plus FAQ, programmes,
//     team, products and books where the page shows them),
//   - the visible FAQ section of the About page (the FAQ markup and its FAQPage data come from the same list),
//   - llms.txt and llms-full.txt (plain-text summaries for AI systems).
// Every fact below is taken from the site's own pages and data files. Do not add claims the site does not make.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export const SITE = 'https://wearestillhere.uk';
const ORG_ID = SITE + '/#organization';
const WEBSITE_ID = SITE + '/#website';
const OG_IMAGE = { '@type': 'ImageObject', url: SITE + '/assets/og-image.png', width: 1200, height: 630 };
const CHUFFED = 'https://chuffed.org/project/we-are-still-here';
const TEEMILL = 'https://we-are-still-here-students.teemill.com/';
const DARAJA = 'https://darajapress.com/publication/we-are-still-here/';
const EMAIL = 'info@wearestillhere.uk';

export const ORG_DESC = {
  en: 'A Palestinian student-led initiative supporting and empowering university students in Gaza.',
  ar: 'مبادرة طلابية فلسطينية لدعم وتمكين طلاب الجامعات في غزة.',
};

// ---------- data files (browser scripts that assign window.WASH_*) ----------

export function loadData(root) {
  const win = {};
  for (const f of ['team-data.js', 'shop-data.js']) {
    new Function('window', readFileSync(resolve(root, 'public/js', f), 'utf8'))(win);
  }
  return { team: win.WASH_TEAM, shop: win.WASH_SHOP };
}

// ---------- dates: the last commit that touched the files, or today when they have uncommitted changes ----------

export function lastModified(root, files) {
  const today = new Date().toISOString().slice(0, 10);
  let latest = '';
  for (const file of [].concat(files)) {
    try {
      const dirty = execFileSync('git', ['status', '--porcelain', '--', file], { cwd: root, encoding: 'utf8' }).trim();
      const d = dirty ? today : execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { cwd: root, encoding: 'utf8' }).trim();
      if (d > latest) latest = d;
    } catch (e) { /* not a git checkout */ }
  }
  return latest || today;
}

// ---------- reading the page text (so Arabic wording is never retyped here) ----------

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// Arabic text of the element whose English text is `en`.
export function arOf(html, en) {
  const esc = en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp('data-ar="([^"]*)" data-en="' + esc + '"').exec(html);
  return m ? decode(m[1]) : en;
}

// Text of the first paragraph after the heading `tag` whose English text is `en`.
export function paragraphAfter(html, tag, en, lang = 'en') {
  const esc = en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const start = new RegExp('<' + tag + '[^>]*data-en="' + esc + '"').exec(html);
  if (!start) return '';
  const p = /<p[^>]*data-ar="([^"]*)"[^>]*data-en="([^"]*)"[^>]*>/.exec(html.slice(start.index));
  return p ? decode(lang === 'ar' ? p[1] : p[2]) : '';
}

// ---------- FAQ (shown on the About page and published as FAQPage data) ----------

export const FAQ = [
  {
    q: { en: 'What is We Are Still Here | Baqoun?', ar: 'ما هي مبادرة «باقون | We Are Still Here»؟' },
    a: {
      en: 'It is a Palestinian student-led, community-based initiative that supports and empowers university students in Gaza. It began in April 2024, when Professor Zahid Pranjol started offering voluntary academic support to students in Gaza.',
      ar: 'مبادرة طلابية فلسطينية مجتمعية تدعم طلاب الجامعات في غزة وتمكّنهم. بدأت في أبريل 2024 حين شرع البروفيسور زاهد برانجول في تقديم دعم أكاديمي تطوعي لطلاب غزة.',
    },
  },
  {
    q: { en: 'Who leads the initiative?', ar: 'من يقود المبادرة؟' },
    a: {
      en: 'Professor Zahid Pranjol is the Founder and Director, and Obay Jouda is the Gaza Project Lead. The initiative has around 50 members and volunteers: around 30 in Gaza and around 20 in the United Kingdom.',
      ar: 'يتولى البروفيسور زاهد برانجول التأسيس والإدارة، ويقود أُبي جودة المشروع في غزة. ويضم الفريق نحو 50 عضوًا ومتطوعًا: نحو 30 في غزة ونحو 20 في المملكة المتحدة.',
    },
  },
  {
    q: { en: 'Which programmes does the initiative run?', ar: 'ما البرامج التي تنفذها المبادرة؟' },
    a: {
      en: 'Four programmes: the English Conversation Programme, the Comprehensive Multi-Disciplinary Academic Programme, Student Support and Financial Assistance, and Literary and Artistic Projects.',
      ar: 'أربعة برامج: برنامج المحادثة الإنجليزية، والبرنامج الأكاديمي الشامل متعدد التخصصات، ودعم الطلاب والمساعدات المالية، والمشاريع الأدبية والفنية.',
    },
  },
  {
    q: { en: 'How can I support the initiative?', ar: 'كيف يمكنني دعم المبادرة؟' },
    a: {
      en: "You can donate through our Chuffed fundraising page, or buy Teemill merchandise and our two books published by Daraja Press from the Shop page. Proceeds support student programmes in Gaza.",
      ar: 'يمكنك التبرع عبر صفحتنا على Chuffed، أو شراء منتجات Teemill وكتابينا الصادرين عن Daraja Press من صفحة المتجر. وتدعم العائدات برامج الطلاب في غزة.',
    },
  },
  {
    q: { en: 'How can I contact the initiative?', ar: 'كيف يمكنني التواصل مع المبادرة؟' },
    a: {
      en: 'Use the form on the Contact page or write to ' + EMAIL + '. We aim to reply within 24 to 48 hours.',
      ar: 'استخدم نموذج صفحة «تواصل معنا» أو راسلنا على ' + EMAIL + '. ونسعى إلى الرد خلال 24 إلى 48 ساعة.',
    },
  },
  {
    q: { en: 'Where does the initiative work?', ar: 'أين تعمل المبادرة؟' },
    a: {
      en: 'The team works across Gaza and the United Kingdom, with Palestinian field leadership in Gaza under the general supervision of the Founder.',
      ar: 'يعمل الفريق في غزة والمملكة المتحدة، بقيادة ميدانية فلسطينية في غزة تحت الإشراف العام للمؤسس.',
    },
  },
];

const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export const FAQ_START = '<!-- seo:faq:start (generated by scripts/seo.mjs) -->';
export const FAQ_END = '<!-- seo:faq:end -->';

export function faqSection() {
  const chevron = '<svg class="w-4 h-4 shrink-0 text-gold-deep transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>';
  const items = FAQ.map((f) =>
    '      <details class="reveal group bg-white rounded-[20px] border border-cream-line shadow-soft px-5 py-4">\n' +
    '        <summary class="cursor-pointer list-none flex items-center justify-between gap-4 min-h-[44px] font-extrabold text-[15px] leading-7"><span data-ar="' + escAttr(f.q.ar) + '" data-en="' + escAttr(f.q.en) + '">' + escText(f.q.en) + '</span>' + chevron + '</summary>\n' +
    '        <p class="mt-2 pb-1 text-sm leading-7 text-ink-muted" data-ar="' + escAttr(f.a.ar) + '" data-en="' + escAttr(f.a.en) + '">' + escText(f.a.en) + '</p>\n' +
    '      </details>'
  ).join('\n');
  return FAQ_START + '\n' +
    '  <section class="pb-14" aria-labelledby="faq-title">\n' +
    '    <div class="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8">\n' +
    '      <div class="mb-6">\n' +
    '        <div class="inline-flex items-center gap-2 text-xs font-extrabold tracking-[0.18em] text-gold-deep uppercase"><span class="w-8 h-px bg-gold-dark"></span><span data-ar="أسئلة شائعة" data-en="FAQ">FAQ</span></div>\n' +
    '        <h2 id="faq-title" class="reveal text-[26px] lg:text-[30px] font-extrabold mt-1" data-ar="أسئلة شائعة عن المبادرة" data-en="Frequently asked questions">Frequently asked questions</h2>\n' +
    '      </div>\n' +
    '      <div class="grid gap-3 max-w-3xl">\n' + items + '\n      </div>\n' +
    '    </div>\n' +
    '  </section>\n  ' + FAQ_END;
}

// ---------- JSON-LD ----------

const L = (lang, en, ar) => (lang === 'ar' ? ar : en);
const money = (n) => Number(n).toFixed(2);

function organization(lang, data) {
  const founder = data.team.departments[0].members[0];
  return {
    '@type': ['NGO', 'Organization'],
    '@id': ORG_ID,
    name: 'We Are Still Here | Baqoun',
    alternateName: ['Baqoun', 'باقون', 'We Are Still Here'],
    url: SITE + '/',
    logo: { '@type': 'ImageObject', url: SITE + '/assets/logo.png', width: 801, height: 729 },
    image: SITE + '/assets/og-image.png',
    description: ORG_DESC[lang],
    foundingDate: '2024-04',
    founder: { '@type': 'Person', name: L(lang, founder.nameEn, founder.nameAr), jobTitle: L(lang, founder.roleEn, founder.roleAr) },
    email: EMAIL,
    areaServed: [{ '@type': 'Place', name: L(lang, 'Gaza', 'غزة') }, { '@type': 'Country', name: L(lang, 'United Kingdom', 'المملكة المتحدة') }],
    knowsLanguage: ['en', 'ar'],
    knowsAbout: L(lang,
      ['Higher education in Gaza', 'Student support and scholarships', 'English conversation programmes', 'Academic and community partnerships', 'Literary and artistic projects'],
      ['التعليم العالي في غزة', 'دعم الطلاب والمنح الدراسية', 'برامج المحادثة الإنجليزية', 'الشراكات الأكاديمية والمجتمعية', 'المشاريع الأدبية والفنية']),
    contactPoint: { '@type': 'ContactPoint', contactType: 'general enquiries', email: EMAIL, availableLanguage: ['English', 'Arabic'] },
    potentialAction: { '@type': 'DonateAction', name: L(lang, 'Donate to support students', 'تبرع لدعم الطلاب'), target: CHUFFED, recipient: { '@id': ORG_ID } },
    sameAs: [
      'https://www.facebook.com/share/1C4kzyoLcq/?mibextid=wwXIfr',
      'https://www.instagram.com/we.are.still.here',
      'https://www.linkedin.com/company/we-are-stll-here/',
      CHUFFED,
      TEEMILL,
    ],
  };
}

function website() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE + '/',
    name: 'We Are Still Here | Baqoun',
    alternateName: ['Baqoun', 'باقون'],
    inLanguage: ['en-GB', 'ar'],
    publisher: { '@id': ORG_ID },
  };
}

function itemList(name, items) {
  return {
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, item })),
  };
}

// page: one entry of PAGES in build-ar.mjs; ctx: { title, desc, html, data }
export function pageGraph(page, lang, ctx) {
  const url = SITE + (lang === 'ar' ? page.ar : page.en);
  const pageId = url + '#webpage';
  const graph = [organization(lang, ctx.data), website()];

  const web = {
    '@type': page.type || 'WebPage',
    '@id': pageId,
    url,
    name: ctx.title,
    description: ctx.desc,
    inLanguage: page.inLanguage || (lang === 'ar' ? 'ar' : 'en-GB'),
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    primaryImageOfPage: OG_IMAGE,
  };
  graph.push(web);

  if (page.crumbEn) {
    const homeUrl = SITE + (lang === 'ar' ? '/ar/' : '/');
    web.breadcrumb = { '@id': url + '#breadcrumb' };
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': url + '#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: L(lang, 'Home', 'الرئيسية'), item: homeUrl },
        { '@type': 'ListItem', position: 2, name: L(lang, page.crumbEn, page.crumb), item: url },
      ],
    });
  }

  if (page.name === 'about') {
    const names = ['English Conversation Programme', 'Comprehensive Multi-Disciplinary Academic Programme', 'Student Support and Financial Assistance', 'Literary and Artistic Projects'];
    const programmes = names.map((n) => ({
      '@type': 'Thing',
      name: L(lang, n, arOf(ctx.html, n)),
      description: paragraphAfter(ctx.html, 'h3', n, lang),
    }));
    graph.push({ ...itemList(L(lang, 'Programmes and activities', 'البرامج والأنشطة'), programmes), '@id': url + '#programmes' });
    web.mainEntity = { '@id': ORG_ID };
    graph.push({
      '@type': 'FAQPage',
      '@id': url + '#faq',
      inLanguage: lang === 'ar' ? 'ar' : 'en-GB',
      mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q[lang], acceptedAnswer: { '@type': 'Answer', text: f.a[lang] } })),
    });
  }

  if (page.name === 'team') {
    const seen = new Set();
    const people = [];
    for (const d of ctx.data.team.departments) {
      for (const m of d.members) {
        if (seen.has(m.nameEn)) continue;
        seen.add(m.nameEn);
        people.push({ '@type': 'Person', name: L(lang, m.nameEn, m.nameAr), jobTitle: L(lang, m.roleEn, m.roleAr), image: SITE + m.photo, worksFor: { '@id': ORG_ID } });
      }
    }
    graph.push({ ...itemList(L(lang, 'The team', 'الفريق'), people), '@id': url + '#team' });
    web.mainEntity = { '@id': url + '#team' };
  }

  if (page.name === 'shop') {
    const shop = ctx.data.shop;
    const products = shop.products.map((p) => ({
      '@type': 'Product',
      name: L(lang, p.name, p.nameAr),
      description: L(lang, p.type, p.typeAr),
      image: p.img,
      brand: { '@type': 'Brand', name: 'We Are Still Here | Baqoun' },
      offers: { '@type': 'Offer', price: money(p.price), priceCurrency: shop.currency, url: shop.base + p.slug, seller: { '@id': ORG_ID } },
    }));
    const t1 = "We Are Still Here: Stories from Gaza's University Students";
    const t2 = "Beneath the Hum of Drones: On Solidarity and the Courage of Gaza's Students";
    const publisher = { '@type': 'Organization', name: 'Daraja Press' };
    const books = [
      { '@type': 'Book', name: t1, alternateName: arOf(ctx.html, t1), inLanguage: 'en', datePublished: '2026-07', publisher, url: DARAJA },
      { '@type': 'Book', name: t2, alternateName: arOf(ctx.html, t2), inLanguage: 'en', publisher, author: { '@type': 'Person', name: 'Professor Zahid Pranjol' } },
    ];
    graph.push({ ...itemList(L(lang, 'Merchandise', 'المنتجات'), products), '@id': url + '#products' });
    graph.push({ ...itemList(L(lang, 'Books', 'الكتب'), books), '@id': url + '#books' });
    web.mainEntity = { '@id': url + '#products' };
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

export function jsonLdScript(graph) {
  return '<script type="application/ld+json">' + JSON.stringify(graph).replace(/</g, '\\u003c') + '</script>';
}

// ---------- llms.txt and llms-full.txt ----------

export function llmsTxt(pages) {
  const line = (p) => '- [' + p.title + '](' + SITE + p.en + '): ' + p.desc;
  const lineAr = (p) => '- [' + p.titleAr + '](' + SITE + p.ar + '): ' + p.descAr;
  return [
    '# We Are Still Here | Baqoun (باقون)',
    '',
    '> ' + ORG_DESC.en + ' Founded in April 2024 by Professor Zahid Pranjol, it offers educational programmes, student support and financial assistance, literary and artistic projects, and academic and community partnerships. The team is around 50 members and volunteers in Gaza and the United Kingdom.',
    '',
    'The website is available in English and Arabic. Each Arabic page has its own URL under /ar/.',
    '',
    '## Pages (English)',
    '',
    ...pages.filter((p) => !p.noAr).map(line),
    '',
    '## الصفحات (العربية)',
    '',
    ...pages.filter((p) => !p.noAr).map(lineAr),
    '',
    '## Support and contact',
    '',
    '- [Donate (Chuffed)](' + CHUFFED + '): fundraising page for student programmes.',
    '- [Teemill shop](' + TEEMILL + '): merchandise; proceeds support student programmes in Gaza.',
    '- [Books (Daraja Press)](' + DARAJA + '): two published books.',
    '- Email: ' + EMAIL,
    '',
    '## Optional',
    '',
    '- [Full text for AI systems](' + SITE + '/llms-full.txt): programmes, values, team, FAQ and product list in one file.',
    '- [Sitemap](' + SITE + '/sitemap.xml)',
    '',
  ].join('\n');
}

export function llmsFullTxt({ aboutHtml, data, pages }) {
  const out = [];
  out.push('# We Are Still Here | Baqoun (باقون): full text', '', '> ' + ORG_DESC.en + ' Source: ' + SITE + '/', '');
  out.push('## About', '');
  out.push('In April 2024, Professor Zahid Pranjol began offering voluntary academic support to students in Gaza. As needs grew, these efforts developed into a student-led, community-based initiative named We Are Still Here | Baqoun.', '');
  out.push('### Vision', '', paragraphAfter(aboutHtml, 'h2', 'Vision'), '');
  out.push('### Mission', '', paragraphAfter(aboutHtml, 'h2', 'Mission'), '');
  out.push('### Core values', '');
  for (const v of ['Human Dignity', 'Student-Centredness', 'Empowerment', 'Accountability', 'Collaboration', 'Adaptability', 'Participation']) {
    out.push('- **' + v + '**: ' + paragraphAfter(aboutHtml, 'h3', v));
  }
  out.push('', '### Programmes', '');
  for (const n of ['English Conversation Programme', 'Comprehensive Multi-Disciplinary Academic Programme', 'Student Support and Financial Assistance', 'Literary and Artistic Projects']) {
    out.push('- **' + n + '**: ' + paragraphAfter(aboutHtml, 'h3', n));
  }
  out.push('', '## Frequently asked questions', '');
  for (const f of FAQ) out.push('**' + f.q.en + '**', f.a.en, '');
  out.push('## Team', '');
  for (const d of data.team.departments) {
    out.push('### ' + d.titleEn, '');
    for (const m of d.members) out.push('- ' + m.nameEn + ': ' + m.roleEn);
    out.push('');
  }
  out.push('## Shop (prices in ' + data.shop.currency + ', sold through Teemill)', '');
  for (const p of data.shop.products) out.push('- ' + p.name + ' (' + p.type + '): £' + money(p.price) + ' - ' + data.shop.base + p.slug);
  out.push('', '### Books', '',
    "- We Are Still Here: Stories from Gaza's University Students (Daraja Press, July 2026): " + DARAJA,
    "- Beneath the Hum of Drones: On Solidarity and the Courage of Gaza's Students, by Professor Zahid Pranjol (Daraja Press)", '');
  out.push('## Pages', '', ...pages.filter((p) => !p.noAr).map((p) => '- ' + p.title + ': ' + SITE + p.en + ' (Arabic: ' + SITE + p.ar + ')'), '');
  out.push('## Contact', '', '- Email: ' + EMAIL, '- Contact form: ' + SITE + '/contact', '- Donate: ' + CHUFFED, '');
  return out.join('\n');
}
