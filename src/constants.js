export const VERSION = 'v1.4.1-web-debug';
export const ROLES = ['top', 'jg', 'mid', 'bot', 'sup'];

export const RANK_DATA = [
  { tag: "UN", name: "UNRANKED", val: 0, color: "#FFFFFF" },
  { tag: "I4", name: "IRON IV", val: 1, color: "#51484A" },
  { tag: "I3", name: "IRON III", val: 2, color: "#51484A" },
  { tag: "I2", name: "IRON II", val: 3, color: "#51484A" },
  { tag: "I1", name: "IRON I", val: 4, color: "#51484A" },
  { tag: "B4", name: "BRONZE IV", val: 5, color: "#8C5229" },
  { tag: "B3", name: "BRONZE III", val: 6, color: "#8C5229" },
  { tag: "B2", name: "BRONZE II", val: 7, color: "#8C5229" },
  { tag: "B1", name: "BRONZE I", val: 8, color: "#8C5229" },
  { tag: "S4", name: "SILVER IV", val: 9, color: "#8098A1" },
  { tag: "S3", name: "SILVER III", val: 10, color: "#8098A1" },
  { tag: "S2", name: "SILVER II", val: 11, color: "#8098A1" },
  { tag: "S1", name: "SILVER I", val: 12, color: "#8098A1" },
  { tag: "G4", name: "GOLD IV", val: 13, color: "#CD8837" },
  { tag: "G3", name: "GOLD III", val: 14, color: "#CD8837" },
  { tag: "G2", name: "GOLD II", val: 15, color: "#CD8837" },
  { tag: "G1", name: "GOLD I", val: 16, color: "#CD8837" },
  { tag: "P4", name: "PLATINUM IV", val: 17, color: "#4E9996" },
  { tag: "P3", name: "PLATINUM III", val: 18, color: "#4E9996" },
  { tag: "P2", name: "PLATINUM II", val: 19, color: "#4E9996" },
  { tag: "P1", name: "PLATINUM I", val: 20, color: "#4E9996" },
  { tag: "E4", name: "EMERALD IV", val: 21, color: "#2ECC71" },
  { tag: "E3", name: "EMERALD III", val: 22, color: "#2ECC71" },
  { tag: "E2", name: "EMERALD II", val: 23, color: "#2ECC71" },
  { tag: "E1", name: "EMERALD I", val: 24, color: "#2ECC71" },
  { tag: "D4", name: "DIAMOND IV", val: 25, color: "#576ACC" },
  { tag: "D3", name: "DIAMOND III", val: 26, color: "#576ACC" },
  { tag: "D2", name: "DIAMOND II", val: 27, color: "#576ACC" },
  { tag: "D1", name: "DIAMOND I", val: 28, color: "#576ACC" },
  { tag: "M", name: "MASTER", val: 29, color: "#9A4E9E" },
  { tag: "GM", name: "GRANDMASTER", val: 34, color: "#CD4545" },
  { tag: "C", name: "CHALLENGER", val: 38, color: "#F4C775" },
];

export const RANK_MAP = RANK_DATA.reduce((acc, r) => ({ ...acc, [r.name]: r.val }), {});

export const DDRAGON_VERSION = '16.1.1'; // 必要に応じて更新
export const DDRAGON_URL = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}`;
