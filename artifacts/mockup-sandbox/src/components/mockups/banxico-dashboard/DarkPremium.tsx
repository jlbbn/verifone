export function DarkPremium() {
  const layers = [
    {
      label: "Panel Admin",
      color: "#3b82f6",
      items: ["Formulario de dispersión", "Confirmación con contraseña", "Historial de TXIDs", "Balance USDT en tiempo real"],
    },
    {
      label: "API Server (Express)",
      color: "#8b5cf6",
      items: ["POST /api/admin/hot-wallet/disperse", "GET /api/admin/hot-wallet/balance", "GET /api/admin/hot-wallet/dispersions", "Verifica contraseña admin antes de firmar"],
    },
    {
      label: "TronWeb v6 Client",
      color: "#c8322b",
      items: ["PLATFORM_TRON_PRIVATE_KEY (en secrets)", "Calcula raw amount (× 10⁶ decimales)", "feeLimit: 40 TRX máximo", "Broadcast a TRON mainnet"],
    },
    {
      label: "TRON Mainnet (Blockchain)",
      color: "#22c55e",
      items: ["Contrato USDT TRC-20: TR7NHq…Lj6t", "Confirmación on-chain irreversible", "Verificable en TronScan", "Fee real: ~$0.02 USD por TX"],
    },
  ];

  const statusItems = [
    { label: "Hot wallet configurada",       done: true  },
    { label: "Balance USDT en tiempo real",  done: true  },
    { label: "Endpoint POST /disperse",      done: true  },
    { label: "Firma con clave privada",      done: true  },
    { label: "Registro en DB (audit log)",   done: true  },
    { label: "Historial con link TronScan",  done: true  },
    { label: "Validar saldo antes de firmar",done: false },
    { label: "Límite máximo por operación",  done: false },
    { label: "Auto-recarga TRX (gas)",       done: false },
    { label: "Polling de confirmación TX",   done: false },
  ];

  return (
    <div className="min-h-screen bg-[#080810] text-white font-sans p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-md bg-[#c8322b] flex items-center justify-center text-[11px] font-black">B+</div>
            <span className="text-[10px] tracking-[0.3em] uppercase text-zinc-500">Banxico Plus LLC</span>
            <span className="text-zinc-700 mx-1">·</span>
            <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-600">Módulo Crypto</span>
          </div>
          <h1 className="text-3xl font-black text-white leading-none tracking-tight">
            Dispersión USDT
            <span className="text-[#c8322b]">.</span>
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Arquitectura on-chain · TRON TRC-20 · Julio 2026</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 mt-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[11px] text-green-400 font-medium">Mainnet activa</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
            <span className="text-[11px] text-blue-400 font-medium">TronWeb v6</span>
          </div>
        </div>
      </div>

      {/* Architecture layers */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-2">Stack de dispersión</p>
        {layers.map((layer, i) => (
          <div key={layer.label} className="relative">
            {/* connector */}
            {i < layers.length - 1 && (
              <div className="absolute left-4 bottom-0 translate-y-full w-px h-1.5 bg-zinc-700 z-10" />
            )}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 flex items-start gap-3">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                style={{ background: layer.color, boxShadow: `0 0 6px ${layer.color}88` }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold mb-1.5" style={{ color: layer.color }}>{layer.label}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {layer.items.map((item) => (
                    <p key={item} className="text-[11px] text-zinc-400 font-mono truncate">{item}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Two columns bottom */}
      <div className="grid grid-cols-2 gap-4">

        {/* Build status */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Estado de construcción</p>
          <div className="space-y-1.5">
            {statusItems.map((s) => (
              <div key={s.label} className="flex items-center gap-2.5">
                <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-bold border ${
                  s.done
                    ? "bg-green-500/20 border-green-500/40 text-green-400"
                    : "bg-zinc-800 border-zinc-700 text-zinc-600"
                }`}>
                  {s.done ? "✓" : "○"}
                </div>
                <p className={`text-[11px] ${s.done ? "text-zinc-200" : "text-zinc-600"}`}>{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="text-zinc-500">Progreso</span>
              <span className="text-white font-bold">6 / 10</span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#c8322b] to-red-400" style={{ width: "60%" }} />
            </div>
          </div>
        </div>

        {/* Flow + metrics */}
        <div className="space-y-3">
          {/* Metrics */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: "TRON",   s: "TRC-20",       c: "#ef4444" },
              { v: "≈$0.02", s: "fee por TX",    c: "#22c55e" },
              { v: "6 dec",  s: "precisión USDT",c: "#3b82f6" },
              { v: "40 TRX", s: "fee limit máx", c: "#f59e0b" },
            ].map((m) => (
              <div key={m.s} className="rounded-lg bg-zinc-900 border border-zinc-800 p-2.5 text-center">
                <p className="text-base font-black" style={{ color: m.c }}>{m.v}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{m.s}</p>
              </div>
            ))}
          </div>

          {/* Flow */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 space-y-1.5">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Flujo por TX</p>
            {[
              { n: "1", t: "Admin ingresa dirección + monto",  c: "#3b82f6" },
              { n: "2", t: "Servidor verifica contraseña",      c: "#8b5cf6" },
              { n: "3", t: "TronWeb firma con clave privada",   c: "#c8322b" },
              { n: "4", t: "Broadcast a TRON mainnet",          c: "#c8322b" },
              { n: "5", t: "TXID → tabla hot_wallet_dispersions",c: "#f59e0b"},
              { n: "6", t: "Estado: confirmed / failed",        c: "#22c55e" },
            ].map((step, i, arr) => (
              <div key={step.n} className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-black border"
                  style={{ borderColor: step.c + "44", background: step.c + "15", color: step.c }}
                >
                  {step.n}
                </div>
                {i < arr.length - 1 && (
                  <div className="w-px h-full" />
                )}
                <p className="text-[11px] text-zinc-300">{step.t}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Next */}
      <div className="rounded-xl border border-[#c8322b]/25 bg-[#c8322b]/5 p-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-[#ef4444] mb-1">Siguiente iteración</p>
          <p className="text-[11px] text-zinc-400">
            Validar saldo antes de firmar · Límite por operación · TRX auto-recarga · Polling on-chain · Binance API Key
          </p>
        </div>
        <div className="text-[10px] text-zinc-700 text-right flex-shrink-0">
          <p>DB: hot_wallet_dispersions ✓</p>
          <p>Secrets: PLATFORM_TRON_PRIVATE_KEY ✓</p>
        </div>
      </div>
    </div>
  );
}
