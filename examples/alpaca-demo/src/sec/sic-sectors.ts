/**
 * SIC code to sector classification mapping
 *
 * Maps 2-digit SIC division codes to a simplified sector taxonomy.
 * Special 4-digit overrides handle cases where the 2-digit grouping is too broad.
 */

import type { IndustryId, SectorId } from "./types.js";

/** 4-digit SIC overrides (checked before 2-digit fallback) */
const SIC4_OVERRIDES: Record<number, SectorId> = {
  // SIC 28xx is split: 2800-2836 = materials (chemicals), 2830-2836 = healthcare (pharma)
  2830: "healthcare",
  2833: "healthcare",
  2834: "healthcare",
  2835: "healthcare",
  2836: "healthcare",
  // SIC 49xx: 4911-4941 = utilities, 4900 = utilities
  4911: "utilities",
  4922: "utilities",
  4923: "utilities",
  4924: "utilities",
  4931: "utilities",
  4932: "utilities",
  4939: "utilities",
  4941: "utilities",
  // SIC 7372-7374 = technology (software/data)
  7371: "technology",
  7372: "technology",
  7373: "technology",
  7374: "technology",
  // SIC 3674 = technology (semiconductors)
  3674: "technology",
};

/** 2-digit SIC → sector mapping */
const SIC2_MAP: Record<number, SectorId> = {
  // Mining / Energy: 10-14
  10: "energy",
  11: "energy",
  12: "energy",
  13: "energy",
  14: "energy",
  // Construction: 15-17 → industrials
  15: "industrials",
  16: "industrials",
  17: "industrials",
  // Food & Tobacco: 20-21 → consumer
  20: "consumer",
  21: "consumer",
  // Textiles, Apparel, Lumber, Furniture, Paper: 22-27
  22: "consumer",
  23: "consumer",
  24: "materials",
  25: "consumer",
  26: "materials",
  27: "communications",
  // Chemicals: 28 → materials (pharma overrides above)
  28: "materials",
  // Petroleum refining: 29 → energy
  29: "energy",
  // Rubber, Leather: 30-31 → materials
  30: "materials",
  31: "materials",
  // Stone/Clay/Glass, Primary metals: 32-33
  32: "materials",
  33: "materials",
  // Fabricated metals: 34 → industrials
  34: "industrials",
  // Industrial machinery & computers: 35
  35: "technology",
  // Electronic equipment: 36
  36: "technology",
  // Transportation equipment: 37
  37: "industrials",
  // Instruments: 38 → healthcare
  38: "healthcare",
  // Misc manufacturing: 39
  39: "industrials",
  // Transportation: 40-47
  40: "industrials",
  41: "industrials",
  42: "industrials",
  43: "industrials",
  44: "industrials",
  45: "industrials",
  46: "energy",
  47: "industrials",
  // Communications: 48
  48: "communications",
  // Utilities: 49
  49: "utilities",
  // Wholesale: 50-51
  50: "consumer",
  51: "consumer",
  // Retail: 52-59
  52: "consumer",
  53: "consumer",
  54: "consumer",
  55: "consumer",
  56: "consumer",
  57: "consumer",
  58: "consumer",
  59: "consumer",
  // Finance, Insurance, Real Estate: 60-67
  60: "finance",
  61: "finance",
  62: "finance",
  63: "finance",
  64: "finance",
  65: "real-estate",
  66: "finance",
  67: "finance",
  // Hotels, Personal services: 70-72 → consumer
  70: "consumer",
  71: "consumer",
  72: "consumer",
  // Business services: 73 → technology
  73: "technology",
  // Health services: 80 → healthcare
  80: "healthcare",
  // Legal/Educational/Social/Engineering services
  81: "industrials",
  82: "consumer",
  83: "consumer",
  84: "consumer",
  86: "consumer",
  87: "industrials",
  89: "industrials",
};

const SECTOR_NAMES: Record<SectorId, string> = {
  technology: "Technology",
  healthcare: "Healthcare",
  finance: "Finance",
  energy: "Energy",
  consumer: "Consumer",
  industrials: "Industrials",
  "real-estate": "Real Estate",
  utilities: "Utilities",
  communications: "Communications",
  materials: "Materials",
  other: "Other",
};

