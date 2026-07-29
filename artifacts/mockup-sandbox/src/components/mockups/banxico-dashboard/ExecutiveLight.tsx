export function ExecutiveLight() {
  const milestones = [
    {
      date: "Jul 2026", title: "Hot Wallet TRON",
      desc: "Wallet configurada en mainnet TRON. Saldo USDT visible en tiempo real desde el panel admin.",
      tag: "Completado", color: "green",
    },
    {
      date: "Jul 2026", title: "Interfaz de Dispersión USDT",
      desc: "Formulario para enviar USDT on-chain. Confirmación con contraseña, historial de TXs con link a TronScan.",
      tag: "Completado", color: "green",
    },
    {
      date: "Jul 2026", title: "Seguridad de Contraseñas",
      desc: "Los cambios de contraseña del admin ahora persisten: ya no se revierten al reiniciar el servidor.",
      tag: "Completado", color: "green",
    },
    {
      date: "Jul 2026", title: "Migrations Automáticas",
      desc: "Script post-merge ejecuta migraciones de base de datos en cada deploy sin intervención manual.",
      tag: "Completado", color: "green",
    },
    {
      date: "En curso", title: "Binance como Broker Principal",
      desc: "Código listo. Pendiente agregar BINANCE_API_KEY y BINANCE_SECRET_KEY en los secrets del proyecto.",
      tag: "En progreso", color: "amber",
    },
    {
      date: "Próximo", title: "Límite de Dispersión + Auto-recarga TRX",
      desc: "Tope máximo por operación para reducir riesgo. Recarga automática de TRX cuando el gas esté bajo.",
      tag: "Pendiente", color: "slate",
    },
  ];

  const cm: Record<string, { bg: string; text: string; dot: string; border: string }> = {
    green: { bg: "bg-green-50",  text: "text-green-700", dot: "bg-green-500",  border: "border-green-200" },
    amber: { bg: "bg-amber-50",  text: "text-amber-700", dot: "bg-amber-400",  border: "border-amber-200" },
    slate: { bg: "bg-slate-50",  text: "text-slate-500", dot: "bg-slate-300",  border: "border-slate-200" },
  };

  return (
    <div className="min-h-screen bg-white font-sans p-8">
      {/* Header */}
      <div className="mb-7 pb-5 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#c8322b] flex items-center justify-center font-black text-white text-sm">B+</div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Reporte de Avances</h1>
            <p className="text-sm text-slate-500">Sistema de Dispersión USDT · Banxico Plus LLC</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Periodo</p>
          <p className="text-sm font-semibold text-slate-700">Julio 2026</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-7">
        {[
          { n: "4",     label: "Funcionalidades completadas", color: "text-[#c8322b]" },
          { n: "2",     label: "Tareas activas en cola",      color: "text-amber-600" },
          { n: "TRON",  label: "Red blockchain activa",       color: "text-blue-600"  },
          { n: "≈$0.02",label: "Costo fee por dispersión",    color: "text-green-600" },
        ].map((k) => (
          <div key={k.label} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
            <p className={`text-2xl font-black ${k.color}`}>{k.n}</p>
            <p className="text-[11px] text-slate-500 mt-1 leading-tight">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Hoja de ruta</h2>
      <div className="space-y-0">
        {milestones.map((m, i) => {
          const c = cm[m.color];
          return (
            <div key={m.title} className="flex gap-4">
              <div className="flex flex-col items-center w-6 flex-shrink-0">
                <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${c.dot}`} />
                {i < milestones.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1" />}
              </div>
              <div className={`mb-3 flex-1 rounded-lg border ${c.border} ${c.bg} p-3`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{m.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{m.desc}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text} border ${c.border}`}>
                      {m.tag}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">{m.date}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
