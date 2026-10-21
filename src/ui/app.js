// Rastro: lógica de interfaz. Scryfall para catálogo; Python (pywebview) para estado y tiendas.
"use strict";

const API = "https://api.scryfall.com";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const RAREZA = { common: "Común", uncommon: "Infrecuente", rare: "Rara", mythic: "Mítica", special: "Especial", bonus: "Bonus" };
const TIPOS = { creature: "Criatura", instant: "Instantáneo", sorcery: "Conjuro", artifact: "Artefacto", enchantment: "Encantamiento", planeswalker: "Planeswalker", land: "Tierra", battle: "Batalla" };
const COLORES = { w: "Blanco", u: "Azul", b: "Negro", r: "Rojo", g: "Verde", c: "Incoloro" };
const FORMATOS = { standard: "Standard", pioneer: "Pioneer", modern: "Modern", legacy: "Legacy", vintage: "Vintage", commander: "Commander", pauper: "Pauper", brawl: "Brawl" };
const MODO_COLOR = { incl: "incluye", exact: "exacto", id: "identidad" };
const PIP_COLOR = { W: "--mana-w", U: "--mana-u", B: "--mana-b", R: "--mana-r", G: "--mana-g", C: "--mana-c" };

const OPT_DEF = { pausa: 1.5, espera: 20, cache: 6, ver: false, foil: true, ia: false, esfuerzo: "equilibrado" };
const S = {
  view: "explore",
  q: "", exact: false,
  f: { colors: new Set(), colorMode: "incl", types: new Set(), cmc: new Set(), rarity: new Set(), set: "", format: "" },
  sort: "name", dir: "asc", layout: "grid",
  results: [], total: 0, next: null, loading: false, error: null, req: 0,
  selected: null, face: 0,
  list: [], shops: [], theme: "dark", sidebar: true,
  of: { lang: [], cond: "", foil: "", max: "" },   // filtros de oferta generales
  offers: {}, missing: [], searchedAt: null,         // resultados de la última búsqueda en tiendas
  stock: {},                                          // artículos a la venta de cada tienda (de la última búsqueda)
  run: null,                                          // búsqueda en marcha
  setup: false,                                       // primeros pasos completados
  opt: { ...OPT_DEF },                                // ventana Opciones
  decks: [], deck: null,                              // mazos (mazos.js) y el abierto
  chat: [],                                           // Preguntar al juez (juez.js): mensajes de la conversación
  juezMazo: null,                                     // mazo vinculado al juez (su id)
  iaPrueba: null,                                     // última prueba de la IA (Opciones): ok, plan, email, fecha
  sel: new Set(),                                     // cartas de Mi lista marcadas para buscar (vacío = todas)
  coleccion: [],                                      // cartas que tienes (coleccion.js): {id, name, set, cn, foil, qty…}
};
let sets = [];

/* ---------- Persistencia (Python si existe, si no localStorage) ---------- */
const bridge = () => window.pywebview && window.pywebview.api;
async function loadState() {
  let raw = null;
  try { raw = bridge() ? await bridge().cargar_estado() : localStorage.getItem("rastro"); } catch { }
  if (!raw) return;
  try {
    const d = typeof raw === "string" ? JSON.parse(raw) : raw;
    Object.assign(S, {
      list: d.list || [], shops: d.shops || [], theme: d.theme || "dark", layout: d.layout || "grid", sidebar: d.sidebar ?? true,
      of: { ...S.of, ...d.of }, offers: d.offers || {}, missing: d.missing || [], searchedAt: d.searchedAt || null, stock: d.stock || {},
      setup: !!d.setup, opt: { ...OPT_DEF, ...d.opt }, decks: d.decks || [], deck: d.deck || null, iaPrueba: d.iaPrueba || null, chat: d.chat || [], juezMazo: d.juezMazo || null, coleccion: d.coleccion || [],
    });
    // Búsquedas antiguas guardaban ofertas sin precio (no comprables): fuera
    for (const o of Object.values(S.offers)) for (const s in o) o[s] = o[s].filter(r => r.precio_num > 0);
  } catch { }
}
const save = debounce(() => {
  const d = JSON.stringify({
    list: S.list, shops: S.shops, theme: S.theme, layout: S.layout, sidebar: S.sidebar,
    of: S.of, offers: S.offers, missing: S.missing, searchedAt: S.searchedAt, stock: S.stock, setup: S.setup, opt: S.opt, decks: S.decks, deck: S.deck, iaPrueba: S.iaPrueba, chat: S.chat.slice(-40), juezMazo: S.juezMazo, coleccion: S.coleccion,
  });
  try { bridge() ? bridge().guardar_estado(d) : localStorage.setItem("rastro", d); } catch { }
}, 300);

/* ---------- Símbolos de maná ---------- */
// Los símbolos oficiales de Scryfall; si no cargan (sin conexión), un círculo de color con la letra
function pip(sym) {
  const s = sym.toUpperCase(), f = s.replace(/\//g, "");
  return `<img class="pip" src="https://svgs.scryfall.io/card-symbols/${encodeURIComponent(f)}.svg" alt="{${esc(s)}}" title="{${esc(s)}}" onerror="this.outerHTML=pipTexto('${esc(s)}')">`;
}
function pipTexto(sym) {
  const s = sym.toUpperCase();
  if (s === "T") return `<span class="pip pip-t" title="Girar">↷</span>`;
  if (s === "Q") return `<span class="pip pip-t" title="Enderezar">↶</span>`;
  const parts = s.split("/");
  if (parts.length === 2 && PIP_COLOR[parts[0]] && PIP_COLOR[parts[1]]) {
    return `<span class="pip" style="background:linear-gradient(135deg,var(${PIP_COLOR[parts[0]]}) 50%,var(${PIP_COLOR[parts[1]]}) 50%)"></span>`;
  }
  const base = parts[0];
  if (PIP_COLOR[base]) return `<span class="pip pip-${base.toLowerCase()}">${parts[1] === "P" ? "ϕ" : base}</span>`;
  return `<span class="pip pip-n">${esc(s === "S" ? "❄" : s)}</span>`;
}
const symbols = text => esc(text).replace(/\{([^}]+)\}/g, (_, s) => pip(s));
const cost = mc => mc ? `<span class="cost">${symbols(mc)}</span>` : "";

