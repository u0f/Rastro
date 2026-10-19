// Rastro: Preguntar al juez. Chat de dudas de reglas de Magic respondidas por Claude con las Comprehensive Rules
// (juez.py busca las reglas relevantes y comprueba las citas). Usa las utilidades de app.js (S, $, esc, bridge…).
"use strict";

const JUEZ_EJEMPLOS = [
  "Si mi criatura tiene deathtouch y trample y la bloquea una 5/5, ¿cuánto daño puedo asignar al jugador?",
  "¿Puedo responder a un hechizo con split second?",
  "¿Qué pasa si mi comandante va al cementerio? ¿Y si lo exilian?",
  "¿En qué orden se aplican los efectos que cambian la fuerza y resistencia?",
];
let juezOcupado = false, juezBorrador = "";

// Al abrir Rastro (con la IA activada): descarga las normas si hay unas nuevas en la web de Wizards
async function comprobarNormas() {
  if (!bridge()) return;
  try { S.reglas = await bridge().reglas_actualizar(); } catch { }
  if (S.reglas?.nuevo && S.reglas.fecha) toast(`Normas de Magic descargadas (${S.reglas.fecha})`);
  if (S.view === "judge") render();
}

function renderJuez() {
  results.className = "results juez";
  $("#viewTitle").textContent = "Preguntar al juez";
  if (!S.opt.ia) {
    $("#resultCount").textContent = "Desactivado";
    results.innerHTML = empty("gavel", "Preguntar al juez está desactivado",
      "Resuelve dudas de reglas de Magic con las Comprehensive Rules oficiales y el texto y los rulings de las cartas, citando cada regla. Usa Claude Code instalado en este equipo: actívalo en Opciones → Inteligencia artificial.",
      `<div class="suggestions"><button class="btn primary" data-juez-opciones><svg class="ic"><use href="#i-settings"/></svg>Abrir Opciones</button></div>`);
    return;
  }
  const n = S.reglas;
  $("#resultCount").textContent = n?.hay ? `Comprehensive Rules del ${n.fecha}` : n ? "Sin normas descargadas" : "";
  const sinNormas = n && !n.hay;
  results.innerHTML = `<div class="juez-wrap">
    <p class="ia-aviso">${avisoIA()}</p>
    ${sinNormas ? `<p class="ia-aviso bad">${esc(n.error || "No se han podido descargar las normas de Magic.")} El juez las necesita: comprueba tu conexión y vuelve a abrir Rastro.</p>` : ""}
    <div class="juez-chat">${S.chat.length ? S.chat.map(mensajeJuez).join("") : `<div class="juez-intro">
        <p>Pregunta cualquier duda de reglas: interacciones entre cartas, la pila, el combate, las capas, Commander… El juez responde con las <b>Comprehensive Rules</b> oficiales y el texto Oracle y los rulings de las cartas, y cita cada regla para que puedas comprobarla.</p>
        <div class="juez-ejemplos">${JUEZ_EJEMPLOS.map(q => `<button class="btn sm" data-juez-ejemplo="${esc(q)}">${esc(q)}</button>`).join("")}</div></div>`}
      ${juezOcupado ? `<div class="juez-msg juez"><p class="muted">Buscando en las normas y consultando a Claude… suele tardar entre 15 y 30 segundos.</p>
        <button class="btn sm ghost" data-juez-cancelar>Cancelar</button></div>` : ""}
    </div>
    <form class="juez-form" id="juezForm" autocomplete="off">
      <textarea class="field area" id="juezTexto" rows="2" maxlength="2000" placeholder="Escribe tu duda de reglas… (Intro para enviar, Mayús+Intro para salto de línea)"${juezOcupado || sinNormas ? " disabled" : ""}>${esc(juezBorrador)}</textarea>
      <div class="juez-acciones">
        ${S.chat.length ? `<button type="button" class="btn sm ghost" data-juez-nueva${juezOcupado ? " disabled" : ""}>Nueva conversación</button>` : "<span></span>"}
        <button class="btn primary" id="juezGo"${juezOcupado || sinNormas ? " disabled" : ""}><svg class="ic"><use href="#i-gavel"/></svg>Preguntar</button>
      </div>
    </form></div>`;
  $("#scroller").scrollTop = $("#scroller").scrollHeight;
  if (!n && bridge()) bridge().reglas_estado().then(e => { if (!S.reglas) { S.reglas = e; if (S.view === "judge") render(); } }).catch(() => { });
}

