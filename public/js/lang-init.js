(function(){
  var root = document.documentElement;
  root.classList.add('js-enabled');
  // If main.js never initialises the reveal animation, show content anyway.
  setTimeout(function(){ if(!root.classList.contains('reveal-ready')) root.classList.remove('js-enabled'); }, 3000);
  try{
    var q = null;
    try{ q = new URLSearchParams(window.location.search).get('lang'); }catch(e){}
    var lang = (q === 'ar' || q === 'en') ? q : null;
    if(!lang){
      try{ lang = window.localStorage.getItem('wash-lang') || 'en'; }catch(e){ lang = 'en'; }
    }
    if(lang !== 'ar' && lang !== 'en') lang = 'en';
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }catch(e){}
})();