/**
 * Convert a SIC code to a sector classification.
 * Checks 4-digit overrides first, then falls back to 2-digit mapping.
 */
export function sicToSector(sic: number): SectorId {
  // Check 4-digit override
  if (SIC4_OVERRIDES[sic]) return SIC4_OVERRIDES[sic];

  // Fallback to 2-digit
  const sic2 = Math.floor(sic / 100);
  return SIC2_MAP[sic2] ?? "other";
}

// ============================================
// Industry mapping (SIC 4-digit → IndustryId)
// ============================================

/** SIC 4-digit → industry mapping (exact match) */
const SIC4_INDUSTRY: Record<number, IndustryId> = {
  // Technology — Software
  7371: "software",
  7372: "software",
  // Technology — IT Services
  7373: "it-services",
  7374: "it-services",
  7379: "it-services",
  7389: "it-services",
  8742: "it-services",
  // Technology — Semiconductors
  3674: "semiconductors",
  // Technology — Computer Hardware
  3571: "computer-hardware",
  3572: "computer-hardware",
  3575: "computer-hardware",
  3577: "computer-hardware",
  3578: "computer-hardware",
  3579: "computer-hardware",
  // Technology — Electronic Equipment
  3669: "electronic-equipment",
  3672: "electronic-equipment",
  3678: "electronic-equipment",
  3679: "electronic-equipment",
  3690: "electronic-equipment",
  3699: "electronic-equipment",
  3612: "electronic-equipment",
  3613: "electronic-equipment",
  3621: "electronic-equipment",
  3625: "electronic-equipment",
  3629: "electronic-equipment",
  3661: "electronic-equipment",

  // Healthcare — Pharmaceuticals
  2833: "pharmaceuticals",
  2834: "pharmaceuticals",
  // Healthcare — Biotechnology
  2835: "biotechnology",
  2836: "biotechnology",
  // Healthcare — Medical Devices
  3841: "medical-devices",
  3842: "medical-devices",
  3845: "medical-devices",
  3844: "medical-devices",
  3851: "medical-devices",
  // Healthcare — Health Services
  8011: "health-services",
  8049: "health-services",
  8060: "health-services",
  8062: "health-services",
  8071: "health-services",
  8082: "health-services",
  8090: "health-services",
  8093: "health-services",
  8099: "health-services",

  // Finance — Banking
  6020: "banking",
  6021: "banking",
  6022: "banking",
  6029: "banking",
  6035: "banking",
  6036: "banking",
  // Finance — Investment Services
  6111: "investment-services",
  6141: "investment-services",
  6153: "investment-services",
  6159: "investment-services",
  6199: "investment-services",
  6200: "investment-services",
  6211: "investment-services",
  6221: "investment-services",
  // Finance — Insurance
  6311: "insurance",
  6321: "insurance",
  6324: "insurance",
  6331: "insurance",
  6351: "insurance",
  6399: "insurance",
  6411: "insurance",
  // Finance — Asset Management
  6282: "asset-management",
  // Finance — Holding Companies
  6710: "holding-companies",
  6726: "holding-companies",
  6770: "holding-companies",

  // Energy — Oil & Gas
  1311: "oil-gas",
  1389: "oil-gas",
  2911: "oil-gas",
  4612: "oil-gas",
  4613: "oil-gas",
  5171: "oil-gas",
  // Energy — Mining
  1000: "mining",
  1040: "mining",
  1090: "mining",
  1220: "mining",
  1221: "mining",
  // Energy — Energy Services
  1381: "energy-services",
  1382: "energy-services",

  // Consumer — Retail
  5200: "retail",
  5211: "retail",
  5311: "retail",
  5331: "retail",
  5411: "retail",
  5412: "retail",
  5500: "retail",
  5531: "retail",
  5600: "retail",
  5621: "retail",
  5651: "retail",
  5700: "retail",
  5712: "retail",
  5731: "retail",
  5900: "retail",
  5912: "retail",
  5940: "retail",
  5944: "retail",
  5945: "retail",
  5961: "retail",
  5990: "retail",
  // Consumer — Food & Beverage
  2000: "food-beverage",
  2010: "food-beverage",
  2013: "food-beverage",
  2020: "food-beverage",
  2030: "food-beverage",
  2040: "food-beverage",
  2050: "food-beverage",
  2060: "food-beverage",
  2080: "food-beverage",
  2082: "food-beverage",
  2086: "food-beverage",
  2090: "food-beverage",
  // Consumer — Restaurants
  5810: "restaurants",
  5812: "restaurants",
  // Consumer — Consumer Products
  2111: "consumer-products",
  2842: "consumer-products",
  2844: "consumer-products",
  3089: "consumer-products",
  3140: "consumer-products",
  3942: "consumer-products",
  3944: "consumer-products",
  3949: "consumer-products",
  // Consumer — Wholesale
  5040: "wholesale",
  5045: "wholesale",
  5047: "wholesale",
  5051: "wholesale",
  5065: "wholesale",
  5084: "wholesale",
  5090: "wholesale",
  5110: "wholesale",
  5122: "wholesale",

  // Industrials — Aerospace & Defense
  3720: "aerospace-defense",
  3721: "aerospace-defense",
  3724: "aerospace-defense",
  3728: "aerospace-defense",
  3760: "aerospace-defense",
  3761: "aerospace-defense",
  3769: "aerospace-defense",
  3812: "aerospace-defense",
  // Industrials — Automotive
  3711: "automotive",
  3714: "automotive",
  3713: "automotive",
  3715: "automotive",
  // Industrials — Machinery
  3523: "machinery",
  3531: "machinery",
  3532: "machinery",
  3533: "machinery",
  3537: "machinery",
  3550: "machinery",
  3559: "machinery",
  3561: "machinery",
  3562: "machinery",
  3569: "machinery",
  3580: "machinery",
  3585: "machinery",
  3589: "machinery",
  3590: "machinery",
  3599: "machinery",
  // Industrials — Construction
  1500: "construction",
  1520: "construction",
  1521: "construction",
  1531: "construction",
  1540: "construction",
  1600: "construction",
  1623: "construction",
  1700: "construction",
  1731: "construction",
  // Industrials — Transportation
  4011: "transportation",
  4013: "transportation",
  4210: "transportation",
  4213: "transportation",
  4400: "transportation",
  4412: "transportation",
  4512: "transportation",
  4522: "transportation",
  4581: "transportation",

  // Communications — Telecom
  4812: "telecom",
  4813: "telecom",
  // Communications — Media
  2710: "media",
  2711: "media",
  2720: "media",
  2731: "media",
  2741: "media",
  4833: "media",
  4841: "media",
  7812: "media",
  7819: "media",
  7822: "media",

  // Real Estate
  6500: "real-estate-services",
  6510: "real-estate-services",
  6512: "real-estate-services",
  6531: "real-estate-services",
  6552: "real-estate-services",
  6798: "reits",

  // Utilities
  4911: "electric-utilities",
  4931: "electric-utilities",
  4932: "electric-utilities",
  4939: "electric-utilities",
  4922: "gas-utilities",
  4923: "gas-utilities",
  4924: "gas-utilities",
  4941: "water-utilities",

  // Materials — Chemicals
  2800: "chemicals",
  2810: "chemicals",
  2812: "chemicals",
  2819: "chemicals",
  2820: "chemicals",
  2821: "chemicals",
  2860: "chemicals",
  2869: "chemicals",
  2890: "chemicals",
  2891: "chemicals",
  2899: "chemicals",
  // Materials — Metals & Mining
  3310: "metals-mining",
  3312: "metals-mining",
  3316: "metals-mining",
  3317: "metals-mining",
  3320: "metals-mining",
  3330: "metals-mining",
  3334: "metals-mining",
  3341: "metals-mining",
  3350: "metals-mining",
  3356: "metals-mining",
  3360: "metals-mining",
  3390: "metals-mining",
  3411: "metals-mining",
  3412: "metals-mining",
  3420: "metals-mining",
  3440: "metals-mining",
  3460: "metals-mining",
  3462: "metals-mining",
  // Materials — Forest Products
  2400: "forest-products",
  2411: "forest-products",
  2421: "forest-products",
  2430: "forest-products",
  2435: "forest-products",
  2436: "forest-products",
  2451: "forest-products",
  2452: "forest-products",
  2611: "forest-products",
  2621: "forest-products",
  2631: "forest-products",
  2650: "forest-products",
  2670: "forest-products",
};

