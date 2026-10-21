(function(){
  var root = document.documentElement;
  try{ window.localStorage.removeItem('wash-lang'); }catch(e){}
  root.classList.add('js-enabled');
  // If main.js never initialises the reveal animation, show content anyway.
  setTimeout(function(){ if(!root.classList.contains('reveal-ready')) root.classList.remove('js-enabled'); }, 3000);
  // The English and Arabic pages each have their own URL (/about and /ar/about) and their markup already carries the language.
  if(root.hasAttribute('data-url-lang')) return;
  try{
    var q = null;
    try{ q = new URLSearchParams(window.location.search).get('lang'); }catch(e){}
    var lang = (q === 'ar' || q === 'en') ? q : null;
    if(!lang){
      try{ lang = window.localStorage.getItem('wash-lang-v2') || 'en'; }catch(e){ lang = 'en'; }
    }
    if(lang !== 'ar' && lang !== 'en') lang = 'en';
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }catch(e){}
})();
