/* ============================================================
   SENT BY SAHEN  -  shop settings
   Everything you might want to change later is in this file.
   ============================================================ */
window.SBS_CONFIG = {
  shopName: "Sent by Sahen",
  igHandle: "",            // e.g. "sentbysahen" (shown after ordering). Leave empty to hide.

supabaseUrl: "https://xuhunisrtszfhldzebqd.supabase.co",
supabaseAnonKey: "sb_publishable_VXRAsgSsXtGrPhTw_2j04Q_Ca7q1Ngz",

  // --- Prices (product only, delivery fee is NOT included) ---
  prices: {
    "5R": { plain: 299, framed: 350 },
    "A4": { plain: 349, framed: 400 }
  },
  downpaymentRate: 0.7,     // 70% now, 30% before ship out

  // --- Thread colors ---
  includedColors: 2,        // colors included in the base price
  maxColors: 3,
  thirdColorFee: 20,        // each color beyond includedColors
  threads: [
    { id: "3363", name: "Sage",   hex: "#8d9b6e" },
    { id: "3685", name: "Wine",   hex: "#6f1230" },
    { id: "3746", name: "Violet", hex: "#8f7bbd" },
    { id: "310",  name: "Black",  hex: "#111111" },
    { id: "813",  name: "Sky",    hex: "#8fc0e8" },
    { id: "3833", name: "Rose",   hex: "#d8758b" }
  ],

  // --- Template 1 look (fixed, thread colors only change the stitched text) ---
  template1: { frame: "#221aa8", accent: "#e4231a", ink: "#6b1d36" },

  // --- Text ---
  freePresets: ["i love you", "with love"],
  // Customized text fee by number of letters/numbers/symbols (spaces do not count).
  // NOTE: your list started at 5 letters. 1-4 were not defined, so they use the first tier.
  customTiers: [
    { min: 1,  max: 7,  fee: 150 },
    { min: 8,  max: 10, fee: 200 },
    { min: 11, max: 11, fee: 250 }
  ],
  extraLetterFee: 7,        // each letter after the 11th adds this (12 letters = 257, 13 = 264, ...)
  extraLetterFrom: 11,
  maxCustomChars: 30,

  // --- Frame ---
  frameName: "Dark walnut"
};
