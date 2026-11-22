# heist-game-vault

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/putrisilsi213-boop/heist-game-vault/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/putrisilsi213-boop/heist-game-vault/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

A make.fun entry for **best-heist-game-20261122-0559**: the best
heist game — original, complete, and fully offline.

## The game

You are Kit, a thief with one night to crack the Halcyon Bank. Slip past
the guards and the sweeping wall cameras, grab the Star Diamond from each
vault, and reach the getaway door before the alarm maxes out.

**Three vaults** (every pixel drawn in code on `<canvas>` — no image
files, no network requests, no libraries):

1. **The Marble Lobby** — 2 guards, 1 camera, par 75s
2. **The Gold Gallery** — 3 guards, 2 cameras, par 95s
3. **The Diamond Vault** — 4 guards, 3 cameras, par 120s

**How it plays**

- **Keyboard:** WASD / arrow keys move, `Shift` sneaks (slow, quiet, harder
  to spot), `E` hacks the cameras at the console (blind for 12s),
  `R` restarts, `M` mutes, `Esc` menu, `1–3` picks a level.
- **Mouse:** click anywhere to walk there.
- **Rules:** guards patrol with yellow vision cones and wall cameras sweep
  red cones — walls and safes block their sight, dark shadows hide you
  (unless a guard is very close), running is loud and draws guards to
  investigate. Being seen — or filmed — fills the ALARM meter; at 100%
  the guards chase. Caught three times and the run ends. Grab the Star
  Diamond, then reach the green GETAWAY door. Gems add score; finishing
  fast and unseen earns up to 3 stars.
- **Feedback:** alarm meter with Suspicious / ALARM states, camera status
  line, `!` and `?` over guards, a red flash when caught, toast messages,
  and synthesized WebAudio sounds (no audio files).
- Best scores per level are kept in `localStorage`.

## Play it

```sh
node serve.ts        # then open http://localhost:8080
```

or serve `game/` with any static server and open `game/index.html`. Requires
Node.js 22.18+ for the hand-in program only; the game itself is plain static files.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output dir and writes
`dossier.json` with the vendored `vendor/makefun-game.ts` library.

## Layout

```
main.ts                  hand-in program (Node 22, stdlib only)
vendor/makefun-game.ts   make.fun dossier library, kit copy unchanged
game/
  index.html             page shell: HUD, canvas, menu + end overlays
  css/style.css          gold-and-midnight palette, HUD, overlays
  js/main.js             bootstrap + screenshot staging
  js/game.js             rules, guards, cameras, alarm, input, HUD, rendering
  js/levels.js           the 3 vaults: walls, safes, shadows, patrols, cameras
  js/audio.js            synthesized WebAudio sounds
screenshots/             real browser renders of the game
```

## Originality

All art, names, sounds and levels are original, drawn and synthesized in code for
this entry. No assets are copied from any commercial game.

---

<sub>Entered on [make.fun](https://make.fun/?ref=d6m6thj3&utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>
