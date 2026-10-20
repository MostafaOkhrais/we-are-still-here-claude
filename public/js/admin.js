(function(){
  'use strict';
  function lang(){ return document.documentElement.lang === 'ar' ? 'ar' : 'en'; }
  var T = {
    loginFail: {ar:'بيانات الدخول غير صحيحة.', en:'Incorrect sign-in details.'},
    rate: {ar:'محاولات كثيرة — حاول لاحقًا.', en:'Too many attempts — try again later.'},
    expired: {ar:'انتهت الجلسة — سجّل الدخول مجددًا.', en:'Session expired — please sign in again.'},
    loadFail: {ar:'تعذّر تحميل البيانات.', en:'Could not load data.'},
    saveFail: {ar:'تعذّر حفظ التغيير.', en:'Could not save the change.'},
    welcome: {ar:'مرحبًا', en:'Welcome'},
    noRows: {ar:'لا توجد عناصر بعد.', en:'No items yet.'},
    unsub: {ar:'إلغاء الاشتراك', en:'Unsubscribe'},
    resub: {ar:'إعادة تفعيل', en:'Reactivate'},
    del: {ar:'حذف', en:'Delete'},
    confirmDelete: {ar:'اضغط مرة أخرى للحذف', en:'Click again to delete'},
    subjectFallback: {ar:'(بدون موضوع)', en:'(no subject)'},
    st: {
      new: {ar:'جديدة', en:'New'}, read: {ar:'مقروءة', en:'Read'},
      replied: {ar:'تم الرد', en:'Replied'}, archived: {ar:'مؤرشفة', en:'Archived'},
      active: {ar:'نشط', en:'Active'}, pending: {ar:'بانتظار التأكيد', en:'Pending'}, unsubscribed: {ar:'ملغي', en:'Unsubscribed'}
    }
  };
  function t(k){ return T[k][lang()]; }
  function stLabel(s){ return (T.st[s] || {ar: s, en: s})[lang()]; }

  var B = window.WASH_BACKEND || {};
  var msgRows = [], subRows = [], postRows = [];
  var emailOn = false;

  function api(path, opts){
    opts = opts || {};
    var headers = {'X-Requested-With': 'wash'};
    if(opts.body) headers['Content-Type'] = 'application/json';
    return fetch('/api/admin' + path, {
      method: opts.method || 'GET',
      headers: headers,
      credentials: 'same-origin',
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function(r){
      return r.json().catch(function(){ return null; }).then(function(b){
        if(r.status === 401){ var e = new Error('auth'); e.code = 'auth'; throw e; }
        if(!r.ok){ var e2 = new Error('api'); e2.code = (b && b.error) || 'api'; e2.status = r.status; throw e2; }
        return b;
      });
    });
  }

  function el(tag, cls, text){
    var n = document.createElement(tag);
    if(cls) n.className = cls;
    if(text != null) n.textContent = text;
    return n;
  }
  function fmtDate(iso){
    try { return new Date(iso).toLocaleString(lang() === 'ar' ? 'ar' : 'en-GB', {dateStyle: 'medium', timeStyle: 'short'}); }
    catch(e){ return iso; }
  }
  function showSt(id, cls, msg){
    var s = document.getElementById(id);
    if(!s) return;
    s.hidden = false; s.className = 'form-status ' + cls; s.textContent = msg;
  }
  function hideSt(id){ var s = document.getElementById(id); if(s) s.hidden = true; }
  function $(id){ return document.getElementById(id); }

  function showApp(email){
    $('login-view').hidden = true;
    $('app-view').hidden = false;
    $('admin-who').textContent = t('welcome') + (lang() === 'ar' ? '، ' : ', ') + email;
    loadAll();
  }
  function showLogin(){
    $('app-view').hidden = true;
    $('login-view').hidden = false;
  }
  function logout(msg){
    showLogin();
    api('/logout', {method: 'POST'}).catch(function(){});
    if(msg) showSt('login-status', 'err', msg);
  }
  function authOr(fn){
    return function(e){
      if(e && e.code === 'auth'){ logout(t('expired')); return; }
      fn(e);
    };
  }

  function emptyRow(tbody, cols){
    var tr = el('tr'), td = el('td', null, t('noRows'));
    td.setAttribute('colspan', String(cols));
    tr.appendChild(td); tbody.appendChild(tr);
  }

  // Two-step delete button: first click arms it, second click confirms.
  function deleteButton(onConfirm){
    var btn = el('button', 'btn ghost', t('del'));
    btn.setAttribute('type', 'button');
    var armed = null;
    btn.addEventListener('click', function(){
      if(!armed){
        btn.textContent = t('confirmDelete');
        armed = setTimeout(function(){ armed = null; btn.textContent = t('del'); }, 4000);
        return;
      }
      clearTimeout(armed); armed = null;
      btn.disabled = true;
      onConfirm(btn);
    });
    return btn;
  }

  function loadStats(){
    return api('/stats').then(function(s){
      $('stat-new').textContent = String(s.newMessages);
      $('stat-subs').textContent = String(s.activeSubscribers);
      var p = $('stat-pending'); if(p) p.textContent = String(s.pendingSubscribers);
    }).catch(authOr(function(){}));
  }

  // ---- messages ----
  function renderMessages(rows){
    msgRows = Array.isArray(rows) ? rows : [];
    var tbody = document.querySelector('#msg-table tbody');
    tbody.textContent = '';
    if(!msgRows.length){ emptyRow(tbody, 5); }
    msgRows.forEach(function(m){
      var tr = el('tr');
      tr.appendChild(el('td', null, fmtDate(m.created_at)));
      tr.appendChild(el('td', null, m.name || ''));
      var tdE = el('td'), a = el('a', null, m.email || '');
      a.setAttribute('href', 'mailto:' + encodeURIComponent(m.email || '')); a.setAttribute('dir', 'ltr');
      tdE.appendChild(a); tr.appendChild(tdE);
      var tdM = el('td', 'msg');
      var det = el('details'), sum = el('summary', null, (m.subject || t('subjectFallback')));
      det.appendChild(sum); det.appendChild(el('p', null, m.message || '')); det.appendChild(el('small', null, (m.lang === 'ar' ? 'AR' : 'EN')));
      tdM.appendChild(det); tr.appendChild(tdM);
      var tdS = el('td'), sel = el('select', 'status-sel');
      ['new', 'read', 'replied', 'archived'].forEach(function(s){
        var o = el('option', null, stLabel(s));
        o.value = s; if(m.status === s) o.selected = true;
        sel.appendChild(o);
      });
      sel.setAttribute('aria-label', stLabel(m.status));
      sel.addEventListener('change', function(){ setMsgStatus(m.id, sel.value, sel); });
      tdS.appendChild(sel);
      tdS.appendChild(deleteButton(function(){
        api('/messages/' + encodeURIComponent(m.id), {method: 'DELETE'})
          .then(function(){ loadMessages(true); loadStats(); })
          .catch(authOr(function(){ showSt('app-status', 'err', t('saveFail')); loadMessages(true); }));
      }));
      tr.appendChild(tdS);
      tbody.appendChild(tr);
    });
  }
  function setMsgStatus(id, status, sel){
    sel.disabled = true;
    api('/messages/' + encodeURIComponent(id), {method: 'PATCH', body: {status: status}})
      .then(function(){ sel.disabled = false; sel.setAttribute('aria-label', stLabel(status)); loadStats(); })
      .catch(authOr(function(){ sel.disabled = false; showSt('app-status', 'err', t('saveFail')); loadMessages(true); }));
  }
  function loadMessages(quiet){
    return api('/messages').then(renderMessages).catch(authOr(function(){
      if(!quiet) showSt('app-status', 'err', t('loadFail'));
    }));
  }

  // ---- subscribers ----
  function renderSubs(rows){
    subRows = Array.isArray(rows) ? rows : [];
    var tbody = document.querySelector('#sub-table tbody');
    tbody.textContent = '';
    if(!subRows.length){ emptyRow(tbody, 5); }
    subRows.forEach(function(s){
      var tr = el('tr');
      var tdE = el('td'), a = el('a', null, s.email || '');
      a.setAttribute('href', 'mailto:' + encodeURIComponent(s.email || '')); a.setAttribute('dir', 'ltr');
      tdE.appendChild(a); tr.appendChild(tdE);
      tr.appendChild(el('td', null, s.name || '—'));
      tr.appendChild(el('td', null, fmtDate(s.created_at)));
      var tdB = el('td'); tdB.appendChild(el('span', 'badge ' + (s.status === 'unsubscribed' ? 'archived' : s.status), stLabel(s.status)));
      tr.appendChild(tdB);
      var tdA = el('td');
      var btn = el('button', 'btn ghost', s.status === 'active' ? t('unsub') : t('resub'));
      btn.setAttribute('type', 'button');
      btn.addEventListener('click', function(){ toggleSub(s, btn); });
      tdA.appendChild(btn);
      tdA.appendChild(deleteButton(function(){
        api('/subscribers/' + encodeURIComponent(s.id), {method: 'DELETE'})
          .then(function(){ loadSubs(); loadStats(); })
          .catch(authOr(function(){ showSt('app-status', 'err', t('saveFail')); loadSubs(); }));
      }));
      tr.appendChild(tdA);
      tbody.appendChild(tr);
    });
  }
  function toggleSub(s, btn){
    btn.disabled = true;
    api('/subscribers/' + encodeURIComponent(s.id), {method: 'PATCH', body: {status: s.status === 'active' ? 'unsubscribed' : 'active'}})
      .then(function(){ loadSubs(); loadStats(); })
      .catch(authOr(function(){ btn.disabled = false; showSt('app-status', 'err', t('saveFail')); }));
  }
  function loadSubs(){
    return api('/subscribers').then(renderSubs).catch(authOr(function(){ showSt('app-status', 'err', t('loadFail')); }));
  }

  // ---- posts ----
  var POST_CAT = {
    news: {ar: 'خبر', en: 'News'}, update: {ar: 'تطور', en: 'Update'}, event: {ar: 'فعالية', en: 'Event'}
  };
  var PT = {
    published: {ar: 'منشور', en: 'Published'}, draft: {ar: 'مسودة', en: 'Draft'},
    edit: {ar: 'تعديل', en: 'Edit'}, publish: {ar: 'نشر', en: 'Publish'}, unpublish: {ar: 'إخفاء', en: 'Unpublish'},
    saved: {ar: 'تم الحفظ بنجاح.', en: 'Saved successfully.'}, deleted: {ar: 'تم الحذف.', en: 'Deleted.'},
    needBoth: {ar: 'أدخل العنوان والنص باللغتين.', en: 'Enter the title and body in both languages.'}
  };
  function pt(k){ return PT[k][lang()]; }
  function pcat(c){ return (POST_CAT[c] || {ar: c, en: c})[lang()]; }
  function postTitle(p){ return (lang() === 'ar' ? p.title_ar : p.title_en) || ''; }
  var postFail = authOr(function(){ showSt('post-status', 'err', t('saveFail')); });

  function loadPosts(){
    return api('/posts').then(renderPosts).catch(authOr(function(){ showSt('app-status', 'err', t('loadFail')); }));
  }
  function renderPosts(rows){
    postRows = Array.isArray(rows) ? rows : [];
    var tbody = document.querySelector('#post-table tbody');
    tbody.textContent = '';
    if(!postRows.length){ emptyRow(tbody, 5); return; }
    postRows.forEach(function(p){
      var tr = el('tr');
      tr.appendChild(el('td', null, postTitle(p)));
      tr.appendChild(el('td', null, pcat(p.category)));
      var tdB = el('td');
      tdB.appendChild(el('span', 'badge ' + (p.published ? 'active' : 'archived'), p.published ? pt('published') : pt('draft')));
      tr.appendChild(tdB);
      tr.appendChild(el('td', null, fmtDate(p.published_at || p.created_at)));
      var tdA = el('td');
      var be = el('button', 'btn ghost', pt('edit')); be.setAttribute('type', 'button');
      be.addEventListener('click', function(){ editPost(p); });
      var bp = el('button', 'btn ghost', p.published ? pt('unpublish') : pt('publish')); bp.setAttribute('type', 'button');
      bp.addEventListener('click', function(){ togglePublish(p, bp); });
      tdA.appendChild(be); tdA.appendChild(bp);
      tdA.appendChild(deleteButton(function(){
        api('/posts/' + encodeURIComponent(p.id), {method: 'DELETE'})
          .then(function(){ showSt('post-status', 'ok', pt('deleted')); loadPosts(); })
          .catch(postFail);
      }));
      tr.appendChild(tdA);
      tbody.appendChild(tr);
    });
  }

  function pv(id){ var n = $(id); return n ? n.value.trim() : ''; }
  function resetPostForm(){
    $('p-id').value = '';
    $('post-form').reset();
    $('post-cancel').hidden = true;
    hideSt('post-status');
  }
  function editPost(p){
    $('p-id').value = p.id;
    $('p-title-ar').value = p.title_ar || '';
    $('p-title-en').value = p.title_en || '';
    $('p-body-ar').value = p.body_ar || '';
    $('p-body-en').value = p.body_en || '';
    $('p-cat').value = p.category || 'news';
    $('p-date').value = p.event_date || '';
    $('p-loc').value = p.location || '';
    $('p-pub').checked = !!p.published;
    $('post-cancel').hidden = false;
    hideSt('post-status');
    $('post-form').scrollIntoView();
  }
  function savePost(e){
    e.preventDefault();
    hideSt('post-status');
    var id = $('p-id').value;
    var row = {
      title_ar: pv('p-title-ar'), title_en: pv('p-title-en'),
      body_ar: pv('p-body-ar'), body_en: pv('p-body-en'),
      category: $('p-cat').value || 'news',
      event_date: pv('p-date') || null,
      location: pv('p-loc') || null,
      published: $('p-pub').checked
    };
    var needIds = ['p-title-ar', 'p-title-en', 'p-body-ar', 'p-body-en'];
    needIds.forEach(function(i){ $(i).removeAttribute('aria-invalid'); });
    var missing = needIds.filter(function(i){ return !$(i).value.trim(); });
    if(missing.length){
      missing.forEach(function(i){ $(i).setAttribute('aria-invalid', 'true'); });
      $(missing[0]).focus();
      showSt('post-status', 'err', pt('needBoth')); return;
    }
    var req = id ? api('/posts/' + encodeURIComponent(id), {method: 'PATCH', body: row}) : api('/posts', {method: 'POST', body: row});
    req.then(function(){
      resetPostForm();
      showSt('post-status', 'ok', pt('saved'));
      loadPosts();
    }).catch(postFail);
  }
  function togglePublish(p, btn){
    btn.disabled = true;
    api('/posts/' + encodeURIComponent(p.id), {method: 'PATCH', body: {published: !p.published}})
      .then(function(){ loadPosts(); })
      .catch(function(e){ btn.disabled = false; postFail(e); });
  }

  // ---- newsletter campaigns ----
  var CT = {
    sentTest: {ar: 'أُرسلت رسالة تجريبية إلى بريدك.', en: 'Test email sent to your address.'},
    sent: {ar: 'تم الإرسال: ', en: 'Sent: '},
    failed: {ar: ' — فشل: ', en: ' — failed: '},
    need: {ar: 'أدخل الموضوع والنص.', en: 'Enter a subject and a message.'},
    disabled: {ar: 'البريد غير مُعدّ على الخادم (RESEND_API_KEY).', en: 'Email is not configured on the server (RESEND_API_KEY).'},
    none: {ar: 'لا يوجد مشتركون نشطون في هذه الفئة.', en: 'There are no active subscribers in this audience.'},
    arm: {ar: 'اضغط مرة أخرى لإرسال النشرة للمشتركين', en: 'Click again to send to all subscribers'},
    fail: {ar: 'تعذّر الإرسال.', en: 'Sending failed.'}
  };
  function ct(k){ return CT[k][lang()]; }
  var campaignArm = null;
  function renderCampaigns(rows){
    var tbody = document.querySelector('#camp-table tbody');
    tbody.textContent = '';
    rows = Array.isArray(rows) ? rows : [];
    if(!rows.length){ emptyRow(tbody, 4); return; }
    rows.forEach(function(c){
      var tr = el('tr');
      tr.appendChild(el('td', null, fmtDate(c.created_at)));
      tr.appendChild(el('td', null, c.subject));
      tr.appendChild(el('td', null, String(c.sent_count) + (c.failed_count ? ' / ' + c.failed_count : '')));
      tr.appendChild(el('td', null, c.created_by));
      tbody.appendChild(tr);
    });
  }
  function loadCampaigns(){
    return api('/campaigns').then(renderCampaigns).catch(authOr(function(){}));
  }
  function sendCampaign(test){
    hideSt('camp-status');
    var subject = pv('c-subject'), body = pv('c-body');
    if(subject.length < 3 || body.length < 10){ showSt('camp-status', 'err', ct('need')); return; }
    var btn = $(test ? 'camp-test' : 'camp-send');
    btn.disabled = true;
    api('/campaigns', {method: 'POST', body: {subject: subject, body: body, audience: $('c-audience').value, test: !!test}})
      .then(function(r){
        showSt('camp-status', 'ok', test ? ct('sentTest') : ct('sent') + r.sent + (r.failed ? ct('failed') + r.failed : ''));
        if(!test){ $('c-subject').value = ''; $('c-body').value = ''; loadCampaigns(); }
      })
      .catch(authOr(function(e){
        showSt('camp-status', 'err', e.code === 'email_disabled' ? ct('disabled') : e.code === 'no_recipients' ? ct('none') : e.code === 'rate_limited' ? t('rate') : ct('fail'));
      }))
      .then(function(){ btn.disabled = !emailOn; });
  }

  // ---- CSV export ----
  function csvCell(v){
    var s = v == null ? '' : String(v);
    if(/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function downloadCSV(name, headers, rows){
    var lines = [headers.map(csvCell).join(',')];
    rows.forEach(function(r){ lines.push(r.map(csvCell).join(',')); });
    var blob, url;
    try { blob = new Blob(["﻿" + lines.join('\r\n')], {type: 'text/csv;charset=utf-8'}); url = URL.createObjectURL(blob); }
    catch(e){ return; }
    var a = el('a');
    a.setAttribute('href', url); a.setAttribute('download', name);
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    try { URL.revokeObjectURL(url); } catch(e){}
  }
  function stamp(){
    var d = new Date();
    function p(n){ return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function loadAll(){
    hideSt('app-status');
    api('/me').then(function(me){ emailOn = !!me.emailEnabled; setEmailState(); }).catch(function(){});
    loadStats(); loadMessages(); loadSubs(); loadPosts(); loadCampaigns();
  }
  function setEmailState(){
    $('camp-test').disabled = !emailOn;
    $('camp-send').disabled = !emailOn;
    $('camp-note').hidden = emailOn;
  }

  document.addEventListener('DOMContentLoaded', function(){
    if(!$('login-form')) return;
    $('logout-btn').addEventListener('click', function(){ logout(); });
    $('exp-msg').addEventListener('click', function(){
      downloadCSV('wash-messages-' + stamp() + '.csv', ['created_at', 'name', 'email', 'subject', 'message', 'lang', 'status'],
        msgRows.map(function(m){ return [m.created_at, m.name, m.email, m.subject, m.message, m.lang, m.status]; }));
    });
    $('exp-sub').addEventListener('click', function(){
      downloadCSV('wash-subscribers-' + stamp() + '.csv', ['created_at', 'email', 'name', 'lang', 'status'],
        subRows.map(function(s){ return [s.created_at, s.email, s.name, s.lang, s.status]; }));
    });
    $('exp-post').addEventListener('click', function(){
      downloadCSV('wash-posts-' + stamp() + '.csv', ['created_at', 'title_ar', 'title_en', 'category', 'published', 'event_date'],
        postRows.map(function(p){ return [p.created_at, p.title_ar, p.title_en, p.category, p.published, p.event_date]; }));
    });
    $('post-form').addEventListener('submit', savePost);
    $('post-cancel').addEventListener('click', resetPostForm);
    $('camp-test').addEventListener('click', function(){ sendCampaign(true); });
    $('camp-send').addEventListener('click', function(){
      var btn = $('camp-send');
      if(!campaignArm){
        var label = btn.textContent;
        btn.textContent = ct('arm');
        campaignArm = setTimeout(function(){ campaignArm = null; btn.textContent = label; }, 5000);
        btn.setAttribute('data-label', label);
        return;
      }
      clearTimeout(campaignArm); campaignArm = null;
      btn.textContent = btn.getAttribute('data-label') || btn.textContent;
      sendCampaign(false);
    });
    $('login-form').addEventListener('submit', function(e){
      e.preventDefault();
      hideSt('login-status');
      var email = $('a-email').value.trim().toLowerCase();
      var pass = $('a-pass').value;
      if(!email || !pass){ showSt('login-status', 'err', t('loginFail')); return; }
      var btn = this.querySelector('button[type="submit"]'); btn.disabled = true;
      fetch('/api/admin/login', {
        method: 'POST', credentials: 'same-origin',
        headers: {'Content-Type': 'application/json', 'X-Requested-With': 'wash'},
        body: JSON.stringify({email: email, password: pass})
      }).then(function(r){
        return r.json().catch(function(){ return null; }).then(function(b){
          if(!r.ok || !b || !b.ok){ var er = new Error('login'); er.status = r.status; throw er; }
          return b;
        });
      }).then(function(b){
        $('a-pass').value = '';
        showApp(b.email);
      }).catch(function(er){
        showSt('login-status', 'err', er && er.status === 429 ? t('rate') : t('loginFail'));
      }).then(function(){ btn.disabled = false; });
    });
    api('/me').then(function(me){ showApp(me.email); }).catch(function(){ showLogin(); });
  });
})();
