<p align="center"><img src="assets/logo.png" width="96" alt="Logo de Rastro"></p>

<h1 align="center">Rastro</h1>

<p align="center">Encuentra tus cartas de Magic en las tiendas de Cardmarket que tú elijas y descubre dónde te salen más baratas.</p>

---

En Cardmarket, para saber qué tiene una tienda hay que buscar carta por carta. Rastro lo hace por ti: le das una lista de cartas (o un mazo entero) y tus tiendas favoritas, y te enseña en una sola tabla qué tiene cada tienda, a qué precio y dónde comprar cada carta para gastar menos.

## Qué incluye

- **Explorar**: al abrirlo ves las cartas más nuevas de Magic, página a página. Busca cualquier carta con filtros de color, tipo, coste, rareza, edición y formato. Mira su imagen, su texto, su legalidad y su precio. Las cartas que solo existen en foil se ven con brillo foil.
- **Mi lista**: añade cartas una a una o pega una lista completa (por ejemplo, una decklist de Moxfield, Arena o MTGO). Elige cuántas copias necesitas de cada una y, si quieres, marca solo las que quieras buscar.
- **Tiendas**: guarda los vendedores de Cardmarket en los que quieres comprar.
- **Buscar en tiendas**: Rastro revisa el stock de todas tus tiendas a la vez y respeta tus filtros (idioma, estado mínimo, foil y precio máximo).
- **Resultados**: una tabla con cada carta y cada tienda, con precio, estado, idioma, stock y enlace directo. La opción más barata sale resaltada, y arriba ves cuánto te costaría todo en cada tienda o comprando cada carta donde está más barata. Puedes exportarlo a Excel (CSV).
- **Mazos**: crea mazos de cualquier formato, incluido Commander. Pega la lista o el enlace de un mazo público de Moxfield y se importa entero. Cada mazo te muestra:
  - Cuánto vale y cuánto te falta por comprar.
  - Si es legal en su formato.
  - La curva de maná, los colores y los tipos de carta.
  - En Commander, el bracket estimado.
  - Los combos que hay dentro del mazo y los que tienes a una sola carta, con los pasos para hacerlos (datos de [Commander Spellbook](https://commanderspellbook.com)).

  Puedes cambiar el arte (la edición) de cualquier carta del mazo y elegir si es foil: al pasar el ratón por encima la verás con brillo foil. Marca las cartas que ya tienes y pulsa **Comprar lo que falta**: Rastro busca solo esas en tus tiendas.
- **Se actualiza solo**: cuando sale una versión nueva, Rastro la descarga y se reinicia sin que tengas que hacer nada. También puedes comprobarlo cuando quieras desde **Opciones → Buscar actualización**.

## Qué necesitas

- Windows 10 u 11.
- Como navegador predeterminado, uno de estos: **Chrome, Edge, Brave, Opera o Vivaldi**. Edge ya viene con Windows. Firefox no sirve.

## Instalación

1. Descarga **Rastro.exe** de la [última versión](https://github.com/u0f/Rastro/releases/latest).
2. Ábrelo. Si Windows muestra un aviso de SmartScreen, pulsa **Más información → Ejecutar de todas formas**. Sale porque la app es nueva y no está firmada.
3. La primera vez se abre el asistente de **Primeros pasos** para instalar la extensión que Rastro usa para leer Cardmarket. Solo hay que hacerlo una vez:
   1. Pulsa **Descargar extensión** y elige dónde guardarla (por ejemplo, en Documentos). Se crea la carpeta `Rastro-extension`. No la borres después: tu navegador la usa desde ahí.
   2. Pulsa **Copiar** y pega la dirección en la barra de tu navegador (por ejemplo, `edge://extensions` o `chrome://extensions`).
   3. Activa el **Modo desarrollador** en esa página.
   4. Pulsa **Cargar descomprimida** (en Edge se llama **Cargar desempaquetada**) y elige la carpeta `Rastro-extension`.
   5. Vuelve a Rastro y pulsa **Probar**. Cuando salga que funciona, pulsa **Continuar**.

Si alguna vez quitas la extensión o hay que actualizarla, Rastro te avisa y te lleva otra vez a estos pasos. También puedes abrirlos desde **Opciones → Primeros pasos**.

## Cómo se usa

1. **Añade tus tiendas** en **Tiendas**. Escribe el nombre de usuario del vendedor en Cardmarket o pega el enlace de su perfil.
2. **Añade cartas** a **Mi lista**: con el botón **+** desde Explorar, o con **Pegar lista**.
3. **Ajusta los filtros** de la izquierda si quieres: idioma, estado mínimo, foil y precio máximo. Si haces clic en una carta, puedes cambiar solo para ella las copias, el precio máximo, la edición o si la quieres foil.
4. Pulsa **Buscar**. Si has marcado algunas cartas, solo se buscan esas; si no, todas. Verás el progreso de cada tienda.
5. Mira **Resultados** y compra desde los enlaces directos a Cardmarket.

Con un mazo es todavía más rápido: ábrelo en **Mazos**, marca **Tengo** en las cartas que ya tienes y pulsa **Comprar lo que falta**.

### Mientras busca

- Rastro abre las páginas de Cardmarket en tu navegador, en una ventana minimizada que se cierra sola al terminar. Puedes seguir usando el navegador con normalidad.
- Si Cardmarket pide una verificación ("No soy un robot"), la ventana aparece para que la marques y la búsqueda sigue sola.
- Va página a página, con pausas, para no saturar Cardmarket. Si Cardmarket pide ir más despacio, Rastro espera y lo vuelve a intentar.
- Lo que ya has consultado en las últimas horas no se vuelve a pedir, así que repetir una búsqueda es casi instantáneo. Marca **Ignorar caché** si quieres datos recién sacados.

## Opciones

Con el botón de ajustes (arriba a la derecha) puedes cambiar:

- **Pausa entre páginas**: más pausa es más lento, pero Cardmarket te frenará menos veces.
- **Esperar a la extensión**: cuánto esperar antes de decidir que la extensión no está instalada.
- **Ver la ventana de búsqueda**: para ver las páginas mientras se leen en vez de tenerlas minimizadas.
- **Recordar páginas leídas**: cuántas horas se guarda lo consultado. También hay un botón para **vaciar la caché**.

El tema claro u oscuro se cambia con el botón del sol o la luna.

## Privacidad

- Todo se queda en tu PC: tu lista, tus mazos y tus tiendas se guardan en `%LOCALAPPDATA%\Rastro`. Rastro no tiene servidores ni cuentas.
- La extensión solo actúa en las pestañas que abre Rastro. Tu navegación normal no se toca.
- Rastro solo se conecta a Cardmarket (desde tu navegador), a [Scryfall](https://scryfall.com) para los datos de las cartas, a Moxfield si importas un mazo, a Commander Spellbook si buscas combos y a GitHub para buscar actualizaciones.
- Las visitas a Cardmarket se hacen con tu navegador y tu sesión, así que Cardmarket las ve como tuyas. Úsalo para uso personal y con calma.

## Preguntas frecuentes

**La prueba de la extensión no pasa.**
Comprueba que la extensión está activada en la página de extensiones de tu navegador y que cargaste la carpeta `Rastro-extension`. Si actualizaste Rastro, vuelve a pulsar **Descargar extensión** (puedes elegir la misma carpeta) y luego el botón de recargar de la extensión.

**Dice que mi navegador no es compatible.**
Rastro usa tu navegador predeterminado de Windows. Si es Firefox, pon como predeterminado Edge, Chrome o Brave y vuelve a abrir Rastro.

**Una tienda dice "No existe en Cardmarket".**
Revisa el nombre: tiene que ser el nombre de usuario exacto del vendedor, el que sale en la dirección de su perfil.

**¿Rastro compra por mí?**
No. Rastro solo busca y compara. La compra la haces tú en Cardmarket con los enlaces de Resultados.

---

Rastro no está afiliado a Cardmarket, Scryfall, Moxfield ni Wizards of the Coast. Magic: The Gathering es una marca de Wizards of the Coast.

¿Quieres colaborar o compilarlo tú? Mira las [notas de desarrollo](DESARROLLO.md).
