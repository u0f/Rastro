// Rastro: colección. Las cartas que tienes, edición a edición (todas las de Magic, de Scryfall).
// Se añaden desde el detalle de una carta, desde un mazo o importando una lista o un CSV, y se exportan a CSV.
// La IA la recibe (coleccionIA) para crear o abaratar mazos con lo que ya tienes.
// Usa las utilidades de app.js (S, $, esc, scry, sets, resolveCards, parseDecklist…).
"use strict";

// Cada entrada es una impresión (id de Scryfall) normal o foil, con lo justo para pintarla sin volver a pedirla
const compacta = c => ({ id: c.id, oracle_id: c.oracle_id, name: c.name, set: c.set, set_name: c.set_name, cn: c.collector_number,
  rarity: c.rarity, img: img(c, "normal"), eur: c.prices?.eur || null, eur_foil: c.prices?.eur_foil || c.prices?.eur_etched || null });
const colEntrada = (id, foil) => S.coleccion.find(e => e.id === id && e.foil === !!foil);
const colCopias = id => S.coleccion.reduce((n, e) => n + (e.id === id ? e.qty : 0), 0);
// Copias de una carta por su nombre, en cualquier edición: lo que cuenta para un mazo
const colNombre = nombre => { const n = nombre.toLowerCase(); return S.coleccion.reduce((t, e) => t + (e.name.toLowerCase() === n ? e.qty : 0), 0); };
const colValor = e => (parseFloat(e.foil ? e.eur_foil || e.eur : e.eur) || 0) * e.qty;

// Suma (o resta) copias de una carta de Scryfall; sin copias, la entrada desaparece
function colSumar(c, n, foil = soloFoil(c)) {
  const e = colEntrada(c.id, foil);
  if (e) { e.qty += n; if (e.qty < 1) S.coleccion.splice(S.coleccion.indexOf(e), 1); }
  else if (n > 0) S.coleccion.push({ ...compacta(c), foil: !!foil, qty: n });
}

// Para la IA: una línea por carta con las copias que tienes en total ("4 Lightning Bolt")
function coleccionIA() {
  const m = new Map();
  for (const e of S.coleccion) m.set(e.name, (m.get(e.name) || 0) + e.qty);
  return [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([n, q]) => `${q} ${n}`).join("\n");
}

/* ---------- Mazos: marcar lo que tienes y sumar el mazo a la colección ---------- */
// Marca Tengo en las cartas del mazo de las que tienes copias suficientes (nunca desmarca). Devuelve cuántas.
function marcarDeColeccion(d) {
  const usadas = new Map();
  let n = 0;
  for (const e of d.cards) {
    const k = e.card.name, libres = colNombre(k) - (usadas.get(k) || 0);
    if (libres < e.qty) continue;
    usadas.set(k, (usadas.get(k) || 0) + e.qty);
    if (!e.have) { e.have = true; n++; }
  }
  return n;
}
function mazoAColeccion(d) {
  if (!d.cards.length) return toast("El mazo está vacío");
  if (!confirm(`Se sumarán a tu colección las ${cuenta(d.cards)} copias de “${d.name}” y se marcarán como Tengo. ¿Seguir?`)) return;
  d.cards.forEach(e => { colSumar(e.card, e.qty, esFoil(e)); e.have = true; });
  save(); render();
  toast("Mazo añadido a tu colección");
}

/* ---------- Vista Colección ---------- */
const COL = { set: null, tab: "sets", filtro: "", solo: false };   // edición abierta, pestaña y filtros
const setsCache = new Map();   // código -> { cartas, completo, error }

