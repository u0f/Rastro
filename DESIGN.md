---
name: Rastro
description: A dense Magic card table, Moxfield's structure inside an Arena-style game client.
colors:
  felt-charcoal: "#111113"
  surface-1: "#19191c"
  surface-2: "#212125"
  surface-3: "#2a2a30"
  surface-hover: "#303037"
  inset-well: "#0c0c0e"
  rule: "#2e2e35"
  rule-strong: "#3f3f48"
  ink: "#ececf0"
  ink-2: "#a7a7b2"
  ink-3: "#787883"
  arcane-violet: "#9b6dff"
  arcane-violet-strong: "#b896ff"
  bronze: "#a8865a"
  bronze-hi: "#d9b77f"
  plate-orange-top: "#ffb24d"
  plate-orange-bottom: "#e8720e"
  plate-edge: "#8a3d00"
  plate-ink: "#241000"
  chrome-ink: "#f3eee6"
  chrome-ink-muted: "#a2a0a8"
  ok: "#5fb878"
  warn: "#e0a640"
  bad: "#e2574c"
  mana-w: "#f8f1d4"
  mana-u: "#4b9cd3"
  mana-b: "#8a7694"
  mana-r: "#d95b50"
  mana-g: "#65a875"
  mana-c: "#a7adb8"
  rar-common: "#9aa1ad"
  rar-uncommon: "#a9c4d8"
  rar-rare: "#d4af67"
  rar-mythic: "#e5793f"
  light-bg: "#ecebe8"
  light-surface-1: "#ffffff"
  light-surface-2: "#f5f4f1"
  light-rule: "#dcd9d2"
  light-ink: "#18181b"
  light-ink-2: "#4e4e57"
  light-violet: "#6a3fd6"
  light-violet-strong: "#5530b8"
  light-bronze: "#8e6c3e"
typography:
  display:
    fontFamily: "Marcellus, Segoe UI Variable Display, serif"
    fontSize: "34px"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Marcellus, Segoe UI Variable Display, serif"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.02em"
  title:
    fontFamily: "Marcellus, Segoe UI Variable Display, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.02em"
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.45
  body-sm:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 700
    lineHeight: 1.2
  tab-label:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.01em"
  mono:
    fontFamily: "Cascadia Mono, Consolas, ui-monospace, monospace"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  xs: "2px"
  sm: "3px"
  md: "4px"
  lg: "6px"
  xl: "8px"
  card: "4.75% / 3.5%"
  pill: "999px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "40px"
components:
  button-primary:
    backgroundColor: "{colors.plate-orange-bottom}"
    textColor: "{colors.plate-ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-secondary:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  field:
    backgroundColor: "{colors.inset-well}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  chip-filter:
    backgroundColor: "{colors.inset-well}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "0 9px"
    height: "26px"
  nav-tab:
    textColor: "{colors.chrome-ink-muted}"
    typography: "{typography.tab-label}"
    padding: "9px 10px 8px"
    height: "64px"
  deck-name-plate:
    textColor: "{colors.chrome-ink}"
    typography: "{typography.title}"
    rounded: "0 0 4px 4px"
    padding: "8px 12px"
  deck-row:
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "2px 4px"
    height: "28px"
---

# Design System: Rastro

## Overview

**Creative North Star: "The Card Table"**

Rastro is a game table, not a dashboard. The structure is Moxfield's: a filter rail on the left, dense lists, decks organized into type columns. The atmosphere is MTG Arena's: a dark client frame across the top, bronze-edged plates, one lit orange plate for the action that matters. Surfaces are charcoal felt, corners are nearly square, and the color in the room comes from the real card art. Chrome stays out of the way.

Density is deliberate. A player scanning 60 to 100 cards needs list rows of 28px and card grids with 16 to 24px gutters. Any padding beyond that is wasted space. Depth comes from tonal surface steps and solid 1px rules, with shadows reserved for physical objects: cards, deck boxes, floating panels. Violet answers the question "what is selected or interactive"; orange answers "what do I do next"; bronze answers "this is a frame". The three never swap jobs.

The system ships in two themes. Dark is the default and the normative world. Light swaps the felt for warm paper (light-bg, light-surface-1) and deepens violet and bronze for contrast. The top bar and modal headers stay dark in both themes because they are the client frame. Interface copy is Spanish.

