# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Magic: The Gathering players in Europe who build decks and buy singles on Cardmarket. Both jobs weigh the same in daily use: building and tuning decks, and finding where to buy the cards they are missing at the lowest price among the sellers they trust.

## Product Purpose

Rastro is a Windows desktop app (pywebview over a local HTML/CSS/JS interface) that searches the stock of the user's chosen Cardmarket sellers in one pass, shows which seller has each card and at what price, and works out the cheapest way to buy a list or a whole deck. Around that it offers a card browser, deck building and analysis, playtesting, an AI deck assistant and an AI rules judge. Success: the user goes from a deck idea to a priced shopping plan without searching card by card.

## Positioning

Cardmarket only lets you search one card at a time per seller. Rastro reads many sellers at once through the user's own browser (assisted mode with a small extension) and compares them in one table, joined to deck building that knows what the user already owns.

## Operating Context

- Runs on Windows 10/11 as `Rastro.exe`; also from source on Mac. Window sizes from 1366×768 to large monitors.
- Card data and images come from Scryfall; combos from Commander Spellbook; rules from Wizards' Comprehensive Rules; AI through the user's local Claude Code.
- Users paste decklists from Moxfield, Arena or MTGO, or a public Moxfield deck link.

## Capabilities and Constraints

- Views: Explorar, Mazos (overview and editor), Mi lista, Resultados, Tiendas, Preguntar al juez; dialogs for pasting lists, first steps, new deck, art/edition, AI assistant, options; full-screen playtest.
- All existing functions must keep working; redesigns change presentation, not behavior, data or AI prompts.
- No new heavy dependencies; the UI is vanilla HTML/CSS/JS loaded locally.
- Interface copy is Spanish.

## Brand Commitments

- Name **Rastro** and its logo (`src/assets/logo.png`, `src/ui/logo.png`) stay.
- The user named Moxfield (structure, density, deck organization) and MTG Arena (game-client atmosphere, cards as heroes) as binding references, without copying their branding or proprietary assets.

## Evidence on Hand

- Card imagery and symbols come from Scryfall at runtime; no other art assets ship with the app.
- No testimonials, user counts or press exist; do not invent them.

## Product Principles

1. The card is the hero: real card images lead, chrome recedes.
2. Dense but legible: a player scanning 60–100 cards needs Moxfield-level density, not dashboard padding.
3. One path from deck to purchase: owned/missing state and buying stay one step away from any deck.
4. AI is a tool inside the workflow, never the headline, and always marked as fallible.
