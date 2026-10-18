// Se ejecuta en cada página de Cardmarket, pero solo actúa en pestañas abiertas por Rastro.
(async () => {
  const enviar = msg => new Promise(ok => chrome.runtime.sendMessage(msg, ok));
  const marca = location.hash.match(/rastro=([a-f0-9]+)/);
  const token = marca ? marca[1] : (await enviar({ tipo: "hola" }))?.token;
  if (!token) return; // navegación normal del usuario: no se toca

  const titulo = document.title.toLowerCase();
  const texto = (document.body?.innerText || "").slice(0, 3000).toLowerCase();
  let msg;
  if (/just a moment|un momento|un instant|einen moment/.test(titulo)) {
    await enviar({ tipo: "reto", token }); // al resolverla, la página se recarga y este script vuelve a correr
    return;
  } else if (/attention required|access denied|you have been blocked/.test(titulo)) {
    msg = { tipo: "bloqueado", token };
  } else if (/rate limited|too many requests|error 1015/.test(texto)) {
    msg = { tipo: "limite", token };
  } else {
    msg = { tipo: "datos", token, datos: extraer() };
  }

  aviso("Rastro está leyendo esta página…");
  let r = await enviar(msg);
  while (r?.esperar) r = await enviar({ tipo: "esperar", token }); // aún no hay siguiente página
  if (r?.url) location.href = r.url;
  else if (r?.fin) {
    history.replaceState(null, "", location.pathname + location.search);
    aviso("Rastro: búsqueda terminada. Puedes cerrar esta pestaña.");
  } else if (r?.sinApp) aviso("Rastro no está buscando ahora mismo.");

  // Misma lectura que hace el adaptador de Cardmarket (busqueda/tiendas/cardmarket.py)
  function extraer() {
    return {
      url_final: location.origin + location.pathname + location.search,
      paginas: +((document.querySelector(".pagination")?.textContent.match(/of\s+(\d+)/) || [])[1] || 1),
      hits: +(document.querySelector(".total-count")?.textContent || 0),
      // En el perfil: total exacto de cartas a la venta (en las ofertas solo pone "2000+")
      singles: +(document.querySelector('a[href$="/Offers/Singles"] .bracketed')?.textContent.replace(/\D/g, "") || 0) || null,
      filas: [...document.querySelectorAll("#UserOffersTable .article-row")].map(r => {
        const attrs = r.querySelector(".product-attributes");
        const labels = attrs ? [...attrs.querySelectorAll("[aria-label],[data-bs-original-title]")]
          .map(e => e.getAttribute("aria-label") || e.getAttribute("data-bs-original-title")) : [];
        const a = r.querySelector(".col-seller a");
        const exp = r.querySelector(".expansion-symbol");
        return {
          nombre: a ? a.textContent.trim() : "",
          edicion: exp ? exp.getAttribute("aria-label") : "",
          estado: r.querySelector(".article-condition .badge")?.textContent.trim() || "", labels,
          precio: r.querySelector(".price-container .color-primary")?.textContent.trim()
            || ((r.querySelector(".price-container, .col-offer") || r).textContent.match(/\d[\d.]*,\d{2}\s*€/) || [""])[0],
          cantidad: r.querySelector(".amount-container .item-count")?.textContent.trim() || "1",
          comentario: r.querySelector(".product-comments")?.textContent.trim() || "",
        };
      }),
    };
  }

  function aviso(texto) {
    let el = document.getElementById("rastro-aviso");
    if (!el) {
      el = document.createElement("div");
      el.id = "rastro-aviso";
      el.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;padding:10px 14px;border-radius:10px;" +
        "background:#171c26;color:#e9ecf2;font:500 13px/1.4 'Segoe UI',system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.35);border:1px solid #d9a94e";
      document.documentElement.appendChild(el);
    }
    el.textContent = texto;
  }
})();
