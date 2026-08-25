/**
 * One palette for the whole world. Colours picked as a set rather than per
 * object — that coherence is most of what makes a stylized scene read as
 * designed instead of assembled.
 *
 * The scene is lit as late golden hour: warm key light, cool sky fill, long
 * shadows.
 */
export const PALETTE = {
  skyTop: "#3f5c8c",
  skyHorizon: "#f6c08a",
  fog: "#e8bfa0",

  grass: "#7d9b58",
  grassDark: "#6b8a4c",
  soil: "#6b5540",

  wall: "#f2e4d0",
  wallShade: "#e2d0b8",
  timber: "#8a6a52",

  roof: "#a8564a",
  roofRidge: "#94473d",

  door: "#b5654a",
  doorPanel: "#a0563e",
  brass: "#e8c07a",

  stone: "#bdb2a4",
  fence: "#e0d3bd",

  paneLit: "#ffd9a0",
  lampLit: "#ffe6b0",

  trunk: "#7a5a44",
  leaves: ["#7fa86a", "#8fba77", "#6f9a5e"],
  blossom: ["#f2a2ae", "#f7d6e0", "#ffd9a0", "#e8b4d0"],

  avatar: {
    skin: "#f7d9c4",
    skinShade: "#eec4ab",
    hair: "#4b3239",
    hairSheen: "#63424a",
    dress: "#e98aa4",
    dressTrim: "#ffd9e2",
    apron: "#fff3e6",
    shoe: "#6d4a52",
    eye: "#33262c",
    blush: "#f0a0ad",
    ribbon: "#ffc2d1",
  },
} as const;
