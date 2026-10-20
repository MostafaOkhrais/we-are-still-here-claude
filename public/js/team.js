(function(){
  function el(tag, cls){
    var n = document.createElement(tag);
    if(cls) n.className = cls;
    return n;
  }
  function tx(node, ar, en){
    node.setAttribute('data-ar', ar);
    node.setAttribute('data-en', en);
    node.textContent = ar;
    return node;
  }
  function card(m, i){
    var c = el('div', 'reveal group bg-white rounded-[20px] border border-cream-line overflow-hidden shadow-soft hover:shadow-card hover:-translate-y-1 transition text-center');
    if(i > 0) c.style.setProperty('--reveal-delay', (Math.min(i, 3) * 0.06).toFixed(2) + 's');
    var wrap = el('div', 'aspect-[3/4] overflow-hidden relative');
    var img = document.createElement('img');
    img.setAttribute('src', m.photo);
    img.setAttribute('width', '900');
    img.setAttribute('height', '1200');
    img.setAttribute('loading', 'lazy');
    img.setAttribute('data-ar-alt', m.nameAr);
    img.setAttribute('data-en-alt', (m.alt && m.alt !== '') ? m.alt : m.nameEn);
    img.setAttribute('alt', m.nameAr);
    img.className = 'w-full h-full object-cover group-hover:scale-105 transition duration-500';
    var shade = el('div', 'absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent');
    var body = el('div', 'p-5');
    var h = el('h4', 'font-black text-[15px]');
    tx(h, m.nameAr, m.nameEn);
    var role = el('p', 'mt-1.5 inline-flex items-center justify-center bg-olive-soft text-olive-dark text-xs font-bold px-3 py-1 rounded-full');
    tx(role, m.roleAr, m.roleEn);
    wrap.appendChild(img);
    wrap.appendChild(shade);
    body.appendChild(h);
    body.appendChild(role);
    c.appendChild(wrap);
    c.appendChild(body);
    return c;
  }
  function section(d){
    var s = el('section');
    var head = el('div', 'flex items-center gap-3 mb-6');
    var badge = el('span', 'w-10 h-10 rounded-xl ' + d.badge + ' flex items-center justify-center font-black text-sm');
    badge.textContent = d.num;
    var h = el('h2', 'text-[20px] lg:text-[22px] font-black');
    tx(h, d.titleAr, d.titleEn);
    var line = el('span', 'h-px flex-1 bg-cream-line ms-4 hidden sm:block');
    head.appendChild(badge);
    head.appendChild(h);
    head.appendChild(line);
    var grid = el('div', 'grid sm:grid-cols-2 lg:grid-cols-4 gap-5');
    d.members.forEach(function(m, i){ grid.appendChild(card(m, i)); });
    s.appendChild(head);
    s.appendChild(grid);
    return s;
  }
  var host = document.getElementById('team-sections');
  var data = window.WASH_TEAM && window.WASH_TEAM.departments;
  if(host && data){
    host.textContent = '';
    data.forEach(function(d){ host.appendChild(section(d)); });
  }
})();
