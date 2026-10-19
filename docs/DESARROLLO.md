# Rastro: notas de desarrollo

Lo técnico: cómo publicar versiones, cómo busca y qué hace cada archivo. La guía para usuarios está en el [README](../README.md).

## Publicar versiones (actualización automática)

El `.exe` se actualiza solo: al abrirse mira la última Release del repositorio de GitHub (`REPO` en `src/actualizar.py`). Si su etiqueta es mayor que `VERSION`, descarga el `Rastro.exe` adjunto, lo cambia por el actual y se reinicia. Si no hay conexión o no hay Releases, sigue con la versión que tiene. Desde el código fuente (`Rastro.bat`) no se actualiza nada.

Para publicar:
1. Sube `VERSION` en `src/actualizar.py` (por ejemplo, `1.1.0`). La primera vez, rellena también `REPO` (`usuario/repositorio`).
2. Ejecuta `build.bat` (necesita `py -m pip install pyinstaller pywebview`). Deja el archivo en `dist\Rastro.exe`.
3. En GitHub crea una Release con la etiqueta `v1.1.0` y adjunta `dist\Rastro.exe` con ese nombre exacto.

Si cambias la extensión, sube su `version` en `extension/manifest.json`. Rastro compara la versión instalada con la que trae y, si no coinciden, avisa para volver a descargarla (la prueba de Primeros pasos tampoco pasa).

## Cómo busca (y por qué así)

- **Por qué en tu navegador**: Cardmarket no tiene API abierta (no admite solicitudes nuevas) y su buscador de stock no acepta varias cartas a la vez. Además, Cloudflare bloquea las peticiones sin navegador y deja atascados los navegadores automatizados (Playwright). Por eso Rastro usa el **modo asistido**:
  - Abre las páginas en **tu navegador predeterminado**, en **una sola pestaña** que va reutilizando, como si hicieras clic en un enlace. La extensión la mueve al momento a una **ventana minimizada** propia (Rastro vuelve delante) y la cierra al terminar.
  - La extensión lee la tabla de ofertas y se la pasa a la app por `127.0.0.1:47321`. La respuesta le dice a qué página ir después.
  - Solo actúa en pestañas abiertas por Rastro (marca `#rastro=` en la URL). Tu navegación normal no se toca.
- **Inventario o por carta**: para cada tienda se mira primero cuántas páginas ocupa su stock (20 artículos por página).
  - Si son menos que las cartas buscadas, lee el inventario completo y cruza en local.
  - Si no, hace una consulta por carta.
- **Cortesía**: una página cada vez, con al menos 1,5 s entre una y otra. No hay proxies, no se aleatoriza el ritmo y no se disimula nada.
- **"Demasiadas peticiones"**: todo el sitio espera 15, 30, 60 y 120 s. Si sigue fallando, se rinde.
- **Captcha**: la extensión muestra la ventana minimizada y la app lo avisa. Al resolverla se vuelve a minimizar. Lo resuelves tú y la búsqueda sigue sola.
- **Caché**: lo consultado en las últimas 6 h no se vuelve a pedir. Si todo está en caché, no se abre ninguna pestaña. Marca **Ignorar caché** para forzar datos frescos.
- **Ojo**: como son tu navegador y tu sesión, Cardmarket ve esas visitas como tuyas. Úsalo a este ritmo y para uso personal.

## Arquitectura

En la raíz solo están los lanzadores (`Rastro.bat` en Windows, `Rastro.command` en Mac), `build.bat` y los documentos. El código está en `src/` y estas notas en `docs/`. Las rutas de la tabla son relativas a `src/`.