function renderColeccion() {
  results.className = "results coleccion";
  const total = S.coleccion.reduce((n, e) => n + e.qty, 0);
  $("#viewActions").innerHTML = `<button class="btn" data-col-import><svg class="ic"><use href="#i-clipboard"/></svg>Importar</button>
    <button class="btn" data-col-export${total ? "" : " disabled"}><svg class="ic"><use href="#i-download"/></svg>Exportar CSV</button>
    <button class="btn" data-col-copy${total ? "" : " disabled"} title="Copia la colección como lista de texto">Copiar lista</button>`;
  const s = COL.set && sets.find(x => x.code === COL.set);
  const filtro = `<input class="field col-filter" id="colFiltro" placeholder="${s ? "Filtrar por nombre o número" : COL.tab === "sets" ? "Buscar edición por nombre o código" : "Filtrar por nombre"}" value="${esc(COL.filtro)}" spellcheck="false">`;
  const solo = label => `<label class="check"><input type="checkbox" id="colSolo"${COL.solo ? " checked" : ""}>${label}</label>`;
  if (s) {
    $("#viewTitle").textContent = s.name;
    results.innerHTML = `<div class="col-bar"><button class="btn sm ghost" data-col-back><svg class="ic"><use href="#i-chevron-left"/></svg>Colecciones</button>
      <span class="col-ico" style="--ico:url('${esc(s.icon_svg_uri)}')"></span>${filtro}${solo("Solo las que tengo")}</div><div id="colBody"></div>`;
    cargarEdicion(s.code);
  } else {
    COL.set = null;
    $("#viewTitle").textContent = "Colección";
    results.innerHTML = `<div class="col-bar"><div class="seg" id="colTab">${[["sets", "Ediciones"], ["mine", "Mis cartas"]]
      .map(([k, n]) => `<button data-col-tab="${k}"${COL.tab === k ? ' class="on"' : ""}>${n}</button>`).join("")}</div>
      ${filtro}${COL.tab === "sets" ? solo("Solo con cartas mías") : ""}</div><div id="colBody"></div>`;
  }
  pintarColeccion();
}

// Solo el cuerpo y el contador: así escribir en el filtro no pierde el foco
function pintarColeccion() {
  const box = $("#colBody"); if (!box) return;
  const f = COL.filtro.trim().toLowerCase(), count = $("#resultCount");
  const total = S.coleccion.reduce((n, e) => n + e.qty, 0);
  const s = COL.set && sets.find(x => x.code === COL.set);
  if (s) {
    const st = setsCache.get(s.code);
    const mias = new Set(S.coleccion.filter(e => e.set === s.code).map(e => e.id));
    count.textContent = `Tienes ${mias.size} de ${s.card_count}`;
    if (st?.error) { box.innerHTML = empty("wifi-off", "No se pudo cargar la edición", "Comprueba tu conexión.", `<div class="suggestions"><button class="btn primary" data-col-retry>Reintentar</button></div>`); return; }
    const cartas = (st?.cartas || []).filter(c => (!COL.solo || mias.has(c.id)) && (!f || c.name.toLowerCase().includes(f) || c.collector_number === f));
    box.innerHTML = `<div class="col-grid">${cartas.map(c => tileCol(c, colCopias(c.id), `data-col-id="${c.id}"`)).join("")}${st?.completo ? "" : '<span class="col-card skel"></span>'.repeat(6)}</div>`
      + (st?.completo && !cartas.length ? `<p class="deck-empty">${COL.solo ? "Aún no tienes cartas de esta edición." : "Ninguna carta coincide."}</p>` : "");
    return;
  }
  const distintas = new Set(S.coleccion.map(e => e.oracle_id || e.name)).size;
  count.textContent = total ? `${total} carta${total > 1 ? "s" : ""} · ${distintas} distinta${distintas > 1 ? "s" : ""} · ${fmtEur(S.coleccion.reduce((t, e) => t + colValor(e), 0))}` : "";
  if (COL.tab === "mine") {
    if (!S.coleccion.length) { box.innerHTML = vacia(); return; }
    const es = S.coleccion.map((e, k) => [e, k]).filter(([e]) => !f || e.name.toLowerCase().includes(f))
      .sort(([a], [b]) => a.name.localeCompare(b.name) || a.set.localeCompare(b.set));
    box.innerHTML = `<div class="col-grid">${es.map(([e, k]) => tileCol({ ...e, collector_number: e.cn }, e.qty, `data-col-e="${k}"`, e)).join("")}</div>`;
    return;
  }
  if (!sets.length) { box.innerHTML = `<p class="deck-empty">Cargando las ediciones de Scryfall…</p>`; return; }
  const porSet = new Map();
  for (const e of S.coleccion) (porSet.get(e.set) || porSet.set(e.set, new Set()).get(e.set)).add(e.id);
  const lista = sets.filter(x => (!COL.solo || porSet.has(x.code)) && (!f || x.name.toLowerCase().includes(f) || x.code === f));
  box.innerHTML = (!S.coleccion.length ? vacia() : "") + `<div class="col-sets">${lista.map(x => {
    const n = porSet.get(x.code)?.size || 0;
    return `<button class="col-set${n ? " have" : ""}" data-col-set="${x.code}">
      <span class="col-ico" style="--ico:url('${esc(x.icon_svg_uri)}')"></span>
      <span class="col-set-name"><b>${esc(x.name)}</b><small>${esc(x.code.toUpperCase())} · ${x.released_at?.slice(0, 4) || "—"} · ${x.card_count} cartas</small></span>
      <span class="col-prog"><small>${n ? `${n} / ${x.card_count}` : ""}</small><i style="--p:${Math.min(100, n / x.card_count * 100)}%"></i></span>
    </button>`;
  }).join("")}</div>` + (!lista.length ? `<p class="deck-empty">Ninguna edición coincide.</p>` : "");
}

