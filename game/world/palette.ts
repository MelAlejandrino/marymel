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

  /** The rabbits. Three coats — cream, dust and cocoa — against one shared
   *  cream underside, so a herd of them still reads as one set. */
  rabbit: {
    fur: ["#f4e7d6", "#cbbca9", "#9b7a5f"],
    belly: "#fffaf2",
    /** Inside of the ear, and the nose. */
    inner: "#eda9b2",
    nose: "#e07f8e",
    eye: "#3a2a2e",
    whisker: "#fff6ec",
  },

  /** Indoors. Warmer and lower-contrast than the exterior, so the room reads
   *  as lamplit rather than as more garden with a roof over it. */
  home: {
    oak: "#c39a6b",
    oakDark: "#9c7449",
    walnut: "#6f4b3a",
    fabric: "#d8c3a5",
    fabricShade: "#c2ab8c",
    cushion: ["#e98aa4", "#f0c489", "#9fb6d8"],
    duvet: "#fbf0e2",
    linen: "#fffaf2",
    metal: "#8d8074",
    foliage: "#5f8a52",
    pot: "#c08a63",
    books: ["#a8564a", "#4f6b8a", "#7f8f4a", "#b5804a", "#7a5470"],
    rug: "#c1738a",
    rugTrim: "#f0d8c0",
    ember: "#ff9a4a",
  },

  avatar: {
    skin: "#f7d9c4",
    skinShade: "#eec4ab",
    hair: "#4b3239",
    hairSheen: "#63424a",
    dress: "#e98aa4",
    dressLight: "#f4a3b8",
    dressTrim: "#ffd9e2",
    sash: "#c65f80",
    apron: "#fff3e6",
    shoe: "#6d4a52",
    eye: "#33262c",
    blush: "#f0a0ad",
    ribbon: "#ffc2d1",
    flower: "#fff0f4",
    flowerCore: "#ffd06a",
  },
} as const;
