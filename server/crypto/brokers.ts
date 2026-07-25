/**
 * Banxico Plus LLC — Crypto Broker Registry
 * Brokers activos: OKX (principal) · Kraken (respaldo) · Binance (inactivo)
 *
 * Regulatory frameworks covered:
 *   - FATF Recommendations (2023)
 *   - FinCEN MSB registration (31 CFR Part 1022)
 *   - OFAC SDN sanctions screening
 *   - EU 5AMLD / MiCA
 *   - Mexico CNBV / SAT Ley Fintech (DOF 9-Mar-2018)
 *   - FATF Travel Rule (≥ $3,000 USD threshold)
 */

export type BrokerType    = "cex" | "data_provider" | "aggregator" | "dex";
export type BrokerStatus  = "active" | "inactive" | "restricted" | "suspended" | "monitoring";
export type KycTier       = "none" | "tier1_basic" | "tier2_enhanced" | "tier3_full";
export type ComplianceStatus = "compliant" | "partial" | "non_compliant" | "unknown";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface AmlParams {
  maxTxUSD:                 number;
  travelRuleThresholdUSD:   number;
  ctrThresholdUSD:          number;
  dailyLimitUSD:            number;
  monthlyLimitUSD:          number;
  requiresKyc:              boolean;
  kycTier:                  KycTier;
  requiresSar:              boolean;
  fatfCompliant:            boolean;
  fincenMsb:                boolean;
  micaCompliant:            boolean;
  cnbvAuthorized:           boolean;
  ofacScreening:            boolean;
  onChainAnalytics:         boolean;
  complianceStatus:         ComplianceStatus;
  regulatoryNotes:          string;
}

export interface GeoRestrictions {
  blockedCountries:  string[];
  restrictedRegions: string[];
  vpnBlocking:       boolean;
  geoEnforcement:    boolean;
}

export interface NetworkChain {
  id:                  string;
  name:                string;
  token:               string;
  minConfirmations:    number;
  avgConfirmTimeMin:   number;
  withdrawalFee:       number;
  minWithdrawal:       number;
  depositEnabled:      boolean;
  withdrawEnabled:     boolean;
}

export interface FeeSchedule {
  maker:           number;
  taker:           number;
  otcFee?:         number;
  withdrawalModel: "flat" | "percentage";
}

export interface RateLimit {
  publicRpm:       number;
  privateRpm:      number;
  dailyCap:        number;
  requiresApiKey:  boolean;
  apiKeyEnvVar?:   string;
}

export interface BrokerCapabilities {
  spotTrading:       boolean;
  futuresTrading:    boolean;
  otcDesk:           boolean;
  priceData:         boolean;
  withdrawals:       boolean;
  deposits:          boolean;
  custodial:         boolean;
  fiatOnRamp:        boolean;
  travelRuleSupport: boolean;
}

export interface Broker {
  id:              string;
  name:            string;
  legalName:       string;
  type:            BrokerType;
  status:          BrokerStatus;
  priority:        number;
  apiBase:         string;
  statusUrl:       string;
  active:          boolean;
  inactiveReason?: string;
  jurisdiction:    string;
  founded:         number;
  aml:             AmlParams;
  geo:             GeoRestrictions;
  networks:        NetworkChain[];
  fees:            FeeSchedule;
  rateLimit:       RateLimit;
  capabilities:    BrokerCapabilities;
  notes:           string;
}

// ─── Network catalog ──────────────────────────────────────────────────────────