const vacia = () => empty("library", "Tu colección está vacía", "Abre una carta y súmala con + en «En tu colección», añade un mazo entero desde Mazos o importa una lista o un CSV (Moxfield, ManaBox, Deckbox…).",
  `<div class="suggestions"><button class="btn primary" data-col-import>Importar</button><button class="btn" data-go="explore">Ir a Explorar</button></div>`);

// e: la entrada de la colección (en Mis cartas), para marcar si es foil
function tileCol(c, n, attrs, e) {
  const foil = e ? e.foil : soloFoil(c);
  const pr = foil ? c.prices?.eur_foil || c.prices?.eur_etched || c.eur_foil : c.prices?.eur || c.eur;
  return `<div class="col-card${n ? " have" : ""}" ${attrs}>
    <button class="col-art skel${foil && n ? " foil" : ""}" data-col-ver title="Ver carta"><img loading="lazy" alt="${esc(c.name)}" src="${esc(c.img || img(c))}" onload="this.parentElement.classList.remove('skel')"></button>
    <span class="col-meta"><b title="${esc(c.name)}">${esc(c.name)}</b><small>${e ? `${esc(c.set.toUpperCase())} ` : ""}#${esc(c.collector_number)}${foil ? ` · <span class="foil-tag">Foil</span>` : ""}${pr ? ` · ${fmtEur(pr)}` : ""}</small></span>
    <span class="deck-qty col-qty"><button data-col-n="-1" title="Quitar una"${n ? "" : " disabled"}>−</button><b>${n}</b><button data-col-n="1" title="Añadir una">+</button></span>
  </div>`;
}

// Todas las impresiones de una edición, por número de coleccionista (Scryfall pagina de 175 en 175)
async function cargarEdicion(code) {
  if (setsCache.has(code) && !setsCache.get(code).error) return;
  const st = { cartas: [], completo: false };
  setsCache.set(code, st);
  const pintar = () => { if (S.view === "collection" && COL.set === code) pintarColeccion(); };
  let url = `${API}/cards/search?${new URLSearchParams({ q: `e:${code}`, unique: "prints", order: "set", include_extras: "true", include_variations: "true" })}`;
  try {
    while (url) {
      const d = await scry(url);
      st.cartas.push(...d.data);
      url = d.has_more ? d.next_page : null;
      pintar();
      if (url) await sleep(100);
    }
  } catch { st.error = true; }
  st.completo = true;
  pintar();
}

/* ---------- Detalle de una carta: copias en tu colección ---------- */
function colDetalleHTML(c) {
  const fin = c.finishes || ["nonfoil", "foil"];
  const filas = [["Normal", false, fin.includes("nonfoil")], ["Foil", true, fin.some(x => x !== "nonfoil")]].filter(x => x[2]);
  const otras = colNombre(c.name) - colCopias(c.id);
  return `<div class="d-section"><h3>En tu colección</h3><div class="col-d">${filas.map(([n, foil]) => {
    const q = colEntrada(c.id, foil)?.qty || 0;
    return `<span class="col-d-row"><span>${n}</span><span class="deck-qty col-qty"><button data-col-d="${foil ? 1 : 0}" data-n="-1" title="Quitar una"${q ? "" : " disabled"}>−</button><b>${q}</b><button data-col-d="${foil ? 1 : 0}" data-n="1" title="Añadir una">+</button></span></span>`;
  }).join("")}</div>${otras > 0 ? `<p class="d-note">Y ${otras} copia${otras > 1 ? "s" : ""} en otras ediciones.</p>` : ""}</div>`;
}
const colCambiada = () => { save(); if (S.view === "collection") pintarColeccion(); };

