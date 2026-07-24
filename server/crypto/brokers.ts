/**
 * Banxico Plus LLC — Crypto Broker Registry
 * Registro centralizado de brokers/exchanges con parámetros de compliance AML/KYC.
 *
 * Regulatory frameworks covered:
 *   - FATF Recommendations (2023)
 *   - FinCEN MSB registration (31 CFR Part 1022)
 *   - OFAC SDN/OFAC sanctions screening
 *   - EU 5AMLD / MiCA
 *   - Mexico CNBV / SAT Ley Fintech (DOF 9-Mar-2018)
 *   - FATF Travel Rule (≥ $3,000 USD threshold)
 */

export type BrokerType = "cex" | "data_provider" | "aggregator" | "dex";
export type BrokerStatus = "active" | "inactive" | "restricted" | "suspended" | "monitoring";
export type KycTier = "none" | "tier1_basic" | "tier2_enhanced" | "tier3_full";
export type ComplianceStatus = "compliant" | "partial" | "non_compliant" | "unknown";

// ─── Compliance ────────────────────────────────────────────────────────────────

export interface AmlParams {
  /** Maximum USD equivalent per single transaction before enhanced due diligence */
  maxTxUSD: number;
  /** FATF Travel Rule trigger threshold (USD) */
  travelRuleThresholdUSD: number;
  /** FinCEN Currency Transaction Report threshold */
  ctrThresholdUSD: number;
  /** Daily cumulative limit (USD) per user */
  dailyLimitUSD: number;
  /** Monthly cumulative limit (USD) per user */
  monthlyLimitUSD: number;
  /** Requires KYC before trading */
  requiresKyc: boolean;
  /** KYC tier required for full access */
  kycTier: KycTier;
  /** Suspicious Activity Report filing required */
  requiresSar: boolean;
  /** FATF Recommendations compliant */
  fatfCompliant: boolean;
  /** Registered as US Money Services Business with FinCEN */
  fincenMsb: boolean;
  /** EU MiCA compliant (Markets in Crypto-Assets) */
  micaCompliant: boolean;
  /** Mexico CNBV / Ley Fintech authorized */
  cnbvAuthorized: boolean;
  /** OFAC SDN screening on counterparties */
  ofacScreening: boolean;
  /** Chainalysis / TRM integration for on-chain analytics */
  onChainAnalytics: boolean;
  /** Overall compliance posture */
  complianceStatus: ComplianceStatus;
  /** Applicable regulatory notes */
  regulatoryNotes: string;
}

export interface GeoRestrictions {
  /** ISO 3166-1 alpha-2 country codes blocked */
  blockedCountries: string[];
  /** Restricted regions (state/province level) */
  restrictedRegions: string[];
  /** Requires VPN detection */
  vpnBlocking: boolean;
  /** IP geolocation enforcement */
  geoEnforcement: boolean;
}

export interface NetworkChain {
  id: string;
  name: string;
  token: string;
  minConfirmations: number;
  avgConfirmTimeMin: number;
  /** Withdrawal fee in native token */
  withdrawalFee: number;
  /** Minimum withdrawal (native token) */
  minWithdrawal: number;
  /** Deposit enabled */
  depositEnabled: boolean;
  /** Withdrawal enabled */
  withdrawEnabled: boolean;
}

export interface FeeSchedule {
  /** Maker fee % */
  maker: number;
  /** Taker fee % */
  taker: number;
  /** OTC desk fee % (if available) */
  otcFee?: number;
  /** Withdrawal fee model: flat | percentage */
  withdrawalModel: "flat" | "percentage";
}

export interface RateLimit {
  /** Public endpoints: requests per minute */
  publicRpm: number;
  /** Private/authenticated endpoints: requests per minute */
  privateRpm: number;
  /** Daily request cap (0 = unlimited) */
  dailyCap: number;
  /** Requires API key for market data */
  requiresApiKey: boolean;
  /** API key env var name */
  apiKeyEnvVar?: string;
}

