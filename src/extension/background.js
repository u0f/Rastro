// Puente entre las pestañas de Rastro y la app local (busqueda/navegador.py).
// Recuerda qué pestañas son de Rastro por si Cloudflare pierde la marca #rastro= al recargar.
// La pestaña de Rastro vive en su propia ventana minimizada: solo se muestra si hay verificación
// (salvo que en Opciones de Rastro se elija ver la ventana: la app lo manda como "ocultar").
const SERVIDOR = "http://127.0.0.1:47321/pagina";

async function pestanas() {
  return (await chrome.storage.session.get("tabs")).tabs || {};
}
async function guardar(tabs) {
  await chrome.storage.session.set({ tabs });
}
async function ventanaRastro() {
  return (await chrome.storage.session.get("win")).win ?? null;
}

// Saca la pestaña a una ventana minimizada propia (si no está ya) o vuelve a minimizar la de Rastro
async function esconder(tab) {
  const win = await ventanaRastro();
  if ((await chrome.storage.local.get("ocultar")).ocultar === false) { // el usuario quiere verla
    if (tab.windowId === win) chrome.windows.update(win, { state: "normal" }).catch(() => {});
    return;
  }
  if (tab.windowId === win) return chrome.windows.update(win, { state: "minimized" }).catch(() => {});
  const nueva = await chrome.windows.create({ tabId: tab.id, state: "minimized", focused: false }).catch(() => null);
  if (!nueva) return;
  if (win != null) chrome.windows.remove(win).catch(() => {}); // pestaña antigua que quedó colgada
  await chrome.storage.session.set({ win: nueva.id });
}

async function cerrar(tab) {
  const win = await ventanaRastro();
  if (tab.windowId !== win) return;
  await chrome.storage.session.remove("win");
  chrome.windows.remove(win).catch(() => {});
}

// Escondida en cuanto empieza a cargar, sin esperar a que la página termine
chrome.tabs.onUpdated.addListener((id, cambio, tab) => {
  if (cambio.url?.includes("#rastro=")) esconder(tab);
});

chrome.runtime.onMessage.addListener((msg, sender, responder) => {
  (async () => {
    const tab = sender.tab, tabId = tab?.id;
    const tabs = await pestanas();
    if (msg.tipo === "hola") return responder({ token: tabs[tabId] || null });
    if (msg.token) { tabs[tabId] = msg.token; await guardar(tabs); }
    if (msg.tipo === "reto" && tab) {
      // Verificación de Cloudflare: se muestra la ventana para que la resuelvas
      chrome.windows.update(tab.windowId, { state: "normal", focused: true });
      chrome.tabs.update(tabId, { active: true });
    } else if (tab) {
      await esconder(tab);
    }
    try {
      const r = await fetch(SERVIDOR, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...msg, v: chrome.runtime.getManifest().version }) });
      const d = await r.json();
      if (d.ocultar != null && d.ocultar !== (await chrome.storage.local.get("ocultar")).ocultar) {
        await chrome.storage.local.set({ ocultar: d.ocultar });
        if (tab) esconder(tab);
      }
      const nuevo = d.url && d.url.match(/#rastro=([a-f0-9]+)/);
      if (nuevo) tabs[tabId] = nuevo[1];
      if (d.fin) delete tabs[tabId];
      await guardar(tabs);
      responder(d);
      if (d.fin && tab) cerrar(tab);
    } catch {
      delete tabs[tabId]; // Rastro no está buscando: la pestaña vuelve a ser normal
      await guardar(tabs);
      responder({ sinApp: true });
      if (tab) cerrar(tab);
    }
  })();
  return true; // respuesta asíncrona
});