**Key Characteristics:**
- Arena-style dark top bar with icon-over-label tabs and a lit orange edge under the active tab, dark in both themes.
- Moxfield filter rail (248px) on the left, card-image grid as the Explorar hero, optional 400px detail panel on the right.
- Charcoal tonal layering (bg, surface-1/2/3, inset wells) separated by 1px rules.
- Near-square corners (2-8px); cards keep their own proportional printed-card radius.
- Solid 1px bronze lines on the table's frames: top-bar edge, deck tiles, deck hero, type-column headings.
- Marcellus (weight 400 only) for names of decks, views, cards and panels; Segoe UI Variable for everything else.
- Official Scryfall SVG mana symbols, with a CSS letter-circle fallback in mana colors.

## Colors

Charcoal felt and bronze trim, with a violet working accent and a single orange action plate. All the saturated color comes from the cards themselves.

### Primary
- **Arcane Violet** (arcane-violet; light theme light-violet): selection, links, focus rings, carets, `::selection`, the active filter chip and mana toggle, the selected card outline, the add-to-list button when the card is already in the list, and the mana-curve bars. Its strong variant (arcane-violet-strong / light-violet-strong) is used for link text, hovered card names, quantities and tags. A soft wash (14% dark, 10% light) fills selected rows and active chips, and a 50% line borders them.

### Secondary
- **Plate Orange** (plate-orange-top to plate-orange-bottom, vertical gradient, plate-edge border, plate-ink text): the Arena action plate. It appears on the one primary button per screen, the lit underline and icon of the active top-bar tab, the active tab's count badge, progress bars and spinners, and the "best price" tag. It is never used as a background for surfaces or as a link color.

### Tertiary
- **Frame Bronze** (bronze, highlight bronze-hi; light theme light-bronze): the frames of the table. Solid bronze draws the 1px edge under the top bar, the borders of deck-box tiles and their name plates, the bottom edge of the deck hero, and the rule under each type-column heading. Translucent bronze (`--bronze-line`, 55% dark / 50% light) frames secondary containers such as modals, the run bar, the judge form, empty-state badges and shop avatars. Bronze-hi is used as text color only on bronze-framed badges, numerals and avatars.

### Neutral
- **Felt Charcoal** (felt-charcoal): the app background, the play mat.
- **Surface steps** (surface-1, surface-2, surface-3, surface-hover): panels and detail pane, then hover rows and image placeholders, then secondary buttons and the selected segment, then the hover state. Each step is about 8 levels lighter than the one below it.
- **Inset Well** (inset-well): fields, segmented controls, filter chips, rules-text boxes. Inputs sit sunk into the table, darker than the surface around them. In the light theme the well is white.
- **Rules** (rule, rule-strong): every 1px divider and default border; rule-strong is used for hover borders and secondary-button outlines.
- **Ink** (ink, ink-2, ink-3): primary text, secondary text and labels, then tertiary metadata, placeholders and counts.
- **Chrome ink** (chrome-ink, chrome-ink-muted): fixed light text on the always-dark chrome (brand name, deck name plates, format tags, idle tabs and top-bar icons). These values do not change with the theme because the chrome does not.

