(function(){
  function lang(){ return document.documentElement.lang === 'en' ? 'en' : 'ar'; }
  var T = {
    sending: {ar:'جارٍ الاشتراك…', en:'Subscribing…'},
    ok: {ar:'تم اشتراكك في النشرة البريدية. أهلًا بك!', en:'You are subscribed to the newsletter. Welcome!'},
    check: {ar:'أرسلنا لك رسالة لتأكيد الاشتراك — تحقق من بريدك.', en:'Check your inbox and click the link to confirm your subscription.'},
    bad: {ar:'يرجى إدخال بريد إلكتروني صالح.', en:'Please enter a valid email address.'},
    rate: {ar:'محاولات كثيرة مؤخرًا — حاول مجددًا بعد ساعة.', en:'Too many attempts recently — please try again in an hour.'},
    fail: {ar:'تعذّر الاشتراك. حاول مجددًا لاحقًا.', en:'Could not subscribe. Please try again later.'}
  };
  function t(k){ return T[k][lang()]; }
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  document.addEventListener('DOMContentLoaded', function(){
    if(!window.WASH_BACKEND) return;
    document.querySelectorAll('form.newsletter').forEach(function(form){
      var input = form.querySelector('input[type="email"]');
      var btn = form.querySelector('button[type="submit"]');
      var status = form.querySelector('.nl-status');
      var hp = form.querySelector('input[name="website"]');
      if(!input || !btn || !status) return;
      function btnLabel(){ return document.documentElement.lang === 'en' ? (btn.getAttribute('data-en') || btn.textContent) : (btn.getAttribute('data-ar') || btn.textContent); }
      function show(ok, msg){
        status.hidden = false;
        status.classList.remove('hidden', 'text-gold', 'text-red-300');
        status.classList.add(ok ? 'text-gold' : 'text-red-300');
        status.textContent = msg;
      }
      function idle(){ btn.disabled = false; btn.removeAttribute('aria-disabled'); btn.textContent = btnLabel(); }
      form.addEventListener('submit', function(e){
        e.preventDefault();
        var email = input.value.trim();
        if(!EMAIL_RE.test(email)){
          show(false, t('bad'));
          input.setAttribute('aria-invalid', 'true'); input.focus(); return;
        }
        input.removeAttribute('aria-invalid');
        btn.disabled = true; btn.setAttribute('aria-disabled', 'true'); btn.textContent = t('sending');
        window.WASH_BACKEND.req(window.WASH_BACKEND.newsletterFn, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({email: email, lang: lang(), website: hp ? hp.value : '', ts: window.WASH_BACKEND.loadedAt})
        }).then(function(r){
          return r.json().catch(function(){ return {}; }).then(function(b){ return {st: r.status, b: b}; });
        }).then(function(x){
          if(x.st === 200 && x.b && x.b.ok){ show(true, x.b.pending ? t('check') : t('ok')); form.reset(); }
          else if(x.b && x.b.error === 'rate_limited'){ show(false, t('rate')); }
          else { show(false, t('fail')); }
          idle();
        }).catch(function(){ show(false, t('fail')); idle(); });
      });
      input.addEventListener('input', function(){
        if(input.hasAttribute('aria-invalid') && input.value.trim()){ input.removeAttribute('aria-invalid'); }
      });
    });
  });
})();
