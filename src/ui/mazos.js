// Rastro: mazos. Crear mazos de cualquier formato, ver su información (valor, lo que tienes, legalidad,
// curva, colores y bracket de Commander) y comprar en tus tiendas solo las cartas que te faltan.
// Usa las utilidades de app.js (S, $, esc, scry, resolveCards, startShopSearch…).
"use strict";

// Reglas por formato. size: mínimo de cartas (exact: exactamente); copies: copias por carta; cmd: lleva comandante.
const FORMATOS_MAZO = {
  commander: { n: "Commander", size: 100, exact: true, copies: 1, cmd: true, side: 0 },
  brawl: { n: "Brawl", size: 60, exact: true, copies: 1, cmd: true, side: 0 },
  standard: { n: "Standard", size: 60, copies: 4, side: 15 },
  pioneer: { n: "Pioneer", size: 60, copies: 4, side: 15 },
  modern: { n: "Modern", size: 60, copies: 4, side: 15 },
  legacy: { n: "Legacy", size: 60, copies: 4, side: 15 },
  vintage: { n: "Vintage", size: 60, copies: 4, side: 15 },
  pauper: { n: "Pauper", size: 60, copies: 4, side: 15 },
  limited: { n: "Limitado", size: 40, copies: Infinity, side: Infinity, libre: true },
  casual: { n: "Casual", size: 0, copies: Infinity, side: Infinity, libre: true, cmdOpcional: true },
};
const ZONAS = { commander: "Comandante", main: "Mazo", side: "Banquillo" };
const GRUPOS = [["Criaturas", "creature"], ["Planeswalkers", "planeswalker"], ["Batallas", "battle"], ["Instantáneos", "instant"],
  ["Conjuros", "sorcery"], ["Artefactos", "artifact"], ["Encantamientos", "enchantment"], ["Tierras", "land"]];

const deckActual = () => S.decks.find(d => d.id === S.deck);
const fmtMazo = d => FORMATOS_MAZO[d.format] || FORMATOS_MAZO.casual;
const tipoDe = c => (faces(c)[0].type_line || c.type_line || "").toLowerCase();
const esTierra = c => tipoDe(c).includes("land");
const precio = c => parseFloat(eur(c)) || 0;
// Foil de una entrada del mazo: lo que eligió el usuario o, si nunca lo tocó, si la carta solo existe en foil
const esFoil = e => e.foil ?? soloFoil(e.card);
const tieneFoil = c => !c.finishes || c.finishes.some(f => f !== "nonfoil");
const precioE = e => parseFloat(esFoil(e) ? e.card.prices?.eur_foil || e.card.prices?.eur_etched || e.card.prices?.eur : eur(e.card)) || 0;
const libre = c => /basic land/i.test(c.type_line) || /any number of cards named/i.test(c.oracle_text || "");
const cuenta = (es, f = () => true) => es.filter(f).reduce((n, e) => n + e.qty, 0);

/* ---------- Leer una decklist con secciones ---------- */
function parseDeckText(text) {
  const items = new Map();
  let zona = "main";
  for (let line of text.split(/\r?\n/)) {
    line = line.trim().replace(/^\/\/\s*/, "");
    if (!line || line.startsWith("#")) continue;
    const h = line.toLowerCase().replace(/\s*:?\s*(\(\d+\))?$/, "");
    if (/^(commander|comandante)s?$/.test(h)) { zona = "commander"; continue; }
    if (/^(sideboard|banquillo|companion|compañero|maybeboard|maybe)$/.test(h)) { zona = "side"; continue; }
    if (/^(deck|mazo|main(board)?)$/.test(h)) { zona = "main"; continue; }
    if (/^(tokens?|about|name .*)$/.test(h)) continue;
    let z = zona;
    if (/^SB:\s*/i.test(line)) { z = "side"; line = line.replace(/^SB:\s*/i, ""); }
    const [it] = parseDecklist(line);
    if (!it) continue;
    const key = `${it.name.toLowerCase()}|${it.set || ""}|${z}`;
    items.set(key, { ...it, zone: z, qty: (items.get(key)?.qty || 0) + it.qty });
  }
  return [...items.values()];
}

// Añade cartas resueltas por Scryfall a un mazo (suma copias si ya están en esa zona)
function meterEnMazo(d, encontradas) {
  for (const { card, qty, zone } of encontradas) {
    const z = zone === "commander" && !fmtMazo(d).cmd && !fmtMazo(d).cmdOpcional ? "main" : zone || "main";
    const e = d.cards.find(x => x.card.id === card.id && x.zone === z);
    if (e) e.qty += qty; else d.cards.push({ card, qty, zone: z, have: false });
  }
}

