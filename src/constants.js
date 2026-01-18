export const VERSION = 'v1.4.1-web-debug';
export const ROLES = ['top', 'jg', 'mid', 'bot', 'sup'];

export const RANK_DATA = [
  { tag: "UN", name: "UNRANKED", val: 400, color: "#FFFFFF" },
  { tag: "I4", name: "IRON IV", val: 500, color: "#51484A" },
  { tag: "I3", name: "IRON III", val: 600, color: "#51484A" },
  { tag: "I2", name: "IRON II", val: 700, color: "#51484A" },
  { tag: "I1", name: "IRON I", val: 800, color: "#51484A" },
  { tag: "B4", name: "BRONZE IV", val: 900, color: "#8C5229" },
  { tag: "B3", name: "BRONZE III", val: 1000, color: "#8C5229" },
  { tag: "B2", name: "BRONZE II", val: 1100, color: "#8C5229" },
  { tag: "B1", name: "BRONZE I", val: 1200, color: "#8C5229" },
  { tag: "S4", name: "SILVER IV", val: 1300, color: "#8098A1" },
  { tag: "S3", name: "SILVER III", val: 1400, color: "#8098A1" },
  { tag: "S2", name: "SILVER II", val: 1500, color: "#8098A1" },
  { tag: "S1", name: "SILVER I", val: 1600, color: "#8098A1" },
  { tag: "G4", name: "GOLD IV", val: 1700, color: "#CD8837" },
  { tag: "G3", name: "GOLD III", val: 1800, color: "#CD8837" },
  { tag: "G2", name: "GOLD II", val: 1900, color: "#CD8837" },
  { tag: "G1", name: "GOLD I", val: 2000, color: "#CD8837" },
  { tag: "P4", name: "PLATINUM IV", val: 2100, color: "#4E9996" },
  { tag: "P3", name: "PLATINUM III", val: 2200, color: "#4E9996" },
  { tag: "P2", name: "PLATINUM II", val: 2300, color: "#4E9996" },
  { tag: "P1", name: "PLATINUM I", val: 2400, color: "#4E9996" },
  { tag: "E4", name: "EMERALD IV", val: 2500, color: "#2ECC71" },
  { tag: "E3", name: "EMERALD III", val: 2600, color: "#2ECC71" },
  { tag: "E2", name: "EMERALD II", val: 2700, color: "#2ECC71" },
  { tag: "E1", name: "EMERALD I", val: 2800, color: "#2ECC71" },
  { tag: "D4", name: "DIAMOND IV", val: 2900, color: "#576ACC" },
  { tag: "D3", name: "DIAMOND III", val: 3000, color: "#576ACC" },
  { tag: "D2", name: "DIAMOND II", val: 3100, color: "#576ACC" },
  { tag: "D1", name: "DIAMOND I", val: 3200, color: "#576ACC" },
  { tag: "M", name: "MASTER", val: 3300, color: "#9A4E9E" },
  { tag: "GM", name: "GRANDMASTER", val: 3600, color: "#CD4545" },
  { tag: "C", name: "CHALLENGER", val: 4000, color: "#F4C775" },
];

export const RANK_MAP = RANK_DATA.reduce((acc, r) => ({ ...acc, [r.name]: r.val }), {});

export const DDRAGON_VERSION = '16.1.1'; // 必要に応じて更新
export const DDRAGON_URL = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}`;
