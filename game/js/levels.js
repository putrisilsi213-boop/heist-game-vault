// Vaultbreak — level data for "The Meridian Vault".
// One hand-built floor plan. Coordinates are pixels in a 960 x 600 world.
// Walls are axis-aligned rectangles. Vault rooms sit along the top wall,
// the lobby and exit sit along the bottom, and the hack console guards the
// middle of the floor between them.

export const WORLD = { width: 960, height: 600 };

export const LEVEL = {
  name: 'The Meridian Vault',
  playerStart: { x: 480, y: 520 },

  // Reach this zone after looting every vault to finish the heist.
  exit: { x: 430, y: 544, w: 100, h: 40 },

  walls: [
    // Outer shell.
    { x: 0, y: 0, w: 960, h: 16 },
    { x: 0, y: 584, w: 960, h: 16 },
    { x: 0, y: 0, w: 16, h: 600 },
    { x: 944, y: 0, w: 16, h: 600 },

    // Vault A room (left). Door gap in the bottom wall: x 130..190.
    { x: 60, y: 50, w: 12, h: 180 },
    { x: 60, y: 50, w: 200, h: 12 },
    { x: 248, y: 50, w: 12, h: 180 },
    { x: 60, y: 218, w: 70, h: 12 },
    { x: 190, y: 218, w: 70, h: 12 },

    // Vault B room (centre). Door gap in the bottom wall: x 450..510.
    { x: 380, y: 50, w: 12, h: 180 },
    { x: 380, y: 50, w: 200, h: 12 },
    { x: 568, y: 50, w: 12, h: 180 },
    { x: 380, y: 218, w: 70, h: 12 },
    { x: 510, y: 218, w: 70, h: 12 },

    // Vault C room (right). Door gap in the bottom wall: x 770..830.
    { x: 700, y: 50, w: 12, h: 180 },
    { x: 700, y: 50, w: 200, h: 12 },
    { x: 888, y: 50, w: 12, h: 180 },
    { x: 700, y: 218, w: 70, h: 12 },
    { x: 830, y: 218, w: 70, h: 12 },

    // Mid-floor partitions that break up the guard sightlines.
    { x: 300, y: 280, w: 12, h: 140 },
    { x: 648, y: 280, w: 12, h: 140 },

    // Lobby walls with a wide centre gap leading to the exit.
    { x: 180, y: 420, w: 240, h: 12 },
    { x: 540, y: 420, w: 240, h: 12 },
  ],

  // Three safes. Stand close and hold E to crack one; loot appears inside.
  vaults: [
    { id: 'A', name: 'Gold Vault', x: 132, y: 120, w: 56, h: 40, value: 500 },
    { id: 'B', name: 'Jewel Vault', x: 452, y: 120, w: 56, h: 40, value: 800 },
    { id: 'C', name: 'Cash Vault', x: 772, y: 120, w: 56, h: 40, value: 650 },
  ],

  // Cash stacks. Hidden until their vault is cracked; walk over one to grab it.
  loot: [
    { vault: 'A', x: 110, y: 100, value: 200 },
    { vault: 'A', x: 210, y: 100, value: 150 },
    { vault: 'A', x: 160, y: 185, value: 150 },
    { vault: 'B', x: 430, y: 100, value: 300 },
    { vault: 'B', x: 530, y: 100, value: 250 },
    { vault: 'B', x: 480, y: 185, value: 250 },
    { vault: 'C', x: 750, y: 100, value: 250 },
    { vault: 'C', x: 850, y: 100, value: 200 },
    { vault: 'C', x: 800, y: 185, value: 200 },
  ],

  // The hack console. Hold E near it to knock the cameras out for 20 seconds
  // and bleed off some of the alarm.
  console: { x: 458, y: 305, w: 44, h: 30 },

  // Guards walk their waypoint loops and chase the player when they spot one.
  guards: [
    {
      name: 'Lobby Guard',
      waypoints: [
        { x: 120, y: 255 },
        { x: 840, y: 255 },
      ],
      speed: 55,
    },
    {
      name: 'West Guard',
      waypoints: [
        { x: 330, y: 260 },
        { x: 330, y: 400 },
      ],
      speed: 50,
    },
    {
      name: 'East Guard',
      waypoints: [
        { x: 630, y: 260 },
        { x: 630, y: 400 },
      ],
      speed: 50,
    },
  ],

  // Sentry cameras sweep back and forth. Hacking the console disables them.
  cameras: [
    { x: 300, y: 240, baseAngle: Math.PI / 2, sweep: 0.7, speed: 0.5 },
    { x: 660, y: 240, baseAngle: Math.PI / 2, sweep: 0.7, speed: 0.5 },
    { x: 480, y: 470, baseAngle: -Math.PI / 2, sweep: 0.6, speed: 0.65 },
  ],
};
