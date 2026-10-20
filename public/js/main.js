(function(){
  var KEY='wash-lang-v2';
  function initial(){ try{var q=null; try{q=new URLSearchParams(window.location.search).get('lang');}catch(e){} if(q==='ar'||q==='en') return q; return localStorage.getItem(KEY)||'en';}catch(e){return 'en';} }
  function current(){ return document.documentElement.lang==='ar'?'ar':'en'; }
  function apply(lang, initial){
    document.documentElement.lang = lang==='ar'?'ar':'en';
    document.documentElement.dir = lang==='ar'?'rtl':'ltr';
    try{var ta=document.documentElement.getAttribute('data-title-ar'),te=document.documentElement.getAttribute('data-title-en'); if(ta&&te){document.title = lang==='ar'?ta:te;}}catch(e){}
    if(!initial && typeof window.WASH_shopRender === 'function' && document.getElementById('shop-grid')){ try{window.WASH_shopRender();}catch(e){} }
    document.querySelectorAll('[data-ar]').forEach(function(el){
      var v = lang==='ar'?el.getAttribute('data-ar'):el.getAttribute('data-en');
      if(v!=null && el.children.length === 0) el.textContent = v;
    });
    document.querySelectorAll('[data-ar-ph]').forEach(function(el){
      el.placeholder = lang==='ar'?el.getAttribute('data-ar-ph'):el.getAttribute('data-en-ph');
    });
    document.querySelectorAll('[data-ar-alt]').forEach(function(el){
      var alt = lang==='ar'?el.getAttribute('data-ar-alt'):el.getAttribute('data-en-alt');
      if(alt!=null) el.setAttribute('alt', alt);
    });
    document.querySelectorAll('[data-ar-label]').forEach(function(el){
      var lbl = lang==='ar'?el.getAttribute('data-ar-label'):el.getAttribute('data-en-label');
      if(lbl!=null) el.setAttribute('aria-label', lbl);
    });
    document.querySelectorAll('.lang-toggle').forEach(function(b){
      b.textContent = lang==='ar'?'EN':'AR';
      b.setAttribute('aria-label', lang==='ar'?'Switch to English':'Switch to Arabic');
    });
    document.querySelectorAll('.to-top').forEach(function(t){
      t.setAttribute('aria-label', lang==='ar'?'\u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 \u0627\u0644\u0623\u0639\u0644\u0649':'Back to top');
    });
    var menu=document.querySelector('.menu-btn');
    var links=document.querySelector('.nav-links') || document.getElementById('main-nav-mobile') || document.getElementById('main-nav');
    if(menu&&links){
      var open = links.id === 'main-nav-mobile' ? !links.classList.contains('hidden') : links.classList.contains('open');
      menu.setAttribute('aria-label',open?(lang==='ar'?'\u0625\u063a\u0644\u0627\u0642 \u0627\u0644\u0642\u0627\u0626\u0645\u0629':'Close menu'):(lang==='ar'?'\u0641\u062a\u062d \u0627\u0644\u0642\u0627\u0626\u0645\u0629':'Open menu'));
    }
    try{localStorage.setItem(KEY,lang);}catch(e){}
  }
  window.WASH_setLang=function(lang){apply(lang);};

  function initReveal(){
    document.documentElement.classList.add('reveal-ready');
    var els=document.querySelectorAll(
      'main .sec-title, main .sec-sub, main .card, main .stat-card, '+
      'main .value-card, main .program-card, main .leader-card, '+
      'main .area-card, main .member-card, main .product, main .note, '+
      'main .reveal');

    var seen = new Set();
    els.forEach(function(el){
      if(seen.has(el)) return; seen.add(el);
      el.classList.add('reveal');
      var sibs=Array.prototype.filter.call(el.parentElement.children,
        function(c){return c.classList.contains('reveal');});
      var i=sibs.indexOf(el);
      el.style.setProperty('--reveal-delay',(Math.min(i,5)*0.07)+'s');
    });
    if(!('IntersectionObserver' in window)){
      els.forEach(function(el){el.classList.add('visible');});
      return;
    }
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){en.target.classList.add('visible');io.unobserve(en.target);}
      });
    },{threshold:.1,rootMargin:'0px 0px -40px 0px'});
    els.forEach(function(el){io.observe(el);});
  }

  function initCounters(){
    var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var nums=document.querySelectorAll('.stat-num:not([data-ar])');
    if(!nums.length){return;}
    function animate(el){
      var m=/^([^\d]*)(\d+)([\s\S]*)$/.exec(el.textContent.trim());
      if(!m){return;}
      var pre=m[1],target=parseInt(m[2],10),suf=m[3];
      if(reduce||!(target>0)){el.textContent=pre+target+suf;return;}
      var dur=1400,t0=null;
      function frame(t){
        if(t0===null){t0=t;}
        var p=Math.min((t-t0)/dur,1);
        var e=1-Math.pow(1-p,4);
        el.textContent=pre+Math.round(target*e)+suf;
        if(p<1){requestAnimationFrame(frame);}
      }
      requestAnimationFrame(frame);
    }
    if(!('IntersectionObserver' in window)){nums.forEach(animate);return;}
    var cio=new IntersectionObserver(function(es){
      es.forEach(function(en){
        if(en.isIntersecting){animate(en.target);cio.unobserve(en.target);}
      });
    },{threshold:.4});
    nums.forEach(function(n){cio.observe(n);});
  }

  document.addEventListener('DOMContentLoaded',function(){
    initReveal();
    apply(initial(), true);
    document.querySelectorAll('.lang-toggle').forEach(function(b){
      b.addEventListener('click',function(){ apply(current()==='ar'?'en':'ar'); });
    });

    var menu=document.querySelector('.menu-btn');
    var linksOld=document.querySelector('.nav-links');
    var linksNew=document.getElementById('main-nav-mobile');
    var links = linksNew || linksOld;
    if(menu&&links){

      if(!links.id) links.id = 'main-nav-mobile';
      menu.setAttribute('aria-controls', links.id);
      menu.setAttribute('aria-expanded','false');
      menu.setAttribute('aria-label','\u0641\u062a\u062d \u0627\u0644\u0642\u0627\u0626\u0645\u0629');

      menu.addEventListener('click',function(){
        var lang=document.documentElement.lang==='ar'?'ar':'en';
        var isNew = links === linksNew;
        var open;
        if(isNew){
          links.classList.toggle('hidden');
          open = !links.classList.contains('hidden');
        } else {
          open = links.classList.toggle('open');
        }
        menu.setAttribute('aria-expanded',open?'true':'false');
        if(window.innerWidth < 1024) document.body.classList.toggle('overflow-hidden', open);
        menu.setAttribute('aria-label',open?(lang==='ar'?'\u0625\u063a\u0644\u0627\u0642 \u0627\u0644\u0642\u0627\u0626\u0645\u0629':'Close menu'):(lang==='ar'?'\u0641\u062a\u062d \u0627\u0644\u0642\u0627\u0626\u0645\u0629':'Open menu'));
      });

      document.addEventListener('keydown',function(e){
        if(e.key==='Escape'){
          var isHidden = links.classList.contains('hidden');
          var isOpenOld = links.classList.contains('open');
          var shouldClose = (links === linksNew && !isHidden) || (links !== linksNew && isOpenOld);
          if(shouldClose){
            if(links === linksNew) links.classList.add('hidden');
            else links.classList.remove('open');
            document.body.classList.remove('overflow-hidden');
            var lang=document.documentElement.lang==='ar'?'ar':'en';
            menu.setAttribute('aria-expanded','false');
            menu.setAttribute('aria-label',lang==='ar'?'\u0641\u062a\u062d \u0627\u0644\u0642\u0627\u0626\u0645\u0629':'Open menu');
            menu.focus();
          }
        }
      });

      links.querySelectorAll('a').forEach(function(a){
        a.addEventListener('click', function(){
          if(window.innerWidth < 1024){
            if(links === linksNew) links.classList.add('hidden');
            else links.classList.remove('open');
            document.body.classList.remove('overflow-hidden');
            menu.setAttribute('aria-expanded','false');
            var lang=document.documentElement.lang==='ar'?'ar':'en';
            menu.setAttribute('aria-label',lang==='ar'?'\u0641\u062a\u062d \u0627\u0644\u0642\u0627\u0626\u0645\u0629':'Open menu');
          }
        });
      });
    }

    var header=document.querySelector('.site-header');
    var progress=document.createElement('div');
    progress.className='scroll-progress';
    progress.setAttribute('aria-hidden','true');
    document.body.appendChild(progress);
        var toTop=document.createElement('button');
    toTop.className='to-top';
    toTop.setAttribute('type','button');
    var NS='http://www.w3.org/2000/svg';
    var ring=document.createElementNS(NS,'svg');
    ring.setAttribute('class','progress-ring');
    ring.setAttribute('viewBox','0 0 52 52');
    ring.setAttribute('aria-hidden','true');
    var circle=document.createElementNS(NS,'circle');
    circle.setAttribute('cx','26');circle.setAttribute('cy','26');circle.setAttribute('r','24');
    circle.setAttribute('stroke-dasharray','150.8');circle.setAttribute('stroke-dashoffset','150.8');
    ring.appendChild(circle);toTop.appendChild(ring);
    var svg=document.createElementNS(NS,'svg');
    svg.setAttribute('viewBox','0 0 24 24');
    svg.setAttribute('fill','none');
    svg.setAttribute('stroke','currentColor');
    svg.setAttribute('stroke-width','2.4');
    svg.setAttribute('stroke-linecap','round');
    svg.setAttribute('stroke-linejoin','round');
    svg.setAttribute('aria-hidden','true');
    var tline=document.createElementNS(NS,'line');
    tline.setAttribute('x1','12');tline.setAttribute('y1','19');
    tline.setAttribute('x2','12');tline.setAttribute('y2','5');
    var tpoly=document.createElementNS(NS,'polyline');
    tpoly.setAttribute('points','5 12 12 5 19 12');
    svg.appendChild(tline);svg.appendChild(tpoly);toTop.appendChild(svg);
    document.body.appendChild(toTop);
    toTop.addEventListener('click',function(){
      var rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({top:0,behavior:rm?'auto':'smooth'});
    });
    var ticking=false;
    function onScroll(){
      var y=window.scrollY||0;
      if(header) header.classList.toggle('scrolled',y>8);
      var h=document.documentElement.scrollHeight-window.innerHeight;
      progress.style.transform='scaleX('+(h>0?Math.min(y/h,1):0)+')';
      var pct=h>0?Math.min(y/h,1):0; circle.setAttribute('stroke-dashoffset', String(150.8*(1-pct)));
      toTop.classList.toggle('show',y>600);
      ticking=false;
    }
    window.addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(onScroll);}},{passive:true}); onScroll();

    initCounters();

    var form=document.querySelector('form.contact');
    if(form){
      function setErr(f,on){
        var err=f.getAttribute('name')?form.querySelector('#err-'+f.getAttribute('name')):null;
        if(on){
          f.setAttribute('aria-invalid','true');
          if(err){
            f.setAttribute('aria-describedby',err.id);
            err.hidden=false;
            err.classList.remove('hidden');

            err.style.display='';
          }
          f.classList.add('border-red-400');
        }else{
          f.removeAttribute('aria-invalid');f.removeAttribute('aria-describedby');
          if(err){
            err.hidden=true;
            err.classList.add('hidden');
          }
          f.classList.remove('border-red-400');
        }
      }
      function stripCRLF(s){return String(s||'').replace(/[\r\n]+/g,' ').slice(0,2000);}
      var EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      form.addEventListener('submit',function(e){
        var valid=true,first=null;
        form.querySelectorAll('[required]').forEach(function(f){
          var v=f.value.trim();
          var bad=!v||(f.getAttribute('type')==='email'&&!EMAIL_RE.test(v));
          setErr(f,bad);
          if(bad){valid=false;if(!first){first=f;}}
        });
        if(!valid){e.preventDefault();if(first){first.focus();}return;}
        var subj=form.querySelector('[name="subject"]');
        if(subj){subj.value=stripCRLF(subj.value);}
        var nm=form.querySelector('[name="name"]');
        if(nm){nm.value=stripCRLF(nm.value);}
        var em=form.querySelector('[name="email"]');
        if(em){em.value=stripCRLF(em.value).replace(/\s+/g,'');}
      });
      form.querySelectorAll('input,textarea').forEach(function(f){
        f.addEventListener('input',function(){
          if(f.hasAttribute('aria-invalid')&&f.value.trim()){setErr(f,false);}
        });
      });
    }

    document.querySelectorAll('.tab[data-filter]').forEach(function(btn){
      btn.addEventListener('click', function(){
        document.querySelectorAll('.tab[data-filter]').forEach(function(b){
          var isActive = b === btn;
          b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
          if(isActive){
            b.classList.remove('bg-white','text-olive-dark','border-cream-line');
            b.classList.add('bg-olive','text-white','border-olive');
          } else {
            b.classList.remove('bg-olive','text-white','border-olive');
            b.classList.add('bg-white','text-olive-dark','border-cream-line');
          }
        });
      });
    });
  });
})();