const TRC20: NetworkChain = {
  id: "trc20", name: "TRON (TRC-20)", token: "USDT",
  minConfirmations: 20, avgConfirmTimeMin: 3,
  withdrawalFee: 1, minWithdrawal: 10,
  depositEnabled: true, withdrawEnabled: true,
};
const ERC20: NetworkChain = {
  id: "erc20", name: "Ethereum (ERC-20)", token: "USDT",
  minConfirmations: 12, avgConfirmTimeMin: 15,
  withdrawalFee: 15, minWithdrawal: 30,
  depositEnabled: true, withdrawEnabled: true,
};
const BEP20: NetworkChain = {
  id: "bep20", name: "BNB Smart Chain (BEP-20)", token: "USDT",
  minConfirmations: 15, avgConfirmTimeMin: 1,
  withdrawalFee: 0.8, minWithdrawal: 5,
  depositEnabled: true, withdrawEnabled: true,
};
const SOL_CHAIN: NetworkChain = {
  id: "sol", name: "Solana SPL", token: "USDT",
  minConfirmations: 31, avgConfirmTimeMin: 1,
  withdrawalFee: 1, minWithdrawal: 10,
  depositEnabled: true, withdrawEnabled: true,
};
const POLYGON: NetworkChain = {
  id: "polygon", name: "Polygon PoS", token: "USDT",
  minConfirmations: 256, avgConfirmTimeMin: 5,
  withdrawalFee: 1, minWithdrawal: 5,
  depositEnabled: true, withdrawEnabled: true,
};
const ARBITRUM: NetworkChain = {
  id: "arb", name: "Arbitrum One", token: "USDT",
  minConfirmations: 1, avgConfirmTimeMin: 1,
  withdrawalFee: 1, minWithdrawal: 5,
  depositEnabled: true, withdrawEnabled: true,
};
const BTC_MAIN: NetworkChain = {
  id: "btc", name: "Bitcoin (mainnet)", token: "BTC",
  minConfirmations: 3, avgConfirmTimeMin: 30,
  withdrawalFee: 0.0002, minWithdrawal: 0.001,
  depositEnabled: true, withdrawEnabled: true,
};
const LTC_MAIN: NetworkChain = {
  id: "ltc", name: "Litecoin (mainnet)", token: "LTC",
  minConfirmations: 6, avgConfirmTimeMin: 8,
  withdrawalFee: 0.001, minWithdrawal: 0.01,
  depositEnabled: true, withdrawEnabled: true,
};

// ─── Broker registry ─────────────────────────────────────────────────────────

