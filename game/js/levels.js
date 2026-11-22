// Vaultbreak — levels. All original: three vault rooms of the Halcyon Bank.
// Coordinates are canvas pixels on a 960x600 floor. Walls and safes block
// movement and line of sight; dark shadow zones hide the player; cameras sweep
// fixed cones; the hack console disables every camera for 12 seconds.
export const LEVELS = [
  {
    id: 1, name: 'The Marble Lobby', sub: 'Level 1 · crack the lobby vault, dodge one camera',
    par: 75,
    playerStart: [70, 530],
    vault: [880, 70],
    console: [120, 90],
    exit: { x: 880, y: 500, w: 56, h: 76 },
    walls: [
      { x: 0, y: 0, w: 960, h: 18 }, { x: 0, y: 582, w: 960, h: 18 },
      { x: 0, y: 0, w: 18, h: 600 }, { x: 942, y: 0, w: 18, h: 600 },
      { x: 300, y: 120, w: 18, h: 220 }, { x: 300, y: 120, w: 200, h: 18 },
      { x: 620, y: 300, w: 18, h: 180 }, { x: 620, y: 300, w: 180, h: 18 },
    ],
    crates: [
      { x: 180, y: 200, w: 64, h: 64 }, { x: 180, y: 420, w: 64, h: 64 },
      { x: 470, y: 120, w: 64, h: 64 }, { x: 470, y: 440, w: 64, h: 64 },
      { x: 740, y: 180, w: 64, h: 64 }, { x: 740, y: 420, w: 64, h: 64 },
    ],
    shadows: [
      { x: 120, y: 120, r: 42 }, { x: 560, y: 520, r: 42 }, { x: 860, y: 300, r: 40 },
    ],
    guards: [
      { path: [[420, 200], [420, 480], [560, 480], [560, 200]], speed: 62, range: 175, fov: 1.25 },
      { path: [[820, 160], [820, 420]], speed: 55, range: 165, fov: 1.25 },
    ],
    cameras: [
      { x: 700, y: 24, base: Math.PI / 2, sweep: 0.9, speed: 0.55, range: 210, fov: 0.7 },
    ],
    gems: [[250, 90], [520, 330], [680, 90], [120, 330]],
  },
  {
    id: 2, name: 'The Gold Gallery', sub: 'Level 2 · two cameras, three patrols, one hack console',
    par: 95,
    playerStart: [70, 70],
    vault: [880, 530],
    console: [480, 300],
    exit: { x: 60, y: 500, w: 56, h: 76 },
    walls: [
      { x: 0, y: 0, w: 960, h: 18 }, { x: 0, y: 582, w: 960, h: 18 },
      { x: 0, y: 0, w: 18, h: 600 }, { x: 942, y: 0, w: 18, h: 600 },
      { x: 240, y: 220, w: 240, h: 18 }, { x: 480, y: 360, w: 240, h: 18 },
      { x: 700, y: 120, w: 18, h: 160 },
    ],
    crates: [
      { x: 150, y: 300, w: 64, h: 64 }, { x: 380, y: 90, w: 64, h: 64 },
      { x: 560, y: 220, w: 64, h: 64 }, { x: 820, y: 300, w: 64, h: 64 },
      { x: 320, y: 460, w: 64, h: 64 },
    ],
    shadows: [
      { x: 120, y: 220, r: 44 }, { x: 480, y: 480, r: 44 }, { x: 700, y: 480, r: 40 },
      { x: 880, y: 120, r: 42 },
    ],
    guards: [
      { path: [[300, 140], [660, 140], [660, 300], [300, 300]], speed: 68, range: 180, fov: 1.25 },
      { path: [[200, 480], [620, 480]], speed: 60, range: 170, fov: 1.2 },
      { path: [[860, 200], [860, 480], [760, 480]], speed: 58, range: 170, fov: 1.25 },
    ],
    cameras: [
      { x: 240, y: 24, base: Math.PI / 2, sweep: 0.8, speed: 0.6, range: 200, fov: 0.7 },
      { x: 936, y: 300, base: Math.PI, sweep: 0.7, speed: 0.5, range: 200, fov: 0.7 },
    ],
    gems: [[120, 420], [360, 300], [620, 140], [880, 420], [520, 90]],
  },
  {
    id: 3, name: 'The Diamond Vault', sub: 'Level 3 · four guards, three cameras, no room for noise',
    par: 120,
    playerStart: [70, 530],
    vault: [480, 70],
    console: [880, 300],
    exit: { x: 880, y: 70, w: 56, h: 76 },
    walls: [
      { x: 0, y: 0, w: 960, h: 18 }, { x: 0, y: 582, w: 960, h: 18 },
      { x: 0, y: 0, w: 18, h: 600 }, { x: 942, y: 0, w: 18, h: 600 },
      { x: 220, y: 140, w: 18, h: 200 }, { x: 220, y: 140, w: 180, h: 18 },
      { x: 560, y: 260, w: 18, h: 200 }, { x: 560, y: 260, w: 180, h: 18 },
      { x: 740, y: 120, w: 18, h: 160 },
    ],
    crates: [
      { x: 120, y: 140, w: 64, h: 64 }, { x: 330, y: 300, w: 64, h: 64 },
      { x: 460, y: 440, w: 64, h: 64 }, { x: 660, y: 420, w: 64, h: 64 },
      { x: 820, y: 300, w: 64, h: 64 }, { x: 120, y: 420, w: 64, h: 64 },
    ],
    shadows: [
      { x: 300, y: 480, r: 42 }, { x: 620, y: 120, r: 42 }, { x: 880, y: 480, r: 40 },
    ],
    guards: [
      { path: [[300, 220], [520, 220], [520, 480], [300, 480]], speed: 72, range: 185, fov: 1.25 },
      { path: [[660, 140], [660, 520]], speed: 66, range: 180, fov: 1.25 },
      { path: [[120, 300], [420, 300]], speed: 62, range: 170, fov: 1.2 },
      { path: [[820, 160], [820, 420], [700, 420]], speed: 60, range: 175, fov: 1.25 },
    ],
    cameras: [
      { x: 480, y: 24, base: Math.PI / 2, sweep: 1.0, speed: 0.65, range: 210, fov: 0.7 },
      { x: 24, y: 300, base: 0, sweep: 0.8, speed: 0.55, range: 200, fov: 0.7 },
      { x: 936, y: 480, base: -Math.PI / 2, sweep: 0.8, speed: 0.6, range: 200, fov: 0.7 },
    ],
    gems: [[200, 90], [480, 200], [700, 300], [880, 540], [60, 300], [380, 540]],
  },
];
