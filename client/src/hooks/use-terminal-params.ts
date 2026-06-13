import { useState, useCallback } from "react";

export type ParamType = "text" | "toggle" | "select";

export interface TerminalParam {
  label: string;
  value: string;
  type: ParamType;
  options?: string[];
  group: string;
  highlight?: boolean;
}

export const DEFAULT_TERMINAL_PARAMS: TerminalParam[] = [
  // ── Identificación ──────────────────────────────────────────────────────────
  { label: "APLICACION",     value: "RETAIL",          type: "text",   group: "Identificación" },
  { label: "VERSION",        value: "PROVEEOPENAT400",  type: "text",   group: "Identificación" },
  { label: "AFILIACION",     value: "7705397",          type: "text",   group: "Identificación" },
  { label: "VERSION FECHA",  value: "JUN 13 2026",      type: "text",   group: "Identificación" },
  { label: "PCI REBOOT",     value: "03",               type: "text",   group: "Identificación" },
  { label: "ARRSVEC",        value: "1.10.213",         type: "text",   group: "Identificación" },
  { label: "REGISTRO VHO",   value: "V660p-A",          type: "text",   group: "Identificación" },
  { label: "VERSION EPROM",  value: "V660PT6 10.2",     type: "text",   group: "Identificación" },
  { label: "TIPO TERMINAL",  value: "V660p-A",          type: "text",   group: "Identificación" },
  { label: "SERIE NUMERO",   value: "T13-768-018",      type: "text",   group: "Identificación" },
  { label: "PTID",           value: "71376801",         type: "text",   group: "Identificación" },
  { label: "NII",            value: "016",              type: "text",   group: "Identificación" },
  { label: "NUM DE FOLIO",   value: "****8",            type: "text",   group: "Identificación" },
  { label: "BANCO",          value: "",                 type: "text",   group: "Identificación" },
  // ── Operación ────────────────────────────────────────────────────────────────
  { label: "TURNOS",         value: "1",                type: "text",   group: "Operación" },
  { label: "DCC MODE",       value: "0",                type: "text",   group: "Operación" },
  { label: "BN#",            value: "0",                type: "text",   group: "Operación" },
  { label: "IMP TICKET",     value: "3",                type: "text",   group: "Operación" },
  { label: "DEVOLUCION",     value: "3",                type: "text",   group: "Operación" },
  { label: "PAGOS DIF",      value: "06",               type: "text",   group: "Operación" },
  { label: "TX POR LLAVE T", value: "VENTA",            type: "select", group: "Operación",
    options: ["VENTA", "VENTA FORZADA", "DEVOLUCION", "CANCELACION"] },
  { label: "EMV MODULE",     value: "VOS2 VERTEX",      type: "text",   group: "Operación" },
  { label: "MODO COMUNI",    value: "SOLO ETHERNET",    type: "select", group: "Operación",
    options: ["SOLO ETHERNET", "WIFI", "GPRS", "DUAL ETHERNET/GPRS"] },
  // ── Funcionalidades ──────────────────────────────────────────────────────────
  { label: "VENTA FORZADA",  value: "SI", type: "toggle", group: "Funcionalidades", highlight: true },
  { label: "CASH BACK",      value: "SI", type: "toggle", group: "Funcionalidades" },
  { label: "TIEMPO AIRE",    value: "SI", type: "toggle", group: "Funcionalidades", highlight: true },
  { label: "CRIPTOGRAFIA",   value: "SI", type: "toggle", group: "Funcionalidades" },
  { label: "AMEX OPTBLUE",   value: "SI", type: "toggle", group: "Funcionalidades" },
  { label: "PLAN AMEX",      value: "SI", type: "toggle", group: "Funcionalidades" },
  { label: "MANEJO CTLS",    value: "SI", type: "toggle", group: "Funcionalidades" },
  { label: "MANEJO EMV",     value: "SI", type: "toggle", group: "Funcionalidades" },
  { label: "PP P400",        value: "SI", type: "toggle", group: "Funcionalidades", highlight: true },
  { label: "USUARIOS",       value: "SI", type: "toggle", group: "Funcionalidades", highlight: true },
  { label: "SERVICOMERCIO",  value: "SI", type: "toggle", group: "Funcionalidades", highlight: true },
  { label: "MOTO CVW2",      value: "SI", type: "toggle", group: "Funcionalidades", highlight: true },
  { label: "SUPER MANUAL",   value: "SI", type: "toggle", group: "Funcionalidades", highlight: true },
  { label: "COMM ELECTR",    value: "SI", type: "toggle", group: "Funcionalidades", highlight: true },
  { label: "OPS",            value: "SI", type: "toggle", group: "Funcionalidades", highlight: true },
  { label: "LEALTAD MEDA",   value: "SI", type: "toggle", group: "Funcionalidades", highlight: true },
  { label: "GIFTCARD",       value: "SI", type: "toggle", group: "Funcionalidades", highlight: true },
  { label: "ACTIVADO SSL",   value: "SI", type: "toggle", group: "Funcionalidades", highlight: true },
  { label: "ACTIVADO TLS",   value: "SI", type: "toggle", group: "Funcionalidades" },
];

const STORAGE_KEY = "banxico_terminal_params_v1";

export function useTerminalParams() {
  const [params, setParams] = useState<TerminalParam[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored: TerminalParam[] = JSON.parse(raw);
        // merge with defaults to pick up any new params added in future
        return DEFAULT_TERMINAL_PARAMS.map(def => {
          const found = stored.find(s => s.label === def.label);
          return found ? { ...def, value: found.value } : def;
        });
      }
    } catch {}
    return DEFAULT_TERMINAL_PARAMS;
  });

  const updateParam = useCallback((label: string, value: string) => {
    setParams(prev => {
      const next = prev.map(p => p.label === label ? { ...p, value } : p);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const saveAll = useCallback((next: TerminalParam[]) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    setParams(next);
  }, []);

  const resetToDefaults = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setParams(DEFAULT_TERMINAL_PARAMS);
  }, []);

  return { params, updateParam, saveAll, resetToDefaults };
}