export const BROKER_REGISTRY: Broker[] = [

  // ── Binance ──────────────────────────────────────────────────────────────────
  {
    id:          "binance",
    name:        "Binance",
    legalName:   "BAM Trading Services Inc. (US) / Binance Holdings Ltd. (Global)",
    type:        "cex",
    status:      "restricted",
    priority:    1,
    active:      false,
    apiBase:     "https://api.binance.com",
    statusUrl:   "https://api.binance.com/api/v3/ping",
    inactiveReason: "RESTRINGIDO — HTTP 451 · Geobloqueado por ubicación del servidor (OFAC/FinCEN compliance)",
    jurisdiction: "Cayman Islands / United States",
    founded:     2017,
    aml: {
      maxTxUSD:                 2_000_000,
      travelRuleThresholdUSD:   3_000,
      ctrThresholdUSD:          10_000,
      dailyLimitUSD:            5_000_000,
      monthlyLimitUSD:          50_000_000,
      requiresKyc:              true,
      kycTier:                  "tier3_full",
      requiresSar:              true,
      fatfCompliant:            true,
      fincenMsb:                true,
      micaCompliant:            false,
      cnbvAuthorized:           false,
      ofacScreening:            true,
      onChainAnalytics:         true,
      complianceStatus:         "partial",
      regulatoryNotes:
        "DOJ/FinCEN settlement $4.3B (Nov 2023). CEO Zhao plea agreement. Monitor compliance 2024-2028. " +
        "FinCEN MSB registrado. OFAC screening activo vía Chainalysis KYT. " +
        "Binance.US opera separadamente como entidad FinCEN-MSB en EE.UU.",
    },
    geo: {
      blockedCountries:  ["IR","KP","CU","SY","SD","MM","AF","BY","BI","CF","CD","GN","GW","HT","LB","LY","ML","NI","RU","SO","SS","YE","ZW"],
      restrictedRegions: ["US"],
      vpnBlocking:       true,
      geoEnforcement:    true,
    },
    networks: [TRC20, ERC20, BEP20, SOL_CHAIN, POLYGON, ARBITRUM, BTC_MAIN, LTC_MAIN],
    fees: { maker: 0.10, taker: 0.10, otcFee: 0.02, withdrawalModel: "flat" },
    rateLimit: {
      publicRpm:      1200,
      privateRpm:      600,
      dailyCap:          0,
      requiresApiKey: false,
    },
    capabilities: {
      spotTrading: true, futuresTrading: true, otcDesk: true,
      priceData:   true, withdrawals:    true, deposits: true,
      custodial:   true, fiatOnRamp:     true, travelRuleSupport: true,
    },
    notes:
      "Broker principal. Acceso API restringido desde servidor por geolocalización (HTTP 451). " +
      "Precios obtenidos vía Binance Data Stream o endpoint público alternativo. " +
      "DOJ consent agreement activo — enhanced compliance monitoring hasta 2028.",
  },

  // ── OKX ───────────────────────────────────────────────────────────────────────
  {
    id:          "okx",
    name:        "OKX",
    legalName:   "OKX Technology Company Limited",
    type:        "cex",
    status:      "active",
    priority:    1,
    active:      true,
    apiBase:     process.env.OKX_URL ?? "https://www.okx.com",
    statusUrl:   "https://www.okx.com/api/v5/system/status",
    jurisdiction: "Seychelles / Malta",
    founded:     2017,
    aml: {
      maxTxUSD:                 2_000_000,
      travelRuleThresholdUSD:   3_000,
      ctrThresholdUSD:          10_000,
      dailyLimitUSD:            10_000_000,
      monthlyLimitUSD:          100_000_000,
      requiresKyc:              true,
      kycTier:                  "tier3_full",
      requiresSar:              true,
      fatfCompliant:            true,
      fincenMsb:                false,
      micaCompliant:            true,
      cnbvAuthorized:           false,
      ofacScreening:            true,
      onChainAnalytics:         true,
      complianceStatus:         "compliant",
      regulatoryNotes:
        "Regulado en Malta (MGA) y Dubai (VARA). MiCA compliant (EU). " +
        "OFAC screening activo. Travel Rule vía Notabene. " +
        "KYC obligatorio desde Nivel 1. Programa de monitoreo AML 24/7. " +
        "Sin licencia FinCEN MSB — operaciones no disponibles en EE.UU. directo.",
    },
    geo: {
      blockedCountries:  ["US","IR","KP","CU","SY","RU","SD","MM","AF"],
      restrictedRegions: [],
      vpnBlocking:       false,
      geoEnforcement:    true,
    },
    networks: [TRC20, ERC20, BEP20, SOL_CHAIN, POLYGON, ARBITRUM, BTC_MAIN, LTC_MAIN],
    fees: { maker: 0.08, taker: 0.10, otcFee: 0.02, withdrawalModel: "flat" },
    rateLimit: {
      publicRpm:      600,
      privateRpm:     300,
      dailyCap:          0,
      requiresApiKey: false,
      apiKeyEnvVar:   "OKX_API_KEY",
    },
    capabilities: {
      spotTrading: true, futuresTrading: true, otcDesk: true,
      priceData:   true, withdrawals:    true, deposits: true,
      custodial:   true, fiatOnRamp:     true, travelRuleSupport: true,
    },
    notes:
      "Broker principal activo. API pública de alto volumen (~20 req/2s). " +
      "Fuente primaria de precios. Tercer exchange por volumen global. " +
      "API privada lista para órdenes y retiros (requiere OKX_API_KEY + OKX_API_SECRET + OKX_API_PASSPHRASE).",
  },

  // ── Kraken ────────────────────────────────────────────────────────────────────
  {
    id:          "kraken",
    name:        "Kraken",
    legalName:   "Payward Inc.",
    type:        "cex",
    status:      "monitoring",
    priority:    2,
    active:      false,
    inactiveReason: "Reemplazado por OKX como broker principal — disponible como respaldo",
    apiBase:     process.env.KRAKEN_URL ?? "https://api.kraken.com",
    statusUrl:   `${(process.env.KRAKEN_URL ?? "https://api.kraken.com").replace(/\/$/, "")}/0/public/SystemStatus`,
    jurisdiction: "United States",
    founded:     2011,
    aml: {
      maxTxUSD:                 1_000_000,
      travelRuleThresholdUSD:   3_000,
      ctrThresholdUSD:          10_000,
      dailyLimitUSD:            5_000_000,
      monthlyLimitUSD:          25_000_000,
      requiresKyc:              true,
      kycTier:                  "tier3_full",
      requiresSar:              true,
      fatfCompliant:            true,
      fincenMsb:                true,
      micaCompliant:            true,
      cnbvAuthorized:           false,
      ofacScreening:            true,
      onChainAnalytics:         true,
      complianceStatus:         "compliant",
      regulatoryNotes:
        "FinCEN MSB registrado desde 2013. EU MiCA compliant. " +
        "OFAC screening vía Chainalysis KYT. Travel Rule vía Notabene.",
    },
    geo: {
      blockedCountries:  ["IR","KP","CU","SY","RU"],
      restrictedRegions: [],
      vpnBlocking:       false,
      geoEnforcement:    true,
    },
    networks: [ERC20, TRC20, BTC_MAIN, LTC_MAIN, SOL_CHAIN, POLYGON],
    fees: { maker: 0.16, taker: 0.26, otcFee: 0.05, withdrawalModel: "flat" },
    rateLimit: {
      publicRpm:      60,
      privateRpm:     60,
      dailyCap:        0,
      requiresApiKey: false,
      apiKeyEnvVar:   "KRAKEN_API_KEY",
    },
    capabilities: {
      spotTrading: true, futuresTrading: true, otcDesk: true,
      priceData:   true, withdrawals:    true, deposits: true,
      custodial:   true, fiatOnRamp:     true, travelRuleSupport: true,
    },
    notes:
      "Broker de respaldo. FinCEN/MiCA fully compliant. " +
      "Entra en operación si OKX falla. API privada lista (KRAKEN_API_KEY + KRAKEN_API_SECRET).",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getActiveBrokers(): Broker[] {
  return BROKER_REGISTRY
    .filter(b => b.active)
    .sort((a, b) => a.priority - b.priority);
}

export function getBroker(id: string): Broker | undefined {
  return BROKER_REGISTRY.find(b => b.id === id);
}

export function getDataProviders(): Broker[] {
  return BROKER_REGISTRY
    .filter(b => b.capabilities.priceData && b.active)
    .sort((a, b) => a.priority - b.priority);
}

export function getDispersalBroker(): Broker | undefined {
  return BROKER_REGISTRY
    .filter(b => b.active && b.capabilities.withdrawals)
    .sort((a, b) => a.priority - b.priority)[0];
}

/** AML compliance check for a given USD amount */
export function checkAmlThreshold(
  brokerId: string,
  amountUSD: number,
): { ok: boolean; level: "clear" | "enhanced_dd" | "sar" | "blocked"; reason: string } {
  const broker = getBroker(brokerId);
  if (!broker) return { ok: false, level: "blocked", reason: "Broker no registrado" };

  const { aml } = broker;
  if (aml.maxTxUSD > 0 && amountUSD > aml.maxTxUSD)
    return { ok: false, level: "blocked", reason: `Excede límite por transacción: $${aml.maxTxUSD.toLocaleString()} USD` };
  if (aml.ctrThresholdUSD > 0 && amountUSD >= aml.ctrThresholdUSD)
    return { ok: true, level: "sar",         reason: `CTR requerido (≥ $${aml.ctrThresholdUSD.toLocaleString()} USD)` };
  if (aml.travelRuleThresholdUSD > 0 && amountUSD >= aml.travelRuleThresholdUSD)
    return { ok: true, level: "enhanced_dd", reason: `FATF Travel Rule aplica (≥ $${aml.travelRuleThresholdUSD.toLocaleString()} USD)` };
  return { ok: true, level: "clear", reason: "Dentro de umbrales AML" };
}

/** Serializable summary for API responses */
export function brokerSummary(b: Broker) {
  return {
    id:             b.id,
    name:           b.name,
    legalName:      b.legalName,
    type:           b.type,
    status:         b.status,
    active:         b.active,
    priority:       b.priority,
    jurisdiction:   b.jurisdiction,
    founded:        b.founded,
    inactiveReason: b.inactiveReason,
    capabilities:   b.capabilities,
    fees:           b.fees,
    rateLimit:      b.rateLimit,
    aml:            b.aml,
    geo:            { blockedCountries: b.geo.blockedCountries, vpnBlocking: b.geo.vpnBlocking, geoEnforcement: b.geo.geoEnforcement },
    networks:       b.networks,
    notes:          b.notes,
  };
}