export interface BrokerCapabilities {
  spotTrading: boolean;
  futuresTrading: boolean;
  otcDesk: boolean;
  priceData: boolean;
  withdrawals: boolean;
  deposits: boolean;
  custodial: boolean;
  fiatOnRamp: boolean;
  travelRuleSupport: boolean;
}

export interface Broker {
  id: string;
  name: string;
  legalName: string;
  type: BrokerType;
  /** Operational status */
  status: BrokerStatus;
  /** Lower = higher priority in aggregation */
  priority: number;
  /** Base API URL */
  apiBase: string;
  /** Health-check / status endpoint */
  statusUrl: string;
  /** Whether Banxico Plus LLC actively routes through this broker */
  active: boolean;
  /** Reason if inactive/restricted */
  inactiveReason?: string;
  /** Jurisdiction of incorporation */
  jurisdiction: string;
  /** Founded year */
  founded: number;
  aml: AmlParams;
  geo: GeoRestrictions;
  /** Supported networks/chains */
  networks: NetworkChain[];
  fees: FeeSchedule;
  rateLimit: RateLimit;
  capabilities: BrokerCapabilities;
  /** CMC / CoinGecko symbol map for price data */
  symbolMap?: Record<string, string | number>;
  /** Internal notes */
  notes: string;
}

// ─── Network catalog ─────────────────────────────────────────────────────────

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

const BITCOIN_MAIN: NetworkChain = {
  id: "btc", name: "Bitcoin (mainnet)", token: "BTC",
  minConfirmations: 3, avgConfirmTimeMin: 30,
  withdrawalFee: 0.0002, minWithdrawal: 0.001,
  depositEnabled: true, withdrawEnabled: true,
};

const LITECOIN_MAIN: NetworkChain = {
  id: "ltc", name: "Litecoin (mainnet)", token: "LTC",
  minConfirmations: 6, avgConfirmTimeMin: 8,
  withdrawalFee: 0.001, minWithdrawal: 0.01,
  depositEnabled: true, withdrawEnabled: true,
};

// ─── Broker registry ─────────────────────────────────────────────────────────