| Archivo | Qué hace |
|---|---|
| `actualizar.py` | Actualización automática: `VERSION`, `REPO`, comparación con la última Release de GitHub y cambio del `.exe` en uso (el viejo queda como `Rastro.old.exe` y se borra al siguiente arranque). |
| `assets/` | Logo: `logo.py` lo dibuja y genera `logo.png`, `logo.ico` (icono del `.exe`), `ui/logo.png` y `extension/iconos/`. |
| `../build.bat` | Crea `dist\Rastro.exe` con PyInstaller. |
| `app.py` | Ventana (pywebview). Expone a JS (`window.pywebview.api`) el estado, la búsqueda, la extensión, Moxfield, la caché y el CSV. Reenvía los eventos de búsqueda a `onMotor(...)` en la interfaz. |
| `juez.py` | Preguntar al juez. Descarga las Comprehensive Rules (`.txt` enlazado en magic.wizards.com/en/rules) a `reglas/` al abrir Rastro con la IA activada, solo si el enlace cambió, y las lee en reglas, títulos y glosario. Cada pregunta va en tres pasos: `ANALISTA` (haiku) saca cartas, secciones del índice real y términos en inglés; `reunir()` y `cartas()` juntan en local las reglas exactas, el glosario, una búsqueda por palabras y, de Scryfall, Oracle, rulings y legalidad; `JUEZ` (sonnet) responde citando solo esas reglas. Las citas que no estaban en las fuentes se devuelven en `sin_verificar`. |
| `ia.py` | Asistente IA de mazos. Ejecuta `claude -p` (Claude Code) en segundo plano, encapsulado: sin herramientas, MCP ni ajustes del usuario (`--tools "" --strict-mcp-config --setting-sources ""`), en una carpeta temporal, con prompt de sistema fijo y `--json-schema` obligatorio. Las tareas y sus prompts están en `TAREAS`; la interfaz solo elige una. `estado()` lee `claude auth status` (instalado, sesión y si es suscripción Pro/Max/… o API de pago por uso, sin gastar uso) y se llama antes de cada tarea; `probar()` hace además una petición real, y su resultado queda guardado en `estado.json` (`iaPrueba`). Contexto: la interfaz manda la ficha del mazo (`fichaMazo`: texto oficial de Scryfall de cada carta) y las estadísticas, el bracket y los combos (`contextoMazo`); `edhrec()` añade lo que juega la comunidad con ese comandante (la variante `/budget` en las tareas de precio). La respuesta se valida en `mazos.js` (`limpiarIA`) y las cartas se comprueban en Scryfall antes de aplicarlas. |
| `busqueda/__init__.py` | Orquestador. Lanza todas las tiendas a la vez en un hilo con asyncio, aísla los fallos de cada tienda y emite eventos: `plan`, `progreso`, `resultado`, `no_tienda`, `tienda_fin`, `espera`, `captcha`, `extension`, `error`, `fin`. |
| `busqueda/navegador.py` | Modo asistido: servidor local para la extensión, cola de páginas (una pestaña), límites por dominio, backoff, captcha y caché. Abre las URLs en el navegador predeterminado y detecta cuál es (`navegador_usado`). |
| `busqueda/cache.py` | Caché SQLite con caducidad (`TTL`, 6 h por defecto). |
| `busqueda/tiendas/__init__.py` | Registro de adaptadores y su contrato (qué métodos y eventos debe tener uno nuevo). |
| `busqueda/tiendas/cardmarket.py` | Adaptador de Cardmarket: URLs con filtros, elección inventario/por carta y filtrado local. `intervalo` fija su ritmo. |
| `extension/` | Extensión para navegadores Chromium (MV3). `content.js` lee la tabla de ofertas (función `extraer`) y avisa de captchas; `background.js` habla con la app, recuerda qué pestañas son de Rastro y las mantiene en una ventana minimizada salvo con captcha. |
| `ui/theme.css` | Único archivo de tema: colores (oscuro y claro), fuentes, espaciado, radios y sombras. |
| `ui/app.css` | Componentes y layout. |
| `ui/index.html` | Estructura e iconos. |
| `ui/mazos.js` | Mazos: formatos, lectura de listas con secciones, legalidad, curva, bracket, combos (Commander Spellbook `find-my-combos`, pedido desde `app.py` por CORS), asistente IA (`ia.py`) y compra de lo que falta. Usa las utilidades de `app.js`. |
| `ui/juez.js` | Vista Preguntar al juez: chat, citas que despliegan el texto real de cada regla y comprobación de normas al arrancar (`comprobarNormas`). |
| `ui/app.js` | Interfaz: Scryfall (búsqueda, autocompletado y `/cards/collection` para listas pegadas), Mi lista, progreso, Resultados, Tiendas y detalle. |

**Añadir otro sitio**: crea `busqueda/tiendas/otrositio.py` con una clase como `Cardmarket` (`sitio`, `dominio`, `pestanas`, `intervalo`, `enlace()`, `buscar()`) y regístrala en `busqueda/tiendas/__init__.py`. Añade también su lector en `extension/content.js` y su dominio en `extension/manifest.json`. En la lista de tiendas se escribe como `otrositio:usuario`. Las que no llevan prefijo son de Cardmarket.

En Mac se ejecuta desde el código con `Rastro.command`: crea un entorno de Python en `~/Library/Application Support/Rastro/python`, instala `pywebview` y abre `src/app.py`. Las diferencias con Windows (navegador predeterminado, abrir archivos, portapapeles, carpeta de datos) están en `busqueda/navegador.py` (`_predeterminado`, `abrir`) y `app.py` (`MAC`).

Datos en `%LOCALAPPDATA%\Rastro\` (en Mac, `~/Library/Application Support/Rastro/`):
- `estado.json`: lista, mazos, tiendas, filtros, opciones, últimas ofertas y la conversación con el juez.
- `reglas\`: las Comprehensive Rules descargadas y `reglas.json` (cuál es y cuándo se comprobó).
- `cache.sqlite`: páginas ya leídas.
- `webview\`: caché de la interfaz e imágenes.

Requisitos para ejecutarlo desde el código (`Rastro.bat`): Python 3 con `pip install pywebview`, un navegador predeterminado Chromium (Chrome, Edge, Brave…) con la extensión instalada y WebView2 (ya viene con Windows 11). Playwright ya no hace falta.
