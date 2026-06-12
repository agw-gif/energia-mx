/* Energía · MX — app multipágina (router por hash) + render desde data/dashboard.json */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const TECH_COLORS = { solar: "#B07E1C", eolica: "#33564B", geotermia: "#9a4a2c", hidro: "#27496B", nuclear: "#5B4F3B", fosiles: "#3a352e" };
const deltaCls = (t) => (t === "up" || t === "down-good") ? "up" : t === "up-bad" ? "bad" : t === "down" ? "down" : "";

const CAT_COLORS = { "Renovables": "#33564B", "Hidrocarburos": "#7A560F", "Electricidad": "#27496B", "Geotermia": "#9a4a2c", "Política": "#B07E1C", "Análisis": "#4A4036", "Casos de Éxito": "#33564B" };
const catColor = (c) => CAT_COLORS[c] || "#5B4F3B";
const darken = (hex, f = .6) => { const n = parseInt(hex.slice(1), 16); const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f); return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); };
const catGrad = (c) => `linear-gradient(135deg, ${catColor(c)}, ${darken(catColor(c))})`;
const ACCENTS = ["#33564B", "#B07E1C", "#27496B", "#9a4a2c", "#7A560F", "#4A4036"];
const ICONS = {
  "#/casos": '<svg viewBox="0 0 24 24"><path d="M12 2.6l2.7 6.1 6.6.5-5 4.3 1.6 6.5L12 16.7 6.1 20l1.6-6.5-5-4.3 6.6-.5z"/></svg>',
  "#/politica": '<svg viewBox="0 0 24 24"><path d="M6 2.5h8l4 4v15H6z"/><path d="M14 2.5v4h4"/><path d="M9 12h6M9 16h6"/></svg>',
  "#/mapa": '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>',
  "#/convocatorias": '<svg viewBox="0 0 24 24"><path d="M4 10v4l11 4V6L4 10z"/><path d="M15 8c2.2 0 3.5 1.6 3.5 4s-1.3 4-3.5 4"/></svg>',
  "#/agenda": '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="16" rx="1.5"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4"/></svg>',
  "#/noticias": '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M7 9h6M7 13h6M16.5 9h1.5M16.5 13h1.5"/></svg>'
};
function areaChart(vals, color) {
  const w = 1000, h = 120, pad = 8, min = Math.min(...vals), max = Math.max(...vals), rng = (max - min) || 1;
  const pts = vals.map((v, i) => [pad + i * (w - 2 * pad) / (vals.length - 1), h - pad - ((v - min) / rng) * (h - 2 * pad - 12)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = `M${pts[0][0]} ${h} ` + pts.map(p => "L" + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ") + ` L${pts[pts.length - 1][0]} ${h} Z`;
  const dots = pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="${color}"/>`).join("");
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".26"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#ag)"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/>${dots}</svg>`;
}

let DATA = null, MAP = null, MARKERS = [];

async function init() {
  try { DATA = await (await fetch("data/dashboard.json?_=" + Date.now())).json(); }
  catch (e) { $("#app").innerHTML = '<div class="page-top wrap"><p class="mono">No se pudo cargar data/dashboard.json — sirve el sitio con un servidor local.</p></div>'; return; }
  window.addEventListener("hashchange", render);
  window.addEventListener("scroll", updateNavStyle);
  render();
}

const ROUTES = {
  "": homePage, "/": homePage,
  "datos": () => `<div class="page-top"></div>` + datosBody(true),
  "casos": casosPage,
  "politica": politicaPage,
  "mapa": mapaPage,
  "convocatorias": convocatoriaPage,
  "agenda": agendaPage,
  "noticias": () => blogPage(DATA.noticias),
};

function render() {
  const hash = location.hash.replace(/^#/, "");
  const parts = hash.replace(/^\//, "").split("/");
  let html, isHome = false;
  if (parts[0] === "nota" && parts[1]) html = articlePage(parts[1]);
  else { const fn = ROUTES[parts[0] || ""] || ROUTES[""]; isHome = (fn === homePage); html = fn(); }
  document.body.classList.toggle("home", isHome);
  $("#app").innerHTML = html + boletin(DATA.boletin) + footer(DATA.footer);

  if ($("#donut")) { drawDonut(DATA.sen.generation_mix); drawBars(DATA.sen.capacity); }
  if ($("#map")) initMap(DATA.mapa);
  if ($("#agenda-filters")) wireChips("#agenda-filters", "#agenda-list", ".agenda-ev", "cat", "Todos");
  if ($("#blog-filters")) wireChips("#blog-filters", "#post-list", ".post", "cat", "Todas");
  setActiveNav(parts[0] || "");
  updateNavStyle(); window.scrollTo(0, 0);
}
function setActiveNav(key) {
  $("#navlinks").querySelectorAll("a").forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#/" + key && key !== ""));
}
function updateNavStyle() {
  const nav = $("#nav");
  if (document.body.classList.contains("home")) {
    const top = window.scrollY < (window.innerHeight - 120);
    nav.classList.toggle("attop", top); nav.classList.toggle("solid", !top);
  } else { nav.classList.remove("attop"); nav.classList.add("solid"); }
}
function pageHead(kicker, title, lede) {
  return `<div class="page-top"><div class="wrap"><div class="kicker">${esc(kicker)}</div><h1>${esc(title)}</h1>${lede ? `<p class="lede">${esc(lede)}</p>` : ""}</div></div>`;
}

/* ---------------- HOME ---------------- */
function homePage() {
  const h = DATA.hero;
  return `
  <section class="hero">
    <div class="hero-fallback"></div><div class="hero-photo"></div><div class="hero-overlay"></div>
    <div class="wrap">
      <h1>${esc(h.headline_lead)}<br><span class="accent">${esc(h.headline_accent)}</span> ${esc(h.headline_tail)}</h1>
      <p class="sub">${esc(h.subtitle)}</p>
      <div class="hero-cta"><a class="solid" href="#/noticias">${esc(h.cta_primary)} <span>→</span></a><a href="#/mapa">${esc(h.cta_secondary)} <span>→</span></a></div>
    </div>
    <div class="hero-foot"><div class="wrap"><span class="mono">↓ DESLIZAR</span><span class="mono">${esc(DATA.meta.updated_label)} &nbsp;·&nbsp; ${esc(h.photo_credit)}</span></div></div>
  </section>
  ${datosBody(true)}
  ${sectionsOverview()}
  ${geotermia(DATA.geotermia, false)}
  ${homeNews(DATA.noticias)}`;
}
function sectionsOverview() {
  const secs = DATA.extras.secciones.filter(s => s.route !== "#/datos");
  return `<section class="block alt"><div class="wrap">
    <div class="sec-head"><div><div class="kicker">EXPLORA ENERGÍA MX</div><h2 class="sec-title">Una mirada a cada sección.</h2></div></div>
    <div class="ov-grid">${secs.map((s, i) => { const ac = ACCENTS[i % ACCENTS.length]; return `<a class="ov" href="${s.route}" style="--accent:${ac}">
      <span class="ic">${ICONS[s.route] || ""}</span><span class="num">${String(i + 1).padStart(2, "0")}</span>
      <h3>${esc(s.title)}</h3><p>${esc(s.desc)}</p><span class="go" style="color:${ac}">IR A LA SECCIÓN →</span></a>`; }).join("")}</div>
  </div></section>`;
}
function homeNews(n) {
  return `<section class="block"><div class="wrap">
    <div class="sec-head"><div><div class="kicker">${esc(n.kicker)}</div><h2 class="sec-title">${esc(n.title)}</h2></div>
      <a class="link-amber" href="#/noticias">Ver todas las noticias →</a></div>
    <div class="post-grid" style="margin-top:36px;border-top:1px solid var(--line)">${n.articles.slice(0, 3).map(postCard).join("")}</div>
  </div></section>`;
}

/* ---------------- DATOS / SEN ---------------- */
function datosBody(first) {
  const s = DATA.sen, m = DATA.meta, mix = s.generation_mix, ind = DATA.extras.datos_indicadores;
  const trendBase = parseFloat(s.kpis[0].value) || 30;
  const trend14 = Array.from({ length: 14 }, (_, i) => +(trendBase - 3 + 3 * Math.sin(i / 2.2) + i * 0.18).toFixed(1));
  const kpis = s.kpis.map(k => `<div class="cell"><div class="clabel">${esc(k.label)}</div>
      <div class="big">${esc(k.value)}<span class="u">${esc(k.unit)}</span></div>
      <div class="delta ${deltaCls(k.trend)}">${esc(k.delta)}</div></div>`).join("");
  return `<section class="block ${first ? "first" : ""}" id="datos"><div class="wrap">
    <div class="sec-head"><div><div class="kicker">${esc(s.kicker)}</div><h2 class="sec-title">${esc(s.title)}</h2></div>
      <div class="sec-meta"><span class="live"></span> Actualizado ${esc(m.updated_label)} · ${esc(m.edition_date_label.toLowerCase())} &nbsp; <a class="link-amber" href="#/datos">Metodología</a></div></div>
    <div class="sen-grid">
      <div class="cell donutcell"><div class="clabel">${esc(mix.label)}</div>
        <div class="donut-wrap"><div id="donut"></div><div class="legend" id="mix-legend"></div></div></div>
      ${kpis}
    </div>
    <div class="cap-strip"><div><div class="clabel">${esc(s.capacity.label)}</div>
      <div class="big">${esc(s.capacity.value)}<span class="u">${esc(s.capacity.unit)}</span></div>
      <div class="delta up" style="margin-top:8px">${esc(s.capacity.delta)}</div></div>
      <div class="bars" id="cap-bars"></div></div>
    <div class="trend"><div class="th"><span class="tl">% RENOVABLES · ÚLTIMOS 14 DÍAS</span><span class="tv">${trendBase}%</span></div>${areaChart(trend14, "#33564B")}</div>
    <div class="sen-foot"><span class="mono" style="color:var(--taupe)">${esc(s.sources)}</span>
      <a class="link-amber" href="data/series.csv" download>Descargar serie completa (CSV) →</a></div>
    <h3 class="subhead">${esc(ind.label)}</h3><p class="sublede">${esc(ind.note)}</p>
    <div class="ministats">${ind.items.map(i => `<div class="m"><div class="l">${esc(i.label)}</div>
      <div class="v">${esc(i.value)}<span class="u">${esc(i.unit)}</span></div>
      <div class="d delta ${deltaCls(i.trend)}">${esc(i.delta)}</div></div>`).join("")}</div>
  </div></section>`;
}
function drawDonut(mix) {
  const el = $("#donut"); if (!el) return;
  const total = mix.slices.reduce((a, s) => a + s.value, 0); const R = 56, C = 2 * Math.PI * R; let off = 0;
  const segs = mix.slices.map(s => { const len = (s.value / total) * C;
    const seg = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${s.color}" stroke-width="22" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`;
    off += len; return seg; }).join("");
  el.innerHTML = `<svg width="140" height="140" viewBox="0 0 140 140">${segs}
    <text x="70" y="66" text-anchor="middle" font-family="Playfair Display,serif" font-size="30" fill="#241F19">${mix.headline_value}${mix.headline_unit}</text>
    <text x="70" y="84" text-anchor="middle" font-family="monospace" font-size="9" fill="#5B4F3B" letter-spacing="1">${esc(mix.headline_note.toUpperCase())}</text></svg>`;
  $("#mix-legend").innerHTML = mix.slices.map(s => `<div class="li"><span class="sw" style="background:${s.color}"></span>${esc(s.name)}<span class="pc">${s.value}%</span></div>`).join("");
}
function drawBars(cap) {
  const el = $("#cap-bars"); if (!el) return; const max = Math.max(...cap.bars.map(b => b.value));
  el.innerHTML = cap.bars.map((b, i) => `<div class="bar" style="height:${Math.round(b.value / max * 100)}%;background:${i === 0 ? 'var(--taupe)' : 'var(--amber)'}"><span>${esc(b.name)}</span></div>`).join("");
}

/* ---------------- CASOS DE ÉXITO (antes Análisis) ---------------- */
function casosPage() {
  const a = DATA.analisis, e = DATA.extras;
  return pageHead(a.kicker, "Casos de éxito y buenas prácticas.", a.intro)
    + `<section class="block first"><div class="wrap">
      <div class="band"><div class="l">POR QUÉ IMPORTA</div><p>${esc(e.casos_why)}</p></div>
      <h3 class="subhead">Casos seleccionados</h3><p class="sublede">${esc(e.casos_lens)}</p>
      <div class="cards" style="margin-top:24px">${a.cases.map((c, i) => `<div class="card" style="--accent:${ACCENTS[i % ACCENTS.length]}">
        <div class="top"><span class="flag">${c.flag}</span><span class="ct">${esc(c.country)} · ${esc(c.topic)}</span></div>
        <h3>${esc(c.title)}</h3><p>${esc(c.body)}</p>
        <div class="foot"><span class="date">${esc(c.date)}</span><a class="link-amber" href="#/noticias">Leer caso →</a></div></div>`).join("")}</div>
    </div></section>`;
}

/* ---------------- POLÍTICA ---------------- */
function politicaPage() {
  const p = DATA.politica, e = DATA.extras;
  return pageHead(p.kicker, p.title, p.intro)
    + `<section class="block first"><div class="wrap">
      <div class="pol-grid">
        <div><div class="pol-stats">${p.stats.map(s => `<div class="s"><div class="v">${esc(s.value.split(' ')[0])}</div><div class="l">${esc(s.label)}</div></div>`).join("")}</div>
          <div class="doc"><span class="dt">${esc(p.doc_ref)}</span><a class="btn" href="#/noticias">PDF →</a></div></div>
        <div class="pol-table">${p.rows.map(r => `<div class="r"><div class="code">${esc(r.code)}</div>
          <div><div class="cn">${esc(r.country)}</div><div class="st">${esc(r.status)}</div></div><div class="nt">${esc(r.notes)}</div></div>`).join("")}</div>
      </div>
      <div class="band"><div class="l">CONTEXTO MÉXICO</div><p>${esc(e.politica_context)}</p></div>
    </div></section>
    <section class="block alt"><div class="wrap">
      <h3 class="subhead" style="margin-top:0">Documentos de trabajo</h3><p class="sublede">Análisis comparados publicados por el equipo editorial.</p>
      <div class="doclist">${e.politica_docs.map(d => `<div class="d"><span class="dt">${esc(d.title)}</span><span class="dr">${esc(d.ref)} · ${esc(d.pages)}</span></div>`).join("")}</div>
    </div></section>`;
}

/* ---------------- MAPA ---------------- */
function mapaPage() {
  const mp = DATA.mapa, e = DATA.extras;
  return pageHead(mp.kicker, mp.title, mp.intro)
    + `<section class="block first"><div class="wrap">
      <div class="map-head" id="map-filters"><span class="chip active" data-tech="all">Todas</span>
        ${mp.filters.map(f => `<span class="chip" data-tech="${f.key}">${esc(f.label)}</span>`).join("")}</div>
      <div class="map-grid"><div id="map"></div>
        <div class="map-side">
          <div class="hl"><div class="kicker">${esc(mp.highlight.label)}</div><div class="ht">${esc(mp.highlight.title)}</div><p>${esc(mp.highlight.body)}</p></div>
          <div class="top5"><div class="kicker" style="margin-bottom:8px">${esc(mp.top5.label)}</div>
            ${mp.top5.rows.map(r => `<div class="row"><span>${r.rank}. ${esc(r.country)}</span><span class="v">${esc(r.value)}</span></div>`).join("")}
            <div class="mono" style="color:var(--warm);margin-top:12px">${esc(mp.top5.source)}</div></div></div>
      </div>
    </div></section>
    <section class="block alt"><div class="wrap">
      <h3 class="subhead" style="margin-top:0">Proyectos emblemáticos en México</h3><p class="sublede">Una muestra de la capacidad instalada por tecnología en el territorio nacional.</p>
      <div class="projlist">${e.mapa_projects.map(pr => `<div class="pr"><span class="dot" style="background:${TECH_COLORS[pr.tech] || '#5B4F3B'}"></span>
        <div><div class="pn">${esc(pr.name)}</div><div class="ps">${esc(pr.state.toUpperCase())} · ${esc(pr.tech.toUpperCase())}</div></div>
        <span class="pv">${esc(pr.value)}</span></div>`).join("")}</div>
    </div></section>`;
}
function initMap(mp) {
  if (!window.L || !$("#map")) return;
  MAP = L.map("map", { scrollWheelZoom: false, attributionControl: false }).setView([24, -40], 2);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", { maxZoom: 8, minZoom: 1 }).addTo(MAP);
  MARKERS = [];
  const all = [...mp.markers, ...mp.top5.rows.map(r => ({ name: r.country + " · " + r.value, lat: r.lat, lon: r.lon, tech: r.tech, value: r.value }))];
  all.forEach(m => { const color = TECH_COLORS[m.tech] || "#5B4F3B";
    const mk = L.circleMarker([m.lat, m.lon], { radius: 7, color, weight: 2, fillColor: color, fillOpacity: .6 }).bindTooltip(`<b>${m.name}</b><br>${m.value || ""}`, { direction: "top" });
    mk._tech = m.tech; mk.addTo(MAP); MARKERS.push(mk); });
  $("#map-filters").addEventListener("click", e => { const chip = e.target.closest(".chip"); if (!chip) return;
    $("#map-filters").querySelectorAll(".chip").forEach(c => c.classList.remove("active")); chip.classList.add("active");
    const t = chip.dataset.tech; MARKERS.forEach(mk => (t === "all" || mk._tech === t) ? mk.addTo(MAP) : MAP.removeLayer(mk)); });
}

/* ---------------- GEOTERMIA (sección de home) ---------------- */
function geotermia(g, page) {
  return `<section class="block ${page ? "first" : "dark"}"><div class="wrap">
    <div class="sec-head"><div><div class="kicker">${esc(g.kicker)}</div><h${page ? 1 : 2} class="sec-title">${esc(g.title)}</h${page ? 1 : 2}></div>
      <a class="link-amber" href="#/noticias">Pulso geotérmico semanal →</a></div>
    <p class="lede">${esc(g.intro)}</p>
    <div class="geo-grid">${g.companies.map(c => `<div class="geo"><div class="gn">${esc(c.name)}</div><div class="gp">${esc(c.place)}</div>
      <div class="gt">${esc(c.tag)}</div><div class="gh">${esc(c.headline)}</div>
      <div class="gm"><div class="mv">${esc(c.metric_value)}</div><div class="ml">${esc(c.metric_label)}</div></div></div>`).join("")}</div>
    <blockquote class="geo-quote">"${esc(g.quote)}"<span class="attr">${esc(g.quote_attr)}</span></blockquote>
  </div></section>`;
}

/* ---------------- CONVOCATORIAS ---------------- */
function convocatoriaPage() {
  const c = DATA.convocatoria, e = DATA.extras;
  return `<div class="page-top"></div><section class="block conv first"><div class="wrap">
    <div class="kicker">${esc(c.kicker)}</div><h1 class="sec-title">${esc(c.title)}</h1>
    <div class="conv-grid"><div><p class="lede">${esc(c.intro)}</p>
      <div class="conv-dates">${c.dates.map(d => `<div class="d"><div class="l">${esc(d.label)}</div><div class="v">${esc(d.value)}</div></div>`).join("")}</div>
      <div class="conv-ctas"><a href="#/noticias">Descargar bases (PDF · 32pp) <span>→</span></a>
        <a href="#/noticias">Términos de referencia <span>→</span></a><a href="#/noticias">Registrar interés <span>→</span></a></div>
      <div class="contact">${esc(c.contact)}</div></div>
      <div class="conv-facts">${c.facts.map(f => `<div class="f"><span class="l">${esc(f.label)}</span><span class="v">${esc(f.value)}</span></div>`).join("")}</div>
    </div></div></section>
    <section class="block alt"><div class="wrap two-col">
      <div><h3 class="subhead" style="margin-top:0">Criterios de elegibilidad</h3><ul class="crit">${e.convocatoria_criterios.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
      <div><h3 class="subhead" style="margin-top:0">Preguntas frecuentes</h3><div class="faq">${e.convocatoria_faq.map(f => `<div class="q"><h4>${esc(f.q)}</h4><p>${esc(f.a)}</p></div>`).join("")}</div></div>
    </div></section>
    <section class="block"><div class="wrap"><h3 class="subhead" style="margin-top:0">Ediciones anteriores</h3>
      <div class="previas">${e.convocatoria_previas.map(p => `<div class="p"><span class="py">${esc(p.year)}</span><span class="px">${esc(p.text)}</span></div>`).join("")}</div>
    </div></section>`;
}

/* ---------------- AGENDA ---------------- */
function agendaPage() {
  const a = DATA.agenda, e = DATA.extras;
  return pageHead(a.kicker, a.title, e.agenda_intro)
    + `<section class="block first"><div class="wrap">
      <div class="map-head" id="agenda-filters">${a.filters.map((f, i) => `<span class="chip ${i === 0 ? 'active' : ''}" data-type="${f}">${esc(f)}</span>`).join("")}</div>
      <div id="agenda-list" style="margin-top:24px">${a.events.map(agendaRow).join("")}</div>
      <div style="margin-top:30px"><a class="link-amber" href="#/agenda">Suscribirse al calendario (.ics) →</a></div>
    </div></section>`;
}
function agendaRow(ev) {
  const map = { CONGRESO: "Congresos", REGULATORIO: "Regulatorio", "PUBLICACIÓN": "Publicaciones" };
  const col = { CONGRESO: "#33564B", REGULATORIO: "#B07E1C", "PUBLICACIÓN": "#27496B" }[ev.type] || "#5B4F3B";
  return `<div class="agenda-ev" data-cat="${map[ev.type] || ''}" style="border-left:3px solid ${col};padding-left:18px">
    <div><span class="d">${esc(ev.date)}</span><span class="dow">${esc(ev.dow)}</span></div>
    <div class="ty" style="color:${col}">${esc(ev.type)}</div><div class="ti">${esc(ev.title)}</div><div class="pl">${esc(ev.place)}</div><div class="ar">→</div></div>`;
}

/* ---------------- NOTICIAS / BLOG ---------------- */
function postCard(a) {
  return `<a class="post" href="#/nota/${esc(a.slug)}" data-cat="${esc(a.category)}">
    <div class="thumb" style="background:${catGrad(a.category)}"><span class="cat">${esc(a.category)}</span></div>
    <div class="pbody"><h3>${esc(a.title)}</h3><p>${esc(a.dek)}</p>
      <div class="meta">${esc(a.date_label)} · ${esc(a.read_min)} min · ${esc(a.author)}</div></div></a>`;
}
function blogPage(n) {
  const feat = n.articles.find(a => a.featured) || n.articles[0];
  const rest = n.articles.filter(a => a !== feat);
  return pageHead(n.kicker, n.title, n.intro)
    + `<section class="block first"><div class="wrap">
      <a class="feat" href="#/nota/${esc(feat.slug)}">
        <div class="ph" style="background:${catGrad(feat.category)}"><span class="cat">${esc(feat.category)}</span></div>
        <div class="body"><div class="kicker amber">DESTACADO</div><h2>${esc(feat.title)}</h2><p>${esc(feat.dek)}</p>
          <div class="meta">${esc(feat.date_label)} · ${esc(feat.read_min)} min de lectura · ${esc(feat.author)}</div></div></a>
      <div class="map-head" id="blog-filters" style="margin-top:34px">${n.categories.map((c, i) => `<span class="chip ${i === 0 ? 'active' : ''}" data-type="${esc(c)}">${esc(c)}</span>`).join("")}</div>
      <div class="post-grid" id="post-list" style="border-top:1px solid var(--line);margin-top:16px">${rest.map(postCard).join("")}</div>
    </div></section>`;
}
function articlePage(slug) {
  const a = DATA.noticias.articles.find(x => x.slug === slug);
  if (!a) return `<div class="page-top"><div class="wrap"><h1>Nota no encontrada</h1><a class="back" href="#/noticias">← Volver a Noticias</a></div></div>`;
  return `<div class="page-top"><div class="wrap article">
    <div class="cat">${esc(a.category)}</div><h1>${esc(a.title)}</h1><p class="dek">${esc(a.dek)}</p>
    <div class="ameta">POR ${esc(a.author.toUpperCase())} · ${esc(a.date_label)} · ${esc(a.read_min)} MIN DE LECTURA</div>
    <div class="cover" style="background:${catGrad(a.category)}"></div><div class="prose">${a.body.map(p => `<p>${esc(p)}</p>`).join("")}</div>
    <a class="back" href="#/noticias">← Volver a Noticias</a></div></div>`;
}

/* ---------------- shared ---------------- */
function wireChips(filtersSel, listSel, itemSel, dataKey, allLabel) {
  const f = $(filtersSel); if (!f) return;
  f.addEventListener("click", e => { const chip = e.target.closest(".chip"); if (!chip) return;
    f.querySelectorAll(".chip").forEach(c => c.classList.remove("active")); chip.classList.add("active");
    const t = chip.dataset.type;
    $(listSel).querySelectorAll(itemSel).forEach(r => r.style.display = (t === allLabel || r.dataset[dataKey] === t) ? "" : "none"); });
}
function boletin(b) {
  return `<section class="boletin"><div class="wrap"><div class="kicker" style="color:var(--taupe)">${esc(b.kicker)}</div>
    <h2>${esc(b.title)}</h2>
    <form onsubmit="event.preventDefault(); this.reset(); alert('¡Gracias! (demo — conectar a tu proveedor de email)');">
      <input type="email" placeholder="tu@correo.com" required><button class="btn btn-amber" type="submit">${esc(b.cta)} →</button></form>
    <div class="note">${esc(b.note)}</div></div></section>`;
}
function footer(f) {
  const routeMap = { "Datos en vivo": "#/datos", "Casos de Éxito": "#/casos", "Política": "#/politica", "Mapa": "#/mapa", "Noticias": "#/noticias" };
  return `<footer class="site"><div class="wrap">
    <div class="f-top"><div class="f-brand"><div class="fb">${esc(f.brand)}</div><p>${esc(f.tagline)}</p></div>
      ${f.columns.map(c => `<div class="f-col"><h4>${esc(c.title)}</h4>${c.links.map(l => `<a href="${routeMap[l] || "#/noticias"}">${esc(l)}</a>`).join("")}</div>`).join("")}</div>
    <div class="f-bottom"><span>${esc(f.legal)}</span><span>ES / EN</span></div></div></footer>`;
}

init();