export const BROKER_REGISTRY: Broker[] = [

  // ── KuCoin ──────────────────────────────────────────────────────────────────
  {
    id:          "kucoin",
    name:        "KuCoin",
    legalName:   "Mek Global Limited",
    type:        "cex",
    status:      "active",
    priority:    1,
    apiBase:     "https://api.kucoin.com",
    statusUrl:   "https://api.kucoin.com/api/v1/status",
    active:      true,
    jurisdiction: "Seychelles",
    founded:     2017,
    aml: {
      maxTxUSD:                 500_000,
      travelRuleThresholdUSD:   3_000,
      ctrThresholdUSD:          10_000,
      dailyLimitUSD:            1_000_000,
      monthlyLimitUSD:          10_000_000,
      requiresKyc:              true,
      kycTier:                  "tier2_enhanced",
      requiresSar:              true,
      fatfCompliant:            true,
      fincenMsb:                false,
      micaCompliant:            false,
      cnbvAuthorized:           false,
      ofacScreening:            true,
      onChainAnalytics:         true,
      complianceStatus:         "partial",
      regulatoryNotes:          "Seychelles FSA licensed. FATF Travel Rule implemented via Notabene. OFAC sanctions screening active. No US customers.",
    },
    geo: {
      blockedCountries:  ["US", "IR", "KP", "CU", "SY", "SD", "MM", "RU"],
      restrictedRegions: ["NY"],
      vpnBlocking:       true,
      geoEnforcement:    true,
    },
    networks: [TRC20, ERC20, BEP20, SOL_CHAIN, POLYGON, ARBITRUM, BITCOIN_MAIN, LITECOIN_MAIN],
    fees: { maker: 0.10, taker: 0.10, otcFee: 0.05, withdrawalModel: "flat" },
    rateLimit: {
      publicRpm:    300,
      privateRpm:   200,
      dailyCap:     0,
      requiresApiKey: false,
    },
    capabilities: {
      spotTrading: true, futuresTrading: true, otcDesk: true,
      priceData: true, withdrawals: true, deposits: true,
      custodial: true, fiatOnRamp: false, travelRuleSupport: true,
    },
    notes: "Broker activo de dispersión. TRC-20 USDT habilitado para salidas. Latencia API típica < 200ms.",
  },

  // ── CoinMarketCap ───────────────────────────────────────────────────────────
  {
    id:          "coinmarketcap",
    name:        "CoinMarketCap",
    legalName:   "Coral Intermediate, Inc. (Binance Group)",
    type:        "data_provider",
    status:      "active",
    priority:    2,
    apiBase:     "https://pro-api.coinmarketcap.com",
    statusUrl:   "https://pro-api.coinmarketcap.com/v1/key/info",
    active:      true,
    jurisdiction: "United States",
    founded:     2013,
    aml: {
      maxTxUSD:                 0,
      travelRuleThresholdUSD:   0,
      ctrThresholdUSD:          0,
      dailyLimitUSD:            0,
      monthlyLimitUSD:          0,
      requiresKyc:              false,
      kycTier:                  "none",
      requiresSar:              false,
      fatfCompliant:            true,
      fincenMsb:                false,
      micaCompliant:            true,
      cnbvAuthorized:           false,
      ofacScreening:            false,
      onChainAnalytics:         false,
      complianceStatus:         "compliant",
      regulatoryNotes:          "Data aggregator only. No custody or trading. SEC registered. FinCEN-friendly data partner.",
    },
    geo: {
      blockedCountries:  [],
      restrictedRegions: [],
      vpnBlocking:       false,
      geoEnforcement:    false,
    },
    networks: [],
    fees: { maker: 0, taker: 0, withdrawalModel: "flat" },
    rateLimit: {
      publicRpm:     0,
      privateRpm:    30,
      dailyCap:      333,     // Free tier: 10k/month
      requiresApiKey: true,
      apiKeyEnvVar:  "CMC_API_KEY",
    },
    capabilities: {
      spotTrading: false, futuresTrading: false, otcDesk: false,
      priceData: true, withdrawals: false, deposits: false,
      custodial: false, fiatOnRamp: false, travelRuleSupport: false,
    },
    symbolMap: {
      btc: 1, eth: 1027, xrp: 52, ltc: 2, doge: 74,
      sol: 5426, ada: 2010, dot: 6636, usdt: 825,
    },
    notes: "Fuente de precios secundaria. API key requerida (CMC_API_KEY). Free tier: 10,000 calls/mes.",
  },

  // ── CoinGecko ───────────────────────────────────────────────────────────────
  {
    id:          "coingecko",
    name:        "CoinGecko",
    legalName:   "Gecko Labs Pte. Ltd.",
    type:        "data_provider",
    status:      "active",
    priority:    3,
    apiBase:     "https://api.coingecko.com",
    statusUrl:   "https://api.coingecko.com/api/v3/ping",
    active:      true,
    jurisdiction: "Singapore",
    founded:     2014,
    aml: {
      maxTxUSD:                 0,
      travelRuleThresholdUSD:   0,
      ctrThresholdUSD:          0,
      dailyLimitUSD:            0,
      monthlyLimitUSD:          0,
      requiresKyc:              false,
      kycTier:                  "none",
      requiresSar:              false,
      fatfCompliant:            true,
      fincenMsb:                false,
      micaCompliant:            true,
      cnbvAuthorized:           false,
      ofacScreening:            false,
      onChainAnalytics:         false,
      complianceStatus:         "compliant",
      regulatoryNotes:          "Data aggregator only. MAS-regulated Singapore entity. No custody.",
    },
    geo: {
      blockedCountries:  [],
      restrictedRegions: [],
      vpnBlocking:       false,
      geoEnforcement:    false,
    },
    networks: [],
    fees: { maker: 0, taker: 0, withdrawalModel: "flat" },
    rateLimit: {
      publicRpm:     10,
      privateRpm:    50,
      dailyCap:      0,
      requiresApiKey: false,
      apiKeyEnvVar:  "COINGECKO_API_KEY",
    },
    capabilities: {
      spotTrading: false, futuresTrading: false, otcDesk: false,
      priceData: true, withdrawals: false, deposits: false,
      custodial: false, fiatOnRamp: false, travelRuleSupport: false,
    },
    symbolMap: {
      btc: "bitcoin", eth: "ethereum", xrp: "ripple", ltc: "litecoin",
      doge: "dogecoin", sol: "solana", ada: "cardano", dot: "polkadot", usdt: "tether",
    },
    notes: "Fuente de precios primaria (sin API key). Rate limit: 10-30 req/min en free tier.",
  },

  // ── OKX ─────────────────────────────────────────────────────────────────────
  {
    id:          "okx",
    name:        "OKX",
    legalName:   "Aux Cayes FinTech Co. Ltd.",
    type:        "cex",
    status:      "monitoring",
    priority:    4,
    apiBase:     "https://www.okx.com",
    statusUrl:   "https://www.okx.com/api/v5/public/time",
    active:      false,
    inactiveReason: "En evaluación — pendiente de acuerdo comercial",
    jurisdiction: "Seychelles",
    founded:     2017,
    aml: {
      maxTxUSD:                 1_000_000,
      travelRuleThresholdUSD:   3_000,
      ctrThresholdUSD:          10_000,
      dailyLimitUSD:            2_000_000,
      monthlyLimitUSD:          20_000_000,
      requiresKyc:              true,
      kycTier:                  "tier2_enhanced",
      requiresSar:              true,
      fatfCompliant:            true,
      fincenMsb:                false,
      micaCompliant:            true,
      cnbvAuthorized:           false,
      ofacScreening:            true,
      onChainAnalytics:         true,
      complianceStatus:         "compliant",
      regulatoryNotes:          "MiCA compliant. VASP registered in Malta. FATF Travel Rule via Notabene. Chainalysis KYT integration.",
    },
    geo: {
      blockedCountries:  ["US", "IR", "KP", "CU", "SY"],
      restrictedRegions: [],
      vpnBlocking:       true,
      geoEnforcement:    true,
    },
    networks: [TRC20, ERC20, BEP20, SOL_CHAIN, POLYGON, ARBITRUM, BITCOIN_MAIN],
    fees: { maker: 0.08, taker: 0.10, otcFee: 0.03, withdrawalModel: "flat" },
    rateLimit: {
      publicRpm:     20,
      privateRpm:    60,
      dailyCap:      0,
      requiresApiKey: false,
    },
    capabilities: {
      spotTrading: true, futuresTrading: true, otcDesk: true,
      priceData: true, withdrawals: true, deposits: true,
      custodial: true, fiatOnRamp: false, travelRuleSupport: true,
    },
    notes: "Alternativa potencial a KuCoin. MiCA compliant. Mejor fee maker (0.08%).",
  },

  // ── Binance ──────────────────────────────────────────────────────────────────
  {
    id:          "binance",
    name:        "Binance",
    legalName:   "BAM Trading Services Inc. (US) / Binance Holdings Ltd. (Global)",
    type:        "cex",
    status:      "restricted",
    priority:    99,
    apiBase:     "https://api.binance.com",
    statusUrl:   "https://api.binance.com/api/v3/ping",
    active:      false,
    inactiveReason: "HTTP 451 — Geobloqueado por ubicación del servidor (OFAC/FinCEN compliance). Acceso restringido desde IP de EE.UU.",
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
      regulatoryNotes:          "DOJ/FinCEN $4.3B settlement (Nov 2023). CEO Zhao plea agreement. Enhanced monitoring until 2028. Binance.US operates separately under FinCEN MSB.",
    },
    geo: {
      blockedCountries:  ["IR", "KP", "CU", "SY", "SD", "MM", "AF", "BY", "BI", "CF", "CD", "GN", "GW", "HT", "LB", "LY", "ML", "NI", "RU", "SO", "SS", "YE", "ZW"],
      restrictedRegions: ["US"],
      vpnBlocking:       true,
      geoEnforcement:    true,
    },
    networks: [TRC20, ERC20, BEP20, SOL_CHAIN, POLYGON, ARBITRUM, BITCOIN_MAIN, LITECOIN_MAIN],
    fees: { maker: 0.10, taker: 0.10, otcFee: 0.02, withdrawalModel: "flat" },
    rateLimit: {
      publicRpm:     1200,
      privateRpm:    600,
      dailyCap:      0,
      requiresApiKey: false,
    },
    capabilities: {
      spotTrading: true, futuresTrading: true, otcDesk: true,
      priceData: true, withdrawals: true, deposits: true,
      custodial: true, fiatOnRamp: true, travelRuleSupport: true,
    },
    notes: "RESTRINGIDO desde servidor. HTTP 451. DOJ settlement activo.",
  },

  // ── Kraken ───────────────────────────────────────────────────────────────────
  {
    id:          "kraken",
    name:        "Kraken",
    legalName:   "Payward Inc.",
    type:        "cex",
    status:      "inactive",
    priority:    98,
    apiBase:     "https://api.kraken.com",
    statusUrl:   "https://api.kraken.com/0/public/SystemStatus",
    active:      false,
    inactiveReason: "Participante del pool de margen — conflicto de interés como contraparte directa",
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
      regulatoryNotes:          "FinCEN MSB registered. NYDFS BitLicense (pending). EU MiCA compliant via Kraken Crypto Services Europe. SEC registered ATS (Kraken Pro).",
    },
    geo: {
      blockedCountries:  ["IR", "KP", "CU", "SY"],
      restrictedRegions: [],
      vpnBlocking:       false,
      geoEnforcement:    true,
    },
    networks: [TRC20, ERC20, BITCOIN_MAIN, LITECOIN_MAIN],
    fees: { maker: 0.16, taker: 0.26, withdrawalModel: "flat" },
    rateLimit: {
      publicRpm:     60,
      privateRpm:    60,
      dailyCap:      0,
      requiresApiKey: false,
    },
    capabilities: {
      spotTrading: true, futuresTrading: true, otcDesk: true,
      priceData: true, withdrawals: true, deposits: true,
      custodial: true, fiatOnRamp: true, travelRuleSupport: true,
    },
    notes: "INACTIVO por participación en pool de margen. Disponible como fallback.",
  },

  // ── Coinbase ─────────────────────────────────────────────────────────────────
  {
    id:          "coinbase",
    name:        "Coinbase",
    legalName:   "Coinbase Global, Inc.",
    type:        "cex",
    status:      "inactive",
    priority:    97,
    apiBase:     "https://api.coinbase.com",
    statusUrl:   "https://api.coinbase.com/v2/time",
    active:      false,
    inactiveReason: "Participante del pool de margen — conflicto de interés como contraparte directa",
    jurisdiction: "United States",
    founded:     2012,
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
      regulatoryNotes:          "NYSE-listed (COIN). FinCEN MSB. NYDFS BitLicense. EU MiCA authorized. SEC scrutiny on staking products (2023). OFAC screening via Chainalysis.",
    },
    geo: {
      blockedCountries:  ["IR", "KP", "CU", "SY", "RU"],
      restrictedRegions: [],
      vpnBlocking:       false,
      geoEnforcement:    true,
    },
    networks: [ERC20, BITCOIN_MAIN, SOL_CHAIN, POLYGON, ARBITRUM],
    fees: { maker: 0.40, taker: 0.60, withdrawalModel: "flat" },
    rateLimit: {
      publicRpm:     10,
      privateRpm:    30,
      dailyCap:      0,
      requiresApiKey: false,
    },
    capabilities: {
      spotTrading: true, futuresTrading: false, otcDesk: true,
      priceData: true, withdrawals: true, deposits: true,
      custodial: true, fiatOnRamp: true, travelRuleSupport: true,
    },
    notes: "INACTIVO por participación en pool de margen.",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Get all active brokers sorted by priority */
