// Vaultbreak — bootstrap + screenshot staging (?shot=...).
// Staging only rearranges a live game state for a render; every screenshot is
// a real render of the game's own code, no mockup.
import { Game } from './game.js';

const game = new Game(document.getElementById('canvas'));
game.renderMenuCards();

const q = new URLSearchParams(location.search);
const shot = q.get('shot');
if (shot) {
  const level = Number(q.get('level') || (shot === 'gallery' ? 2 : shot === 'vault' ? 3 : 1));
  game.startLevel(level - 1);
  const L = game.level; const p = game.player;
  if (shot === 'cover') {
    // Kit crouched in the shadows, a guard's cone sweeping just past, camera overhead.
    p.x = 470; p.y = 200; game.sneaking = true;
    const g = game.guards[0]; g.x = 420; g.y = 300; g.dir = Math.PI / 2; g.pause = 99;
    const cam = game.cameras[0]; cam.dir = Math.PI / 2 + 0.5;
    game.alarm = 38;
  } else if (shot === 'gallery') {
    // Mid-heist in the Gold Gallery: alarm climbing, a camera cone crossing Kit.
    p.x = 150; p.y = 300; game.sneaking = true;
    const g = game.guards[0]; g.x = 300; g.y = 220; g.dir = 0; g.pause = 99;
    const cam = game.cameras[0]; cam.dir = Math.PI / 2; cam.x = 240; cam.y = 120;
    game.alarm = 62;
  } else if (shot === 'vault') {
    // Diamond in hand, one step from the getaway door, a guard closing in.
    game.lootGot = true; game.score = 450; game.gemsGot = 5;
    p.x = L.exit.x - 90; p.y = L.exit.y + 30; p.dir = 0;
    const g = game.guards[1]; g.x = 760; g.y = 200; g.dir = Math.PI * 0.75; g.pause = 99;
    game.alarm = 84;
  } else if (shot === 'win') {
    game.lootGot = true; game.score = 640; game.gemsGot = 4; game.time = 68; game.spotted = 0;
    game.completeLevel();
  }
  game.updateHud();
  requestAnimationFrame(() => { window.__shotReady = true; });
} else {
  window.__shotReady = true;
}
window.__game = game;