/** 2-digit SIC → industry fallback (broader grouping) */
const SIC2_INDUSTRY: Record<number, IndustryId> = {
  10: "mining",
  11: "mining",
  12: "mining",
  13: "oil-gas",
  14: "mining",
  15: "construction",
  16: "construction",
  17: "construction",
  20: "food-beverage",
  21: "consumer-products",
  22: "consumer-products",
  23: "consumer-products",
  24: "forest-products",
  25: "consumer-products",
  26: "forest-products",
  27: "media",
  28: "chemicals",
  29: "oil-gas",
  30: "chemicals",
  31: "consumer-products",
  32: "metals-mining",
  33: "metals-mining",
  34: "machinery",
  35: "computer-hardware",
  36: "electronic-equipment",
  37: "automotive",
  38: "medical-devices",
  39: "consumer-products",
  40: "transportation",
  41: "transportation",
  42: "transportation",
  43: "transportation",
  44: "transportation",
  45: "transportation",
  46: "oil-gas",
  47: "transportation",
  48: "telecom",
  49: "electric-utilities",
  50: "wholesale",
  51: "wholesale",
  52: "retail",
  53: "retail",
  54: "retail",
  55: "retail",
  56: "retail",
  57: "retail",
  58: "restaurants",
  59: "retail",
  60: "banking",
  61: "investment-services",
  62: "investment-services",
  63: "insurance",
  64: "insurance",
  65: "real-estate-services",
  66: "banking",
  67: "holding-companies",
  70: "consumer-products",
  71: "consumer-products",
  72: "consumer-products",
  73: "software",
  80: "health-services",
  81: "other",
  82: "other",
  83: "other",
  84: "other",
  86: "other",
  87: "it-services",
  89: "other",
};