export function getActiveBrokers(): Broker[] {
  return BROKER_REGISTRY
    .filter(b => b.active && b.status === "active")
    .sort((a, b) => a.priority - b.priority);
}

/** Get broker by id */
export function getBroker(id: string): Broker | undefined {
  return BROKER_REGISTRY.find(b => b.id === id);
}

/** Get active data providers (price sources) sorted by priority */
export function getDataProviders(): Broker[] {
  return BROKER_REGISTRY
    .filter(b => b.capabilities.priceData && b.active)
    .sort((a, b) => a.priority - b.priority);
}

/** Get primary dispersal broker (first active CEX) */
export function getDispersalBroker(): Broker | undefined {
  return BROKER_REGISTRY
    .filter(b => b.active && b.status === "active" && b.type === "cex" && b.capabilities.withdrawals)
    .sort((a, b) => a.priority - b.priority)[0];
}

/** Compliance check: is amount within AML limits? */
export function checkAmlThreshold(
  brokerId: string,
  amountUSD: number,
): { ok: boolean; level: "clear" | "enhanced_dd" | "sar" | "blocked"; reason: string } {
  const broker = getBroker(brokerId);
  if (!broker) return { ok: false, level: "blocked", reason: "Broker no registrado" };

  const { aml } = broker;

  if (aml.maxTxUSD > 0 && amountUSD > aml.maxTxUSD) {
    return { ok: false, level: "blocked", reason: `Excede límite por transacción: $${aml.maxTxUSD.toLocaleString()} USD` };
  }
  if (aml.ctrThresholdUSD > 0 && amountUSD >= aml.ctrThresholdUSD) {
    return { ok: true, level: "sar", reason: `CTR requerido (≥ $${aml.ctrThresholdUSD.toLocaleString()} USD)` };
  }
  if (aml.travelRuleThresholdUSD > 0 && amountUSD >= aml.travelRuleThresholdUSD) {
    return { ok: true, level: "enhanced_dd", reason: `FATF Travel Rule aplica (≥ $${aml.travelRuleThresholdUSD.toLocaleString()} USD)` };
  }
  return { ok: true, level: "clear", reason: "Dentro de umbrales AML" };
}

