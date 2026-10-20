window.WASH_BACKEND = (function(){
  // Everything is served by the same-origin API (Cloudflare Pages Functions + D1).
  var loadedAt = Date.now();
  function req(url, opts, ms){
    opts = opts || {};
    opts.credentials = 'same-origin';
    if(!window.AbortController) return fetch(url, opts);
    var ctrl = new AbortController();
    opts.signal = ctrl.signal;
    var timer = setTimeout(function(){ ctrl.abort(); }, ms || 12000);
    return fetch(url, opts).then(function(r){ clearTimeout(timer); return r; },
      function(e){ clearTimeout(timer); throw e; });
  }
  return {
    req: req,
    loadedAt: loadedAt,
    contactFn: '/api/contact',
    newsletterFn: '/api/newsletter',
    newsFeed: '/api/news'
  };
})();
