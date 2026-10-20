(function(){
  var filter = "all";
  function el(tag, cls){
    var n = document.createElement(tag);
    if(cls) n.className = cls;
    return n;
  }
  function tx(node, ar, en){
    node.setAttribute("data-ar", ar);
    node.setAttribute("data-en", en);
    node.textContent = ar;
    return node;
  }
  function card(p, idx){
    var base = window.WASH_SHOP.base;
    var c = el("div", "reveal group bg-white rounded-[24px] border border-cream-line overflow-hidden shadow-soft hover:shadow-card hover:-translate-y-1 transition flex flex-col");
    var link = document.createElement("a");
    link.setAttribute("href", base + p.slug + "/");
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
    link.className = "relative block aspect-square bg-cream border-b border-cream-line overflow-hidden";
    link.setAttribute("data-ar-label", p.nameAr);
    link.setAttribute("data-en-label", p.name);
    link.setAttribute("aria-label", p.nameAr);
    var img = document.createElement("img");
    img.setAttribute("src", p.img);
    img.setAttribute("data-ar-alt", p.nameAr);
    img.setAttribute("data-en-alt", p.name);
    img.setAttribute("alt", p.nameAr);
    img.setAttribute("loading", idx < 3 ? "eager" : "lazy");
    img.setAttribute("decoding", "async");
    img.setAttribute("width", "640");
    img.setAttribute("height", "640");
    if(idx < 3) img.setAttribute("fetchpriority", "high");
    img.className = "w-full h-full object-cover group-hover:scale-105 transition duration-500";
    var badge = el("span", "absolute bottom-3 end-3 bg-olive text-white text-sm font-black px-4 py-1.5 rounded-full shadow-soft");
    badge.setAttribute("dir", "ltr");
    badge.textContent = "\u00A3" + p.price;
    link.appendChild(img);
    link.appendChild(badge);
    var body = el("div", "p-5 flex flex-col flex-1");
    var h = el("h3", "font-extrabold text-[15px] leading-6");
    tx(h, p.nameAr, p.name);
    var tp = el("p", "mt-2 text-xs font-bold text-gold-deep");
    tx(tp, p.typeAr, p.type);
    var btn = document.createElement("a");
    btn.setAttribute("href", base + p.slug + "/");
    btn.setAttribute("target", "_blank");
    btn.setAttribute("rel", "noopener noreferrer");
    btn.className = "mt-4 inline-flex items-center justify-center gap-2 bg-olive hover:bg-olive-dark text-white px-6 py-3 rounded-full font-bold text-sm transition w-full";
    var bt = el("span");
    tx(bt, "عرض المنتج", "View product");
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("aria-hidden", "true");
    var p1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p1.setAttribute("d", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6");
    var p2 = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    p2.setAttribute("points", "15 3 21 3 21 9");
    var p3 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    p3.setAttribute("x1", "10");
    p3.setAttribute("y1", "14");
    p3.setAttribute("x2", "21");
    p3.setAttribute("y2", "3");
    svg.appendChild(p1);
    svg.appendChild(p2);
    svg.appendChild(p3);
    btn.appendChild(bt);
    btn.appendChild(svg);
    body.appendChild(h);
    body.appendChild(tp);
    body.appendChild(btn);
    c.appendChild(link);
    c.appendChild(body);
    return c;
  }
  var firstRender = true;
  function render(){
    var grid = document.getElementById("shop-grid");
    if(!grid || !window.WASH_SHOP) return;
    grid.textContent = "";
    var idx = 0;
    window.WASH_SHOP.products.forEach(function(p){
      if(filter !== "all" && p.cat !== filter) return;
      grid.appendChild(card(p, idx));
      idx++;
    });
    var lang = document.documentElement.lang === "en" ? "en" : "ar";
    grid.querySelectorAll("[data-ar]").forEach(function(n){
      var v = lang === "ar" ? n.getAttribute("data-ar") : n.getAttribute("data-en");
      if(v != null) n.textContent = v;
    });
    if(!firstRender){
      grid.querySelectorAll(".reveal").forEach(function(n){ n.classList.add("visible"); });
    }
    firstRender = false;
    document.querySelectorAll("#shop-tabs .tab").forEach(function(b){
      var on = b.getAttribute("data-filter") === filter;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      if(on){
        b.classList.remove("bg-white", "text-olive-dark", "border-cream-line");
        b.classList.add("bg-olive", "text-white", "border-olive");
      } else {
        b.classList.remove("bg-olive", "text-white", "border-olive");
        b.classList.add("bg-white", "text-olive-dark", "border-cream-line");
      }
    });
  }
  document.addEventListener("DOMContentLoaded", function(){
    document.querySelectorAll("#shop-tabs .tab").forEach(function(b){
      b.addEventListener("click", function(){
        filter = b.getAttribute("data-filter") || "all";
        render();
      });
    });
    render();
  });
  window.WASH_shopRender = render;
})();
