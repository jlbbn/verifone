export function ModernGlass() {
  const pipeline = [
    {
      phase: "ADMIN UI",
      color: "#60a5fa",
      glow: "#3b82f6",
      items: [
        { name: "Formulario dispersión", live: true },
        { name: "Selector de dirección TRON", live: true },
        { name: "Validación formato T…", live: true },
        { name: "Balance visible en widget", live: true },
      ],
    },
    {
      phase: "AUTH LAYER",
      color: "#c084fc",
      glow: "#9333ea",
      items: [
        { name: "Verificación contraseña admin", live: true },
        { name: "requireRole('ADMIN')", live: true },
        { name: "Límite máx. por operación", live: false },
        { name: "Rate limiting endpoint", live: false },
      ],
    },
    {
      phase: "TRON CLIENT",
      color: "#f87171",
      glow: "#c8322b",
      items: [
        { name: "PLATFORM_TRON_PRIVATE_KEY", live: true },
        { name: "rawAmount = floor(amt × 10⁶)", live: true },
        { name: "contract.transfer().send()", live: true },
        { name: "feeLimit: 40_000_000 sun", live: true },
      ],
    },
    {
      phase: "BLOCKCHAIN",
      color: "#4ade80",
      glow: "#22c55e",
      items: [
        { name: "TRON Mainnet broadcast", live: true },
        { name: "Contrato USDT TR7NHq…", live: true },
        { name: "Polling confirmación", live: false },
        { name: "TronScan verification link", live: true },
      ],
    },
    {
      phase: "AUDIT DB",
      color: "#fbbf24",
      glow: "#f59e0b",
      items: [
        { name: "tabla hot_wallet_dispersions", live: true },
        { name: "status: pending→confirmed", live: true },
        { name: "txid + nota + timestamp", live: true },
        { name: "Historial últimas 50 TXs", live: true },
      ],
    },
  ];

  const totalItems  = pipeline.flatMap(p => p.items).length;
  const liveItems   = pipeline.flatMap(p => p.items).filter(i => i.live).length;
  const pct = Math.round((liveItems / totalItems) * 100);

  return (
    <div
      className="min-h-screen font-sans p-5 space-y-4"
      style={{ background: "linear-gradient(160deg, #06040f 0%, #0d0820 40%, #0a1020 100%)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] tracking-[0.3em] text-white/30 uppercase mb-1.5">Banxico Plus LLC · Crypto Module</p>
          <h1 className="text-2xl font-black text-white leading-none">
            Pipeline de Dispersión
            <br />
            <span style={{ background: "linear-gradient(90deg,#c8322b,#f87171,#fbbf24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              USDT On-Chain
            </span>
          </h1>
          <p className="text-[11px] text-white/30 mt-1.5">TRON TRC-20 · TronWeb v6 · PostgreSQL Audit</p>
        </div>
        <div className="text-right space-y-1.5 mt-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-green-500/20 bg-green-500/8">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[11px] text-green-400 font-medium">Mainnet Live</span>
          </div>
          <div className="block">
            <span className="text-[11px] text-white/30">{liveItems}/{totalItems} funciones activas</span>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="rounded-2xl border border-white/8 bg-white/4 p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[11px] text-white/50 font-medium">Completitud del pipeline</span>
          <span className="text-xl font-black text-white">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/8 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, #c8322b 0%, #f87171 50%, #fbbf24 100%)",
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-white/25">
          <span>{liveItems} funciones desplegadas</span>
          <span>{totalItems - liveItems} en construcción</span>
        </div>
      </div>

      {/* Pipeline columns */}
      <div className="grid grid-cols-5 gap-2">
        {pipeline.map((phase) => {
          const liveCnt  = phase.items.filter(i => i.live).length;
          const totalCnt = phase.items.length;
          return (
            <div
              key={phase.phase}
              className="rounded-xl border border-white/8 bg-white/4 p-2.5 space-y-2"
            >
              {/* Phase header */}
              <div>
                <div
                  className="text-[9px] font-black tracking-[0.2em] uppercase mb-1"
                  style={{ color: phase.color }}
                >
                  {phase.phase}
                </div>
                <div className="h-0.5 rounded-full bg-white/8 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(liveCnt / totalCnt) * 100}%`,
                      background: phase.color,
                      boxShadow: `0 0 6px ${phase.glow}`,
                    }}
                  />
                </div>
                <p className="text-[9px] text-white/25 mt-1">{liveCnt}/{totalCnt}</p>
              </div>

              {/* Items */}
              <div className="space-y-1.5">
                {phase.items.map((item) => (
                  <div key={item.name} className="flex items-start gap-1.5">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0 flex items-center justify-center mt-0.5 text-[8px] font-bold border"
                      style={item.live
                        ? { background: phase.color + "22", borderColor: phase.color + "55", color: phase.color }
                        : { background: "transparent", borderColor: "#ffffff15", color: "#ffffff20" }
                      }
                    >
                      {item.live ? "✓" : "○"}
                    </div>
                    <p
                      className="text-[10px] leading-tight font-mono"
                      style={{ color: item.live ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.2)" }}
                    >
                      {item.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Key specs row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { v: "TRON",    d: "TRC-20 Mainnet",          g: "#c8322b,#f87171" },
          { v: "≈$0.02",  d: "Fee por dispersión",       g: "#22c55e,#4ade80" },
          { v: "10⁶",     d: "Decimales precisión USDT", g: "#3b82f6,#60a5fa" },
          { v: "40 TRX",  d: "Fee limit configurado",    g: "#f59e0b,#fbbf24" },
        ].map((m) => (
          <div key={m.d} className="rounded-xl border border-white/8 bg-white/4 p-3 text-center">
            <p
              className="text-xl font-black"
              style={{ background: `linear-gradient(135deg,${m.g})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
            >
              {m.v}
            </p>
            <p className="text-[10px] text-white/30 mt-0.5 leading-tight">{m.d}</p>
          </div>
        ))}
      </div>

      {/* Next */}
      <div className="rounded-xl border border-white/8 bg-white/4 p-3">
        <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">Pendiente en el pipeline</p>
        <div className="flex flex-wrap gap-2">
          {[
            "Validar saldo antes de firmar",
            "Límite máx. por TX (configurable)",
            "Auto-recarga TRX cuando gas bajo",
            "Polling confirmación on-chain",
            "Binance API Key → exchange activo",
          ].map((t) => (
            <span key={t} className="text-[10px] px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-white/40 font-medium">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
