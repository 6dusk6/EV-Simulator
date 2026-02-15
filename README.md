# EV-Simulator

Blackjack Hand EV Calculator WordPress plugin (shortcode: `[ev_simulator_handcalc]`).

## Installation

1. Copy this repository folder into `wp-content/plugins/ev-simulator`, or zip it and upload via the WordPress Plugins screen.
2. Activate **EV-Simulator** in WordPress.
3. Add the shortcode `[ev_simulator_handcalc]` to any post or page.

## Usage

Use the shortcode:

```
[ev_simulator_handcalc]
```

The calculator renders the dark-themed UI with three card selectors and a **BERECHNE** button that outputs action EVs.

## Rules (fixed)

- 6-deck shoe, card removal for player cards + dealer upcard.
- Dealer stands on soft 17 (S17), no peek for blackjack.
- No insurance, no surrender.
- Blackjack pays 3:2 only for the original two-card hand (A + T), never after splits.
- Double allowed on 9/10/11, only on the first two cards.
- Splits allowed for pairs, up to 4 hands total; double after split for non-ace hands.
- Split aces receive one card and stand (resplitting allowed up to 4 total hands).
- “Hit on blackjack” is allowed: stand is treated as blackjack, hit continues normally.

## Local testing

```bash
npm i
```

- Fast UI/smoke checks (default):

```bash
npm test
# or
npm run test:ui
```

- Full engine baseline checks (canon + smoke):

```bash
npm run test:full
```

- Re-generate canon fixtures (uses same split precompute source as canon tests):

```bash
npm run canon:gen
npm run test:canon
```
