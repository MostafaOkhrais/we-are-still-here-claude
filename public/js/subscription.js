(function(){
  'use strict';
  var TOKEN_RE = /^[a-f0-9]{64}$/;
  function $(id){ return document.getElementById(id); }
  function show(id){
    ['st-confirm', 'st-confirmed', 'st-unsubscribe', 'st-unsubscribed', 'st-invalid'].forEach(function(s){ $(s).hidden = s !== id; });
    $('st-actions').hidden = id === 'st-unsubscribe' || id === 'st-confirm';
  }
  // A button that sends the token to the API: the email link alone changes nothing (mail scanners follow links).
  function armButton(btnId, errId, path, doneId, token){
    var btn = $(btnId);
    btn.addEventListener('click', function(){
      btn.disabled = true;
      $(errId).hidden = true;
      window.WASH_BACKEND.req(path, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({token: token})
      }).then(function(r){
        if(!r.ok) throw new Error('fail');
        show(doneId);
      }).catch(function(){ btn.disabled = false; $(errId).hidden = false; });
    });
  }
  document.addEventListener('DOMContentLoaded', function(){
    var q = new URLSearchParams(window.location.search);
    var status = q.get('status');
    var token = q.get('token') || '';
    try { history.replaceState(null, '', window.location.pathname); } catch(e){}
    if(status === 'confirmed') return show('st-confirmed');
    if(status === 'unsubscribed') return show('st-unsubscribed');
    if(status === 'confirm' && TOKEN_RE.test(token)){
      show('st-confirm');
      armButton('confirm-btn', 'confirm-error', '/api/newsletter/confirm', 'st-confirmed', token);
      return;
    }
    if(status === 'unsubscribe' && TOKEN_RE.test(token)){
      show('st-unsubscribe');
      armButton('unsub-btn', 'unsub-error', '/api/newsletter/unsubscribe', 'st-unsubscribed', token);
      return;
    }
    show('st-invalid');
  });
})();