/* ---------- Importar y exportar ---------- */
// Una fila de CSV con comillas ("Atraxa, Praetors' Voice"); separador , o ;
function csvFila(l, sep) {
  const out = []; let v = "", q = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (q) { if (ch === '"' && l[i + 1] === '"') { v += '"'; i++; } else if (ch === '"') q = false; else v += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { out.push(v); v = ""; }
    else v += ch;
  }
  return [...out, v];
}
// Código de edición a partir de lo que traiga el archivo: el código o el nombre completo
const codigoSet = v => { v = (v || "").trim(); if (!v) return null; return (/^[a-z0-9]{2,6}$/i.test(v) ? v : sets.find(s => s.name.toLowerCase() === v.toLowerCase())?.code || null)?.toLowerCase() || null; };

// CSV con cabecera (Moxfield, ManaBox, Deckbox, el de Rastro…) o una lista de texto ("4 Sol Ring (C21) 263 *F*")
function leerColeccion(texto) {
  const lineas = texto.split(/\r?\n/).filter(l => l.trim());
  const sep = (lineas[0] || "").split(";").length > (lineas[0] || "").split(",").length ? ";" : ",";
  const cab = lineas.length ? csvFila(lineas[0], sep).map(x => x.trim().toLowerCase()) : [];
  const col = (...ns) => cab.findIndex(h => ns.includes(h));
  const iNombre = col("name", "card name", "card", "nombre");
  if (iNombre >= 0 && cab.length > 1) {
    const iQty = col("count", "quantity", "qty", "cantidad", "copias"), iCn = col("collector number", "number", "cn", "número", "numero");
    const iSet = [col("set code", "edition code", "código"), col("edition", "set", "edición", "edicion"), col("set name")].find(i => i >= 0) ?? -1;
    const iFoil = col("foil", "printing", "finish");
    return lineas.slice(1).map(l => csvFila(l, sep)).map(f => ({
      name: (f[iNombre] || "").trim(), qty: Math.max(1, parseInt(f[iQty]) || 1), set: iSet >= 0 ? codigoSet(f[iSet]) : null,
      cn: iCn >= 0 && (f[iCn] || "").trim() || null, foil: iFoil >= 0 && /^(foil|etched|true|yes|s[ií]|1)$/i.test((f[iFoil] || "").trim()),
    })).filter(x => x.name);
  }
  return lineas.map(l => { const [it] = parseDecklist(l); return it && { ...it, foil: /\*[FE]\*\s*$/.test(l) }; }).filter(Boolean);
}

function abrirImportar() {
  $("#colStatus").textContent = ""; $("#colReplace").checked = false;
  $("#colDlg").showModal(); $("#colTexto").focus();
}
async function importarColeccion() {
  const items = leerColeccion($("#colTexto").value), status = $("#colStatus"), btn = $("#colGo");
  if (!items.length) { status.textContent = "No he encontrado ninguna carta en el texto."; return; }
  if ($("#colReplace").checked && S.coleccion.length && !confirm(`Se borrarán las ${S.coleccion.length} entradas de tu colección y se cambiarán por las importadas. ¿Seguir?`)) return;
  btn.disabled = true;
  status.textContent = `Buscando ${items.length} carta${items.length > 1 ? "s" : ""} en Scryfall… (las listas grandes tardan un poco)`;
  try {
    const { found, missing } = await resolveCards(items);
    if ($("#colReplace").checked) S.coleccion = [];
    for (const { card, qty, foil } of found) colSumar(card, qty, foil || soloFoil(card));
    save(); render();
    const n = found.reduce((t, x) => t + x.qty, 0);
    toast(`${n} carta${n === 1 ? "" : "s"} añadida${n === 1 ? "" : "s"} a tu colección`);
    if (missing.length) {
      status.innerHTML = `Añadidas ${n}. <span class="bad">No encontradas (${missing.length}):</span> ${missing.map(x => `<code>${esc(x.name)}</code>`).join(" ")}`;
      $("#colTexto").value = missing.map(x => `${x.qty} ${x.name}`).join("\n");
    } else { $("#colDlg").close(); $("#colTexto").value = ""; }
  } catch {
    status.innerHTML = `<span class="bad">No se pudo contactar con Scryfall.</span> Comprueba tu conexión e inténtalo de nuevo.`;
  }
  btn.disabled = false;
}