/* ---------- Datos de carta ---------- */
const faces = c => c.card_faces && !c.image_uris ? c.card_faces : [c];
const img = (c, size = "normal", face = 0) => (faces(c)[face]?.image_uris || c.image_uris || {})[size] || "";
const eur = c => c.prices?.eur || c.prices?.eur_foil;
// Cartas que solo se imprimieron en foil (o etched): se dibujan con el brillo foil en toda la app
const soloFoil = c => !!c.finishes && !c.finishes.includes("nonfoil");
// Se dibuja foil si solo existe en foil o si en Mi lista la has pedido "Solo foil"
const verFoil = c => soloFoil(c) || c._f?.foil === "si";
const fmtEur = v => v ? `${Number(v).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : "—";
const inList = id => S.list.some(c => c.id === id);
const manaCost = c => c.mana_cost ?? (c.card_faces || []).map(f => f.mana_cost).filter(Boolean).join(" // ");

/* ---------- Consulta a Scryfall ---------- */
function buildQuery() {
  const p = [], f = S.f;
  if (S.q) p.push(S.exact ? `!"${S.q}"` : S.q);
  const cols = [...f.colors].filter(c => c !== "c").join("");
  if (cols) p.push(f.colorMode === "exact" ? `c=${cols}` : f.colorMode === "id" ? `id<=${cols}` : `c>=${cols}`);
  else if (f.colors.has("c")) p.push("c=c");
  const or = arr => arr.length > 1 ? `(${arr.join(" or ")})` : arr[0];
  if (f.types.size) p.push(or([...f.types].map(t => `t:${t}`)));
  if (f.cmc.size) p.push(or([...f.cmc].map(n => n === "7" ? "mv>=7" : `mv=${n}`)));
  if (f.rarity.size) p.push(or([...f.rarity].map(r => `r:${r}`)));
  if (f.set) {
    const m = f.set.match(/\(([a-z0-9]+)\)\s*$/i);
    const hit = m ? m[1] : sets.find(s => s.name.toLowerCase() === f.set.toLowerCase())?.code || f.set.trim();
    p.push(`e:${hit}`);
  }
  if (f.format) p.push(`f:${f.format}`);
  return p.join(" ");
}

async function scry(url) {
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (r.status === 404) return { data: [], total_cards: 0 };
  if (!r.ok) throw new Error(`Scryfall ${r.status}`);
  return r.json();
}

// Sin búsqueda ni filtros, Explorar enseña las últimas cartas impresas en papel, de la más nueva a la más antigua
const NOVEDADES = "game:paper -t:token -t:emblem -t:basic -layout:art_series -is:digital";
async function search() {
  const q = buildQuery();
  const id = ++S.req;
  S.results = []; S.total = 0; S.next = null; S.error = null;
  S.loading = true; render();
  const params = q ? { q, order: S.sort, dir: S.dir, unique: "cards" } : { q: NOVEDADES, order: "released", dir: "desc", unique: "prints" };
  try {
    const d = await scry(`${API}/cards/search?${new URLSearchParams(params)}`);
    if (id !== S.req) return;
    S.results = d.data; S.total = d.total_cards; S.next = d.has_more ? d.next_page : null;
    if (S.exact && S.results.length === 1) openDetail(S.results[0]);
  } catch (e) {
    if (id !== S.req) return;
    S.error = e;
  }
  S.loading = false; render();
}
const searchSoon = debounce(search, 250);

async function loadMore() {
  if (!S.next || S.loading) return;
  const id = S.req;
  S.loading = true;
  appendSkeletons(6);
  try {
    const d = await scry(S.next);
    if (id !== S.req) return;
    S.next = d.has_more ? d.next_page : null;
    const from = S.results.length;
    S.results.push(...d.data);
    $$(".card.skeleton", results).forEach(e => e.remove());
    results.insertAdjacentHTML("beforeend", d.data.map((c, i) => cardHTML(c, i)).join(""));
    wireImages(results, from);
  } catch { $$(".card.skeleton", results).forEach(e => e.remove()); toast("No se pudieron cargar más resultados"); }
  S.loading = false;
}

/* ---------- Render ---------- */
const results = $("#results");

function cardHTML(c, i) {
  const r = c.rarity || "common";
  const added = inList(c.id);
  const small = S.layout === "rows";
  return `<div class="card${S.selected?.id === c.id ? " selected" : ""}" tabindex="0" data-id="${c.id}" style="--i:${i}"${small ? ` data-big="${esc(img(c, "normal"))}"` : ""}>
    ${S.view === "list" ? `<label class="sel-box" title="Buscar solo las marcadas"><input type="checkbox" data-sel="${c.id}"${S.sel.has(c.id) ? " checked" : ""}></label>` : ""}
    <div class="art skel${verFoil(c) ? " foil" : ""}"${soloFoil(c) ? ' title="Solo existe en foil"' : ""}><img alt="${esc(c.name)}" loading="lazy" decoding="async" src="${esc(img(c, small ? "art_crop" : "normal"))}"></div>
    <div class="meta">
      <div class="name" title="${esc(c.name)}">${S.view === "list" && qtyOf(c) > 1 ? `<span class="qty">${qtyOf(c)}×</span>` : ""}<span class="nm">${esc(c.name)}</span>${S.view === "list" ? foilBtn(c) : ""}</div>
      <div class="sub"><i class="rdot rar-${r}" title="${RAREZA[r] || r}"></i><span class="set">${esc(c.set_name)}</span><span class="price">${fmtEur(eur(c))}</span></div>
      <div class="avail-slot">${availHTML(c.id)}</div>
    </div>
    <span class="cost row-only">${cost(manaCost(c))}</span>
    <span class="type row-only">${esc(c.type_line)}</span>
    <span class="setcol row-only"><i class="rdot rar-${r}"></i> ${esc(c.set_name)}</span>
    <span class="price-col row-only">${fmtEur(eur(c))}</span>
    <span class="avail-col row-only avail-slot">${availHTML(c.id)}</span>
    <button class="add-btn${added ? " in" : ""}" data-add="${c.id}" title="${added ? "Quitar de mi lista" : "Añadir a mi lista"}"><svg class="ic"><use href="#i-${added ? "check" : "plus"}"/></svg></button>
  </div>`;
}

// En Mi lista: botón para comprar esa carta solo en foil (es el filtro "Foil: Solo foil" de la carta)
function foilBtn(c) {
  if (soloFoil(c)) return ` <span class="foil-tag" title="Solo existe en foil">Foil</span>`;
  const on = c._f?.foil === "si";
  return ` <button class="foil-btn${on ? " on" : ""}" data-foilsel="${c.id}" title="${on ? "Se busca solo en foil. Pulsa para aceptar cualquiera" : "Comprar solo en foil"}">Foil</button>`;
}
function toggleFoil(id) {
  const c = listItem(id); if (!c) return;
  const f = { ...c._f };
  if (f.foil === "si") delete f.foil; else f.foil = "si";
  c._f = f; save(); render();
  if (S.selected?.id === id) { S.selected = c; renderDetail(); }
  toast(f.foil ? `${c.name}: solo foil` : `${c.name}: foil o normal`);
}

function skeletons(n) {
  return Array.from({ length: n }, () => `<div class="card skeleton"><div class="art skel"></div><div class="meta row-only-hide"><div class="line skel"></div><div class="line short skel"></div></div></div>`).join("");
}
function appendSkeletons(n) { results.insertAdjacentHTML("beforeend", skeletons(n)); }

function wireImages(root, from = 0) {
  $$(".card img", root).slice(from).forEach(im => {
    const done = () => { im.classList.add("loaded"); im.parentElement.classList.remove("skel"); };
    im.complete && im.naturalWidth ? done() : im.addEventListener("load", done, { once: true });
  });
}

function empty(icon, title, text, extra = "") {
  return `<div class="empty"><div class="badge"><svg class="ic"><use href="#i-${icon}"/></svg></div><h2>${title}</h2><p>${text}</p>${extra}</div>`;
}

function render() {
  document.documentElement.dataset.theme = S.theme;
  $("#btnTheme use").setAttribute("href", S.theme === "dark" ? "#i-sun" : "#i-moon");
  document.body.classList.toggle("no-sidebar", !S.sidebar);
  document.body.classList.toggle("sin-foil", !S.opt.foil);
  $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === S.view));
  [["#countList", S.list.length], ["#countShops", S.shops.length], ["#countDecks", S.decks.length], ["#countCol", S.coleccion.reduce((n, e) => n + e.qty, 0)]]
    .forEach(([sel, n]) => { const el = $(sel); el.textContent = n; el.toggleAttribute("data-zero", !n); });
  $("#filters").hidden = S.view !== "explore";
  $("#offerFilters").hidden = S.view === "explore" || S.view === "judge" || S.view === "collection" || (S.view === "decks" && !deckActual());
  $(".toolbar-right").style.display = S.view === "shops" || S.view === "decks" || S.view === "judge" || S.view === "collection" ? "none" : "";
  $("#viewActions").innerHTML = "";   // cada vista pone aquí sus acciones principales
  $(".view-toggle").style.display = S.view === "results" ? "none" : "";
  $$(".view-toggle button").forEach(b => b.classList.toggle("on", b.dataset.v === S.layout));
  $("#sort").value = S.sort;
  $("#sortDir use").setAttribute("href", S.dir === "asc" ? "#i-arrow-up" : "#i-arrow-down");
  results.className = `results ${S.layout === "grid" ? "grid" : "rows"}`;
  renderChips();

  const title = $("#viewTitle"), count = $("#resultCount");
  if (S.view === "shops") { title.textContent = "Tiendas"; count.textContent = ""; renderShops(); return; }
  if (S.view === "decks") { renderDecks(); return; }
  if (S.view === "judge") { renderJuez(); return; }
  if (S.view === "collection") { renderColeccion(); return; }
  if (S.view === "results") { title.textContent = "Resultados"; count.textContent = S.list.length ? `${S.list.length} cartas · ${S.shops.length} tiendas` : ""; renderResults(); return; }
  if (S.view === "list") {
    title.textContent = "Mi lista";
    count.textContent = S.list.length ? `${S.list.length} carta${S.list.length > 1 ? "s" : ""}` : "";
    if (!S.list.length) {
      results.innerHTML = empty("bookmark", "Tu lista está vacía", "Pega una lista o decklist, o añade cartas desde Explorar con el botón +.",
        `<div class="suggestions"><button class="btn primary" data-paste><svg class="ic"><use href="#i-clipboard"/></svg>Pegar lista</button><button class="btn" data-go="explore"><svg class="ic"><use href="#i-compass"/></svg>Ir a Explorar</button></div>`);
      return;
    }
    const sorted = sortLocal(S.list);
    const running = S.run && !S.run.finished;
    const found = S.list.filter(c => offerSummary(c.id).hits.length).length;
    const summary = S.searchedAt
      ? `<span class="summary">Disponibles <b>${found}</b> de <b>${S.list.length}</b> · última búsqueda ${new Date(S.searchedAt).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>`
      : `<span class="summary">Ajusta los filtros de oferta a la izquierda y busca en tus tiendas.</span>`;
    results.innerHTML = `<div class="list-actions">${summary}
        <button class="btn" data-paste><svg class="ic"><use href="#i-clipboard"/></svg>Pegar lista</button>
        ${found ? `<button class="btn" data-go="results"><svg class="ic"><use href="#i-table"/></svg>Ver resultados</button><button class="btn" id="btnExport"><svg class="ic"><use href="#i-download"/></svg>Exportar CSV</button>` : ""}
        <label class="check" title="Vuelve a consultar aunque haya datos de hace menos de 6 horas"><input type="checkbox" id="fresh">Ignorar caché</label>
        <span class="sel-actions"><button class="btn sm ghost" data-selall="1">Marcar todas</button><button class="btn sm ghost" data-selall="0">Ninguna</button></span>
        <button class="btn primary" id="btnShopSearch" ${running ? "disabled" : ""}><svg class="ic"><use href="#i-radar"/></svg><span id="shopSearchLabel">${textoBuscar()}</span></button>
      </div>`
      + sorted.map((c, i) => cardHTML(c, i)).join("");
    wireImages(results);
    return;
  }

  title.textContent = "Explorar";
  count.textContent = S.loading && !S.results.length ? "Buscando…" : !buildQuery() ? "Novedades: las cartas más recientes" : S.total ? `${S.total.toLocaleString("es-ES")} resultado${S.total > 1 ? "s" : ""}` : "";
  if (S.loading && !S.results.length) { results.innerHTML = skeletons(18); return; }
  if (S.error) {
    results.innerHTML = empty("wifi-off", "No hay conexión con Scryfall", "Comprueba tu conexión a internet. Tus listas y tiendas siguen guardadas.",
      `<div class="suggestions"><button class="btn primary" data-retry>Reintentar</button></div>`);
    return;
  }
  if (!S.results.length) {
    const hasF = activeFilters().length;
    results.innerHTML = empty("search-x", `Sin resultados${S.q ? ` para “${esc(S.q)}”` : ""}`,
      hasF ? "Prueba a quitar algún filtro o revisa la ortografía. Los nombres de carta van en inglés." : "Revisa la ortografía. Los nombres de carta van en inglés.",
      hasF ? `<div class="suggestions"><button class="btn primary" data-clear>Quitar filtros</button></div>` : "");
    return;
  }
  results.innerHTML = S.results.map((c, i) => cardHTML(c, i)).join("");
  wireImages(results);
}

function sortLocal(arr) {
  const k = { name: c => c.name, cmc: c => c.cmc ?? 0, eur: c => Number(eur(c) || 0), released: c => c.released_at || "" }[S.sort];
  const out = [...arr].sort((a, b) => (k(a) > k(b) ? 1 : k(a) < k(b) ? -1 : 0));
  return S.dir === "desc" ? out.reverse() : out;
}

/* Chips de filtros activos */
function activeFilters() {
  const f = S.f, out = [];
  f.colors.forEach(c => out.push({ label: `${pip(c)}${COLORES[c]}${f.colorMode !== "incl" ? ` · ${MODO_COLOR[f.colorMode]}` : ""}`, off: () => f.colors.delete(c) }));
  f.types.forEach(t => out.push({ label: TIPOS[t], off: () => f.types.delete(t) }));
  f.cmc.forEach(n => out.push({ label: `Coste ${n === "7" ? "7+" : n}`, off: () => f.cmc.delete(n) }));
  f.rarity.forEach(r => out.push({ label: `<i class="rdot rar-${{ c: "common", u: "uncommon", r: "rare", m: "mythic" }[r]}"></i>${{ c: "Común", u: "Infrecuente", r: "Rara", m: "Mítica" }[r]}`, off: () => f.rarity.delete(r) }));
  if (f.set) out.push({ label: `Set: ${esc(f.set)}`, off: () => { f.set = ""; $("#fSet").value = ""; } });
  if (f.format) out.push({ label: `Legal en ${FORMATOS[f.format]}`, off: () => { f.format = ""; $("#fFormat").value = ""; } });
  return out;
}
let chipActions = [];
function renderChips() {
  const box = $("#activeChips");
  if (S.view !== "explore") { box.innerHTML = ""; return; }
  chipActions = activeFilters();
  box.innerHTML = chipActions.map((c, i) => `<span class="chip">${c.label}<button data-chip="${i}" title="Quitar"><svg class="ic"><use href="#i-x"/></svg></button></span>`).join("")
    + (chipActions.length > 1 ? `<button class="chip clear" data-clear>Limpiar todo</button>` : "");
}
function syncFilterUI() {
  const f = S.f;
  $$("#fColor .mana-btn").forEach(b => b.classList.toggle("on", f.colors.has(b.dataset.v)));
  $$("#fColorMode button").forEach(b => b.classList.toggle("on", b.dataset.v === f.colorMode));
  $$("#fType button").forEach(b => b.classList.toggle("on", f.types.has(b.dataset.v)));
  $$("#fCmc button").forEach(b => b.classList.toggle("on", f.cmc.has(b.dataset.v)));
  $$("#fRarity button").forEach(b => b.classList.toggle("on", f.rarity.has(b.dataset.v)));
}
function clearFilters() {
  const f = S.f;
  [f.colors, f.types, f.cmc, f.rarity].forEach(s => s.clear());
  f.set = f.format = ""; f.colorMode = "incl";
  $("#fSet").value = ""; $("#fFormat").value = "";
  syncFilterUI(); search();
}

/* Tiendas */
const shopUrl = (shop, name) => `https://www.cardmarket.com/en/Magic/Users/${encodeURIComponent(shop)}/Offers/Singles${name ? `?name=${encodeURIComponent(name.split(" // ")[0])}` : ""}`;
const offerLink = (shop, c, r) => r?.enlace || shopUrl(shop, c.name);
const qtyOf = c => Math.max(1, parseInt(c._f?.qty, 10) || 1);

// Coste de comprar qty copias empezando por las ofertas más baratas (las filas ya vienen ordenadas)
function fill(rows, qty) {
  let left = qty, total = 0;
  for (const r of rows) {
    const n = Math.min(left, r.cantidad || 1);
    total += n * r.precio_num; left -= n;
    if (!left) break;
  }
  return { total, got: qty - left, stock: rows.reduce((t, r) => t + (r.cantidad || 1), 0) };
}
function shopStats(shop) {
  const checked = S.list.filter(c => S.offers[c.id] && shop in S.offers[c.id]);
  const have = checked.filter(c => S.offers[c.id][shop].length);
  const total = have.reduce((t, c) => t + fill(S.offers[c.id][shop], qtyOf(c)).total, 0);
  const complete = have.filter(c => fill(S.offers[c.id][shop], qtyOf(c)).got >= qtyOf(c)).length;
  return { checked, have, total, complete };
}
const rankShops = () => {
  const stats = Object.fromEntries(S.shops.map(s => [s, shopStats(s)]));
  const order = [...S.shops].filter(s => !S.missing.includes(s))
    .sort((a, b) => stats[b].have.length - stats[a].have.length || stats[a].total - stats[b].total);
  return { stats, order };
};

function renderShops() {
  const typed = $("#shopInput")?.value || "";
  const { stats, order } = rankShops();
  const shops = [...order, ...S.shops.filter(s => S.missing.includes(s))];
  const best = order.find(s => stats[s].have.length);
  const row = s => {
    const st = stats[s], missing = S.missing.includes(s);
    const info = missing ? `<span class="shop-stats" style="color:var(--bad)">No existe en Cardmarket</span>`
      : st.checked.length ? `<span class="shop-stats">Tiene <b>${st.have.length}</b> de ${st.checked.length}${st.have.length ? ` · <b>${fmtEur(st.total)}</b>` : ""}</span>` : "";
    const cards = !missing && st.checked.length ? `<div class="shop-cards">${st.checked.map(c => {
      const r = S.offers[c.id][s];
      return r.length ? `<span>${esc(c.name)}<b>${fmtEur(r[0].precio_num)}</b></span>` : `<span class="no">${esc(c.name)}</span>`;
    }).join("")}</div>` : "";
    return `<div class="shop-row${missing ? " missing" : ""}"><span class="avatar">${esc(s[0])}</span>
      <span class="grow">${esc(s)} ${s === best ? `<span class="best">Más completa</span>` : ""}${!missing && S.stock[s] != null ? `<small class="shop-listed">${typeof S.stock[s] === "number" ? S.stock[s].toLocaleString("es-ES") : esc(S.stock[s])} cartas a la venta</small>` : ""}</span>${info}
      <a class="link" href="${shopUrl(s)}" target="_blank"><svg class="ic"><use href="#i-external"/></svg>Ver</a>
      <button class="icon-btn sm" data-rmshop="${esc(s)}" title="Quitar"><svg class="ic"><use href="#i-trash"/></svg></button>${cards}</div>`;
  };
  results.className = "results";
  results.innerHTML = `<div class="shops">
    <p style="margin:0;color:var(--text-2)">Usuarios de Cardmarket en los que buscar las cartas de tu lista. Tras buscar, se ordenan por cuántas cartas tienen y por el coste total más barato.</p>
    <form class="shop-add" id="shopForm"><input class="field" id="shopInput" placeholder="Nombre de usuario o URL del perfil" autocomplete="off" value="${esc(typed)}"><button class="btn primary"><svg class="ic"><use href="#i-plus"/></svg>Añadir</button>
      <button type="button" class="btn" id="btnShopsImport" title="Añade tiendas desde un archivo de texto (una por línea)">Importar</button>
      <button type="button" class="btn" id="btnShopsExport" title="Guarda tus tiendas en un archivo de texto"><svg class="ic"><use href="#i-download"/></svg>Exportar</button></form>
    <div class="shop-list">${shops.length ? shops.map(row).join("") : empty("store", "Sin tiendas", "Añade el nombre de usuario de una tienda de Cardmarket.")}</div></div>`;
}

/* ---------- Resultados ---------- */
function renderResults() {
  results.className = "results";
  if (!S.list.length) {
    results.innerHTML = empty("table", "Sin cartas", "Pega una lista o añade cartas desde Explorar y búscalas en tus tiendas.",
      `<div class="suggestions"><button class="btn primary" data-paste><svg class="ic"><use href="#i-clipboard"/></svg>Pegar lista</button></div>`);
    return;
  }
  if (!S.searchedAt && !S.run) {
    results.innerHTML = empty("radar", "Todavía no has buscado", "Pulsa Buscar en Mi lista para comparar tus tiendas.",
      `<div class="suggestions"><button class="btn primary" data-go="list">Ir a Mi lista</button></div>`);
    return;
  }
  const { stats, order } = rankShops();
  const cards = sortLocal(S.list);
  let optimal = 0, optimalCards = 0;
  const bodies = cards.map(c => {
    const q = qtyOf(c), o = S.offers[c.id] || {};
    const shops = Object.keys(o).filter(s => o[s].length).map(s => ({ s, rows: o[s], f: fill(o[s], q) }))
      .sort((a, b) => a.rows[0].precio_num - b.rows[0].precio_num);
    const head = `<td class="cardcell" rowspan="${Math.max(1, shops.length)}" data-open="${c.id}">${q > 1 ? `<span class="qty">${q}×</span>` : ""}${esc(c.name)}</td>`;
    if (!shops.length) {
      const pending = offerSummary(c.id).pending;
      return `<tbody><tr class="none">${head}<td colspan="7">${pending ? "Buscando…" : "No está en ninguna de tus tiendas"}</td></tr></tbody>`;
    }
    optimal += shops[0].f.total; optimalCards++;
    return `<tbody>${shops.map(({ s, rows, f }, i) => {
      const r = rows[0];
      return `<tr class="${i === 0 ? "cheapest" : ""}">${i === 0 ? head : ""}
        <td>${esc(s)}${i === 0 && shops.length > 1 ? `<span class="badge-cheap">Más barata</span>` : ""}</td>
        <td class="num price">${esc(r.precio)}</td>
        <td><span class="cond cond-${esc(r.estado)}">${esc(r.estado)}</span></td>
        <td>${esc(LANG_ES[r.idioma] || r.idioma)}${extrasHTML(r)}</td>
        <td class="num${f.stock < q ? " short" : ""}" title="${f.stock < q ? `Solo tiene ${f.stock} de ${q}` : ""}">${f.stock}</td>
        <td class="num">${fmtEur(f.total)}</td>
        <td><a class="go" href="${esc(offerLink(s, c, r))}" target="_blank" title="Abrir en la tienda"><svg class="ic"><use href="#i-external"/></svg></a></td>
      </tr>`;
    }).join("")}</tbody>`;
  }).join("");
  const top = order.find(s => stats[s].have.length);
  const totals = order.filter(s => stats[s].checked.length).map(s => {
    const st = stats[s];
    return `<div class="total-card${s === top ? " top" : ""}"><header><span>${esc(s)}</span>${s === top ? `<span class="best">Más completa</span>` : ""}</header>
      <b>${fmtEur(st.total) === "—" ? "0,00 €" : fmtEur(st.total)}</b>
      <small>${st.have.length} de ${S.list.length} cartas${st.complete < st.have.length ? ` · ${st.have.length - st.complete} sin stock suficiente` : ""}</small></div>`;
  }).join("");
  results.innerHTML = `<div class="res">
    <div class="totals">
      <div class="total-card optimal"><header><span title="Comprando cada carta en la tienda donde sale más barata">Mejor precio por carta</span></header>
        <b>${fmtEur(optimal) === "—" ? "0,00 €" : fmtEur(optimal)}</b><small>${optimalCards} de ${S.list.length} cartas disponibles</small></div>
      ${totals}
    </div>
    <div class="table-wrap"><table class="rtable">
      <thead><tr><th>Carta</th><th>Tienda</th><th class="num">Precio</th><th>Estado</th><th>Idioma</th><th class="num">Stock</th><th class="num">Total</th><th></th></tr></thead>
      ${bodies}
    </table></div></div>`;
}

/* ---------- Ofertas en tiendas ---------- */
// Foto del artículo subida por el vendedor (r.foto); las búsquedas antiguas la traían como <img> dentro de extras
function extrasDe(r) {
  const foto = r.foto || ((r.extras || "").match(/src="([^"]+)"/) || [])[1] || "";
  const texto = (r.extras || "").split(/,\s*/).filter(x => x && !x.includes("<")).join(", ");
  return { foto: foto.replace(/&amp;/g, "&"), texto };
}
function extrasHTML(r) {
  const { foto, texto } = extrasDe(r);
  return (texto ? ` <span class="tag">${esc(texto)}</span>` : "")
    + (foto ? ` <span class="foto" data-foto="${esc(foto)}" role="button" tabindex="0" title="Foto del artículo: clic para verla en grande"><svg class="ic"><use href="#i-camera"/></svg>Foto</span>` : "");
}

// Vista previa al pasar el ratón; clic abre la foto completa en tu navegador.
// El servidor de fotos de Cardmarket rechaza peticiones que no vienen de su web, así que las descarga app.py.
const preview = $("#fotoPreview");
const miniaturas = new Map();   // url -> data: URI ya descargada
let fotoActual = "";
async function mostrarFoto(el) {
  const url = el.dataset.foto;
  const im = preview.querySelector("img") || preview.appendChild(Object.assign(document.createElement("img"), { alt: "" }));
  if (fotoActual !== url) {
    fotoActual = url;
    preview.classList.remove("loaded", "fallo");
    im.removeAttribute("src");
    im.onload = () => preview.classList.add("loaded");
    try {
      if (!miniaturas.has(url)) miniaturas.set(url, bridge() ? await bridge().foto_miniatura(url) : url);
      if (fotoActual === url) im.src = miniaturas.get(url);
    } catch {
      miniaturas.delete(url);
      if (fotoActual === url) preview.classList.add("fallo");
    }
  }
  const r = el.getBoundingClientRect(), w = 260, h = 360, m = 12;
  let x = r.left - w - m, y = r.top + r.height / 2 - h / 2;
  if (x < m) x = r.right + m;                               // si no cabe a la izquierda, a la derecha
  y = Math.max(m, Math.min(y, innerHeight - h - m));
  preview.style.transform = `translate(${x}px, ${y}px)`;
  preview.hidden = false;
}
document.addEventListener("mouseover", e => { const f = e.target.closest?.("[data-foto]"); if (f) mostrarFoto(f); });
document.addEventListener("mouseout", e => { if (e.target.closest?.("[data-foto]") && !e.relatedTarget?.closest?.("[data-foto]")) preview.hidden = true; });
function abrirFoto(e, f) {
  e.preventDefault(); e.stopPropagation();                  // no seguir el enlace de la fila
  preview.hidden = true;
  if (!bridge()) return window.open(f.dataset.foto, "_blank");
  toast("Abriendo la foto…");
  bridge().abrir_foto(f.dataset.foto).catch(() => toast("No se pudo descargar la foto"));
}
document.addEventListener("click", e => { const f = e.target.closest("[data-foto]"); if (f) abrirFoto(e, f); }, true);

// Lista compacta: la carta entera al pasar el ratón por la fila, sin salirse de la ventana
const cardPreview = $("#cardPreview");
document.addEventListener("mouseover", e => {
  const row = e.target.closest?.("[data-big]");
  if (!row) return;
  const im = cardPreview.firstElementChild || cardPreview.appendChild(Object.assign(document.createElement("img"), { alt: "" }));
  if (im.getAttribute("src") !== row.dataset.big) im.src = row.dataset.big;
  const r = row.getBoundingClientRect(), w = 250, h = w * 88 / 63, m = 12;
  let x = e.clientX + 32;
  if (x + w > innerWidth - m) x = e.clientX - w - 32;   // si no cabe a la derecha del ratón, a la izquierda
  let y = r.top + r.height / 2 - h / 2;
  y = Math.max(m, Math.min(y, innerHeight - h - m));
  cardPreview.style.transform = `translate(${x}px, ${y}px)`;
  cardPreview.hidden = false;
});
document.addEventListener("mouseout", e => { if (e.target.closest?.("[data-big]") && !e.relatedTarget?.closest?.("[data-big]")) cardPreview.hidden = true; });
document.addEventListener("click", () => { cardPreview.hidden = true; });
document.addEventListener("keydown", e => { const f = e.target.closest?.("[data-foto]"); if (f && (e.key === "Enter" || e.key === " ")) abrirFoto(e, f); });

const LANG_ES = { English: "Inglés", French: "Francés", German: "Alemán", Spanish: "Español", Italian: "Italiano", "S-Chinese": "Chino simp.", Japanese: "Japonés", Portuguese: "Portugués", Russian: "Ruso", Korean: "Coreano", "T-Chinese": "Chino trad." };
const listItem = id => S.list.find(c => c.id === id);

function offerSummary(id) {
  const o = S.offers[id] || {};
  const hits = Object.values(o).filter(r => r.length);
  const r = S.run;
  const pending = !!r && !r.finished && r.ids.has(id) && Object.entries(r.shops).some(([s, st]) => !st.fin && !(s in o));
  return { hits, best: hits.length ? Math.min(...hits.map(x => x[0].precio_num)) : null, pending, searched: id in S.offers };
}
function availHTML(id) {
  const s = offerSummary(id);
  if (!s.searched) return "";
  if (s.hits.length) return `<span class="avail ok"><b>${s.hits.length}</b> tienda${s.hits.length > 1 ? "s" : ""} · desde <b>${fmtEur(s.best)}</b>${s.pending ? " …" : ""}</span>`;
  if (s.pending) return `<span class="avail pending">Buscando…</span>`;
  return `<span class="avail none">No disponible</span>`;
}
const refreshAvail = id => $$(`.card[data-id="${id}"] .avail-slot`).forEach(e => { e.innerHTML = availHTML(id); });

function offersHTML(c) {
  if (!inList(c.id)) return `<div class="placeholder-box">Añádela a tu lista para buscarla en tus tiendas.</div>`;
  const o = S.offers[c.id];
  if (!o) return `<div class="placeholder-box">Pulsa “Buscar en tiendas” en Mi lista para ver aquí sus ofertas.</div>`;
  const shops = Object.keys(o);
  if (!shops.length) return `<div class="placeholder-box">${offerSummary(c.id).pending ? "Buscando en tus tiendas…" : "Sin datos de la última búsqueda."}</div>`;
  const yes = shops.filter(s => o[s].length).sort((a, b) => o[a][0].precio_num - o[b][0].precio_num);
  const no = shops.filter(s => !o[s].length);
  return `<div class="offers">${yes.map(s => `<section class="offer-shop"><header>${esc(s)}<small>${o[s].length} oferta${o[s].length > 1 ? "s" : ""}</small></header>
      ${o[s].map(r => `<a class="offer-row" href="${esc(offerLink(s, c, r))}" target="_blank" title="Abrir en la tienda">
        <span class="o-set">${esc(r.edicion)}</span>
        <span class="o-qty">×${esc(r.cantidad)}</span>
        <span class="o-price">${esc(r.precio)}</span>
        <span class="o-meta"><span class="cond cond-${esc(r.estado)}">${esc(r.estado)}</span>${esc(LANG_ES[r.idioma] || r.idioma)}${extrasHTML(r)}</span>
        ${r.comentario ? `<span class="o-com">“${esc(r.comentario)}”</span>` : ""}
      </a>`).join("")}</section>`).join("")}
    ${no.map(s => `<section class="offer-shop none"><header>${esc(s)}<small>No la tiene</small></header></section>`).join("")}</div>`;
}

function cardFiltersHTML(c) {
  const f = c._f || {};
  return `<div class="card-filters">
    <div class="row2">
      <label><small>Copias que necesitas</small><input class="field" data-cf="qty" type="number" min="1" max="99" value="${qtyOf(c)}"></label>
      <label><small>Precio máx.</small><input class="field" data-cf="max" inputmode="decimal" placeholder="${S.of.max ? `General: ${esc(S.of.max)} €` : "Sin límite"}" value="${esc(f.max || "")}"></label>
    </div>
    <label class="check"><input type="checkbox" data-cf="edicion" ${f.edicion ? "checked" : ""}>Solo esta edición (${esc(c.set_name)})</label>
    <label><small>Foil</small><select class="field" data-cf="foil">
      <option value="">Como general</option>
      <option value="si" ${f.foil === "si" ? "selected" : ""}>Solo foil</option>
      <option value="no" ${f.foil === "no" ? "selected" : ""}>Sin foil</option></select></label>
  </div>`;
}

const cardFilters = c => {
  const f = c._f || {}, o = {};
  if (f.edicion) o.edicion = c.set_name;
  if (f.max) o.max = f.max;
  if (f.foil) o.foil = f.foil;
  return o;
};
const generalFilters = () => {
  const o = {};
  if (S.of.lang.length) o.idioma = S.of.lang.join(",");
  if (S.of.cond) o.estado = S.of.cond;
  if (S.of.foil) o.foil = S.of.foil;
  if (S.of.max) o.max = S.of.max;
  return o;
};

// Si hay cartas marcadas en Mi lista, se buscan solo esas; si no, todas
const aBuscar = () => S.sel.size ? S.list.filter(c => S.sel.has(c.id)) : S.list;
const textoBuscar = () => `Buscar ${S.sel.size ? `${S.sel.size} marcada${S.sel.size > 1 ? "s" : ""}` : "todas"} en ${S.shops.length || "mis"} tienda${S.shops.length === 1 ? "" : "s"}`;
function marcar(id, on) {
  if (on) S.sel.add(id); else S.sel.delete(id);
  if ($("#shopSearchLabel")) $("#shopSearchLabel").textContent = textoBuscar();
}

async function startShopSearch() {
  if (!bridge()) return toast("La búsqueda en tiendas solo funciona dentro de la app");
  if (!S.shops.length) { goView("shops"); return toast("Añade primero alguna tienda"); }
  const cartas = aBuscar();
  const ids = cartas.map(c => c.id);
  for (const id of ids) S.offers[id] = {};   // las no marcadas conservan sus ofertas anteriores
  S.missing = [];
  S.run = {
    ids: new Set(ids), finished: false, errors: [], captcha: false, wait: 0,
    shops: Object.fromEntries(S.shops.map(s => [s, { modo: "", hecho: 0, total: 0, fin: false }])),
  };
  render(); renderRun();
  const fresh = $("#fresh")?.checked;
  const ok = await bridge().buscar_tiendas(cartas.map(c => ({ id: c.id, nombre: c.name, filtros: cardFilters(c) })), S.shops, generalFilters(), !!fresh,
    { pausa: S.opt.pausa, espera_extension: S.opt.espera, cache_horas: S.opt.cache, ocultar: !S.opt.ver });
  if (!ok) { S.run = null; toast("Ya hay una búsqueda en marcha"); render(); renderRun(); }
}

// Eventos que envía la búsqueda (app.py -> onMotor)
const rerenderSoon = debounce(() => { if (S.view === "results") renderResults(); if (S.view === "shops") renderShops(); }, 250);
window.onMotor = ev => {
  const r = S.run, st = r && ev.tienda ? r.shops[ev.tienda] : null;
  switch (ev.tipo) {
    case "plan":
      S.stock[ev.tienda] = ev.stock;
      if (st) Object.assign(st, { modo: ev.modo, total: ev.total, stock: ev.stock });
      break;
    case "progreso": if (st) Object.assign(st, { hecho: ev.hecho, total: ev.total }); break;
    case "resultado":
      ev.filas.forEach(f => { f.enlace = ev.enlace; });
      (S.offers[ev.id] ??= {})[ev.tienda] = ev.filas;
      refreshAvail(ev.id);
      if (S.selected?.id === ev.id) renderDetail();
      rerenderSoon();
      break;
    case "no_tienda":
      S.missing.push(ev.tienda);
      if (st) st.missing = true;
      toast(`La tienda “${ev.tienda}” no existe en Cardmarket`);
      break;
    case "tienda_fin":
      if (st) st.fin = true;
      S.list.forEach(c => refreshAvail(c.id));
      rerenderSoon();
      break;
    case "extension_vieja":
      if (r) r.extVieja = ev.instalada || "antigua";
      break;
    case "actualizando":
      $("#updateBanner")?.remove();
      document.body.insertAdjacentHTML("beforeend", `<div class="update-banner" id="updateBanner" role="status">${ev.error
        ? `No se pudo actualizar a la versión ${esc(ev.version)}. Se intentará la próxima vez que abras Rastro.`
        : `Actualizando Rastro a la versión ${esc(ev.version)}… se reiniciará solo en unos segundos.`}</div>`);
      if (ev.error) setTimeout(() => $("#updateBanner")?.remove(), 8000);
      return;
    case "extension":
      if (!r) break;
      if (ev.ok) r.contacted = true; else if (!r.contacted) r.noExt = true; // nunca contestó: la búsqueda se para
      r.extension = ev.ok;
      break;
    case "captcha":
      if (r) r.captcha = ev.activo;
      if (ev.activo) toast(`Cardmarket pide verificación: resuélvela en la ventana de ${esc(NAV.nombre)}`);
      break;
    case "espera": if (r) r.wait = ev.segundos; break;
    case "error":
      if (r) r.errors.push(ev.texto);
      if (st) st.error = ev.texto;
      break;
    case "fin":
      if (r?.noExt) {
        S.run = null; render(); renderRun();
        openSetup(`No se detecta la extensión de Rastro en ${NAV.nombre}: puede que se haya quitado o desactivado. Vuelve a instalarla y pruébala; al continuar, la búsqueda se relanzará sola.`, true);
        return;
      }
      S.searchedAt = new Date().toISOString();
      if (r?.errors.length) r.finished = true; else S.run = null;
      if (r && !r.errors.length) toast("Búsqueda terminada");
      save(); render();
      if (S.selected) renderDetail();
      break;
  }
  renderRun();
};

function renderRun() {
  const r = S.run, bar = $("#runBar");
  bar.hidden = !r;
  if (!r) return;
  const shops = Object.entries(r.shops);
  const done = shops.reduce((t, [, s]) => t + (s.fin ? Math.max(s.total, 1) : s.hecho), 0);
  const total = shops.reduce((t, [, s]) => t + Math.max(s.total, 1), 0);
  const active = shops.filter(([, s]) => !s.fin).length;
  bar.classList.toggle("error", r.finished && r.errors.length > 0);
  $("#runText").textContent = r.finished
    ? `Búsqueda terminada con ${r.errors.length} aviso${r.errors.length > 1 ? "s" : ""}: ${r.errors.at(-1)}`
    : r.stopping ? "Parando…" : `Buscando en ${active} de ${shops.length} tiendas`;
  $("#runCount").textContent = r.finished ? "" : `${done}/${total} páginas`;
  $("#runProgress").style.transform = `scaleX(${total ? Math.min(1, done / total) : 0})`;
  $("#btnStop").textContent = r.finished ? "Cerrar" : "Parar";
  $(".runbar-hint").hidden = r.finished;
  const alert = $("#runAlert");
  const msg = r.finished ? "" : r.extVieja
    ? `La extensión de ${esc(NAV.nombre)} es de una versión anterior de Rastro. Vuelve a descargarla y recárgala para evitar fallos. <button class="btn sm" data-setup>Primeros pasos</button>`
    : r.extension === false
    ? `No llega nada de la extensión Rastro en ${esc(NAV.nombre)}. Si no la has instalado, sigue los primeros pasos. <button class="btn sm" data-setup>Primeros pasos</button>`
    : r.captcha
    ? `Cardmarket pide una verificación. He puesto esa pestaña delante en ${esc(NAV.nombre)}: resuélvela y la búsqueda sigue sola.`
    : r.wait ? `Cardmarket pide ir más despacio. Todas sus tiendas esperan ${r.wait} s antes de reintentar.` : "";
  alert.hidden = !msg;
  alert.innerHTML = msg ? `<svg class="ic"><use href="#i-alert"/></svg><span>${msg}</span>` : "";
  $("#runShops").innerHTML = shops.map(([name, s]) => {
    const bad = s.missing || s.error;
    const label = s.missing ? "No existe" : s.error ? "Error" : s.fin ? "Hecho" : s.total ? `${s.hecho}/${s.total}` : "En cola";
    const modo = s.modo === "inventario" ? `<span class="mode" title="Lee todo su stock (${s.stock} artículos) y cruza en local">Inventario</span>`
      : s.modo === "carta" ? `<span class="mode" title="Su stock es grande: una consulta por carta">Por carta</span>` : "";
    const frac = s.fin ? 1 : s.total ? s.hecho / s.total : 0;
    return `<div class="run-shop${s.fin && !bad ? " done" : ""}${bad ? " bad" : ""}" title="${esc(s.error || "")}">
      <b>${esc(name)}${modo}</b><small>${label}</small><span class="mini"><i style="transform:scaleX(${frac})"></i></span></div>`;
  }).join("");
}

async function exportCSV() {
  const rows = [["Carta", "Copias", "Tienda", "Edición", "Idioma", "Estado", "Extras", "Precio", "Cantidad", "Comentario", "Enlace", "Foto"]];
  S.list.forEach(c => Object.entries(S.offers[c.id] || {}).forEach(([s, rs]) => rs.forEach(r =>
    rows.push([c.name, qtyOf(c), s, r.edicion, r.idioma, r.estado, extrasDe(r).texto, r.precio, r.cantidad, r.comentario, offerLink(s, c, r), extrasDe(r).foto]))));
  if (rows.length === 1) return toast("No hay ofertas que exportar");
  if (!bridge()) return toast("Exportar solo funciona dentro de la app");
  if (await bridge().exportar_csv(rows)) toast("CSV guardado");
}

/* ---------- Pegar lista (decklist) ---------- */
function parseDecklist(text) {
  const items = new Map();
  for (let line of text.split(/\r?\n/)) {
    line = line.trim().replace(/^SB:\s*/i, "");
    if (!line || /^(\/\/|#)/.test(line)) continue;
    if (/^(deck|mazo|main(board)?|sideboard|banquillo|commander|comandante|companion|compañero|maybeboard|tokens?)\s*:?\s*(\(\d+\))?$/i.test(line)) continue;
    let qty = 1, rest = line;
    const m = line.match(/^(\d+)\s*x?\s+(.+)$/i);
    if (m) { qty = +m[1]; rest = m[2]; }
    rest = rest.replace(/\s+\*[A-Z]+\*\s*$/, "");                     // *F* (foil) de Moxfield
    let name = rest, set = null;
    let cn = null;
    const s = rest.match(/^(.*?)\s+[([]([A-Za-z0-9]{2,6})[)\]](?:\s+([\w★-]+))?\s*$/); // "Nombre (SET) 123"
    if (s) { name = s[1]; set = s[2].toLowerCase(); cn = s[3] || null; }
    name = name.trim();
    const key = `${name.toLowerCase()}|${set || ""}|${cn || ""}`;
    items.set(key, { name, set, cn, qty: (items.get(key)?.qty || 0) + qty });
  }
  return [...items.values()];
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
// Scryfall /cards/collection: hasta 75 cartas por petición; ~150 ms entre peticiones (su límite es 10/s)
async function resolveCards(items) {
  const found = [], missing = [];
  const key = id => `${(id.name || "").toLowerCase()}|${id.set || ""}|${id.collector_number || ""}`;
  for (let i = 0; i < items.length; i += 75) {
    const chunk = items.slice(i, i + 75);
    const ids = chunk.map(x => x.set && x.cn ? { set: x.set, collector_number: x.cn } : x.set ? { name: x.name, set: x.set } : { name: x.name });
    const r = await fetch(`${API}/cards/collection`, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ identifiers: ids }),
    });
    if (!r.ok) throw new Error(`Scryfall respondió ${r.status}`);
    const d = await r.json();
    const nf = new Set((d.not_found || []).map(key));
    let k = 0;
    chunk.forEach((x, j) => nf.has(key(ids[j])) ? missing.push(x) : found.push({ ...x, card: d.data[k++] }));
    await sleep(150);
  }
  // Segundo intento, uno a uno y aproximado, para lo que no encontró (caras traseras, erratas leves)
  const still = [];
  for (const x of missing) {
    const r = await fetch(`${API}/cards/named?fuzzy=${encodeURIComponent(x.name)}`, { headers: { Accept: "application/json" } });
    if (r.ok) found.push({ ...x, card: await r.json() }); else still.push(x);
    await sleep(120);
  }
  return { found, missing: still };
}

async function importList() {
  const text = $("#pasteText").value;
  const items = parseDecklist(text);
  const status = $("#pasteStatus");
  if (!items.length) { status.textContent = "No he encontrado ninguna carta en el texto."; return; }
  const btn = $("#pasteGo");
  btn.disabled = true;
  status.textContent = `Buscando ${items.length} carta${items.length > 1 ? "s" : ""} en Scryfall…`;
  try {
    const { found, missing } = await resolveCards(items);
    if ($("#pasteReplace").checked) S.list = [];
    for (const { card, qty } of found) {
      const have = listItem(card.id);
      if (have) have._f = { ...have._f, qty: qtyOf(have) + qty };
      else S.list.push({ ...card, _f: { qty } });
    }
    save(); render();
    const n = found.length;
    toast(`${n} carta${n === 1 ? "" : "s"} añadida${n === 1 ? "" : "s"} a tu lista`);
    if (missing.length) {
      status.innerHTML = `Añadidas ${n}. <span class="bad">No encontradas (${missing.length}):</span> ${missing.map(x => `<code>${esc(x.name)}</code>`).join(" ")}`;
      $("#pasteText").value = missing.map(x => `${x.qty} ${x.name}`).join("\n");
    } else {
      $("#pasteDlg").close();
      $("#pasteText").value = ""; status.textContent = "";
      goView("list");
    }
  } catch (e) {
    status.innerHTML = `<span class="bad">No se pudo contactar con Scryfall.</span> Comprueba tu conexión e inténtalo de nuevo.`;
  }
  btn.disabled = false;
}

/* ---------- Detalle ---------- */
function openDetail(c) {
  S.selected = c; S.face = 0;
  document.body.classList.add("detail-open");
  $("#detail").setAttribute("aria-hidden", "false");
  $$(".card.selected").forEach(e => e.classList.remove("selected"));
  $(`.card[data-id="${c.id}"]`)?.classList.add("selected");
  renderDetail();
}
function closeDetail() {
  S.selected = null;
  document.body.classList.remove("detail-open");
  $("#detail").setAttribute("aria-hidden", "true");
  $$(".card.selected").forEach(e => e.classList.remove("selected"));
}
function renderDetail() {
  const c = S.selected; if (!c) return;
  const fs = faces(c), multiImg = c.card_faces && !c.image_uris;
  const text = (c.card_faces || [c]).map(f => `<div class="d-face">
      ${c.card_faces ? `<div class="d-title" style="margin-bottom:6px"><b>${esc(f.name)}</b>${cost(f.mana_cost)}</div><div class="d-type" style="margin:0 0 8px">${esc(f.type_line)}</div>` : ""}
      ${(f.oracle_text || "").split("\n").filter(Boolean).map(l => `<p>${symbols(l)}</p>`).join("")}
      ${f.flavor_text ? `<p class="flavor">${esc(f.flavor_text)}</p>` : ""}
      ${f.power != null ? `<p class="pt">${esc(f.power)}/${esc(f.toughness)}</p>` : f.loyalty ? `<p class="pt">Lealtad ${esc(f.loyalty)}</p>` : ""}
    </div>`).join("");
  const legal = Object.entries(FORMATOS).map(([k, n]) => {
    const v = c.legalities?.[k] || "not_legal";
    const [cls, lbl] = { legal: ["legal-ok", "Legal"], banned: ["legal-ban", "Prohibida"], restricted: ["legal-res", "Restringida"] }[v] || ["legal-no", "No legal"];
    return `<div>${n}<span class="${cls}">${lbl}</span></div>`;
  }).join("");
  const added = inList(c.id);
  const other = !added && listByOracle(c);   // la misma carta ya está en tu lista con otro arte
  $("#detailBody").innerHTML = `
    <div class="detail-head">
      ${multiImg ? `<button class="icon-btn" id="dFlip" title="Girar carta"><svg class="ic"><use href="#i-flip"/></svg></button>` : ""}
      <button class="icon-btn" id="dClose" title="Cerrar (Esc)"><svg class="ic"><use href="#i-x"/></svg></button>
    </div>
    <div class="detail-img skel${verFoil(listItem(c.id) || c) ? " foil" : ""}"><img alt="${esc(c.name)}" src="${esc(img(c, "large", S.face))}">${soloFoil(c) ? `<span class="foil-badge">Solo foil</span>` : ""}</div>
    <div class="d-title"><h2>${esc(c.name)}</h2>${c.card_faces ? "" : cost(c.mana_cost)}</div>
    <div class="d-type">${esc(c.type_line)}</div>
    <div class="d-text">${text}</div>

    <div class="d-section"><h3>Artes y ediciones <span class="h-count" id="dPrintsCount"></span></h3>
      <div class="prints" id="dPrints">${printsHTML(c)}</div>
    </div>

    <div class="d-section"><h3>Edición</h3>
      <dl class="d-facts">
        <dt>Set</dt><dd>${esc(c.set_name)} <span style="color:var(--text-3)">${esc(c.set.toUpperCase())} · #${esc(c.collector_number)}</span></dd>
        <dt>Rareza</dt><dd><i class="rdot rar-${c.rarity}"></i>${RAREZA[c.rarity] || esc(c.rarity)}</dd>
        <dt>Fecha</dt><dd>${c.released_at ? new Date(c.released_at).toLocaleDateString("es-ES", { year: "numeric", month: "short", day: "numeric" }) : "—"}</dd>
        ${c.artist ? `<dt>Ilustración</dt><dd>${esc(c.artist)}</dd>` : ""}
      </dl>
    </div>

    <div class="d-section"><h3>Precio de referencia</h3>
      <div class="prices">
        <div class="price-box"><small>Normal</small><b>${fmtEur(c.prices?.eur)}</b></div>
        <div class="price-box"><small>Foil</small><b>${fmtEur(c.prices?.eur_foil)}</b></div>
      </div>
      ${c.purchase_uris?.cardmarket ? `<a class="link" href="${esc(c.purchase_uris.cardmarket)}" target="_blank"><svg class="ic"><use href="#i-external"/></svg>Ver en Cardmarket</a>` : ""}
    </div>

    ${colDetalleHTML(c)}

    <div class="d-section"><h3>En tus tiendas</h3>${offersHTML(c)}</div>
    ${added ? `<div class="d-section"><h3>Filtros para esta carta</h3>${cardFiltersHTML(listItem(c.id))}</div>` : ""}

    <div class="d-section"><h3>Legalidad</h3><div class="legal">${legal}</div></div>

    <div class="d-actions">
      ${other ? `<button class="btn block primary" data-swap="${c.id}"><svg class="ic"><use href="#i-flip"/></svg>Usar este arte en mi lista</button>
        <p class="d-note">En tu lista tienes la de ${esc(other.set_name)}. Se conservan las copias, los filtros y las ofertas encontradas.</p>`
      : `<button class="btn block ${added ? "" : "primary"}" data-add="${c.id}"><svg class="ic"><use href="#i-${added ? "check" : "plus"}"/></svg>${added ? "En tu lista · quitar" : "Añadir a mi lista con este arte"}</button>`}
    </div>`;
  loadPrints(c);
  const im = $("#detailBody .detail-img img");
  const done = () => { im.classList.add("loaded"); im.parentElement.classList.remove("skel"); };
  im.complete && im.naturalWidth ? done() : im.addEventListener("load", done, { once: true });
  $("#dClose").onclick = closeDetail;
  if ($("#dFlip")) $("#dFlip").onclick = () => { S.face = (S.face + 1) % fs.length; renderDetail(); };
}

/* ---------- Artes y ediciones (impresiones de Scryfall) ---------- */
const printsCache = new Map();   // oracle_id -> [cartas] | "error"
const listByOracle = c => c.oracle_id && S.list.find(x => x.oracle_id === c.oracle_id && x.id !== c.id);

function printsHTML(c) {
  const ps = printsCache.get(c.oracle_id);
  if (ps === "error") return `<p class="d-note">No se pudieron cargar las ediciones.</p>`;
  if (!ps) return Array.from({ length: 8 }, () => `<span class="print skel"></span>`).join("");
  const enLista = new Set(S.list.map(x => x.id));
  return ps.map(p => `<button class="print${p.id === c.id ? " on" : ""}" data-print="${p.id}"
      title="${esc(p.set_name)} · #${esc(p.collector_number)}${p.prices?.eur ? ` · ${fmtEur(p.prices.eur)}` : ""}">
      <span class="print-img skel"><img loading="lazy" alt="" src="${esc(img(p, "small"))}" onload="this.parentElement.classList.remove('skel')"></span>
      <span class="print-set">${esc(p.set.toUpperCase())}${enLista.has(p.id) ? ` <svg class="ic"><use href="#i-bookmark"/></svg>` : ""}</span>
    </button>`).join("");
}

async function loadPrints(c) {
  const box = () => S.selected?.oracle_id === c.oracle_id && $("#dPrints");
  const ponerCuenta = () => {
    const ps = printsCache.get(c.oracle_id);
    if (box() && Array.isArray(ps)) $("#dPrintsCount").textContent = ps.length;
  };
  if (printsCache.has(c.oracle_id) || !c.prints_search_uri) {
    if (!c.prints_search_uri && !printsCache.has(c.oracle_id)) printsCache.set(c.oracle_id, [c]);
    ponerCuenta();
    return;
  }
  try {
    const d = await scry(c.prints_search_uri);   // todas las impresiones, de la más nueva a la más antigua
    printsCache.set(c.oracle_id, d.data.length ? d.data : [c]);
  } catch {
    printsCache.set(c.oracle_id, "error");
  }
  if (box()) { box().innerHTML = printsHTML(S.selected); ponerCuenta(); }
}

function choosePrint(id) {
  const p = (printsCache.get(S.selected?.oracle_id) || []).find(x => x.id === id);
  if (!p || p.id === S.selected.id) return;
  S.selected = listItem(p.id) || p; S.face = 0;
  renderDetail();
}

function swapArt(id) {
  const p = (printsCache.get(S.selected?.oracle_id) || []).find(x => x.id === id);
  const old = p && listByOracle(p);
  if (!old) return;
  const nuevo = { ...p, _f: old._f };
  S.list[S.list.indexOf(old)] = nuevo;
  if (S.offers[old.id]) { S.offers[nuevo.id] = S.offers[old.id]; delete S.offers[old.id]; }   // mismas ofertas: es la misma carta
  save();
  S.selected = nuevo;
  toast(`Arte cambiado: ${p.set_name}`);
  if (S.view === "list" || S.view === "results") render();
  renderDetail();
}

/* ---------- Mi lista ---------- */
function toggleList(id) {
  const c = S.results.find(x => x.id === id) || S.list.find(x => x.id === id) || (S.selected?.id === id && S.selected);
  if (!c) return;
  if (inList(id)) { S.list = S.list.filter(x => x.id !== id); S.sel.delete(id); toast(`Quitada: ${c.name}`); }
  else { S.list.push(c); toast(`Añadida a tu lista: ${c.name}`); }
  save();
  $$(`[data-add="${id}"]`).forEach(b => {
    const on = inList(id);
    b.classList.toggle("in", on);
    b.querySelector("use").setAttribute("href", on ? "#i-check" : "#i-plus");
  });
  $("#countList").textContent = S.list.length;
  if (S.selected?.id === id) renderDetail();
  if (S.view === "list") render();
}

/* ---------- Autocompletado ---------- */
const input = $("#q"), sug = $("#suggest");
let sugItems = [], sugIdx = -1;
const autocomplete = debounce(async v => {
  if (v.length < 2) return hideSuggest();
  try {
    const d = await scry(`${API}/cards/autocomplete?q=${encodeURIComponent(v)}`);
    if (input.value.trim() !== v) return;
    sugItems = d.data.slice(0, 8); sugIdx = -1;
    if (!sugItems.length) return hideSuggest();
    const re = new RegExp(`(${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i");
    sug.innerHTML = sugItems.map((n, i) => `<li role="option" data-i="${i}"><svg class="ic"><use href="#i-search"/></svg><span>${esc(n).replace(re, "<b>$1</b>")}</span></li>`).join("");
    sug.hidden = false; input.setAttribute("aria-expanded", "true");
  } catch { hideSuggest(); }
}, 140);
function hideSuggest() { sug.hidden = true; sugIdx = -1; input.setAttribute("aria-expanded", "false"); }
function moveSuggest(d) {
  if (sug.hidden) return;
  sugIdx = (sugIdx + d + sugItems.length) % sugItems.length;
  $$("li", sug).forEach((li, i) => li.classList.toggle("on", i === sugIdx));
}
function pick(name) {
  input.value = name; hideSuggest();
  S.q = name; S.exact = true; goView("explore"); search();
}
function runText() {
  hideSuggest();
  S.q = input.value.trim(); S.exact = false; goView("explore"); search();
}

/* ---------- Varios ---------- */
let toastT;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2200);
}
function goView(v) {
  if (S.view === v) return;
  S.view = v; closeDetail(); render();
  $("#scroller").scrollTop = 0;
  document.body.classList.remove("sidebar-mobile");
}
const mobile = () => matchMedia("(max-width: 860px)").matches;

/* ---------- Eventos ---------- */
input.addEventListener("input", () => { $("#qClear").hidden = !input.value; autocomplete(input.value.trim()); });
input.addEventListener("keydown", e => {
  if (e.key === "ArrowDown") { e.preventDefault(); moveSuggest(1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); moveSuggest(-1); }
  else if (e.key === "Enter") { e.preventDefault(); sugIdx >= 0 ? pick(sugItems[sugIdx]) : runText(); }
  else if (e.key === "Escape") { sug.hidden ? input.blur() : hideSuggest(); }
});
input.addEventListener("blur", () => setTimeout(hideSuggest, 120));
sug.addEventListener("mousedown", e => { const li = e.target.closest("li"); if (li) { e.preventDefault(); pick(sugItems[+li.dataset.i]); } });
$("#qClear").onclick = () => { input.value = ""; $("#qClear").hidden = true; S.q = ""; S.exact = false; search(); input.focus(); };

document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.focus(); input.select(); }
  else if (e.key === "Escape" && document.activeElement !== input) { closeDetail(); document.body.classList.remove("sidebar-mobile"); }
  else if (e.key === "Enter" && document.activeElement?.classList.contains("card")) document.activeElement.click();
});

$("#btnTheme").onclick = () => { S.theme = S.theme === "dark" ? "light" : "dark"; save(); render(); };
$("#btnSidebar").onclick = () => {
  if (mobile()) document.body.classList.toggle("sidebar-mobile");
  else { S.sidebar = !S.sidebar; save(); render(); }
};
$("#scrim").onclick = () => { closeDetail(); document.body.classList.remove("sidebar-mobile"); };
$$(".nav-item").forEach(b => b.onclick = () => goView(b.dataset.view));

// Filtros
const toggleSet = (set, v) => set.has(v) ? set.delete(v) : set.add(v);
const filterChanged = () => { syncFilterUI(); renderChips(); searchSoon(); };
$("#fColor").onclick = e => { const b = e.target.closest("button"); if (b) { toggleSet(S.f.colors, b.dataset.v); filterChanged(); } };
$("#fColorMode").onclick = e => { const b = e.target.closest("button"); if (b) { S.f.colorMode = b.dataset.v; filterChanged(); } };
$("#fType").onclick = e => { const b = e.target.closest("button"); if (b) { toggleSet(S.f.types, b.dataset.v); filterChanged(); } };
$("#fCmc").onclick = e => { const b = e.target.closest("button"); if (b) { toggleSet(S.f.cmc, b.dataset.v); filterChanged(); } };
$("#fRarity").onclick = e => { const b = e.target.closest("button"); if (b) { toggleSet(S.f.rarity, b.dataset.v); filterChanged(); } };
$("#fSet").addEventListener("change", e => { S.f.set = e.target.value.trim(); filterChanged(); });
$("#fFormat").addEventListener("change", e => { S.f.format = e.target.value; filterChanged(); });

// Filtros de oferta
function syncOfferUI() {
  $$("#oLang button").forEach(b => b.classList.toggle("on", S.of.lang.includes(b.dataset.v)));
  $$("#oCond button").forEach(b => b.classList.toggle("on", b.dataset.v === S.of.cond));
  $$("#oFoil button").forEach(b => b.classList.toggle("on", b.dataset.v === S.of.foil));
  $("#oMax").value = S.of.max;
}
const offerChanged = () => { syncOfferUI(); save(); };
$("#oLang").onclick = e => {
  const b = e.target.closest("button"); if (!b) return;
  const v = b.dataset.v;
  S.of.lang = S.of.lang.includes(v) ? S.of.lang.filter(x => x !== v) : [...S.of.lang, v];
  offerChanged();
};
$("#oCond").onclick = e => { const b = e.target.closest("button"); if (b) { S.of.cond = b.dataset.v; offerChanged(); } };
$("#oFoil").onclick = e => { const b = e.target.closest("button"); if (b) { S.of.foil = b.dataset.v; offerChanged(); } };
$("#oMax").addEventListener("change", e => { S.of.max = e.target.value.trim().replace(",", "."); offerChanged(); });
$("#btnStop").onclick = () => {
  if (!S.run) return;
  if (S.run.finished) { S.run = null; renderRun(); render(); return; }
  S.run.stopping = true; renderRun();
  bridge()?.parar_busqueda();
};
// Filtros propios de una carta (panel de detalle)
document.addEventListener("change", e => {
  const el = e.target.closest("[data-cf]"); if (!el || !S.selected) return;
  const c = listItem(S.selected.id); if (!c) return;
  const v = el.type === "checkbox" ? el.checked : el.dataset.cf === "qty" ? Math.max(1, parseInt(el.value, 10) || 1) : el.value.trim().replace(",", ".");
  c._f = { ...c._f, [el.dataset.cf]: v };
  save();
  if ((el.dataset.cf === "qty" || el.dataset.cf === "foil") && S.view === "list") render();
  if (el.dataset.cf === "foil") renderDetail();
});

// Orden y vista
$("#sort").onchange = e => { S.sort = e.target.value; S.view === "explore" ? search() : render(); };
$("#sortDir").onclick = () => { S.dir = S.dir === "asc" ? "desc" : "asc"; S.view === "explore" ? search() : render(); };
$(".view-toggle").onclick = e => {
  const b = e.target.closest("button"); if (!b || b.dataset.v === S.layout) return;
  S.layout = b.dataset.v; save(); render();
};

// Clics delegados en la zona central y chips
document.addEventListener("click", e => {
  const t = e.target;
  const add = t.closest("[data-add]");
  if (add) { e.stopPropagation(); toggleList(add.dataset.add); return; }
  const fb = t.closest("[data-foilsel]");
  if (fb) { e.stopPropagation(); toggleFoil(fb.dataset.foilsel); return; }
  if (t.closest(".sel-box")) { if (t.dataset.sel) marcar(t.dataset.sel, t.checked); return; }
  const sa = t.closest("[data-selall]");
  if (sa) { S.list.forEach(c => marcar(c.id, sa.dataset.selall === "1")); $$("[data-sel]").forEach(b => { b.checked = sa.dataset.selall === "1"; }); return; }
  const chip = t.closest("[data-chip]");
  if (chip) { chipActions[+chip.dataset.chip]?.off(); filterChanged(); return; }
  if (t.closest("[data-clear]")) { clearFilters(); return; }
  if (t.closest("[data-retry]")) { search(); return; }
  const tr = t.closest("[data-try]");
  if (tr) { input.value = tr.dataset.try; $("#qClear").hidden = false; runText(); return; }
  const go = t.closest("[data-go]");
  if (go) { goView(go.dataset.go); return; }
  const rm = t.closest("[data-rmshop]");
  if (rm) { S.shops = S.shops.filter(s => s !== rm.dataset.rmshop); save(); render(); return; }
  if (t.closest("#btnShopSearch")) { startShopSearch(); return; }
  if (t.closest("[data-setup]")) { openSetup(); return; }
  const pr = t.closest("[data-print]");
  if (pr) { choosePrint(pr.dataset.print); return; }
  const sw = t.closest("[data-swap]");
  if (sw) { swapArt(sw.dataset.swap); return; }
  if (t.closest("[data-paste]")) { $("#pasteStatus").textContent = ""; $("#pasteDlg").showModal(); $("#pasteText").focus(); return; }
  const op = t.closest("[data-open]");
  if (op) { const c = listItem(op.dataset.open); if (c) openDetail(c); return; }
  if (t.closest("#btnExport")) { exportCSV(); return; }
  if (t.closest("#btnShopsExport")) { exportShops(); return; }
  if (t.closest("#btnShopsImport")) { importShops(); return; }
  const card = t.closest(".card:not(.skeleton)");
  if (card) {
    const c = S.results.find(x => x.id === card.dataset.id) || S.list.find(x => x.id === card.dataset.id);
    if (c) S.selected?.id === c.id ? closeDetail() : openDetail(c);
  }
});
// Nombre de usuario a partir de lo escrito (nombre o URL del perfil); true si era nueva
function addShop(text) {
  const v = text.trim().replace(/\/+$/, "").split("/").pop();
  if (!v || S.shops.some(s => s.toLowerCase() === v.toLowerCase())) return false;
  S.shops.push(v); return true;
}
document.addEventListener("submit", e => {
  if (e.target.id !== "shopForm") return;
  e.preventDefault();
  if (addShop($("#shopInput").value)) { save(); render(); $("#shopInput").focus(); }
});
async function exportShops() {
  if (!S.shops.length) return toast("No hay tiendas que exportar");
  if (!bridge()) return toast("Exportar solo funciona dentro de la app");
  if (await bridge().exportar_tiendas(S.shops)) toast("Tiendas guardadas");
}
async function importShops() {
  if (!bridge()) return toast("Importar solo funciona dentro de la app");
  const text = await bridge().importar_tiendas().catch(() => null);
  if (text == null) return;
  const n = text.split(/[\r\n,;]+/).filter(addShop).length;
  if (n) { save(); render(); }
  toast(n ? `${n} tienda${n > 1 ? "s" : ""} añadida${n > 1 ? "s" : ""}` : "No había tiendas nuevas");
}

$("#pasteForm").addEventListener("submit", e => {
  if (e.submitter?.value === "cancel") return;
  e.preventDefault();
  importList();
});

// Scroll infinito
new IntersectionObserver(es => { if (es[0].isIntersecting && S.view === "explore") loadMore(); }, { root: $("#scroller"), rootMargin: "600px" }).observe($("#sentinel"));

/* ---------- Primeros pasos: instalar y probar la extensión ---------- */
let NAV = { nombre: "tu navegador", extensiones: "chrome://extensions" }; // navegador donde se abren las páginas (app.py lo detecta)
function showNav() {
  $$(".nav-name").forEach(e => { e.textContent = NAV.nombre; });
  $$(".nav-ext").forEach(e => { e.textContent = NAV.extensiones || ""; });
  $("#setupWarn").hidden = !!NAV.extensiones;
  $("#setupCopy").disabled = $("#setupTest").disabled = !NAV.extensiones;
}
function openSetup(why = "", relanzar = false) {
  $("#setupWhy").hidden = !why;
  $("#setupWhy").textContent = why;
  showNav();
  const dlg = $("#setupDlg"), status = $("#setupStatus"), test = $("#setupTest");
  dlg.addEventListener("cancel", e => e.preventDefault()); // Esc no lo cierra
  $("#setupFolder").onclick = async () => {
    let ruta = null;
    try { ruta = await bridge()?.descargar_extension(); } catch { }
    if (ruta) $("#setupSaved").innerHTML = `Guardada en <code>${esc(ruta)}</code>`;
  };
  $("#setupCopy").onclick = async () => {
    try { await bridge()?.copiar(NAV.extensiones); toast(`Copiado: pégalo en la barra de direcciones de ${NAV.nombre}`); } catch { }
  };
  $("#setupSkip").onclick = () => dlg.close(); // vuelve a salir en el próximo arranque
  $("#setupGo").onclick = () => { S.setup = true; save(); dlg.close(); if (relanzar) startShopSearch(); };
  test.onclick = async () => {
    test.disabled = true;
    status.innerHTML = `Probando… mira la pestaña de Cardmarket que se ha abierto en ${esc(NAV.nombre)} (puede tardar hasta un minuto).`;
    let ok = false;
    try { ok = await bridge().probar_extension(!S.opt.ver); } catch { }
    test.disabled = false;
    if (ok === "vieja") {
      $("#setupGo").disabled = true;
      status.innerHTML = `<span class="bad">La extensión responde, pero es de una versión anterior.</span> Pulsa <b>Descargar extensión</b> de nuevo (en la misma carpeta) y luego el botón de recargar de Rastro en <code>${esc(NAV.extensiones || "")}</code>.`;
      return;
    }
    $("#setupGo").disabled = !ok;
    status.innerHTML = ok
      ? `<span class="good">✓ La extensión funciona. Ya puedes continuar.</span>`
      : `<span class="bad">No llegó respuesta de la extensión.</span> Revisa que esté cargada y activada en <code>${esc(NAV.extensiones || "")}</code> y vuelve a probar.`;
  };
  dlg.showModal();
}

/* ---------- Opciones ---------- */
const OPT_CAMPOS = { pausa: ["#optPausa", 1.5, 30], espera: ["#optEspera", 10, 120], cache: ["#optCache", 0, 72] };
function showOptions() {
  for (const [k, [sel]] of Object.entries(OPT_CAMPOS)) $(sel).value = S.opt[k];
  $("#optVer").checked = S.opt.ver;
  $("#optFoil").checked = S.opt.foil;
  $("#optIa").checked = S.opt.ia;
  pintarPruebaIA();
  $("#optEsfuerzo").innerHTML = selectorEsfuerzo();
}
for (const [k, [sel, min, max]] of Object.entries(OPT_CAMPOS)) {
  $(sel).onchange = e => {
    const v = parseFloat(String(e.target.value).replace(",", "."));
    S.opt[k] = isNaN(v) ? OPT_DEF[k] : Math.min(max, Math.max(min, v));
    e.target.value = S.opt[k]; save();
  };
}
$("#optVer").onchange = e => { S.opt.ver = e.target.checked; save(); };
$("#optFoil").onchange = e => { S.opt.foil = e.target.checked; save(); render(); };
// Al activar la IA, si nunca se ha probado bien, se prueba sola
$("#optIa").onchange = e => { S.opt.ia = e.target.checked; save(); render(); if (S.opt.ia && !S.iaPrueba?.ok) probarIA(); if (S.opt.ia) comprobarNormas(); };
$("#optIaTest").onclick = () => probarIA();
// Resultado de la última prueba, guardado: cuenta, plan y fecha
function pintarPruebaIA() {
  const p = S.iaPrueba, est = $("#optIaEstado");
  if (!p) { est.textContent = "Comprueba que el comando claude está instalado, con sesión iniciada, y responde."; return; }
  const cuando = new Date(p.fecha).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  est.innerHTML = p.ok ? `<span class="good">Conexión correcta</span> · ${esc(p.plan)}${p.email ? ` · ${esc(p.email)}` : ""} · probada el ${cuando}`
    : `<span class="bad">${esc(p.error)}</span>${p.instalado === false ? ` <a href="https://claude.com/claude-code" target="_blank" rel="noopener">Cómo instalar Claude Code</a>` : ""} · ${cuando}`;
}
async function probarIA() {
  const b = $("#optIaTest"), est = $("#optIaEstado");
  if (!bridge()) { est.innerHTML = `<span class="bad">Solo funciona dentro de la app.</span>`; return; }
  b.disabled = true; est.textContent = "Probando… (puede tardar unos segundos)";
  let r = null;
  try { r = await bridge().ia_probar(); } catch { }
  b.disabled = false;
  guardarPruebaIA(r || { ok: false, error: "No se pudo probar." });
}
// Aviso en todo lo que pide algo a la IA: puede equivocarse y gasta cuota (o crédito de la API)
// Esfuerzo de la IA (ia.NIVELES): el mismo selector en Opciones, en las ventanas de IA de los mazos y en el juez
const ESFUERZOS = { rapido: "Rápido · Haiku, gasta menos", equilibrado: "Equilibrado · Sonnet", maximo: "Máximo · Opus, gasta más" };
const selectorEsfuerzo = () => `<select class="field esfuerzo" data-esfuerzo aria-label="Esfuerzo de la IA" title="Esfuerzo de la IA: más esfuerzo da mejores respuestas, pero tarda más y gasta más cuota">${
  Object.entries(ESFUERZOS).map(([k, n]) => `<option value="${k}"${k === S.opt.esfuerzo ? " selected" : ""}>${n}</option>`).join("")}</select>`;
document.addEventListener("change", e => {
  if (!e.target.matches?.("[data-esfuerzo]")) return;
  S.opt.esfuerzo = e.target.value; save();
  $$("[data-esfuerzo]").forEach(s => { s.value = S.opt.esfuerzo; });
});
function avisoIA() {
  const uso = S.iaPrueba?.metodo === "api"
    ? "Cada petición gasta crédito de tu API de Anthropic: puedes consultarlo en console.anthropic.com."
    : "Cada petición consume tu cuota de Claude: puedes consultarla en la app de Claude (Ajustes → Uso) o con el comando /usage en Claude Code.";
  return `<svg class="ic"><use href="#i-alert"/></svg><span><b>La IA puede cometer errores:</b> revisa siempre el resultado. ${uso}</span>`;
}
function guardarPruebaIA(r) {
  S.iaPrueba = { ok: !!r.ok, plan: r.plan || "", metodo: r.metodo || "", email: r.email || "", instalado: r.instalado, error: r.error || "", fecha: new Date().toISOString() };
  save(); pintarPruebaIA(); render();
}
$("#optReset").onclick = () => { S.opt = { ...OPT_DEF }; save(); showOptions(); render(); };
$("#optClear").onclick = async () => {
  if (!bridge()) return;
  if (!await bridge().vaciar_cache()) return toast("No se pudo vaciar: espera a que termine la búsqueda o cierra la otra ventana de Rastro");
  // También los resultados guardados, para que la próxima búsqueda parta de cero
  Object.assign(S, { offers: {}, missing: [], searchedAt: null, stock: {} });
  save(); render();
  toast("Caché y resultados borrados");
};
$("#optUpdate").onclick = async e => {
  if (!bridge()) return;
  const b = e.currentTarget; b.disabled = true; b.textContent = "Buscando…";
  let r = null;
  try { r = await bridge().comprobar_actualizacion(); } catch { }
  b.disabled = false; b.textContent = "Buscar actualización";
  toast({
    al_dia: "Tienes la última versión",
    actualizando: `Hay una versión nueva (${r?.version}): se instalará y Rastro se reiniciará`,
    ocupado: `Hay una versión nueva (${r?.version}): se instalará cuando termine la búsqueda y vuelvas a abrir Rastro`,
    fuente: "Las actualizaciones solo funcionan en Rastro.exe",
  }[r?.estado] || "No se pudo comprobar. Revisa tu conexión e inténtalo de nuevo");
};
$("#optSetup").onclick = () => { $("#optDlg").close(); openSetup(); };
$("#btnOptions").onclick = async () => {
  showOptions(); $("#optDlg").showModal();
  try { if (bridge()) $("#optVersion").textContent = `Rastro ${await bridge().version()}`; } catch { }
};

/* ---------- Arranque ---------- */
let started = false;
async function init() {
  if (started) return;
  started = true;
  await loadState();
  try { if (bridge()) NAV = await bridge().navegador(); } catch { }
  showNav();
  syncOfferUI();
  render();
  search(); // Explorar arranca con las novedades
  if (S.opt.ia) comprobarNormas();
  if (!S.setup && bridge()) openSetup();
  try {
    const d = await scry(`${API}/sets`);
    sets = d.data.filter(s => !s.digital && s.card_count > 0);
    $("#setList").innerHTML = sets.map(s => `<option value="${esc(s.name)} (${s.code.toUpperCase()})">`).join("");
    if (S.view === "collection") render();
  } catch { }
}
window.addEventListener("pywebviewready", init, { once: true });
// En un navegador normal (sin pywebview) arranca igual
setTimeout(() => { if (!window.pywebview) init(); }, 300);
