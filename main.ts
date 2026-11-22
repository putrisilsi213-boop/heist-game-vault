// Vaultbreak — entrypoint for the make.fun harness.
//
// Builds the entry dossier from this directory's game/ and screenshots/
// with the kit's own buildDossier (vendor/makefun-game.ts) and writes it
// to dossier.json next to this file. The scorer runs the same function on
// what is handed in, so the dossier must be exactly what buildDossier
// writes — never hand-edited.
//
// Caps come from the competition's gate: at most 163840 bytes of source
// text, at most 4 screenshots of at most 262144 bytes each, at most 993
// entries under game/.
//
// Run with: node main.ts
// (Node 22+ runs this erasable TypeScript file as-is, no build step.)

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

// Under the grader the repo is read-only, so the dossier goes to the
// writable output dir when one is provided; locally it stays next to
// this file, exactly as before.
const botDir = process.env.MAKEFUN_BOT_DIR ?? '.';
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '.';

const dossier = buildDossier(botDir, caps);
writeFileSync(join(outDir, 'dossier.json'), dossier);

const hash = createHash('sha256').update(dossier).digest('hex');
console.log(`dossier.json: ${dossier.length} bytes, sha256 ${hash}`);