// CSV compatible con Moxfield (Count, Name, Edition, Collector Number, Foil) y con el importador de Rastro
async function exportarColeccion() {
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const filas = [["Count", "Name", "Edition", "Collector Number", "Foil", "Set Name"], ...[...S.coleccion].sort((a, b) => a.name.localeCompare(b.name))
    .map(e => [e.qty, e.name, e.set, e.cn, e.foil ? "foil" : "", e.set_name])];
  const txt = filas.map(f => f.map(q).join(",")).join("\r\n") + "\r\n";
  if (!bridge()) return toast("Exportar solo funciona dentro de la app");
  if (await bridge().guardar_texto("coleccion_rastro.csv", txt)) toast("Colección guardada");
}
function copiarColeccion() {
  const txt = [...S.coleccion].sort((a, b) => a.name.localeCompare(b.name)).map(e => `${e.qty} ${e.name} (${e.set.toUpperCase()}) ${e.cn}${e.foil ? " *F*" : ""}`).join("\n");
  (bridge() ? bridge().copiar(txt) : navigator.clipboard.writeText(txt)).then(() => toast("Colección copiada al portapapeles"), () => toast("No se pudo copiar"));
}

/* ---------- Eventos ---------- */
document.addEventListener("click", async e => {
  const t = e.target;
  let x;
  if ((x = t.closest("[data-col-d]")) && S.selected) {   // detalle de una carta, en cualquier vista
    colSumar(S.selected, +x.dataset.n, x.dataset.colD === "1");
    colCambiada(); renderDetail(); return;
  }
  if (t.closest("[data-col-import]")) return abrirImportar();
  if (S.view !== "collection") return;
  if (t.closest("[data-col-export]")) return exportarColeccion();
  if (t.closest("[data-col-copy]")) return copiarColeccion();
  if ((x = t.closest("[data-col-tab]"))) { COL.tab = x.dataset.colTab; COL.filtro = ""; render(); return; }
  if ((x = t.closest("[data-col-set]"))) { COL.set = x.dataset.colSet; COL.filtro = ""; closeDetail(); render(); $("#scroller").scrollTop = 0; return; }
  if (t.closest("[data-col-back]")) { COL.set = null; COL.filtro = ""; closeDetail(); render(); return; }
  if (t.closest("[data-col-retry]")) { cargarEdicion(COL.set); pintarColeccion(); return; }
  const tile = t.closest(".col-card"); if (!tile) return;
  const ent = tile.dataset.colE != null ? S.coleccion[+tile.dataset.colE] : null;
  const carta = ent || setsCache.get(COL.set)?.cartas.find(c => c.id === tile.dataset.colId);
  if (!carta) return;
  if ((x = t.closest("[data-col-n]"))) {
    if (ent) { ent.qty += +x.dataset.colN; if (ent.qty < 1) S.coleccion.splice(S.coleccion.indexOf(ent), 1); }
    else { const n = +x.dataset.colN; colSumar(carta, n, n > 0 ? soloFoil(carta) : !colEntrada(carta.id, false)); }   // resta primero las normales
    colCambiada();
    if (S.selected?.id === carta.id) renderDetail();
    return;
  }
  if (t.closest("[data-col-ver]")) {
    if (S.selected?.id === carta.id) return closeDetail();
    if (!ent) return openDetail(carta);
    try { openDetail(await scry(`${API}/cards/${ent.id}`)); } catch { toast("No se pudo cargar la carta de Scryfall"); }
  }
});
document.addEventListener("input", e => { if (e.target.id === "colFiltro") { COL.filtro = e.target.value; pintarColeccion(); } });
document.addEventListener("change", e => { if (e.target.id === "colSolo") { COL.solo = e.target.checked; pintarColeccion(); } });
$("#colForm").addEventListener("submit", e => { if (e.submitter?.value === "cancel") return; e.preventDefault(); importarColeccion(); });
$("#colFile").onclick = async () => {
  if (!bridge()) return toast("Abrir archivos solo funciona dentro de la app");
  const txt = await bridge().importar_tiendas().catch(() => null);   // texto del archivo elegido
  if (txt != null) $("#colTexto").value = txt;
};