/** Summary for API response — strips large arrays for list views */
export function brokerSummary(b: Broker) {
  return {
    id:              b.id,
    name:            b.name,
    type:            b.type,
    status:          b.status,
    active:          b.active,
    priority:        b.priority,
    jurisdiction:    b.jurisdiction,
    inactiveReason:  b.inactiveReason,
    capabilities:    b.capabilities,
    fees:            b.fees,
    aml: {
      maxTxUSD:              b.aml.maxTxUSD,
      travelRuleThresholdUSD: b.aml.travelRuleThresholdUSD,
      ctrThresholdUSD:       b.aml.ctrThresholdUSD,
      dailyLimitUSD:         b.aml.dailyLimitUSD,
      monthlyLimitUSD:       b.aml.monthlyLimitUSD,
      requiresKyc:           b.aml.requiresKyc,
      kycTier:               b.aml.kycTier,
      fatfCompliant:         b.aml.fatfCompliant,
      fincenMsb:             b.aml.fincenMsb,
      micaCompliant:         b.aml.micaCompliant,
      cnbvAuthorized:        b.aml.cnbvAuthorized,
      ofacScreening:         b.aml.ofacScreening,
      complianceStatus:      b.aml.complianceStatus,
      regulatoryNotes:       b.aml.regulatoryNotes,
    },
    geo: {
      blockedCountries:  b.geo.blockedCountries,
      vpnBlocking:       b.geo.vpnBlocking,
      geoEnforcement:    b.geo.geoEnforcement,
    },
    networks:  b.networks,
    rateLimit: b.rateLimit,
    notes:     b.notes,
  };
}
