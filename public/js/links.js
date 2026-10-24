(function(){
  var root = document.documentElement;
  var KEY = 'wash-lang-v2';
  var TITLES = {
    ar: 'الروابط الرسمية | We Are Still Here | باقون',
    en: 'Official links | We Are Still Here | Baqoun'
  };

  function apply(lang){
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = TITLES[lang];
    document.querySelectorAll('[data-ar][data-en]').forEach(function(el){ el.textContent = el.getAttribute('data-' + lang); });
    document.querySelectorAll('[data-ar-label]').forEach(function(el){ el.setAttribute('aria-label', el.getAttribute('data-' + lang + '-label')); });
    document.querySelectorAll('[data-ar-alt]').forEach(function(el){ el.setAttribute('alt', el.getAttribute('data-' + lang + '-alt')); });
    document.querySelectorAll('[data-href-ar]').forEach(function(el){ el.setAttribute('href', el.getAttribute('data-href-' + lang)); });
    document.querySelectorAll('[data-set-lang]').forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-set-lang') === lang ? 'true' : 'false'); });
  }

  // lang-init.js has already chosen the language (?lang=, the saved choice, or Arabic by default) before the page was painted.
  var start = root.lang === 'en' ? 'en' : 'ar';
  if(start === 'en') apply('en');

  document.querySelectorAll('[data-set-lang]').forEach(function(b){
    b.addEventListener('click', function(){
      var lang = b.getAttribute('data-set-lang');
      apply(lang);
      try{ window.localStorage.setItem(KEY, lang); }catch(e){}
    });
  });

  var dialog = document.getElementById('qr-dialog');
  if(!dialog) return;
  function openQr(){ if(typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', ''); }
  function closeQr(){ if(typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); }
  document.querySelectorAll('[data-qr-open]').forEach(function(b){ b.addEventListener('click', openQr); });
  document.getElementById('qr-close').addEventListener('click', closeQr);
  dialog.addEventListener('click', function(e){ if(e.target === dialog) closeQr(); });
})();