// Un mensaje. En las respuestas, cada [702.19b] es un botón que despliega el texto real de esa regla (de las normas, no de la IA)
function mensajeJuez(m, k) {
  if (m.rol === "usuario") return `<div class="juez-msg usuario">${parrafos(m.texto)}</div>`;
  if (m.error) return `<div class="juez-msg juez"><p class="bad">${esc(m.error)}</p></div>`;
  const dudosas = new Set(m.sin_verificar || []);
  const texto = parrafos(m.texto).replace(/\[([\d.a-z,\s]+)\]/g, (todo, ids) => {
    const lista = ids.split(/,\s*/).filter(x => /^\d{3}\.\d+[a-z]?$/.test(x));
    return lista.length ? lista.map(id => `<button class="juez-cita${dudosas.has(id) ? " bad" : ""}" data-juez-cita="${k}-${id}" title="${dudosas.has(id) ? "Regla no comprobada" : "Ver la regla"}">${id}</button>`).join(" ") : todo;
  });
  const confianza = { alta: "Confianza alta", media: "Confianza media", baja: "Confianza baja: revísalo con cuidado" }[m.confianza];
  return `<div class="juez-msg juez${m.valido === false ? " fuera" : ""}">
    ${texto}
    ${m.aclaracion ? `<p class="juez-nota">${esc(m.aclaracion)}</p>` : ""}
    ${dudosas.size ? `<p class="juez-nota bad">Cita reglas que no estaban en las normas consultadas y no se han podido comprobar (${[...dudosas].map(esc).join(", ")}): no te fíes de esa parte.</p>` : ""}
    ${m.citas?.length ? `<div class="juez-citas">${m.citas.map(c => `<details id="cita-${k}-${esc(c.id)}"><summary>${esc(c.id)}</summary><p>${esc(c.texto).replace(/\n/g, "<br>")}</p></details>`).join("")}</div>` : ""}
    ${m.valido !== false ? `<p class="juez-pie">${confianza ? `<span class="juez-conf ${m.confianza}">${confianza}</span>` : ""}${m.cartas?.length ? ` · Cartas consultadas: ${m.cartas.map(esc).join(", ")}` : ""}${m.normas ? ` · Comprehensive Rules del ${esc(m.normas)}` : ""}</p>` : ""}
  </div>`;
}
const parrafos = t => (t || "").split(/\n+/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join("");

async function preguntarJuez(q) {
  q = q.trim();
  if (!q || juezOcupado) return;
  if (!bridge()) return toast("El juez solo funciona dentro de la app");
  // Comprobación rápida (sin gastar uso) de que claude está instalado y con sesión
  let e = null;
  try { e = await bridge().ia_estado(); } catch { }
  if (e && !e.ok) { S.chat.push({ rol: "usuario", texto: q }, { rol: "juez", error: `${e.error} Después, prueba la conexión en Opciones.` }); juezBorrador = ""; save(); render(); return; }
  const historial = S.chat.filter(m => m.texto && !m.error && m.valido !== false).slice(-6).map(m => ({ rol: m.rol, texto: m.texto }));
  S.chat.push({ rol: "usuario", texto: q });
  juezOcupado = true; juezBorrador = ""; render();
  let r = null;
  try { r = await bridge().juez_preguntar(q, historial); } catch { }
  juezOcupado = false;
  S.chat.push(r?.error || !r ? { rol: "juez", error: r?.error || "No se pudo hablar con Claude." } : { rol: "juez", ...r, texto: r.respuesta, respuesta: undefined });
  save();
  if (S.view === "judge") render();
  else toast("El juez ha respondido");
}

document.addEventListener("click", e => {
  if (S.view !== "judge") return;
  const t = e.target;
  let x;
  if (t.closest("[data-juez-opciones]")) return $("#btnOptions").click();
  if ((x = t.closest("[data-juez-ejemplo]"))) return preguntarJuez(x.dataset.juezEjemplo);
  if ((x = t.closest("[data-juez-cita]"))) {
    const d = document.getElementById(`cita-${x.dataset.juezCita}`);
    if (d) { d.open = true; d.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
    else toast("Esa regla no estaba en las normas consultadas: no se ha podido comprobar");
    return;
  }
  if (t.closest("[data-juez-cancelar]")) return bridge()?.ia_cancelar();
  if (t.closest("[data-juez-nueva]")) { if (confirm("¿Empezar una conversación nueva? Se borrará la actual.")) { S.chat = []; save(); render(); } }
});
document.addEventListener("submit", e => {
  if (e.target.id !== "juezForm") return;
  e.preventDefault();
  preguntarJuez($("#juezTexto").value);
}, true);
document.addEventListener("keydown", e => {
  if (e.target.id === "juezTexto" && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); preguntarJuez(e.target.value); }
});
document.addEventListener("input", e => { if (e.target.id === "juezTexto") juezBorrador = e.target.value; });
