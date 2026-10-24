(function(){
  'use strict';
  function lang(){ return document.documentElement.lang === 'en' ? 'en' : 'ar'; }
  var CAT = {
    news: {ar: '\u062e\u0628\u0631', en: 'News'},
    update: {ar: '\u062a\u062d\u062f\u064a\u062b', en: 'Update'},
    event: {ar: '\u0641\u0639\u0627\u0644\u064a\u0629', en: 'Event'}
  };
  var T = {
    fail: {ar: 'تعذّر تحميل الأخبار. يُرجى المحاولة مجددًا لاحقًا.', en: 'The news could not be loaded. Please try again later.'},
    upcoming: {ar: '\u0642\u0627\u062f\u0645\u0629', en: 'Upcoming'},
    ended: {ar: '\u0627\u0646\u062a\u0647\u062a', en: 'Past'},
    published: {ar: '\u0646\u064f\u0634\u0631 \u0628\u062a\u0627\u0631\u064a\u062e', en: 'Published'},
    eventDate: {ar: '\u0627\u0644\u0645\u0648\u0639\u062f', en: 'Date'},
    location: {ar: '\u0627\u0644\u0645\u0643\u0627\u0646', en: 'Location'}
  };
  function t(k){ return T[k][lang()]; }
  function catLabel(c){ return (CAT[c] || {ar: c, en: c})[lang()]; }

  var cache = [];
  var filter = 'all';

  function el(tag, cls, text){
    var n = document.createElement(tag);
    if(cls) n.className = cls;
    if(text != null) n.textContent = text;
    return n;
  }
  function fmtDate(iso){
    if(!iso) return '';
    try {
      var d = iso.length <= 10 ? new Date(iso + 'T00:00:00') : new Date(iso);
      return d.toLocaleDateString(lang() === 'ar' ? 'ar' : 'en-GB', {dateStyle: 'medium'});
    } catch(e){ return iso; }
  }
  function todayStr(){
    var d = new Date();
    function p(n){ return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function card(p){
    var l = lang();
    var c = el('div', 'card');
    var badge = el('span', 'badge cat-' + p.category, catLabel(p.category));
    c.appendChild(badge);
    c.appendChild(el('h3', null, l === 'ar' ? p.title_ar : p.title_en));
    var meta = el('p', 'news-meta', t('published') + ': ' + fmtDate(p.published_at || p.created_at));
    c.appendChild(meta);
    if(p.category === 'event' && p.event_date){
      var box = el('div', 'event-box');
      box.appendChild(el('span', null, t('eventDate') + ': ' + fmtDate(p.event_date)));
      if(p.location) box.appendChild(el('span', null, t('location') + ': ' + p.location));
      var coming = p.event_date >= todayStr();
      box.appendChild(el('span', 'badge ' + (coming ? 'active' : 'archived'), coming ? t('upcoming') : t('ended')));
      c.appendChild(box);
    } else if(p.location){
      c.appendChild(el('p', 'news-meta', t('location') + ': ' + p.location));
    }
    c.appendChild(el('p', 'news-body', l === 'ar' ? p.body_ar : p.body_en));
    return c;
  }

  function show(n, on){ if(!n) return; n.hidden = !on; n.classList.toggle('hidden', !on); }

  function render(){
    var list = document.getElementById('news-list');
    var empty = document.getElementById('news-empty');
    if(!list || !empty) return;
    list.textContent = '';
    var rows = cache.filter(function(p){ return filter === 'all' || p.category === filter; });
    show(empty, rows.length === 0);
    var tabs = document.querySelector('.tabs');
    if(tabs){ tabs.hidden = cache.length === 0; tabs.classList.toggle('hidden', cache.length === 0); }
    rows.forEach(function(p){ list.appendChild(card(p)); });
    if(window.WASH_reveal) window.WASH_reveal(list.children, 3);
  }

  function fail(){
    var empty = document.getElementById('news-empty');
    var txt = document.getElementById('news-empty-text');
    var list = document.getElementById('news-list');
    if(list){ list.textContent = ''; list.removeAttribute('aria-busy'); }
    if(txt) txt.textContent = t('fail');
    show(empty, true);
  }

  document.addEventListener('DOMContentLoaded', function(){
    var B = window.WASH_BACKEND;
    var list = document.getElementById('news-list');
    if(list){
      for(var i = 0; i < 4; i++){ list.appendChild(el('div', 'news-skeleton')); }
      list.setAttribute('aria-busy', 'true');
    }
    if(B && B.newsFeed){
      B.req(B.newsFeed).then(function(r){
        if(!r.ok) throw new Error('api');
        return r.json();
      }).then(function(rows){
        cache = Array.isArray(rows) ? rows : [];
        if(list) list.removeAttribute('aria-busy');
        render();
      }).catch(fail);
    } else {
      fail();
    }
    document.querySelectorAll('.tab[data-filter]').forEach(function(btn){
      btn.addEventListener('click', function(){
        filter = btn.getAttribute('data-filter');
        document.querySelectorAll('.tab[data-filter]').forEach(function(b){
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        render();
      });
    });

    document.querySelectorAll('.lang-toggle').forEach(function(b){
      b.addEventListener('click', function(){ render(); });
    });
  });
})();
