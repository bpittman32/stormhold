# Stormhold

A phone-friendly Norse roguelike in the spirit of *Castle of the Winds*.

**Play:** https://bpittman32.github.io/stormhold/

- Chapter 1: the village of Ravensfjord and the 10-level Barrow — slay Grimtusk the Troll King and take the Storm Crown from Hrimfang the Frost Jarl.
- Chapter 2: recover the stolen relics in the Ironwood, solve the Stone Circle, then free the captives of the Shadowdeep beneath Eldermere.

Tap to move, tap foes to attack, long-press to examine. Progress autosaves in your browser; use **Menu → Save / Load → Download save file** to back up or move a game to another device. No account needed.

## Project layout

- `index.html` — the whole game in one file (this is what GitHub Pages serves).
- `src/` — source: `data.js` (monsters, items, spells), `sprites.js` (pixel art), `art.js` (tile and town rendering), `engine.js` (game rules), `ui.js` (screens and input), `style.css`, `shell.html`.
- `build.py` — run `python3 build.py` to rebuild `index.html` from `src/`.