### Domain colors
- **Mana** (mana-w/u/b/r/g/c): letter-pip fallbacks, the color-identity bar and mana charts. The white pip uses dark ink (#3b3320).
- **Rarity** (rar-common/uncommon/rare/mythic): 8px rarity dots and rarity chips only. The light theme darkens common, uncommon and rare.
- **State** (ok, warn, bad): owned/complete, missing/pending, error/illegal. They are applied as text color, or as a 12-15% wash with a 35% border on alerts and condition tags.

### Named Rules
**The Three Jobs Rule.** Violet selects, orange acts, bronze frames. Never use violet for a call to action, orange for selection, or bronze for anything interactive.

**The One Plate Rule.** Each screen gets at most one orange-gradient primary button. Everything else is a charcoal secondary button or a ghost button.

**The Cards Bring the Color Rule.** Surfaces stay neutral charcoal or paper. Saturation belongs to card art, mana symbols and rarity, never to large chrome areas.

## Typography

**Title Font:** Marcellus (self-hosted woff2, latin and latin-ext, SIL OFL; falls back to Segoe UI Variable Display, then serif)
**Body Font:** Segoe UI Variable Text (falls back to Segoe UI, then system-ui)
**Mono Font:** Cascadia Mono (falls back to Consolas); used for pasted decklists and inline code

**Character:** Marcellus has open, inscription-like serifs, so a deck name reads like an engraved plate. Segoe UI Variable is the native Windows 11 working face and stays dense and neutral under it.

### Hierarchy
- **Display** (Marcellus 400, 34px, 1.15, +0.01em; 24px under 860px): the editable deck name on the deck hero. Only this element uses it.
- **Headline** (Marcellus 400, 21px, 1.2-1.3, +0.01-0.02em): view titles in the toolbar, card names in the detail pane, empty-state headings. Modal titles use 18px at +0.03em, and the brand wordmark uses 19px at +0.04em.
- **Title** (Marcellus 400, 17px, 1.2, +0.02em): deck names on shelf tiles; the AI panel name uses 18px.
- **Body** (Segoe 400, 13.5px, 1.45): the default for the whole app and for deck rows. Rules text uses 1.6 line height inside an inset well.
- **Body small** (Segoe 400-600, 12.5px): metadata, card set lines, buttons, chips, the deck hero meta line, panel content.
- **Label** (Segoe 600-700, 12.5px, 1.2, sentence case, ink-2): filter group headings, detail section headings, deck panel headings. Type-column headings use 700 at 13.5px with a bronze underline.
- **Tab label** (Segoe 600, 11.5px, 1, +0.01em): top-bar tab captions under 22px icons.
- **Numerals**: prices, counts, quantities and mana-curve values always use `font-variant-numeric: tabular-nums`.

The scale is a fixed px ramp (11.5 / 12.5 / 13.5 / 15 / 19 / 30) sized for a desktop window from 1366x768 up, not a fluid clamp.

### Named Rules
**The Engraved Name Rule.** Marcellus is only for names (deck, view, card, panel, brand) and is only set at weight 400. `font-synthesis: none` is set globally, so never request bold or italic Marcellus. Hierarchy comes from size and tracking.

**The Sentence-Case Label Rule.** Section labels are sentence-case Segoe at 600-700 in ink-2. Weight and color carry the hierarchy, not capitals or tracking.

## Layout

The app is a fixed three-column shell under a 64px top bar: a filter rail (248px), fluid content, and a detail pane (400px) that opens on demand. Columns animate through `grid-template-columns`. The rail hides itself when a view has no filters, and the deck editor keeps a rail toggle. On the deck shelf the offer filters are hidden.

- **Spacing** follows a 4px base: 4 / 8 / 12 / 16 / 24 / 40. Content padding is 16px top and 24px sides; toolbars are at least 56px tall.
- **Card grid**: `auto-fill, minmax(168px, 1fr)` with 24px row gaps and 16px column gaps (138px minimum under 860px). Cards use the printed 63:88 ratio.
- **Compact list**: a single bordered table of 42px rows with zebra striping, a 46x32 art thumbnail, and a hover preview of the full card at 244px.
- **Deck shelf**: `auto-fill, minmax(230px, 1fr)` grid of deck-box tiles with 16:10 art.
- **Deck editor**: a full-bleed art banner (minimum 150px) that breaks out of the content padding, then the action row, then the buy bar, then a two-column body of type columns plus a 250px sticky side column (statistics, preview). Type columns are CSS multi-column (`columns: 330px`, 24px gap) with `break-inside: avoid`. When a column is narrower than 320px a container query hides the mana cost.
- **Responsive**: under 1240px tab labels collapse to icons. Under 1180px the detail pane floats over the content with a scrim. Under 1100px the deck body becomes a single column. Under 860px the rail becomes an off-canvas drawer and the brand name and Ctrl K hint are hidden.

## Elevation & Depth

Depth is mostly tonal: felt, then surfaces, then inset wells, separated by 1px rules. Shadows are reserved for physical objects (cards, deck boxes, the card preview) and for things that float (popovers, modals, the off-canvas rail and detail pane, the update banner). The top bar casts one ambient shadow beneath its bronze edge.

### Shadow Vocabulary
- **Card rest** (`0 2px 5px rgba(0,0,0,.55)` dark): every card image and deck box at rest.
- **Card lifted** (`0 14px 28px rgba(0,0,0,.7)` dark): hovered card, together with `translateY(-4px)`.
- **Floating** (`0 18px 44px rgba(0,0,0,.65)` dark): suggestion popover, modals, card preview, detail image, floating drawers.
- **Panel** (`0 6px 16px rgba(0,0,0,.45)` dark): the store-search run bar.
- **Frame edge** (`0 1px 0 var(--bronze), 0 6px 18px rgba(0,0,0,.35)`): the top bar only.

Light-theme shadows use a warm ink (rgba(30,24,10, .08-.28)) instead of black.

### Named Rules
**The Objects Cast Shadows Rule.** Cards, deck boxes and floating layers cast shadows. Panels, rows, chips and buttons sit flat on the felt; the orange plate's 2px drop is the only exception.

## Shapes

Corners are nearly square, like a tool table: 2px for tags and micro-controls, 3px for chips and small buttons, 4px for buttons, fields and panels, 6px for modals and the judge form, and 8px at most. Cards are the exception and keep a proportional printed-card radius (`4.75% / 3.5%`) at every size. Circles are used only for mana symbols, mana toggles, rarity dots, avatars, step numbers and the bracket badge. The pill radius is used only for top-bar count badges.

A deck box has two parts: an art window rounded on the top corners only, and a name plate rounded on the bottom corners only, joined with no gap and framed together in solid bronze.

## Components

### Buttons
Small, flat and dense. The orange plate is the only loud object.
- **Shape:** 4px radius (3px for the 28px small size), 32px tall, 12px horizontal padding, 12.5px text at weight 600, optional 15px line icon.
- **Primary (the plate):** a vertical gradient from plate-orange-top to plate-orange-bottom, a 1px plate-edge border, plate-ink text at 700, and a soft drop shadow (`0 2px 6px rgba(0,0,0,.35)`). It has no bevel or inner highlight. Hover brightens it to 1.08; active darkens it to 0.94.
- **Secondary:** surface-3 fill with a rule-strong border. On hover the fill moves to surface-hover and the border to ink-3.
- **Ghost:** transparent, ink-2 text; surface-hover fill on hover.
- **Danger:** a ghost button with bad text and a 14% bad wash on hover.
- **Icon button:** 32px square (26px small), transparent, ink-2, surface-hover on hover.

### Chips
- **Filter chip:** 26px tall, 3px radius, inset-well fill, 1px rule border, ink-2 text. When on, it gets a violet border, a violet soft wash and ink text.
- **Active-filter chip:** violet soft wash with a violet-line border and a small square remove button. "Clear all" is a transparent chip with a dashed rule-strong border.
- **Segmented control:** an inset-well track with 2px padding. The selected segment is surface-3 with an inset rule-strong ring.
- **Mana toggles:** 32px circles holding the official symbol, desaturated to 35% opacity when off. When on they get a violet border and wash.

### Cards / Containers
- **Card tile:** the card image is the whole tile, at the 63:88 ratio with the card radius and card-rest shadow. On hover it lifts 4px with the lifted shadow. When selected it gets a 2px violet outline offset 2px. A square add button (28px, 4px radius, translucent overlay-ink) appears in the top-right corner on hover; it turns violet once the card is in the list. Under the image sit the name (600) and a set line with a right-aligned tabular price. Cards deal in with a fade, a 10px rise and a 1-degree tilt, staggered 14ms each.
- **Panels:** surface-1, 1px rule border, 4px radius, 12px by 16px padding, label-style heading.
- **Inset wells:** rules text and card filters sit in inset-well boxes with a rule border.
- **Modals:** surface-1 body with a translucent bronze frame, 6px radius and the floating shadow. The sticky header uses the dark top-bar gradient with chrome ink and an 18px Marcellus title. The backdrop is the scrim.

### Inputs / Fields
- **Style:** 32px tall, inset-well fill, 1px rule border, 4px radius, 10px padding, ink-3 placeholder. Hover moves the border to rule-strong.
- **Focus:** the border turns violet with a 3px violet-soft ring and no outline.
- **Disabled:** 55% opacity with a not-allowed cursor.
- **Top-bar search:** a 36px dark well (#0d0d0f, border #3a3840) with a 16px search icon and a Ctrl K hint. It stays dark in both themes and uses the same violet focus.

### Navigation
- **Top bar:** 64px tall, a vertical charcoal gradient (dark in both themes), a solid bronze 1px bottom edge, the logo and Marcellus wordmark on the left, then tabs, then search on the right.
- **Tabs:** a 22px line icon (stroke 1.7) over an 11.5px caption, at least 74px wide. Idle tabs use chrome-ink-muted and get a 4% white wash on hover. The active tab has white text, an orange icon, a faint orange glow rising from the bottom, and a 3px orange gradient edge that scales in from the center (240ms ease-out). Count badges are small pills and turn orange on the active tab.
- **Filter rail:** sidebar background, 1px right rule, groups separated by rules with 12-16px padding and label headings.

### Deck Box (signature)
A shelf tile shaped like an Arena deck box. A 16:10 art crop sits in a solid bronze frame (rounded top corners, dark top fade so the format tag and color pips stay readable). Below it hangs the name plate: the dark top-bar gradient, a 1px bronze frame with a bronze-hi top edge, and the deck name in 17px Marcellus in chrome ink. On hover the tile rises 3px, the art zooms to 1.04 and both frames brighten to bronze-hi. Owned and missing counts follow in body small with ok and warn colors.

### Deck Hero and Type Columns (signature)
The deck editor opens on full-bleed card art, set at center 28% with `cover`. Two gradients fade it into the background color: from the left toward the text, and from the bottom. A solid bronze rule closes the banner. Inside it are a back link, the editable deck name (34px Marcellus as a borderless input that shows a rule-strong border on hover and violet on focus), a meta line of dot-separated facts (format select, color pips, card count, owned/missing in ok/warn), and nothing else. Below the banner come the action row, the buy bar (a surface-1 strip with the single orange plate), then the type columns. Each type heading is 13.5px Segoe 700 with a count in parentheses and a solid bronze underline. Rows are 28px: owned checkbox, quantity, name, cost, tabular price. Row tools (quantity steppers, zone select, actions) are hidden until hover or focus, when they fade in over the price on a surface-2 gradient. Owned cards dim to ink-3; illegal cards turn bad.

### Mana Symbols
Mana symbols are the official Scryfall SVGs (`svgs.scryfall.io/card-symbols/{X}.svg`), 17px by default, scaled with `--pip`, with a 1px drop shadow. If a symbol fails to load, it falls back to a CSS circle filled with the mana color and the letter at 56% of the circle size. Hybrid symbols split diagonally.

## Do's and Don'ts

### Do:
- **Do** route every value through the tokens in theme.css; the stylesheets say components use only these variables.
- **Do** keep the top bar and modal headers dark in the light theme; they are the client frame.
- **Do** use solid bronze (`--bronze`) for the table's frames (top-bar edge, deck boxes, deck hero, type-column rules) and translucent bronze (`--bronze-line`) for secondary containers.
- **Do** keep exactly one orange plate per screen and use violet for every selected, focused or linked state.
- **Do** let real card art carry the screen: card grids as the hero, art banners and deck boxes cropped from card art.
- **Do** keep rows dense: 28px deck rows, 42px list rows, 32px controls; reveal row tools on hover and focus, never all at once.
- **Do** use tabular numerals for every price, count and quantity.
- **Do** honor `prefers-reduced-motion`, which collapses deal, slide and foil animations to 1ms.

### Don't:
- **Don't** set Marcellus in any weight other than 400 or synthesize bold or italic.
- **Don't** add stat strips or rounded stat cards to the deck editor; deck facts belong in the hero meta line.
- **Don't** add bevels, inner highlights or hard offset shadows to the orange plate or to any surface.
- **Don't** round corners past 8px on chrome; only cards keep their printed-card radius.
- **Don't** draw mana as glyphs or text in place of the Scryfall SVGs except through the CSS letter-circle fallback.
- **Don't** add uppercase tracked kicker labels above headings; section labels are sentence case.
- **Don't** use orange for selection or violet for the primary action.
