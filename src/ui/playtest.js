// Rastro: probar un mazo. Manos iniciales (mulligan de Londres y estadísticas exactas de tierras) y partida de prueba en
// solitario con todas las zonas (biblioteca, mano, pila, campo, cementerio, exilio y zona de mando), fases del turno,
// vidas y contadores, maná flotante, fichas, impuesto de comandante y deshacer.
// Usa las utilidades de app.js y mazos.js (S, $, esc, img, faces, scry, toast, deckActual, fmtMazo, esTierra, tipoDe…).
"use strict";

const PT_FASES = ["Enderezar", "Mantenimiento", "Robar", "Principal 1", "Combate", "Principal 2", "Final"];
const PT_ZONAS = { hand: "Mano", bf: "Campo", stack: "Pila", gy: "Cementerio", ex: "Exilio", lib: "Biblioteca", cmd: "Zona de mando" };
const PT_JUGADOR = { vida: "Vida", veneno: "Veneno", energia: "Energía", exp: "Experiencia", rival: "Vida del rival" };
let PT = null, ptUid = 0;

const ptCarta = (c, extra) => ({ u: ++ptUid, c, t: false, f: 0, abajo: false, cnt: {}, tax: 0, ...extra });
const permanente = c => !/instant|sorcery/.test(tipoDe(c));
const dosCaras = c => faces(c).length > 1 && !!faces(c)[1].image_uris;
function barajar(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function abrirPrueba(modo) {
  const d = deckActual(); if (!d) return;
  const f = fmtMazo(d), conMando = f.cmd || f.cmdOpcional;
  const copias = es => es.flatMap(e => Array.from({ length: e.qty }, () => e.card));
  const base = copias(d.cards.filter(e => e.zone === "main" || (e.zone === "commander" && !conMando)));
  if (base.length < 8) return toast("El mazo necesita al menos 8 cartas para probarlo");
  PT = { d, modo, base, baseCmd: conMando ? copias(d.cards.filter(e => e.zone === "commander")) : [],
    gratis: !!f.cmd, play: true, vidaIni: f.cmd ? 40 : 20 };
  repartir(true);
  $("#ptDlg").showModal();
  pintarPrueba();
}

// Mano nueva: con reset vuelve a empezar de cero; si no, es un mulligan (la mano vuelve a la biblioteca)
function repartir(reset) {
  if (reset) {
    PT.z = { lib: PT.base.map(c => ptCarta(c)), hand: [], bf: [], stack: [], gy: [], ex: [], cmd: PT.baseCmd.map(c => ptCarta(c)) };
    Object.assign(PT, { mulls: 0, j: { vida: PT.vidaIni, veneno: 0, energia: 0, exp: 0, rival: PT.vidaIni }, mana: {} });
  } else { PT.z.lib.push(...PT.z.hand); PT.z.hand = []; PT.mulls++; }
  barajar(PT.z.lib);
  PT.z.hand = PT.z.lib.splice(0, 7);
  Object.assign(PT, { etapa: "mull", fondo: new Set(), turno: 0, fase: 3, robadas: 0, hist: [], menu: null, ver: null });
}
const aFondo = () => Math.max(0, PT.mulls - (PT.gratis ? 1 : 0));

function quedarse() {
  const n = aFondo();
  if (PT.fondo.size !== n) return toast(`Elige ${n} carta${n > 1 ? "s" : ""} para ponerla${n > 1 ? "s" : ""} debajo de la biblioteca`);
  const abajo = PT.z.hand.filter(x => PT.fondo.has(x.u));
  PT.z.hand = PT.z.hand.filter(x => !PT.fondo.has(x.u));
  PT.z.lib.push(...barajar(abajo));
  PT.fondo.clear();
  if (PT.modo === "manos") PT.etapa = "mano"; else empezarPartida();
}
function empezarPartida() {
  Object.assign(PT, { modo: "partida", etapa: "juego", turno: 1, fase: 3, hist: [] });
  if (!PT.play) robar(1); // robando primero también se roba en el primer turno
}

/* ---------- Acciones de partida (todas se pueden deshacer) ---------- */
const foto = () => ({ z: Object.fromEntries(Object.entries(PT.z).map(([k, a]) => [k, a.map(x => ({ ...x, cnt: { ...x.cnt } }))])),
  j: { ...PT.j }, mana: { ...PT.mana }, turno: PT.turno, fase: PT.fase });
function hacer(fn) {
  PT.hist.push(foto()); if (PT.hist.length > 80) PT.hist.shift();
  fn(); PT.menu = null; pintarPrueba();
}
function deshacer() {
  const f = PT.hist.pop(); if (!f) return toast("No hay nada que deshacer");
  Object.assign(PT, f); PT.menu = null; pintarPrueba();
}
const buscarCarta = u => { for (const [k, a] of Object.entries(PT.z)) { const x = a.find(y => y.u === u); if (x) return [k, x]; } return []; };

function mover(u, dest, alFondo) {
  const [desde, x] = buscarCarta(u); if (!x) return;
  PT.z[desde].splice(PT.z[desde].indexOf(x), 1);
  if (x.ficha && dest !== "bf" && dest !== "stack") return; // las fichas dejan de existir fuera del campo
  if (desde === "cmd" && (dest === "stack" || dest === "bf")) x.tax += 2; // impuesto de comandante
  if (dest !== "bf") { x.t = false; x.cnt = {}; }
  if (dest !== "bf" && dest !== "ex") x.abajo = false;
  if (dest === "lib" || dest === "hand") x.f = 0;
  if (dest === "lib" && !alFondo) PT.z.lib.unshift(x); else PT.z[dest].push(x);
}
function robar(n) {
  for (let i = 0; i < n; i++) {
    if (!PT.z.lib.length) { toast("La biblioteca está vacía"); break; }
    PT.z.hand.push(PT.z.lib.shift());
  }
}
const jugar = u => { const [, x] = buscarCarta(u); if (x) mover(u, permanente(x.c) ? "bf" : "stack"); };
function resolver(u) { const [, x] = buscarCarta(u); if (x) mover(u, permanente(x.c) ? "bf" : "gy"); }
function pasarFase() {
  PT.mana = {}; // el maná se vacía al final de cada paso y fase
  if (PT.fase === PT_FASES.length - 1) return nuevoTurno(false);
  PT.fase++;
  if (PT.fase === 2) robar(1);
}
function nuevoTurno(directo) {
  PT.turno++; PT.mana = {};
  PT.z.bf.forEach(x => { x.t = false; });
  if (directo) { robar(1); PT.fase = 3; } else PT.fase = 0;
}
function contador(x, k, n) {
  const opuesto = { "+1/+1": "-1/-1", "-1/-1": "+1/+1" }[k];
  if (n > 0 && opuesto && x.cnt[opuesto]) { if (!--x.cnt[opuesto]) delete x.cnt[opuesto]; return; } // se anulan entre sí
  x.cnt[k] = Math.max(0, (x.cnt[k] || 0) + n);
  if (!x.cnt[k]) delete x.cnt[k];
}
async function crearFicha() {
  const n = prompt("Nombre de la ficha (en inglés), por ejemplo Treasure, Soldier, Goblin, Clue:")?.trim();
  if (!n) return;
  let c = null;
  for (const q of [`t:token !"${n}"`, `t:token ${n}`]) {
    try { c = (await scry(`${API}/cards/search?q=${encodeURIComponent(q)}`)).data[0]; break; } catch { }
  }
  if (!PT) return;
  hacer(() => PT.z.bf.push(ptCarta(c || { id: `ficha-${n}`, name: n, type_line: "Token" }, { ficha: true })));
  if (!c) toast(`No hay imagen de “${n}” en Scryfall: se crea con su nombre`);
}
const pedirNumero = (t, def = 1) => { const n = parseInt(prompt(t, String(def))); return n > 0 ? n : 0; };

/* ---------- Estadísticas de manos (hipergeométrica exacta) ---------- */
function comb(n, k) { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }
const hiper = (N, K, n, k) => comb(K, k) * comb(N - K, n - k) / comb(N, n);
const pct = p => `${(p * 100).toFixed(1).replace(".", ",")} %`;
function estadisticas() {
  const N = PT.base.length, L = PT.base.filter(esTierra).length;
  const dist = Array.from({ length: 8 }, (_, k) => hiper(N, L, 7, k)), max = Math.max(...dist);
  const alMenos = (n, k) => 1 - Array.from({ length: k }, (_, i) => hiper(N, L, n, i)).reduce((a, b) => a + b, 0);
  const enMano = PT.z.hand.filter(x => esTierra(x.c)).length;
  return `<section class="pt-stats">
    <h3>Probabilidades</h3>
    <p class="deck-note">${L} tierras de ${N} cartas (${pct(L / N)}). De media, ${(7 * L / N).toFixed(1).replace(".", ",")} tierras en la mano inicial. Esta mano tiene <b>${enMano}</b>.</p>
    <div class="deck-curve pt-dist">${dist.map((p, k) => `<div title="${pct(p)} de las manos tienen ${k} tierra${k === 1 ? "" : "s"}"><i style="height:${p / max * 100}%"></i><b>${Math.round(p * 100)}</b><small>${k}</small></div>`).join("")}</div>
    <p class="deck-note muted">% de manos de 7 según cuántas tierras traen.</p>
    <p class="deck-note">Manos con 2 a 4 tierras: <b>${pct(dist[2] + dist[3] + dist[4])}</b> · con 0–1: ${pct(dist[0] + dist[1])} · con 5 o más: ${pct(dist[5] + dist[6] + dist[7])}</p>
    <table class="pt-tabla"><tr><th>Tierras a tiempo</th><th>Empiezas</th><th>Robas primero</th></tr>
      ${[2, 3, 4, 5].map(k => `<tr><td>${k} tierras en el turno ${k}</td><td>${pct(alMenos(6 + k, k))}</td><td>${pct(alMenos(7 + k, k))}</td></tr>`).join("")}</table>
  </section>`;
}

/* ---------- Pintar ---------- */
function cartaPT(x, zona) {
  const src = x.abajo ? "" : img(x.c, "normal", x.f) || img(x.c);
  const cnt = Object.entries(x.cnt).map(([k, n]) => `<i>${n} × ${esc(k)}</i>`).join("");
  return `<div class="pt-card${x.t ? " tap" : ""}${PT.fondo.has(x.u) ? " sel" : ""}${x.abajo ? " back" : ""}" draggable="true" data-u="${x.u}" data-z="${zona}" title="${esc(x.abajo ? "Boca abajo" : x.c.name)}">
    ${src ? `<img alt="${esc(x.c.name)}" src="${esc(src)}" draggable="false">` : `<span class="pt-txt">${x.abajo ? "" : esc(x.c.name)}</span>`}
    ${cnt || x.ficha || x.tax ? `<span class="pt-tags">${x.ficha ? "<i>Ficha</i>" : ""}${x.tax ? `<i>Impuesto +${x.tax}</i>` : ""}${cnt}</span>` : ""}</div>`;
}

function pintarPrueba() {
  const dlg = $("#ptDlg"); if (!PT || !dlg.open) return;
  const scroll = $$("[data-scroll]", dlg).map(e => [e.dataset.scroll, e.scrollTop]);
  const juego = PT.etapa === "juego";
  dlg.innerHTML = `<header class="pt-top">
      <b class="pt-name">${esc(PT.d.name)}</b>
      ${juego ? `<span class="pt-turno">Turno ${PT.turno}</span>
        <nav class="pt-fases">${PT_FASES.map((f, i) => `<button class="${i === PT.fase ? "on" : ""}" data-pt-fase="${i}">${f}</button>`).join("")}</nav>`
      : `<span class="pt-turno">${PT.modo === "manos" ? "Manos iniciales" : "Partida de prueba · mano inicial"}</span>`}
      <span class="grow"></span>
      ${juego ? `<button class="btn sm" data-pt="fase" title="Atajo: P">Pasar fase</button>
        <button class="btn sm primary" data-pt="turno" title="Endereza todo y roba (atajo: N)">Siguiente turno</button>
        <button class="btn sm ghost" data-pt="deshacer" title="Atajo: Ctrl+Z"${PT.hist.length ? "" : " disabled"}>Deshacer</button>` : ""}
      <button class="btn sm ghost" data-pt="reiniciar">Reiniciar</button>
      <button class="icon-btn" data-pt="cerrar" title="Cerrar"><svg class="ic"><use href="#i-x"/></svg></button>
    </header>
    ${juego ? mesa() : mulligan()}
    ${PT.menu ? menuPT() : ""}${PT.ver ? visor() : ""}
    <div class="pt-zoom" id="ptZoom" hidden></div>`;
  for (const [k, v] of scroll) { const e = $(`[data-scroll="${k}"]`, dlg); if (e) e.scrollTop = v; }
  const m = $(".pt-menu", dlg);
  if (m) {
    const r = m.getBoundingClientRect();
    m.style.left = `${Math.max(4, Math.min(PT.menu.x, innerWidth - r.width - 8))}px`;
    m.style.top = `${Math.max(4, Math.min(PT.menu.y, innerHeight - r.height - 8))}px`;
  }
}

function mulligan() {
  const n = aFondo(), manos = PT.modo === "manos", guardada = PT.etapa === "mano";
  const nota = guardada ? `Te quedas con ${PT.z.hand.length - PT.robadas} cartas.${PT.robadas ? ` Robadas después: ${PT.robadas} (hasta el turno ${PT.robadas + (PT.play ? 1 : 0)}).` : " Roba para ver cómo seguirían los próximos turnos."}`
    : n ? `Mulligan ${PT.mulls}: elige <b>${n}</b> carta${n > 1 ? "s" : ""} para poner debajo de la biblioteca (${PT.fondo.size} de ${n}).`
    : PT.mulls ? "Primer mulligan gratis: te quedas con las 7." : "¿Te quedas con esta mano o haces mulligan?";
  return `<main class="pt-mull${manos ? " con-stats" : ""}">
    <section class="pt-mull-mano">
      <p class="pt-nota">${nota}</p>
      <div class="pt-mano grande" data-scroll="mull">${PT.z.hand.map(x => cartaPT(x, "hand")).join("")}</div>
      <div class="pt-acciones">${guardada
        ? `<button class="btn" data-pt="robar-mano">Robar</button><button class="btn" data-pt="nueva">Nueva mano</button><button class="btn primary" data-pt="jugar-mano">Jugar con esta mano</button>`
        : `<button class="btn" data-pt="mulligan"${PT.mulls >= 6 ? " disabled" : ""}>Mulligan</button><button class="btn primary" data-pt="quedarse">Me la quedo</button>`}</div>
      ${guardada ? "" : `<div class="pt-opciones">
        <label class="check"><input type="checkbox" data-pt-op="play"${PT.play ? " checked" : ""}>Empiezo yo (no robo en el primer turno)</label>
        <label class="check"><input type="checkbox" data-pt-op="gratis"${PT.gratis ? " checked" : ""}>Primer mulligan gratis (Commander multijugador)</label>
      </div>`}
      <p class="deck-note muted">Mulligan de Londres: siempre robas 7 y luego pones debajo una carta por cada mulligan.${PT.baseCmd.length ? " El comandante empieza en la zona de mando." : ""}</p>
    </section>
    ${manos ? estadisticas() : ""}
  </main>`;
}

function mesa() {
  const z = PT.z, bf = z.bf;
  const otros = bf.filter(x => x.abajo || !esTierra(x.c)), tierras = bf.filter(x => !x.abajo && esTierra(x.c));
  const monton = (k, cartaArriba) => `<div class="pt-monton" data-pt-drop="${k}" data-pt-pila="${k}" title="${PT_ZONAS[k]}">
      ${cartaArriba ? `<img alt="" src="${esc(img(cartaArriba.c, "normal", cartaArriba.f) || img(cartaArriba.c))}">` : k === "lib" && z.lib.length ? `<span class="pt-dorso"></span>` : `<span class="pt-hueco"></span>`}
      <small>${PT_ZONAS[k]} · <b>${z[k].length}</b></small></div>`;
  const vida = k => `<div class="pt-vida"><span>${PT_JUGADOR[k]}</span><button data-pt-j="${k}" data-d="-1" title="Mayús: −5">−</button><b>${PT.j[k]}</b><button data-pt-j="${k}" data-d="1" title="Mayús: +5">+</button></div>`;
  return `<main class="pt-mesa">
    <section class="pt-campo" data-pt-drop="bf" data-scroll="campo">
      <div class="pt-fila">${otros.map(x => cartaPT(x, "bf")).join("")}</div>
      <div class="pt-fila tierras">${tierras.map(x => cartaPT(x, "bf")).join("")}</div>
      ${bf.length ? "" : `<p class="pt-vacio">Haz doble clic en una carta de la mano para jugarla, o arrástrala aquí. Clic en una carta del campo: girarla. Clic derecho: más opciones.</p>`}
    </section>
    <aside class="pt-lado" data-scroll="lado">
      <div class="pt-bloque">${Object.keys(PT_JUGADOR).map(vida).join("")}</div>
      <div class="pt-bloque"><span class="pt-tit">Maná flotante</span><div class="pt-mana">${["W", "U", "B", "R", "G", "C"].map(c => `<button data-pt-mana="${c}" title="Clic: +1 · Clic derecho: −1">${pip(c)}<b>${PT.mana[c] || ""}</b></button>`).join("")}</div></div>
      ${z.cmd.length || PT.baseCmd.length ? `<div class="pt-bloque" data-pt-drop="cmd"><span class="pt-tit">Zona de mando</span><div class="pt-mini">${z.cmd.map(x => cartaPT(x, "cmd")).join("") || `<p class="deck-note muted">Vacía</p>`}</div></div>` : ""}
      <div class="pt-bloque" data-pt-drop="stack"><span class="pt-tit">Pila${z.stack.length ? ` · ${z.stack.length}` : ""}</span><div class="pt-mini">${z.stack.map(x => cartaPT(x, "stack")).reverse().join("") || `<p class="deck-note muted">Los instantáneos y conjuros que juegues van aquí. Clic para resolverlos.</p>`}</div></div>
      <div class="pt-bloque"><span class="pt-tit">Más</span><div class="pt-mas">
        <button class="btn sm" data-pt="ficha">Crear ficha</button><button class="btn sm" data-pt="enderezar">Enderezar todo</button>
        <button class="btn sm" data-pt="d6">Dado d6</button><button class="btn sm" data-pt="d20">Dado d20</button><button class="btn sm" data-pt="moneda">Moneda</button></div></div>
      <p class="deck-note muted pt-atajos">Atajos: D robar · P pasar fase · N siguiente turno · U enderezar · S barajar · Ctrl+Z deshacer</p>
    </aside>
    <section class="pt-abajo">
      <div class="pt-mano" data-pt-drop="hand" data-scroll="mano">${z.hand.map(x => cartaPT(x, "hand")).join("") || `<p class="pt-vacio">Mano vacía</p>`}</div>
      <div class="pt-montones">${monton("lib")}${monton("gy", z.gy.at(-1))}${monton("ex", z.ex.at(-1))}</div>
    </section>
  </main>`;
}

// Menú contextual: de una carta (según su zona) o de la biblioteca
function menuPT() {
  const m = PT.menu, op = (acc, t) => `<button data-pt-acc="${acc}">${t}</button>`;
  let h = "";
  if (m.pila === "lib") h = op("robar", "Robar") + op("robarN", "Robar varias…") + op("mirar", "Mirar las de arriba…") + op("moler", "Al cementerio las de arriba…")
    + op("exiliar", "Exiliar la de arriba") + op("revelar", "Jugar la de arriba boca arriba") + op("buscar", "Buscar una carta") + op("barajar", "Barajar");
  else if (m.pila) h = op(`ver:${m.pila}`, `Ver ${PT_ZONAS[m.pila].toLowerCase()}`);
  else {
    const [zona, x] = buscarCarta(m.u); if (!x) return "";
    if (zona === "hand" || zona === "cmd") h += op("jugar", permanente(x.c) ? "Jugar al campo" : "Lanzar (a la pila)");
    if (zona === "stack") h += op("resolver", "Resolver");
    if (zona === "bf") {
      h += op("tap", x.t ? "Enderezar" : "Girar");
      if (dosCaras(x.c)) h += op("flip", "Transformar (otra cara)");
      h += op("abajo", x.abajo ? "Poner boca arriba" : "Poner boca abajo") + "<hr>"
        + op("cnt:+1/+1", "Contador +1/+1") + op("cnt:-1/-1", "Contador −1/−1") + op("cnt:?", "Otro contador…")
        + (Object.keys(x.cnt).length ? op("menos", "Quitar un contador") + op("sin", "Quitar todos los contadores") : "")
        + op("copia", "Crear una ficha copia");
    } else if (dosCaras(x.c) && zona !== "hand") h += op("flip", "Ver la otra cara");
    h += "<hr>" + Object.entries({ hand: "A la mano", bf: "Al campo", gy: "Al cementerio", ex: "Al exilio", "lib": "Arriba de la biblioteca", "lib-fondo": "Debajo de la biblioteca", cmd: "A la zona de mando" })
      .filter(([k]) => k !== zona && !(k === "bf" && zona === "hand")).map(([k, t]) => op(`mover:${k}`, t)).join("");
    if (zona === "hand" || zona === "bf") h += op("mover:ex-abajo", "Exiliar boca abajo");
  }
  return `<div class="pt-menu" style="left:${m.x}px;top:${m.y}px">${h}</div>`;
}

// Visor de una zona: cementerio, exilio, la biblioteca entera (buscar) o las de arriba (mirar, adivinar, vigilar)
function visor() {
  const v = PT.ver, z = PT.z[v.zona];
  let cartas = v.us ? z.filter(x => v.us.includes(x.u)) : v.zona === "lib" ? [...z].sort((a, b) => a.c.name.localeCompare(b.c.name)) : [...z].reverse();
  const titulo = v.us ? `Las ${v.us.length} de arriba de la biblioteca` : v.zona === "lib" ? "Buscar en la biblioteca" : PT_ZONAS[v.zona];
  const destinos = { hand: "Mano", bf: "Campo", gy: "Cementerio", ex: "Exilio", lib: "Arriba", "lib-fondo": "Abajo" };
  return `<div class="pt-visor"><div class="pt-visor-box">
    <header class="modal-head"><h2>${titulo} <small>${cartas.length}</small></h2><button class="icon-btn" data-pt="cerrar-ver" title="Cerrar"><svg class="ic"><use href="#i-x"/></svg></button></header>
    ${v.us ? `<p class="modal-note">Orden actual de arriba a abajo. Pulsa “Arriba” en el orden inverso al que las quieras (la última que pulses queda encima).</p>` : ""}
    <div class="pt-visor-lista" data-scroll="visor">${cartas.map(x => {
      const pos = v.zona === "lib" && v.us ? z.indexOf(x) : -1;
      return `<div class="pt-visor-carta">${cartaPT(x, v.zona)}
        ${pos >= 0 ? `<small>${pos === z.length - 1 ? "Abajo del todo" : `${pos + 1}.ª desde arriba`}</small>` : ""}
        <div>${Object.entries(destinos).filter(([k]) => k !== v.zona || v.zona === "lib").map(([k, t]) => `<button class="btn sm" data-pt-vmover="${x.u}:${k}">${t}</button>`).join("")}</div></div>`;
    }).join("") || `<p class="deck-note">No hay cartas.</p>`}</div>
    ${v.zona === "lib" && !v.us ? `<footer class="modal-foot"><span></span><button class="btn primary" data-pt="cerrar-barajar">Barajar y cerrar</button></footer>` : ""}
  </div></div>`;
}

/* ---------- Eventos ---------- */
function accionMenu(acc) {
  const m = PT.menu, [, x] = m.u ? buscarCarta(m.u) : [];
  const [tipo, arg] = acc.split(":");
  const lib = PT.z.lib;
  switch (tipo) {
    case "robar": return hacer(() => robar(1));
    case "robarN": { const n = pedirNumero("¿Cuántas cartas robas?", 2); return n ? hacer(() => robar(n)) : cerrarMenu(); }
    case "mirar": { const n = pedirNumero("¿Cuántas cartas de arriba quieres mirar?", 3); if (!n) return cerrarMenu(); PT.ver = { zona: "lib", us: lib.slice(0, n).map(y => y.u) }; return cerrarMenu(); }
    case "moler": { const n = pedirNumero("¿Cuántas cartas de arriba van al cementerio?", 3); return n ? hacer(() => lib.slice(0, n).forEach(y => mover(y.u, "gy"))) : cerrarMenu(); }
    case "exiliar": return lib.length ? hacer(() => mover(lib[0].u, "ex")) : cerrarMenu();
    case "revelar": return lib.length ? hacer(() => mover(lib[0].u, permanente(lib[0].c) ? "bf" : "stack")) : cerrarMenu();
    case "buscar": PT.ver = { zona: "lib" }; return cerrarMenu();
    case "barajar": hacer(() => barajar(lib)); return toast("Biblioteca barajada");
    case "ver": PT.ver = { zona: arg }; return cerrarMenu();
  }
  if (!x) return cerrarMenu();
  switch (tipo) {
    case "jugar": return hacer(() => jugar(x.u));
    case "resolver": return hacer(() => resolver(x.u));
    case "tap": return hacer(() => { x.t = !x.t; });
    case "flip": return hacer(() => { x.f = x.f ? 0 : 1; });
    case "abajo": return hacer(() => { x.abajo = !x.abajo; });
    case "menos": return hacer(() => contador(x, Object.keys(x.cnt).at(-1), -1));
    case "sin": return hacer(() => { x.cnt = {}; });
    case "copia": return hacer(() => PT.z.bf.push(ptCarta(x.c, { ficha: true })));
    case "cnt": {
      const k = arg === "?" ? prompt("Nombre del contador (por ejemplo: carga, lealtad, aturdimiento):")?.trim() : acc.slice(4);
      return k ? hacer(() => contador(x, k, 1)) : cerrarMenu();
    }
    case "mover": {
      if (arg === "ex-abajo") return hacer(() => { mover(x.u, "ex"); x.abajo = true; });
      return hacer(() => mover(x.u, arg.replace("-fondo", ""), arg.endsWith("-fondo")));
    }
  }
}
const cerrarMenu = () => { PT.menu = null; pintarPrueba(); };

function clicPrueba(e) {
  if (!PT) return;
  const t = e.target;
  let x;
  if ((x = t.closest("[data-pt-acc]"))) return accionMenu(x.dataset.ptAcc);
  if (PT.menu && !t.closest(".pt-menu")) { PT.menu = null; pintarPrueba(); if (!t.closest("[data-pt]")) return; }
  if ((x = t.closest("[data-pt]"))) {
    const a = x.dataset.pt;
    switch (a) {
      case "cerrar": return $("#ptDlg").close();
      case "reiniciar": if (PT.etapa !== "juego" || confirm("¿Empezar de nuevo? Se pierde la partida.")) { repartir(true); pintarPrueba(); } return;
      case "mulligan": repartir(false); return pintarPrueba();
      case "quedarse": quedarse(); return pintarPrueba();
      case "nueva": repartir(true); return pintarPrueba();
      case "robar-mano": robar(1); PT.robadas++; return pintarPrueba();
      case "jugar-mano": empezarPartida(); return pintarPrueba();
      case "fase": return hacer(pasarFase);
      case "turno": return hacer(() => nuevoTurno(true));
      case "deshacer": return deshacer();
      case "enderezar": return hacer(() => PT.z.bf.forEach(y => { y.t = false; }));
      case "ficha": return crearFicha();
      case "d6": case "d20": return toast(`${a}: ${1 + crypto.getRandomValues(new Uint32Array(1))[0] % +a.slice(1)}`);
      case "moneda": return toast(crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? "Cara" : "Cruz");
      case "cerrar-ver": PT.ver = null; return pintarPrueba();
      case "cerrar-barajar": PT.ver = null; hacer(() => barajar(PT.z.lib)); return toast("Biblioteca barajada");
    }
    return;
  }
  if ((x = t.closest("[data-pt-fase]"))) return hacer(() => { PT.fase = +x.dataset.ptFase; PT.mana = {}; });
  if ((x = t.closest("[data-pt-j]"))) return hacer(() => { PT.j[x.dataset.ptJ] += +x.dataset.d * (e.shiftKey ? 5 : 1); });
  if ((x = t.closest("[data-pt-mana]"))) return hacer(() => { PT.mana[x.dataset.ptMana] = (PT.mana[x.dataset.ptMana] || 0) + 1; });
  if ((x = t.closest("[data-pt-vmover]"))) {
    const [u, dest] = x.dataset.ptVmover.split(":");
    return hacer(() => mover(+u, dest.replace("-fondo", ""), dest.endsWith("-fondo")));
  }
  if ((x = t.closest("[data-pt-pila]")) && !t.closest(".pt-visor")) {
    if (PT.etapa !== "juego") return;
    return x.dataset.ptPila === "lib" ? hacer(() => robar(1)) : (PT.ver = { zona: x.dataset.ptPila }, pintarPrueba());
  }
  if ((x = t.closest(".pt-card")) && !t.closest(".pt-visor")) {
    const u = +x.dataset.u, zona = x.dataset.z;
    if (PT.etapa === "mull" && aFondo()) {
      if (PT.fondo.has(u)) PT.fondo.delete(u); else if (PT.fondo.size < aFondo()) PT.fondo.add(u);
      return pintarPrueba();
    }
    if (PT.etapa !== "juego") return;
    if (zona === "bf") return hacer(() => { const [, c] = buscarCarta(u); c.t = !c.t; });
    if (zona === "stack") return hacer(() => resolver(u));
  }
}

const dlgPT = $("#ptDlg");
dlgPT.addEventListener("click", clicPrueba);
dlgPT.addEventListener("dblclick", e => {
  const x = e.target.closest(".pt-card");
  if (PT?.etapa === "juego" && x && !e.target.closest(".pt-visor") && (x.dataset.z === "hand" || x.dataset.z === "cmd")) hacer(() => jugar(+x.dataset.u));
});
dlgPT.addEventListener("contextmenu", e => {
  if (PT?.etapa !== "juego") return;
  const mana = e.target.closest("[data-pt-mana]");
  if (mana) { e.preventDefault(); const c = mana.dataset.ptMana; if (PT.mana[c]) hacer(() => { PT.mana[c]--; }); return; }
  const carta = e.target.closest(".pt-card"), pila = e.target.closest("[data-pt-pila]");
  if (!carta && !pila) return;
  e.preventDefault();
  PT.menu = carta && !pila ? { u: +carta.dataset.u, x: e.clientX, y: e.clientY } : { pila: pila.dataset.ptPila, x: e.clientX, y: e.clientY };
  pintarPrueba();
});
dlgPT.addEventListener("change", e => {
  const op = e.target.dataset.ptOp;
  if (op && PT) { PT[op] = e.target.checked; pintarPrueba(); }
});
// Arrastrar cartas entre zonas
dlgPT.addEventListener("dragstart", e => {
  const x = e.target.closest?.(".pt-card");
  if (!x || PT?.etapa !== "juego") return e.preventDefault();
  e.dataTransfer.setData("text/plain", x.dataset.u); e.dataTransfer.effectAllowed = "move";
});
dlgPT.addEventListener("dragover", e => { if (e.target.closest("[data-pt-drop]")) e.preventDefault(); });
dlgPT.addEventListener("drop", e => {
  const zona = e.target.closest("[data-pt-drop]")?.dataset.ptDrop, u = +e.dataTransfer.getData("text/plain");
  if (!zona || !u) return;
  e.preventDefault();
  if (buscarCarta(u)[0] !== zona) hacer(() => mover(u, zona));
});
// La carta bajo el ratón se ve en grande
dlgPT.addEventListener("mouseover", e => {
  const zoom = $("#ptZoom"); if (!zoom || !PT) return;
  const x = e.target.closest(".pt-card"), [, c] = x ? buscarCarta(+x.dataset.u) : [];
  if (!c || c.abajo || !img(c.c) || e.target.closest(".pt-visor, .pt-mull")) { zoom.hidden = true; return; }
  zoom.innerHTML = `<img alt="" src="${esc(img(c.c, "large", c.f) || img(c.c, "large"))}">`; zoom.hidden = false;
});
dlgPT.addEventListener("keydown", e => {
  if (!PT || e.target.matches("input, textarea, select")) return;
  if (e.key === "Escape" && (PT.menu || PT.ver)) { e.preventDefault(); PT.menu = PT.ver = null; return pintarPrueba(); }
  if (PT.etapa !== "juego" || e.altKey) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); return deshacer(); }
  if (e.ctrlKey || e.metaKey) return;
  const acc = { d: () => robar(1), p: pasarFase, n: () => nuevoTurno(true), u: () => PT.z.bf.forEach(y => { y.t = false; }), s: () => barajar(PT.z.lib) }[k];
  if (acc) { e.preventDefault(); hacer(acc); }
});
dlgPT.addEventListener("cancel", e => { if (PT?.etapa === "juego" && !confirm("¿Salir de la partida de prueba?")) e.preventDefault(); });
dlgPT.addEventListener("close", () => { PT = null; dlgPT.innerHTML = ""; });