const INDUSTRY_NAMES: Record<IndustryId, string> = {
  software: "Software",
  semiconductors: "Semiconductors",
  "it-services": "IT Services",
  "computer-hardware": "Computer Hardware",
  "electronic-equipment": "Electronic Equipment",
  pharmaceuticals: "Pharmaceuticals",
  biotechnology: "Biotechnology",
  "medical-devices": "Medical Devices",
  "health-services": "Health Services",
  banking: "Banking",
  "investment-services": "Investment Services",
  insurance: "Insurance",
  "asset-management": "Asset Management",
  "holding-companies": "Holding Companies",
  "oil-gas": "Oil & Gas",
  mining: "Mining",
  "energy-services": "Energy Services",
  retail: "Retail",
  "food-beverage": "Food & Beverage",
  restaurants: "Restaurants",
  "consumer-products": "Consumer Products",
  wholesale: "Wholesale",
  "aerospace-defense": "Aerospace & Defense",
  automotive: "Automotive",
  machinery: "Machinery",
  construction: "Construction",
  transportation: "Transportation",
  telecom: "Telecom",
  media: "Media",
  reits: "REITs",
  "real-estate-services": "Real Estate Services",
  "electric-utilities": "Electric Utilities",
  "gas-utilities": "Gas Utilities",
  "water-utilities": "Water Utilities",
  chemicals: "Chemicals",
  "metals-mining": "Metals & Mining",
  "forest-products": "Forest Products",
  other: "Other",
};

/**
 * Convert a SIC code to an industry classification.
 * Checks 4-digit exact match first, then falls back to 2-digit mapping.
 */
export function sicToIndustry(sic: number): IndustryId {
  if (SIC4_INDUSTRY[sic]) return SIC4_INDUSTRY[sic];
  const sic2 = Math.floor(sic / 100);
  return SIC2_INDUSTRY[sic2] ?? "other";
}

/** Get human-readable sector name */
export function getSectorName(id: SectorId): string {
  return SECTOR_NAMES[id];
}

/** Get human-readable industry name */
export function getIndustryName(id: IndustryId): string {
  return INDUSTRY_NAMES[id];
}

/** Get all sector IDs */
export function getAllSectors(): SectorId[] {
  return Object.keys(SECTOR_NAMES) as SectorId[];
}

/** Get all industry IDs */
export function getAllIndustries(): IndustryId[] {
  return Object.keys(INDUSTRY_NAMES) as IndustryId[];
}
