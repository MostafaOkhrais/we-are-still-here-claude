(function(){
  'use strict';
  var TOKEN_RE = /^[a-f0-9]{64}$/;
  function $(id){ return document.getElementById(id); }
  function show(id){
    ['st-confirmed', 'st-unsubscribe', 'st-unsubscribed', 'st-invalid'].forEach(function(s){ $(s).hidden = s !== id; });
    $('st-actions').hidden = id === 'st-unsubscribe';
  }
  document.addEventListener('DOMContentLoaded', function(){
    var q = new URLSearchParams(window.location.search);
    var status = q.get('status');
    var token = q.get('token') || '';
    try { history.replaceState(null, '', window.location.pathname); } catch(e){}
    if(status === 'confirmed') return show('st-confirmed');
    if(status === 'unsubscribed') return show('st-unsubscribed');
    if(status === 'unsubscribe' && TOKEN_RE.test(token)){
      show('st-unsubscribe');
      var btn = $('unsub-btn');
      btn.addEventListener('click', function(){
        btn.disabled = true;
        $('unsub-error').hidden = true;
        window.WASH_BACKEND.req('/api/newsletter/unsubscribe', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({token: token})
        }).then(function(r){
          if(!r.ok) throw new Error('fail');
          show('st-unsubscribed');
        }).catch(function(){ btn.disabled = false; $('unsub-error').hidden = false; });
      });
      return;
    }
    show('st-invalid');
  });
})();