/* ---------- Información del mazo ---------- */
function infoMazo(d) {
  const f = fmtMazo(d);
  const juego = d.cards.filter(e => e.zone !== "side");                // lo que cuenta para el tamaño
  const todas = d.cards;
  const total = cuenta(juego);
  const valor = todas.reduce((s, e) => s + precioE(e) * e.qty, 0);
  const faltan = todas.filter(e => !e.have);
  const sinPrecio = cuenta(todas, e => !precioE(e));
  const cmds = d.cards.filter(e => e.zone === "commander");
  const identidad = new Set(cmds.flatMap(e => e.card.color_identity || []));

  // Legalidad: se informa, nunca se impide
  const avisos = [];
  if (!f.libre || f.size) {
    if (f.exact && total !== f.size) avisos.push(`Debe tener exactamente ${f.size} cartas${f.cmd ? " contando el comandante" : ""} (tiene ${total}).`);
    else if (!f.exact && total < f.size) avisos.push(`Necesita al menos ${f.size} cartas (tiene ${total}).`);
  }
  const side = cuenta(d.cards, e => e.zone === "side");
  if (side > f.side) avisos.push(f.side ? `El banquillo admite ${f.side} cartas (tiene ${side}).` : `${f.n} no usa banquillo (hay ${side}).`);
  if (f.cmd) {
    if (!cmds.length) avisos.push("Falta elegir el comandante.");
    const pareja = cmds.length === 2 && cmds.every(e => (e.card.keywords || []).some(k => /partner|friends forever|doctor's companion/i.test(k)) || /background/i.test(e.card.type_line) || /choose a background/i.test(e.card.oracle_text || ""));
    if (cmds.length > 2 || (cmds.length === 2 && !pareja)) avisos.push("Solo puede haber un comandante (o dos con Partner).");
    cmds.filter(e => !/legendary/i.test(e.card.type_line) || !/creature|planeswalker|background/i.test(e.card.type_line))
      .filter(e => !/can be your commander/i.test(e.card.oracle_text || ""))
      .forEach(e => avisos.push(`${e.card.name} no puede ser comandante.`));
    const fuera = juego.filter(e => (e.card.color_identity || []).some(c => !identidad.has(c)));
    if (cmds.length && fuera.length) avisos.push(`Fuera de la identidad de color del comandante: ${fuera.map(e => e.card.name).join(", ")}.`);
  }
  const porNombre = new Map();
  for (const e of d.cards) if (!libre(e.card)) porNombre.set(e.card.name, (porNombre.get(e.card.name) || 0) + e.qty);
  for (const [n, q] of porNombre) {
    const restringida = d.format === "vintage" && d.cards.find(e => e.card.name === n).card.legalities?.vintage === "restricted";
    const max = restringida ? 1 : f.copies;
    if (q > max) avisos.push(`${n}: ${q} copias (máximo ${max}).`);
  }
  if (!f.libre) {
    const mal = d.cards.filter(e => { const l = e.card.legalities?.[d.format]; return l && l !== "legal" && l !== "restricted"; });
    if (mal.length) avisos.push(`No legales o prohibidas en ${f.n}: ${mal.map(e => e.card.name).join(", ")}.`);
  }

  // Curva (sin tierras), colores y tipos del mazo jugable
  const curva = Array(8).fill(0);
  for (const e of juego) if (!esTierra(e.card)) curva[Math.min(7, Math.floor(e.card.cmc || 0))] += e.qty;
  const pips = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  for (const e of juego) for (const m of (manaCost(e.card) || "").matchAll(/\{([^}]+)\}/g)) for (const p of m[1].split("/")) if (p in pips) pips[p] += e.qty;
  const tipos = GRUPOS.map(([n, t]) => [n, cuenta(juego, e => tipoDe(e.card).includes(t))]).filter(([, q]) => q);
  const noTierras = juego.filter(e => !esTierra(e.card));
  const cmcMedio = noTierras.length ? noTierras.reduce((s, e) => s + (e.card.cmc || 0) * e.qty, 0) / cuenta(noTierras) : 0;

  return { f, total, valor, sinPrecio, tengo: cuenta(todas, e => e.have), copias: cuenta(todas), distintas: new Set(todas.map(e => e.card.oracle_id || e.card.name)).size,
    faltan, faltanCopias: cuenta(faltan), faltanValor: faltan.reduce((s, e) => s + precioE(e) * e.qty, 0),
    avisos, curva, pips, tipos, cmcMedio, identidad: [...identidad], bracket: f.cmd ? bracket(juego) : null };
}

// Bracket estimado (sistema oficial en beta): Game Changers, destrucción masiva de tierras y turnos extra.
// Nunca devuelve 1 (es una intención, no se ve en la lista) y no puede ver combos.
function bracket(es) {
  const gc = es.filter(e => e.card.game_changer).map(e => e.card.name);
  const mld = es.filter(e => /destroy all lands|destroy each land|sacrifices? all lands|each player sacrifices (?:all|half|\w+) lands|lands don't untap/i.test(e.card.oracle_text || "")).map(e => e.card.name);
  const turnos = es.filter(e => /extra turn/i.test(e.card.oracle_text || "")).map(e => e.card.name);
  let b = 2;
  const motivos = [];
  if (gc.length) { b = Math.max(b, gc.length > 3 ? 4 : 3); motivos.push(`${gc.length} Game Changer${gc.length > 1 ? "s" : ""}: ${gc.join(", ")}`); }
  if (mld.length) { b = Math.max(b, 4); motivos.push(`Destrucción masiva de tierras: ${mld.join(", ")}`); }
  if (turnos.length) { b = Math.max(b, turnos.length >= 3 ? 3 : 2); motivos.push(`Turnos extra: ${turnos.join(", ")}`); }
  return { b, motivos };
}
const BRACKETS = { 2: "Básico", 3: "Mejorado", 4: "Optimizado", 5: "cEDH" };

/* ---------- Pintar ---------- */
function renderDecks() {
  results.className = "results decks";
  const title = $("#viewTitle"), count = $("#resultCount");
  const d = deckActual();
  if (!d) {
    S.deck = null;
    title.textContent = "Mazos";
    count.textContent = S.decks.length ? `${S.decks.length} mazo${S.decks.length > 1 ? "s" : ""}` : "";
    results.innerHTML = S.decks.length ? `
      <div class="deck-top">${S.opt.ia ? `<button class="btn" data-ia="crear"><svg class="ic"><use href="#i-plus"/></svg>Crear con IA</button>` : ""}<button class="btn primary" data-deck-new><svg class="ic"><use href="#i-plus"/></svg>Nuevo mazo</button></div>
      <div class="deck-tiles">${S.decks.map(tileMazo).join("")}</div>`
      : empty("layers", "Aún no tienes mazos", "Crea un mazo de cualquier formato, pega su lista o añade cartas una a una, y compra en tus tiendas solo lo que te falta.",
        `<div class="suggestions"><button class="btn primary" data-deck-new><svg class="ic"><use href="#i-plus"/></svg>Nuevo mazo</button>${S.opt.ia ? `<button class="btn" data-ia="crear">Crear con IA</button>` : ""}</div>`);
    return;
  }
  const i = infoMazo(d);
  title.textContent = d.name;
  count.textContent = `${i.f.n} · ${i.total} cartas`;
  const portada = d.cards.find(e => e.zone === "commander") || d.cards[0];
  results.innerHTML = `
    <div class="deck-head">
      <button class="btn sm ghost" data-deck-back>← Mazos</button>
      <input class="field deck-name" id="deckName" value="${esc(d.name)}" aria-label="Nombre del mazo">
      <select class="field deck-format" id="deckFormat" aria-label="Formato">${Object.entries(FORMATOS_MAZO).map(([k, f]) => `<option value="${k}"${k === d.format ? " selected" : ""}>${f.n}</option>`).join("")}</select>
      <span class="grow"></span>
      <button class="btn sm" data-deck-paste><svg class="ic"><use href="#i-clipboard"/></svg>Pegar lista</button>
      <button class="btn sm" data-deck-export title="Copia la lista como texto">Copiar lista</button>
      <button class="btn sm ghost" data-deck-delete title="Eliminar mazo"><svg class="ic"><use href="#i-trash"/></svg></button>
    </div>
    <div class="deck-stats">
      ${tile("Valor del mazo", fmtEur(i.valor), i.sinPrecio ? `${i.sinPrecio} sin precio conocido` : "Precio de referencia (Scryfall)")}
      ${tile("Las tengo", `${i.tengo} / ${i.copias}`, `${i.distintas} cartas distintas`)}
      ${tile("Me faltan", i.faltanCopias ? String(i.faltanCopias) : "Nada", i.faltanCopias ? `${fmtEur(i.faltanValor)} para completarlo` : "Tienes todas las cartas")}
      ${tile("Cartas", i.f.size ? `${i.total} / ${i.f.size}` : String(i.total), i.f.copies === 1 ? "Singleton: una copia de cada" : i.f.copies === Infinity ? "Sin límite de copias" : `Hasta ${i.f.copies} copias de cada`)}
    </div>
    <div class="deck-buy">
      <span>${i.faltanCopias ? `Marca <b>Tengo</b> en las cartas que ya tienes. Se buscarán las <b>${i.faltan.length}</b> restantes (${i.faltanCopias} copias) en tus <b>${S.shops.length}</b> tiendas.` : "Tienes todas las cartas de este mazo."}</span>
      <button class="btn sm ghost" data-deck-all="1">Tengo todas</button>
      <button class="btn sm ghost" data-deck-all="0">Ninguna</button>
      <button class="btn primary" data-deck-buy${i.faltanCopias ? "" : " disabled"}><svg class="ic"><use href="#i-store"/></svg>Comprar lo que falta</button>
    </div>
    <div class="deck-body">
      <div class="deck-list">
        <form class="deck-add" id="deckAdd" autocomplete="off">
          <svg class="ic"><use href="#i-search"/></svg>
          <input class="field" id="deckAddInput" placeholder="Añadir carta al mazo…" spellcheck="false">
          <ul class="suggest" id="deckSuggest" hidden></ul>
        </form>
        ${d.cards.length ? listaMazo(d, i) : `<p class="deck-empty">Este mazo está vacío. Busca cartas arriba o pulsa <b>Pegar lista</b>.</p>`}
      </div>
      <aside class="deck-side">
        ${portada ? `<span class="deck-preview-wrap${esFoil(portada) ? " foil" : ""}" id="deckPreviewWrap" data-def-foil="${esFoil(portada) ? 1 : ""}"><img class="deck-preview" id="deckPreview" alt="" src="${esc(img(portada.card))}" data-def="${esc(img(portada.card))}"></span>` : ""}
        ${S.opt.ia ? panelIA(d) : ""}
        ${panelCombos(d)}
        ${i.bracket ? panelBracket(i.bracket, d) : ""}
        ${panelLegal(i)}
        ${panelCurva(i)}
        ${panelColores(i)}
      </aside>
    </div>`;
}

const tile = (l, v, h) => `<div class="deck-stat"><small>${l}</small><b>${v}</b><span>${h}</span></div>`;

function tileMazo(d) {
  const i = infoMazo(d);
  const c = d.cards.find(e => e.zone === "commander")?.card || d.cards[0]?.card;
  return `<button class="deck-tile" data-deck-open="${d.id}">
    <span class="deck-tile-art">${c ? `<img alt="" loading="lazy" src="${esc(img(c, "art_crop"))}">` : ""}</span>
    <span class="deck-tile-meta"><b>${esc(d.name)}</b><small>${i.f.n} · ${i.total} cartas · ${fmtEur(i.valor)}</small>
    <small class="${i.faltanCopias ? "" : "ok"}">${i.faltanCopias ? `Faltan ${i.faltanCopias}` : "Completo"}${i.avisos.length ? ` · <span class="warn">${i.avisos.length} aviso${i.avisos.length > 1 ? "s" : ""}</span>` : ""}</small></span>
  </button>`;
}

function listaMazo(d, i) {
  const filas = es => es.sort((a, b) => (a.card.cmc || 0) - (b.card.cmc || 0) || a.card.name.localeCompare(b.card.name)).map(e => {
    const k = d.cards.indexOf(e), c = e.card;
    const fuera = i.f.cmd && e.zone !== "commander" && i.identidad.length && (c.color_identity || []).some(x => !i.identidad.includes(x));
    return `<div class="deck-row${e.have ? " have" : ""}${fuera ? " bad" : ""}" data-k="${k}">
      <label class="deck-have" title="La tengo"><input type="checkbox" data-deck-have="${k}"${e.have ? " checked" : ""}><span>Tengo</span></label>
      <span class="deck-qty"><button data-deck-qty="${k}" data-d="-1" title="Quitar una">−</button><b>${e.qty}</b><button data-deck-qty="${k}" data-d="1" title="Añadir una">+</button></span>
      <button class="deck-cname" data-deck-card="${k}" title="Ver carta">${esc(c.name)}${esFoil(e) ? ` <span class="foil-tag">Foil</span>` : ""}</button>
      <span class="cost">${cost(manaCost(c))}</span>
      <span class="deck-price">${precioE(e) ? fmtEur(precioE(e) * e.qty) : ""}</span>
      <select class="deck-zone" data-deck-zone="${k}" title="Mover a">${Object.entries(ZONAS).filter(([z]) => z !== "commander" || i.f.cmd || i.f.cmdOpcional)
        .map(([z, n]) => `<option value="${z}"${z === e.zone ? " selected" : ""}>${n}</option>`).join("")}</select>
      <button class="icon-btn sm" data-deck-art="${k}" title="Cambiar arte o edición"><svg class="ic"><use href="#i-flip"/></svg></button>
      <button class="icon-btn sm" data-deck-rm="${k}" title="Quitar del mazo"><svg class="ic"><use href="#i-x"/></svg></button>
    </div>`;
  }).join("");
  const grupo = (titulo, es) => es.length ? `<section class="deck-group"><h3>${titulo}<span>${cuenta(es)}</span><span class="deck-sub">${fmtEur(es.reduce((s, e) => s + precioE(e) * e.qty, 0))}</span></h3>${filas(es)}</section>` : "";
  const main = d.cards.filter(e => e.zone === "main");
  const usados = new Set();
  const porTipo = GRUPOS.map(([n, t]) => {
    const es = main.filter(e => !usados.has(e) && (t === "land" ? esTierra(e.card) : !esTierra(e.card) && tipoDe(e.card).includes(t)));
    es.forEach(e => usados.add(e));
    return grupo(n, es);
  }).join("");
  return grupo("Comandante", d.cards.filter(e => e.zone === "commander")) + porTipo
    + grupo("Otras", main.filter(e => !usados.has(e))) + grupo("Banquillo", d.cards.filter(e => e.zone === "side"));
}

function panelBracket({ b, motivos }, d) {
  const dos = combosAlDia(d) ? d.combos.en.filter(c => c.cartas.length === 2).length : null;
  return `<section class="deck-panel"><h3>Bracket estimado</h3>
    <div class="deck-bracket"><b>${b}</b><span>${BRACKETS[b]}</span></div>
    <p class="deck-note">${motivos.length ? motivos.map(esc).join("<br>") : "Sin Game Changers, destrucción masiva de tierras ni turnos extra."}</p>
    <p class="deck-note muted">${dos ? `Tiene ${dos} combo${dos > 1 ? "s" : ""} de dos cartas: si se puede${dos > 1 ? "n" : ""} armar pronto en la partida, es bracket 4.`
      : dos === 0 ? "Sin combos de dos cartas." : "Busca los combos del mazo para afinar el bracket: un combo rápido de dos cartas es bracket 4."}</p></section>`;
}
function panelLegal(i) {
  return `<section class="deck-panel"><h3>Legalidad · ${i.f.n}</h3>${i.avisos.length
    ? `<ul class="deck-issues">${i.avisos.map(a => `<li>${esc(a)}</li>`).join("")}</ul>`
    : `<p class="deck-ok">Sin problemas${i.f.libre ? "" : ` para ${i.f.n}`}.</p>`}
    ${i.identidad.length ? `<p class="deck-note">Identidad de color: ${i.identidad.map(c => pip(c)).join("")}</p>` : ""}</section>`;
}
function panelCurva(i) {
  const max = Math.max(1, ...i.curva);
  return `<section class="deck-panel"><h3>Curva de maná<span>media ${i.cmcMedio.toFixed(2).replace(".", ",")}</span></h3>
    <div class="deck-curve">${i.curva.map((n, k) => `<div title="${n} carta${n === 1 ? "" : "s"} de coste ${k}${k === 7 ? " o más" : ""}"><i style="height:${(n / max) * 100}%"></i><b>${n || ""}</b><small>${k === 7 ? "7+" : k}</small></div>`).join("")}</div></section>`;
}
function panelColores(i) {
  const pips = Object.entries(i.pips).filter(([, n]) => n), total = pips.reduce((s, [, n]) => s + n, 0);
  return `<section class="deck-panel"><h3>Colores y tipos</h3>
    ${total ? `<div class="deck-pips">${pips.map(([c, n]) => `<span>${pip(c)}<b>${n}</b><small>${Math.round(n / total * 100)} %</small></span>`).join("")}</div>` : ""}
    <div class="deck-types">${i.tipos.map(([n, q]) => `<span>${n}<b>${q}</b></span>`).join("")}</div></section>`;
}

/* ---------- Combos (Commander Spellbook) ---------- */
// La búsqueda se guarda con una firma de la lista: si cambias cartas, se avisa de que hay que repetirla
const firmaMazo = d => d.cards.filter(e => e.zone !== "side").map(e => e.card.name).sort().join("|");
const combosAlDia = d => d.combos && d.combos.firma === firmaMazo(d);

async function buscarCombos() {
  const d = deckActual(); if (!d) return;
  if (!d.cards.some(e => e.zone !== "side")) return toast("El mazo está vacío");
  S.buscandoCombos = true; render();
  const ok = await consultarCombos(d);
  S.buscandoCombos = false;
  if (!ok) { render(); return toast("No se pudo consultar Commander Spellbook. Inténtalo de nuevo"); }
  save(); render();
}

// Pide los combos del mazo a Commander Spellbook y los guarda en d.combos. Devuelve false si falla.
async function consultarCombos(d) {
  const nombres = z => d.cards.filter(e => e.zone === z).map(e => ({ card: faces(e.card)[0].name }));
  const cuerpo = { commanders: nombres("commander"), main: nombres("main") };
  let r = null;
  try {
    r = bridge() ? await bridge().buscar_combos(cuerpo)
      : (await (await fetch("https://backend.commanderspellbook.com/find-my-combos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) })).json()).results;
  } catch { }
  if (!r) return false;
  const tengo = new Set(d.cards.flatMap(e => [e.card.name, faces(e.card)[0].name]));
  const resumen = c => ({ id: c.id, cartas: c.uses.map(u => u.card.name), produce: c.produces.map(p => p.feature.name),
    mana: c.manaNeeded || "", pasos: c.description || "", requisitos: [c.easyPrerequisites, c.notablePrerequisites].filter(Boolean).join("\n") });
  const porUso = (a, b) => (b.popularity || 0) - (a.popularity || 0);
  d.combos = { firma: firmaMazo(d), en: r.included.sort(porUso).map(resumen),
    casi: r.almostIncluded.sort(porUso).slice(0, 8).map(c => ({ ...resumen(c), falta: c.uses.map(u => u.card.name).filter(n => !tengo.has(n)) })) };
  return true;
}

const comboHTML = (c, casi) => `<details class="combo">
  <summary><span class="combo-cards">${c.cartas.map(n => `<b${casi && c.falta.includes(n) ? ' class="falta"' : ""}>${esc(n)}</b>`).join("")}</span>
    <span class="combo-res">${c.produce.slice(0, 3).map(esc).join(" · ")}</span></summary>
  ${c.mana ? `<p>Maná: ${symbols(c.mana)}</p>` : ""}
  ${c.requisitos ? `<p class="muted">${esc(c.requisitos).replace(/\n/g, "<br>")}</p>` : ""}
  <ol>${c.pasos.split("\n").filter(Boolean).map(p => `<li>${symbols(p)}</li>`).join("")}</ol>
  <a href="https://commanderspellbook.com/combo/${encodeURIComponent(c.id)}/" target="_blank" rel="noopener">Ver en Commander Spellbook</a>
</details>`;

function panelCombos(d) {
  const c = d.combos, viejo = c && !combosAlDia(d);
  const boton = `<button class="btn sm" data-deck-combos${S.buscandoCombos ? " disabled" : ""}>${S.buscandoCombos ? "Buscando…" : c ? "Volver a buscar" : "Buscar combos"}</button>`;
  if (!c) return `<section class="deck-panel"><h3>Combos</h3><p class="deck-note">Busca qué combos hay dentro del mazo y cuáles tienes a una carta, con los datos de Commander Spellbook.</p><p class="deck-note">${boton}</p></section>`;
  return `<section class="deck-panel"><h3>Combos<span>${c.en.length}</span></h3>
    ${viejo ? `<p class="deck-note warn">Has cambiado cartas desde la última búsqueda.</p>` : ""}
    ${c.en.length ? c.en.map(x => comboHTML(x)).join("") : `<p class="deck-note">No hay combos completos en el mazo.</p>`}
    ${c.casi.length ? `<h4 class="combo-sub">A una carta</h4>${c.casi.map(x => comboHTML(x, true)).join("")}` : ""}
    <p class="deck-note">${boton}</p></section>`;
}

/* ---------- Cambiar el arte (impresión) de una carta del mazo ---------- */
let arteDe = null; // la entrada del mazo a la que se le está cambiando el arte
async function elegirArte(e) {
  arteDe = e;
  const dlg = $("#artDlg"), box = $("#artGrid");
  $("#artTitle").textContent = `Arte de ${e.card.name}`;
  $("#artFoil").checked = esFoil(e);
  box.innerHTML = Array.from({ length: 8 }, () => `<span class="print skel"></span>`).join("");
  dlg.showModal();
  let ps = [e.card];
  try { if (e.card.prints_search_uri) ps = (await scry(e.card.prints_search_uri)).data; } catch { box.innerHTML = `<p class="deck-note">No se pudieron cargar las ediciones.</p>`; return; }
  if (arteDe !== e) return;
  ps = ps.filter(p => !p.digital);
  box._prints = ps;
  pintarArtes();
}
// Con "Versión foil" marcada, las ediciones que existen en foil se ven con brillo y su precio foil
function pintarArtes() {
  const box = $("#artGrid"), quiere = $("#artFoil").checked, e = arteDe;
  if (!box._prints || !e) return;
  box.innerHTML = box._prints.map(p => {
    const foil = soloFoil(p) || (quiere && tieneFoil(p));
    const pr = foil ? p.prices?.eur_foil || p.prices?.eur_etched : p.prices?.eur;
    return `<button class="art-opt${p.id === e.card.id ? " on" : ""}" data-art-pick="${p.id}" title="${esc(p.set_name)} · #${esc(p.collector_number)}">
      <span class="skel${foil ? " foil" : ""}"><img loading="lazy" alt="" src="${esc(img(p))}" onload="this.parentElement.classList.remove('skel')"></span>
      <small>${esc(p.set_name)} · ${pr ? fmtEur(pr) : "sin precio"}${soloFoil(p) ? " · solo foil" : !tieneFoil(p) ? " · sin foil" : ""}</small></button>`;
  }).join("");
}

/* ---------- Acciones ---------- */
function nuevoMazo() {
  $("#deckDlgTitle").textContent = "Nuevo mazo";
  $("#deckDlgName").closest("label").hidden = $("#deckDlgFormat").closest("label").hidden = false;
  $("#deckDlgName").value = ""; $("#deckDlgFormat").value = "commander"; $("#deckDlgText").value = "";
  $("#deckDlgStatus").textContent = ""; $("#deckDlg").dataset.mode = "new";
  $("#deckDlgGo").lastChild.textContent = "Crear mazo";
  $("#deckDlg").showModal(); $("#deckDlgName").focus();
}
function pegarEnMazo() {
  $("#deckDlgTitle").textContent = "Pegar lista en el mazo";
  $("#deckDlgName").closest("label").hidden = $("#deckDlgFormat").closest("label").hidden = true;
  $("#deckDlgText").value = ""; $("#deckDlgStatus").textContent = ""; $("#deckDlg").dataset.mode = "add";
  $("#deckDlgGo").lastChild.textContent = "Añadir cartas";
  $("#deckDlg").showModal(); $("#deckDlgText").focus();
}
async function guardarDialogo() {
  const dlg = $("#deckDlg"), status = $("#deckDlgStatus"), btn = $("#deckDlgGo");
  // Enlace de Moxfield: app.py lo descarga y lo convierte en una lista con secciones
  const mox = $("#deckDlgText").value.match(/https?:\/\/(?:www\.)?moxfield\.com\/decks\/[\w-]+/);
  if (mox) {
    if (!bridge()) { status.innerHTML = `<span class="bad">Importar de Moxfield solo funciona dentro de la app.</span>`; return; }
    btn.disabled = true; status.textContent = "Descargando el mazo de Moxfield…";
    const r = await bridge().importar_moxfield(mox[0]).catch(() => null);
    btn.disabled = false;
    if (!r || r.error) { status.innerHTML = `<span class="bad">${esc(r?.error || "No se pudo importar ese enlace.")}</span>`; return; }
    if (dlg.dataset.mode === "new") {
      if (!$("#deckDlgName").value.trim()) $("#deckDlgName").value = r.nombre;
      $("#deckDlgFormat").value = r.formato in FORMATOS_MAZO ? r.formato : "casual";
    }
    $("#deckDlgText").value = r.texto;
  }
  const items = parseDeckText($("#deckDlgText").value);
  let d = dlg.dataset.mode === "add" ? deckActual() : null;
  if (!d) {
    d = { id: crypto.randomUUID(), name: $("#deckDlgName").value.trim() || "Mazo sin nombre", format: $("#deckDlgFormat").value, cards: [], creado: new Date().toISOString() };
    S.decks.unshift(d);
  }
  if (items.length) {
    btn.disabled = true;
    status.textContent = `Buscando ${items.length} carta${items.length > 1 ? "s" : ""} en Scryfall…`;
    try {
      const { found, missing } = await resolveCards(items);
      meterEnMazo(d, found);
      if (missing.length) {
        status.innerHTML = `Añadidas ${found.length}. <span class="bad">No encontradas (${missing.length}):</span> ${missing.map(x => `<code>${esc(x.name)}</code>`).join(" ")}`;
        $("#deckDlgText").value = missing.map(x => `${x.qty} ${x.name}`).join("\n");
        dlg.dataset.mode = "add";
      }
    } catch {
      status.innerHTML = `<span class="bad">No se pudo contactar con Scryfall.</span> Comprueba tu conexión e inténtalo de nuevo.`;
    }
    btn.disabled = false;
  }
  S.deck = d.id; save();
  if (S.view !== "decks") goView("decks"); else render();
  if (!status.querySelector(".bad")) dlg.close();
}

function comprarFaltan() {
  const d = deckActual(); if (!d) return;
  const faltan = d.cards.filter(e => !e.have);
  if (!faltan.length) return;
  if (!S.shops.length) { goView("shops"); return toast("Añade primero alguna tienda"); }
  const copias = cuenta(faltan);
  if (!confirm(`Se pondrán en Mi lista las ${faltan.length} cartas que te faltan (${copias} copias), reemplazando lo que haya, y se buscarán en tus ${S.shops.length} tiendas. ¿Seguir?`)) return;
  const porCarta = new Map();
  for (const e of faltan) {
    const p = porCarta.get(e.card.id);
    porCarta.set(e.card.id, { card: e.card, qty: (p?.qty || 0) + e.qty, foil: (p ? p.foil : true) && esFoil(e) });
  }
  // Las cartas foil del mazo se buscan solo en foil (se puede cambiar en sus filtros de Mi lista)
  S.list = [...porCarta.values()].map(({ card, qty, foil }) => ({ ...card, _f: foil ? { qty, foil: "si" } : { qty } }));
  S.sel.clear();
  save();
  goView("results");
  startShopSearch();
}

const textoMazo = d => Object.keys(ZONAS).map(z => {
  const es = d.cards.filter(e => e.zone === z);
  return es.length ? `${{ commander: "Commander", main: "Deck", side: "Sideboard" }[z]}\n${es.map(e => `${e.qty} ${e.card.name} (${e.card.set.toUpperCase()}) ${e.card.collector_number}`).join("\n")}` : "";
}).filter(Boolean).join("\n\n");

function copiarLista() {
  const d = deckActual(); if (!d) return;
  const txt = textoMazo(d);
  (bridge() ? bridge().copiar(txt) : navigator.clipboard.writeText(txt)).then(() => toast("Lista copiada al portapapeles"), () => toast("No se pudo copiar"));
}

/* ---------- Asistente IA (Claude Code en este equipo, desde ia.py) ---------- */
// Cada tarea: [botón, título del diálogo, explicación, ayuda del cuadro de indicaciones]
const IA_TAREAS = {
  optimizar: ["Optimizar", "Optimizar el mazo", "Propone cambios que lo mejoran sin cambiar su estrategia.", "Indicaciones opcionales: presupuesto, cartas que no quieres tocar…"],
  roast: ["Roast", "Roast del mazo", "Lo bueno, lo malo y una nota, con sinceridad y algo de humor.", "Indicaciones opcionales"],
  mana: ["Base de maná", "Mejorar la base de maná", "Tierras, fijadores de color y rampa según tu curva y tus colores.", "Indicaciones opcionales: presupuesto para tierras…"],
  bracket: ["Cambiar bracket", "Subir o bajar de bracket", "Cambios para llevar el mazo al bracket que elijas.", "Indicaciones opcionales: qué quieres conservar…"],
  barato: ["Versión económica", "Versión económica", "Cambia las cartas caras por alternativas baratas con la misma función.", "Indicaciones opcionales: precio máximo por carta…"],
  jugar: ["Cómo jugarlo", "Cómo jugar el mazo", "Plan de juego, mulligan y amenazas a vigilar.", "Indicaciones opcionales: contra qué juegas…"],
  crear: ["Crear con IA", "Crear mazo con IA", "Describe el mazo y la IA lo arma entero. Después puedes cambiar lo que quieras.", "Por ejemplo: Commander de Atraxa con contadores +1/+1, presupuesto de 100 €"],
};
let IA = null; // { tarea, formato, r, ocupada }

function panelIA(d) {
  const cmd = fmtMazo(d).cmd;
  const p = S.iaPrueba;
  return `<section class="deck-panel"><h3>Asistente IA${p?.ok ? `<span>${esc(p.plan)}</span>` : ""}</h3><div class="ia-tasks">${Object.entries(IA_TAREAS)
    .filter(([k]) => k !== "crear" && (k !== "bracket" || cmd))
    .map(([k, [b]]) => `<button class="btn sm" data-ia="${k}">${b}</button>`).join("")}</div>
    ${p?.ok ? "" : `<p class="deck-note ${p ? "warn" : "muted"}">${p ? `La última prueba falló: ${esc(p.error)}` : "Aún no has probado la conexión con Claude."} Revísalo en Opciones → Inteligencia artificial.</p>`}</section>`;
}

// Antes de cada tarea, comprobación rápida (sin gastar uso): si falta claude o la sesión, se avisa y no se deja pedir
async function comprobarIA(yo) {
  if (!bridge()) return;
  let e = null;
  try { e = await bridge().ia_estado(); } catch { }
  if (IA !== yo || !e) return;
  if (!e.ok) {
    IA.bloqueada = true; pintarBotonIA();
    $("#iaStatus").innerHTML = `<span class="bad">${esc(e.error)}</span>${e.instalado === false
      ? ` <a href="https://claude.com/claude-code" target="_blank" rel="noopener">Cómo instalar Claude Code</a>` : ""} Después, prueba la conexión en Opciones.`;
  }
  // Si cambió la cuenta o el estado desde la última prueba, se actualiza lo guardado
  if (!!S.iaPrueba?.ok !== e.ok || (e.ok && S.iaPrueba.plan !== e.plan)) guardarPruebaIA(e);
}

function abrirIA(tarea) {
  const d = deckActual();
  if (tarea !== "crear" && !d?.cards.length) return toast("El mazo está vacío");
  const [, titulo, nota, ayuda] = IA_TAREAS[tarea];
  IA = { tarea, r: null, ocupada: false };
  $("#iaTitle").textContent = titulo; $("#iaNote").textContent = nota; $("#iaAviso").innerHTML = avisoIA(); $("#iaEsfuerzo").innerHTML = selectorEsfuerzo();
  $("#iaTexto").value = ""; $("#iaTexto").placeholder = ayuda;
  $("#iaFormato").innerHTML = Object.entries(FORMATOS_MAZO).map(([k, f]) => `<option value="${k}">${f.n}</option>`).join("");
  $("#iaFormatoL").hidden = tarea !== "crear";
  $("#iaObjetivoL").hidden = tarea !== "bracket";
  if (tarea === "bracket") { const b = infoMazo(d).bracket?.b || 2; $("#iaObjetivo").value = String(b >= 4 ? b - 1 : b + 1); }
  $("#iaCampos").hidden = tarea !== "crear" && tarea !== "bracket";
  $("#iaOut").innerHTML = ""; $("#iaStatus").textContent = "";
  pintarBotonIA();
  $("#iaDlg").showModal(); $("#iaTexto").focus();
  comprobarIA(IA);
}

const iaAplicable = r => r?.valido && (IA.tarea === "crear" ? IA.cartas?.length : r.quitar.length || r.anadir.length);
function pintarBotonIA() {
  const go = $("#iaGo"), r = IA?.r;
  go.disabled = !!IA?.ocupada || !!IA?.bloqueada;
  go.textContent = IA?.ocupada ? "Pensando…" : iaAplicable(r) ? (IA.tarea === "crear" ? "Crear este mazo" : "Aplicar los marcados") : r ? "Volver a pedir" : "Pedir a la IA";
  $("#iaCancel").hidden = !IA?.ocupada;
}

async function pedirIA() {
  const d = deckActual(), tarea = IA.tarea, texto = $("#iaTexto").value.trim(), status = $("#iaStatus");
  if (!bridge()) { status.innerHTML = `<span class="bad">La IA solo funciona dentro de la app.</span>`; return; }
  if (tarea === "crear" && !texto) { status.innerHTML = `<span class="bad">Describe el mazo que quieres.</span>`; return; }
  const yo = IA;
  IA.formato = tarea === "crear" ? $("#iaFormato").value : d.format;
  const formato = FORMATOS_MAZO[IA.formato]?.n || IA.formato;
  IA.ocupada = true; IA.r = IA.cartas = null; pintarBotonIA();
  $("#iaOut").innerHTML = "";
  const llamar = async (...args) => {
    let x = null;
    const a = [...args]; a.length = 8; // los que falten van como null; el último es el esfuerzo
    try { x = await bridge().ia_pedir(...a, S.opt.esfuerzo); } catch { }
    return x?.datos ? limpiarIA(x.datos) : { error: x?.error || "No se pudo hablar con Claude." };
  };
  // Contexto: los combos se consultan si no están al día (si falla, se sigue sin ellos)
  let contexto = "", comandantes = [];
  if (tarea !== "crear") {
    if (!combosAlDia(d)) {
      status.textContent = "Reuniendo contexto: combos del mazo en Commander Spellbook…";
      if (await consultarCombos(d)) save();
      if (IA !== yo) return;
    }
    contexto = contextoMazo(d);
    comandantes = d.cards.filter(e => e.zone === "commander").map(e => e.card.name);
  }
  status.textContent = `Claude está trabajando${comandantes.length && IA.formato === "commander" ? " (con datos de EDHREC)" : ""}. Puede tardar uno o dos minutos…`;
  let r = await llamar(tarea, tarea === "crear" ? "" : fichaMazo(d), formato, texto, tarea === "bracket" ? +$("#iaObjetivo").value : null, null, contexto, comandantes);
  let aviso = "";
  // Mazo nuevo: se comprueban los precios reales (impresión más barata, sin básicas) y, si se pasa del presupuesto más de
  // un 5 %, la IA lo reajusta (hasta 2 veces). Al final se queda el intento más cercano al presupuesto sin pasarse.
  if (IA === yo && tarea === "crear" && r.valido && r.lista?.length) {
    const presupuesto = r.presupuesto || presupuestoDe(texto), intentos = [];
    for (let vuelta = 1; ; vuelta++) {
      status.textContent = "Buscando la impresión más barata de cada carta en Scryfall…";
      let res;
      try {
        res = await resolveCards(r.lista.map(c => ({ name: c.carta, qty: c.cantidad, zone: c.zona })));
        await masBaratas(res.found);
      } catch { if (!intentos.length) r = { error: "No se pudo contactar con Scryfall." }; break; }
      if (IA !== yo) return;
      const total = res.found.reduce((t, x) => t + coste(x), 0);
      intentos.push({ r, cartas: res.found, missing: res.missing, total });
      if (!presupuesto || total <= presupuesto * 1.05) break;
      if (vuelta > 2) break;
      status.textContent = `Se pasa del presupuesto (${fmtEur(total)} de ${fmtEur(presupuesto)}). La IA lo está ajustando, intento ${vuelta} de 2…`;
      const nuevo = await llamar("presupuesto", fichaMazo({ cards: res.found }, true), formato, texto, presupuesto, total);
      if (IA !== yo) return;
      if (nuevo.error || !nuevo.valido || !nuevo.lista.length) { aviso = `No se pudo ajustar al presupuesto: ${nuevo.error || "la IA no devolvió una lista"}.`; break; }
      r = { ...nuevo, nombre: nuevo.nombre || r.nombre, presupuesto };
    }
    if (intentos.length) {
      const dentro = intentos.filter(x => x.total <= presupuesto * 1.05);
      const mejor = !presupuesto ? intentos[0] : dentro.length ? dentro.reduce((a, b) => b.total > a.total ? b : a) : intentos.reduce((a, b) => b.total < a.total ? b : a);
      r = mejor.r;
      Object.assign(IA, { cartas: mejor.cartas, missing: mejor.missing, total: mejor.total, presupuesto });
      if (presupuesto && mejor.total > presupuesto)
        aviso ||= mejor.total <= presupuesto * 1.05 ? `Se pasa ${fmtEur(mejor.total - presupuesto)} del presupuesto: revísalo antes de comprar.`
          : `Tras dos ajustes sigue pasándose del presupuesto (${fmtEur(mejor.total)} de ${fmtEur(presupuesto)}). Puedes pedir una versión económica después.`;
    }
  }
  if (IA !== yo) return; // se cerró el diálogo mientras pensaba
  IA.ocupada = false;
  if (r.error) { status.innerHTML = `<span class="bad">${esc(r.error)}</span>`; pintarBotonIA(); return; }
  IA.r = r;
  status.innerHTML = aviso ? `<span class="bad">${esc(aviso)}</span>` : "";
  $("#iaOut").innerHTML = respuestaIA(r);
  pintarBotonIA();
}

// Ficha del mazo para la IA: cada carta con su coste, tipo, texto oficial y precio (Scryfall), para que no tire de memoria.
// paraPresupuesto: el precio es el que cuenta para el presupuesto (las básicas no cuentan).
function fichaMazo(d, paraPresupuesto) {
  const linea = e => {
    const c = e.card, partes = [`${e.qty} ${c.name}`], fs = c.card_faces || [c];
    if (esBasica(c)) return `${partes[0]} | tierra básica${paraPresupuesto ? " (no cuenta para el presupuesto)" : ""}`;
    const texto = fs.map(f => f.oracle_text || "").filter(Boolean).join(" // ").replace(/\s*\n\s*/g, " / ");
    partes.push(c.mana_cost || fs.map(f => f.mana_cost).filter(Boolean).join(" // ") || "sin coste", c.type_line || "");
    if (texto) partes.push(texto.length > 400 ? texto.slice(0, 400) + "…" : texto);
    if (fs[0].power != null) partes.push(`${fs[0].power}/${fs[0].toughness}`);
    const p = paraPresupuesto ? coste(e) : precioE(e) * e.qty;
    partes.push(p ? `${p.toFixed(2)} €${e.qty > 1 ? " en total" : ""}` : "sin precio en esta edición");
    if (c.game_changer) partes.push("Game Changer");
    return partes.join(" | ");
  };
  return Object.keys(ZONAS).map(z => {
    const es = d.cards.filter(e => e.zone === z);
    return es.length ? `${{ commander: "Commander", main: "Deck", side: "Sideboard" }[z]}\n${es.map(linea).join("\n")}` : "";
  }).filter(Boolean).join("\n\n");
}

// Datos calculados por la app para la IA: tamaño, tierras, curva, colores, tipos, valor, bracket, legalidad y combos
function contextoMazo(d) {
  const i = infoMazo(d), juego = d.cards.filter(e => e.zone !== "side");
  const tierras = cuenta(juego, e => esTierra(e.card)), basicas = cuenta(juego, e => esBasica(e.card));
  const pips = Object.entries(i.pips).filter(([, n]) => n);
  const lineas = [
    `Cartas: ${i.total}${i.f.size ? ` (el formato pide ${i.f.exact ? "exactamente" : "al menos"} ${i.f.size})` : ""}; ${i.distintas} distintas.`,
    `Tierras: ${tierras} (${basicas} básicas). Hechizos: ${i.total - tierras}. Coste medio sin tierras: ${i.cmcMedio.toFixed(2)}.`,
    `Curva sin tierras: ${i.curva.map((n, k) => `${k === 7 ? "7+" : k}: ${n}`).join(", ")}.`,
    pips.length ? `Símbolos de maná en los costes: ${pips.map(([c, n]) => `${c} ${n}`).join(", ")}.` : "",
    `Tipos: ${i.tipos.map(([n, q]) => `${n} ${q}`).join(", ")}.`,
    i.identidad.length ? `Identidad de color del comandante: ${i.identidad.join("")}.` : "",
    `Valor del mazo: ${i.valor.toFixed(2)} € (precio de referencia de las ediciones elegidas).`,
    i.bracket ? `Bracket estimado por la app: ${i.bracket.b} (${BRACKETS[i.bracket.b]}). ${i.bracket.motivos.length ? i.bracket.motivos.join(". ") + "." : "Sin Game Changers, destrucción masiva de tierras ni turnos extra."} La app no ve combos ni intención: tenlo en cuenta.` : "",
    i.avisos.length ? `Avisos de legalidad: ${i.avisos.join(" ")}` : `Legalidad en ${i.f.n}: sin problemas.`,
  ];
  const c = combosAlDia(d) && d.combos;
  if (c) {
    lineas.push(c.en.length ? `Combos completos en el mazo (Commander Spellbook): ${c.en.slice(0, 15).map(x => `${x.cartas.join(" + ")} → ${x.produce.slice(0, 2).join(", ")}`).join("; ")}.` : "Combos completos en el mazo (Commander Spellbook): ninguno.");
    if (c.casi.length) lineas.push(`Combos a una carta: ${c.casi.map(x => `${x.cartas.join(" + ")} (falta ${x.falta.join(", ")}) → ${x.produce.slice(0, 2).join(", ")}`).join("; ")}.`);
  }
  return lineas.filter(Boolean).join("\n");
}

// Coste para el presupuesto: las tierras básicas no cuentan
const esBasica = c => /\bbasic\b.*\bland\b/i.test(c.type_line || "");
const coste = e => esBasica(e.card) ? 0 : precio(e.card) * e.qty;

// Cambia cada carta por su impresión de papel más barata con precio (de 15 en 15 por búsqueda, con todas sus páginas)
async function masBaratas(es) {
  const ids = [...new Set(es.filter(e => !esBasica(e.card) && e.card.oracle_id).map(e => e.card.oracle_id))];
  const mejor = new Map();
  for (let i = 0; i < ids.length; i += 15) {
    const q = `(${ids.slice(i, i + 15).map(id => `oracleid:${id}`).join(" or ")}) game:paper`;
    let url = `${API}/cards/search?unique=prints&q=${encodeURIComponent(q)}`;
    while (url) {
      const d = await scry(url);
      for (const p of d.data) {
        const v = precio(p), m = mejor.get(p.oracle_id);
        if (v > 0 && (!m || v < precio(m))) mejor.set(p.oracle_id, p);
      }
      url = d.has_more ? d.next_page : null;
      await sleep(100);
    }
  }
  for (const e of es) { const p = mejor.get(e.card.oracle_id); if (p && !esBasica(e.card)) e.card = p; }
}

// Presupuesto escrito en las indicaciones ("100 €", "presupuesto 100"), por si la IA no lo devuelve
function presupuestoDe(t) {
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:€|eur|euros?)|presupuesto\D{0,15}(\d+(?:[.,]\d+)?)/i);
  return m ? parseFloat((m[1] || m[2]).replace(",", ".")) : 0;
}

// La respuesta se trata como datos: solo los campos y tipos esperados, con los textos recortados
function limpiarIA(x) {
  const txt = (v, n = 2500) => typeof v === "string" ? v.slice(0, n) : "";
  const lista = (v, f) => Array.isArray(v) ? v.map(f).filter(Boolean) : [];
  const carta = c => c && txt(c.carta, 150).trim() ? { carta: txt(c.carta, 150).trim(), cantidad: Math.min(99, Math.max(1, parseInt(c.cantidad) || 1)),
    motivo: txt(c.motivo, 300), zona: ZONAS[c.zona] ? c.zona : "main" } : null;
  return { valido: x?.valido !== false, presupuesto: Math.max(0, parseFloat(x?.presupuesto) || 0), resumen: txt(x?.resumen), nombre: txt(x?.nombre, 80), nota: Math.min(10, Math.max(0, parseInt(x?.nota) || 0)),
    buenos: lista(x?.buenos, v => txt(v, 400)).filter(Boolean), malos: lista(x?.malos, v => txt(v, 400)).filter(Boolean),
    quitar: lista(x?.quitar, carta), anadir: lista(x?.anadir, carta), lista: lista(x?.lista, carta) };
}

function respuestaIA(r) {
  const parrafos = t => t.split(/\n+/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join("");
  if (!r.valido) return `<div class="ia-text">${parrafos(r.resumen || "La IA no pudo hacer esta tarea.")}</div>`;
  const puntos = (titulo, xs, cls) => xs.length ? `<h4 class="combo-sub">${titulo}</h4><ul class="ia-points ${cls}">${xs.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  const cambio = (tipo, c, k) => `<label class="check ia-change"><input type="checkbox" checked data-ia-${tipo}="${k}">
    <span><b>${tipo === "q" ? "−" : "+"}${c.cantidad} ${esc(c.carta)}</b>${c.motivo ? `<small>${esc(c.motivo)}</small>` : ""}</span></label>`;
  const [bien, mal] = IA.tarea === "jugar" ? ["Mulligan y mano inicial", "Amenazas a vigilar"] : ["Lo bueno", "Lo malo"];
  return `${r.nota ? `<div class="deck-bracket"><b>${r.nota}</b><span>sobre 10</span></div>` : ""}
    ${r.nombre && IA.tarea === "crear" ? `<h3 class="ia-name">${esc(r.nombre)}</h3>` : ""}
    <div class="ia-text">${parrafos(r.resumen)}</div>
    ${puntos(bien, r.buenos, "good")}${puntos(mal, r.malos, "bad")}
    ${r.quitar.length ? `<h4 class="combo-sub">Quitar</h4>${r.quitar.map((c, k) => cambio("q", c, k)).join("")}` : ""}
    ${r.anadir.length ? `<h4 class="combo-sub">Añadir</h4>${r.anadir.map((c, k) => cambio("a", c, k)).join("")}` : ""}
    ${IA.cartas ? listaCreadaIA() : ""}`;
}

// Mazo creado, ya comprobado en Scryfall: cada carta con su precio y el total frente al presupuesto
function listaCreadaIA() {
  const { cartas, missing, total, presupuesto } = IA, zona = { commander: " · comandante", side: " · banquillo", main: "" };
  return `<h4 class="combo-sub">Lista · ${cuenta(cartas)} cartas · ${fmtEur(total)}</h4>
    ${presupuesto ? `<p class="${total <= presupuesto ? "good" : "bad"}">Presupuesto: ${fmtEur(presupuesto)}. ${total <= presupuesto ? "Dentro del presupuesto" : `Se pasa ${fmtEur(total - presupuesto)}`} (impresión más barata de cada carta según Scryfall, sin contar las tierras básicas).</p>` : ""}
    <ul class="ia-points">${Object.keys(ZONAS).flatMap(z => cartas.filter(x => x.zone === z)
      .map(x => `<li>${x.qty} ${esc(x.card.name)}${zona[z]} · ${esBasica(x.card) ? "básica, no cuenta" : precio(x.card) ? fmtEur(coste(x)) : "sin precio"}</li>`)).join("")}</ul>
    ${missing.length ? `<p class="bad">No existen en Scryfall y no se añadirán: ${missing.map(x => esc(x.name)).join(", ")}</p>` : ""}`;
}

// Aplica los cambios marcados (o crea el mazo). Las cartas se buscan en Scryfall: lo que no exista se avisa y no se añade.
async function aplicarIA() {
  const r = IA.r, status = $("#iaStatus"), go = $("#iaGo"), crear = IA.tarea === "crear";
  const marcadas = (tipo, xs) => xs.filter((_, k) => $(`[data-ia-${tipo}="${k}"]`)?.checked);
  const poner = crear ? [] : marcadas("a", r.anadir), quitar = crear ? [] : marcadas("q", r.quitar);
  if (!crear && !poner.length && !quitar.length) return toast("No hay cambios marcados");
  let found = IA.cartas || [], missing = IA.missing || [];
  if (!crear) {
    go.disabled = true; status.textContent = "Comprobando las cartas en Scryfall…";
    try { ({ found, missing } = await resolveCards(poner.map(c => ({ name: c.carta, qty: c.cantidad, zone: "main" })))); await masBaratas(found); }
    catch { go.disabled = false; status.innerHTML = `<span class="bad">No se pudo contactar con Scryfall.</span>`; return; }
  }
  let d = deckActual();
  if (crear) {
    d = { id: crypto.randomUUID(), name: r.nombre || "Mazo de la IA", format: IA.formato, cards: [], creado: new Date().toISOString() };
    S.decks.unshift(d); S.deck = d.id;
  }
  const mismo = (e, n) => [e.card.name, faces(e.card)[0].name].some(x => x.toLowerCase() === n.toLowerCase());
  const noEstaban = [];
  for (const c of quitar) {
    let q = c.cantidad;
    const es = d.cards.filter(e => e.zone !== "commander" && mismo(e, c.carta)).sort((a, b) => (b.zone === "main") - (a.zone === "main"));
    if (!es.length) noEstaban.push(c.carta);
    for (const e of es) {
      const n = Math.min(q, e.qty); e.qty -= n; q -= n;
      if (e.qty < 1) d.cards.splice(d.cards.indexOf(e), 1);
      if (!q) break;
    }
  }
  meterEnMazo(d, found);
  $("#iaDlg").close();
  save(); render();
  const avisos = [missing.length && `no existen en Scryfall: ${missing.map(x => x.name).join(", ")}`,
    noEstaban.length && `no estaban en el mazo (o son el comandante): ${noEstaban.join(", ")}`].filter(Boolean);
  toast(avisos.length ? `Hecho, pero ${avisos.join("; ")}` : crear ? `Mazo creado: ${d.name}` : "Cambios aplicados");
}

$("#iaGo").onclick = () => { if (IA && !IA.ocupada) iaAplicable(IA.r) ? aplicarIA() : pedirIA(); };
$("#iaCancel").onclick = () => bridge()?.ia_cancelar();
$("#iaDlg").addEventListener("close", () => { if ($("#iaDlg").open) return; if (IA?.ocupada) bridge()?.ia_cancelar(); IA = null; });

// Buscador para añadir cartas sueltas (autocompletado de Scryfall)
const sugerirMazo = debounce(async v => {
  const ul = $("#deckSuggest"); if (!ul) return;
  if (v.length < 2) { ul.hidden = true; return; }
  try {
    const d = await scry(`${API}/cards/autocomplete?q=${encodeURIComponent(v)}`);
    ul.innerHTML = d.data.slice(0, 8).map(n => `<li data-deck-pick="${esc(n)}">${esc(n)}</li>`).join("");
    ul.hidden = !d.data.length;
  } catch { ul.hidden = true; }
}, 180);
async function anadirCarta(nombre) {
  const d = deckActual(); if (!d || !nombre) return;
  try {
    const c = await scry(`${API}/cards/named?exact=${encodeURIComponent(nombre)}`);
    const zona = fmtMazo(d).cmd && !d.cards.some(e => e.zone === "commander") && /legendary creature/i.test(c.type_line) && !d.cards.length ? "commander" : "main";
    meterEnMazo(d, [{ card: c, qty: 1, zone: zona }]);
    save(); render();
    toast(`Añadida: ${c.name}${zona === "commander" ? " (comandante)" : ""}`);
    $("#deckAddInput")?.focus();
  } catch { toast(`No he encontrado “${nombre}”`); }
}

document.addEventListener("click", e => {
  const t = e.target;
  const pick = t.closest("[data-art-pick]");
  if (pick && arteDe) {
    const p = $("#artGrid")._prints.find(x => x.id === pick.dataset.artPick);
    if (p) {
      arteDe.card = p;
      arteDe.foil = soloFoil(p) || ($("#artFoil").checked && tieneFoil(p));
      save(); render(); toast(`${p.set_name}${arteDe.foil ? " · foil" : ""}`);
    }
    $("#artDlg").close(); arteDe = null; return;
  }
  if (S.view !== "decks" && !t.closest("[data-deck-new]")) return;
  const d = deckActual();
  const k = el => d.cards[+el];
  let x;
  if (t.closest("[data-deck-new]")) return nuevoMazo();
  if ((x = t.closest("[data-deck-open]"))) { S.deck = x.dataset.deckOpen; save(); render(); $("#scroller").scrollTop = 0; return; }
  if (t.closest("[data-deck-back]")) { S.deck = null; save(); render(); return; }
  if ((x = t.closest("[data-ia]"))) return abrirIA(x.dataset.ia);
  if (!d) return;
  if (t.closest("[data-deck-paste]")) return pegarEnMazo();
  if (t.closest("[data-deck-export]")) return copiarLista();
  if (t.closest("[data-deck-combos]")) return buscarCombos();
  if (t.closest("[data-deck-buy]")) return comprarFaltan();
  if (t.closest("[data-deck-delete]")) {
    if (confirm(`¿Eliminar el mazo “${d.name}”? No se puede deshacer.`)) { S.decks = S.decks.filter(m => m !== d); S.deck = null; save(); render(); }
    return;
  }
  if ((x = t.closest("[data-deck-all]"))) { d.cards.forEach(c => { c.have = x.dataset.deckAll === "1"; }); save(); render(); return; }
  if ((x = t.closest("[data-deck-qty]"))) {
    const c = k(x.dataset.deckQty); c.qty += +x.dataset.d;
    if (c.qty < 1) d.cards.splice(d.cards.indexOf(c), 1);
    save(); render(); return;
  }
  if ((x = t.closest("[data-deck-art]"))) return elegirArte(k(x.dataset.deckArt));
  if ((x = t.closest("[data-deck-rm]"))) { d.cards.splice(+x.dataset.deckRm, 1); save(); render(); return; }
  if ((x = t.closest("[data-deck-card]"))) { openDetail(k(x.dataset.deckCard).card); return; }
  if ((x = t.closest("[data-deck-pick]"))) { $("#deckSuggest").hidden = true; $("#deckAddInput").value = ""; anadirCarta(x.dataset.deckPick); return; }
});
document.addEventListener("change", e => {
  const t = e.target, d = deckActual();
  if (S.view !== "decks" || !d) return;
  if (t.dataset.deckHave != null) { d.cards[+t.dataset.deckHave].have = t.checked; save(); render(); }
  else if (t.dataset.deckZone != null) { d.cards[+t.dataset.deckZone].zone = t.value; save(); render(); }
  else if (t.id === "deckName") { d.name = t.value.trim() || d.name; save(); render(); }
  else if (t.id === "deckFormat") { d.format = t.value; save(); render(); }
});
document.addEventListener("input", e => { if (e.target.id === "deckAddInput") sugerirMazo(e.target.value.trim()); });
document.addEventListener("change", e => { if (e.target.id === "artFoil") pintarArtes(); });
document.addEventListener("submit", e => {
  if (e.target.id === "deckAdd") {
    e.preventDefault();
    const ul = $("#deckSuggest"), v = $("#deckAddInput").value.trim(), first = !ul.hidden && $("li", ul);
    ul.hidden = true; $("#deckAddInput").value = "";
    anadirCarta(first ? first.dataset.deckPick : v);
  } else if (e.target.id === "deckForm" && e.submitter?.value !== "cancel") {
    e.preventDefault(); guardarDialogo();
  }
}, true);
// La imagen de la derecha sigue a la fila que tienes debajo del ratón
document.addEventListener("mouseover", e => {
  const row = e.target.closest?.(".deck-row"), pv = $("#deckPreview"), d = deckActual();
  if (!pv || !d) return;
  const ent = row && d.cards[+row.dataset.k];
  const src = ent ? img(ent.card) : pv.dataset.def;
  if (pv.getAttribute("src") !== src) pv.src = src;
  const foil = ent ? esFoil(ent) : !!$("#deckPreviewWrap").dataset.defFoil; // la imagen sigue a la fila: foil si esa carta lo es
  $("#deckPreviewWrap").classList.toggle("foil", foil);
});
