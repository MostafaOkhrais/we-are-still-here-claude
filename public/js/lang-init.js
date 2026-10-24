(function(){
  var root = document.documentElement;
  try{ window.localStorage.removeItem('wash-lang'); }catch(e){}
  root.classList.add('js-enabled');
  // If main.js never initialises the reveal animation, show content anyway.
  setTimeout(function(){ if(!root.classList.contains('reveal-ready')) root.classList.remove('js-enabled'); }, 3000);
  // Content built by scripts before main.js has loaded (products, team members, news) is hidden at once,
  // so it can fade in without a flash. main.js replaces this with the version that also observes the elements.
  window.WASH_reveal = function(nodes, perRow){
    Array.prototype.forEach.call(nodes, function(el, i){
      el.classList.add('reveal');
      el.style.setProperty('--reveal-delay', ((perRow ? i % perRow : Math.min(i, 5)) * 0.08) + 's');
    });
  };
  // The English and Arabic pages each have their own URL (/about and /ar/about) and their markup already carries the language.
  if(root.hasAttribute('data-url-lang')) return;
  try{
    var q = null;
    try{ q = new URLSearchParams(window.location.search).get('lang'); }catch(e){}
    var lang = (q === 'ar' || q === 'en') ? q : null;
    // A page can name its own default (the /links page opens in Arabic); every other page defaults to English.
    var def = root.getAttribute('data-default-lang') === 'ar' ? 'ar' : 'en';
    if(!lang){
      try{ lang = window.localStorage.getItem('wash-lang-v2') || def; }catch(e){ lang = def; }
    }
    if(lang !== 'ar' && lang !== 'en') lang = def;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }catch(e){}
})();
