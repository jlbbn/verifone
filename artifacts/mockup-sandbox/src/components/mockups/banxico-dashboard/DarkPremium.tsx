import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ArrowRightLeft, 
  Briefcase, 
  Server, 
  FileText, 
  Repeat, 
  Key, 
  Bell,
  Search,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal
} from 'lucide-react';

export function DarkPremium() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ backgroundColor: '#0d1117', color: '#e5e7eb' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
        
        .font-mono {
          font-family: 'JetBrains Mono', monospace;
        }
        .font-sans {
          font-family: 'Inter', sans-serif;
        }
        
        .ticker-wrap {
          width: 100%;
          overflow: hidden;
          background-color: #161b22;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          height: 40px;
        }
        
        .ticker-move {
          display: inline-block;
          white-space: nowrap;
          padding-right: 100%;
          animation: ticker 30s linear infinite;
        }
        
        @keyframes ticker {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-100%, 0, 0); }
        }
        
        .ticker-item {
          display: inline-flex;
          align-items: center;
          padding: 0 2rem;
          font-size: 0.85rem;
          color: #9ca3af;
        }
        
        .card-glow {
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 20px rgba(0,0,0,0.4);
        }
        
        /* Custom scrollbar for table */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #0d1117; 
        }
        ::-webkit-scrollbar-thumb {
          background: #30363d; 
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #484f58; 
        }
      `}</style>

      {/* Ticker */}
      <div className="ticker-wrap">
        <div className="ticker-move font-mono">
          <span className="ticker-item">
            <span className="mr-2 text-gray-400">BTC/USD</span>
            <span className="text-white mr-2">$64,230.50</span>
            <span className="text-emerald-400 flex items-center"><TrendingUp size={14} className="mr-1"/> +2.4%</span>
          </span>
          <span className="ticker-item">
            <span className="mr-2 text-gray-400">ETH/USD</span>
            <span className="text-white mr-2">$3,450.20</span>
            <span className="text-red-400 flex items-center"><TrendingDown size={14} className="mr-1"/> -1.2%</span>
          </span>
          <span className="ticker-item">
            <span className="mr-2 text-gray-400">XRP/USD</span>
            <span className="text-white mr-2">$0.582</span>
            <span className="text-emerald-400 flex items-center"><TrendingUp size={14} className="mr-1"/> +0.8%</span>
          </span>
          <span className="ticker-item">
            <span className="mr-2 text-gray-400">ON/USD</span>
            <span className="text-white mr-2">$14.20</span>
            <span className="text-emerald-400 flex items-center"><TrendingUp size={14} className="mr-1"/> +5.1%</span>
          </span>
          <span className="ticker-item">
            <span className="mr-2 text-gray-400">CAD/MXN</span>
            <span className="text-white mr-2">$13.45</span>
            <span className="text-red-400 flex items-center"><TrendingDown size={14} className="mr-1"/> -0.3%</span>
          </span>
          <span className="ticker-item">
            <span className="mr-2 text-gray-400">USD/MXN</span>
            <span className="text-white mr-2">$16.85</span>
            <span className="text-emerald-400 flex items-center"><TrendingUp size={14} className="mr-1"/> +0.1%</span>
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r flex flex-col" style={{ backgroundColor: '#161b22', borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="p-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded bg-[#c8322b] flex items-center justify-center font-bold text-white tracking-tighter">
                BP
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white">Banxico<span className="text-[#c8322b]">Plus</span></h1>
            </div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-2 font-mono">Terminal</p>
          </div>

          <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
            <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
            <NavItem icon={<ArrowRightLeft size={18} />} label="Transacciones" active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} />
            <NavItem icon={<Briefcase size={18} />} label="Caja" active={activeTab === 'caja'} onClick={() => setActiveTab('caja')} />
            <NavItem icon={<Server size={18} />} label="Enrutamiento POS" active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} />
            <NavItem icon={<FileText size={18} />} label="Registros" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
            <NavItem icon={<Repeat size={18} />} label="Exchange Crypto" active={activeTab === 'exchange'} onClick={() => setActiveTab('exchange')} />
            <NavItem icon={<Key size={18} />} label="Claves Encriptadas" active={activeTab === 'keys'} onClick={() => setActiveTab('keys')} />
          </div>

          <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#c8322b]/20 text-[#c8322b] flex items-center justify-center border border-[#c8322b]/50">
                JB
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">José Luis Barrientos</p>
                <p className="text-xs text-[#c8322b] font-mono tracking-wider">ADMIN</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="h-16 border-b flex items-center justify-between px-8" style={{ backgroundColor: '#161b22', borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="flex items-center text-sm text-gray-400 font-mono">
              <span>{new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span className="mx-3 text-gray-600">|</span>
              <span className="text-[#c8322b]">SISTEMA OPERATIVO NORMAL</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Buscar folio, cliente, cuenta..." 
                  className="bg-[#0d1117] border border-gray-700 rounded-full pl-9 pr-4 py-1.5 text-sm w-64 focus:outline-none focus:border-[#c8322b] transition-colors text-white placeholder-gray-500 font-mono"
                />
              </div>
              <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#c8322b]"></span>
              </button>
            </div>
          </header>

          {/* Content Scroll Area */}
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-7xl mx-auto space-y-6">
              
              {/* Balance Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 rounded-xl p-6 border card-glow flex flex-col justify-between relative overflow-hidden" style={{ backgroundColor: '#161b22', borderColor: 'rgba(255,255,255,0.08)' }}>
                  <div className="absolute right-0 top-0 w-64 h-64 bg-[#c8322b] opacity-5 blur-[100px] rounded-full pointer-events-none -mr-20 -mt-20"></div>
                  <div>
                    <h2 className="text-gray-400 text-sm font-medium tracking-wide uppercase mb-1">Balance Disponible (Global)</h2>
                    <div className="flex items-baseline gap-3">
                      <span className="text-4xl font-light text-white font-mono tracking-tight">$1,250,000.00</span>
                      <span className="text-xl text-gray-500 font-mono">USD</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-8 mt-8 border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Equivalente MXN</p>
                      <p className="text-lg text-white font-mono">$21,062,500.00</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">En Tránsito</p>
                      <p className="text-lg text-[#c8322b] font-mono">$45,300.00</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Rendimiento (30d)</p>
                      <p className="text-lg text-amber-500 font-mono flex items-center gap-1"><TrendingUp size={16}/> +$12,450.00</p>
                    </div>
                  </div>
                </div>
                
                <div className="rounded-xl p-6 border card-glow flex flex-col" style={{ backgroundColor: '#161b22', borderColor: 'rgba(255,255,255,0.08)' }}>
                  <h3 className="text-gray-400 text-sm font-medium tracking-wide uppercase mb-4">Acciones Rápidas</h3>
                  <div className="grid grid-cols-2 gap-3 flex-1">
                    <ActionButton icon={<ArrowUpRight size={18}/>} label="Enviar SPEI" />
                    <ActionButton icon={<ArrowDownRight size={18}/>} label="Solicitar" />
                    <ActionButton icon={<Repeat size={18}/>} label="Exchange" />
                    <ActionButton icon={<FileText size={18}/>} label="Reporte" />
                  </div>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="rounded-xl border card-glow overflow-hidden" style={{ backgroundColor: '#161b22', borderColor: 'rgba(255,255,255,0.08)' }}>
                <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <h3 className="text-white font-medium">Movimientos Recientes</h3>
                  <button className="text-sm text-[#c8322b] hover:text-white transition-colors flex items-center gap-1 font-medium">
                    Ver todos <ArrowRightLeft size={14} />
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b bg-[#0d1117]/50" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                        <th className="px-6 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">Folio</th>
                        <th className="px-6 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">Fecha/Hora</th>
                        <th className="px-6 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">Descripción</th>
                        <th className="px-6 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">Monto</th>
                        <th className="px-6 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">Estado</th>
                        <th className="px-6 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      <TableRow 
                        folio="TRX-8921"
                        date="Hoy, 14:32"
                        desc="Liquidación Terminal POS Centro"
                        amount="+$14,250.00"
                        currency="MXN"
                        type="credit"
                        status="Completado"
                      />
                      <TableRow 
                        folio="TRX-8920"
                        date="Hoy, 11:15"
                        desc="Transferencia Internacional a Citi"
                        amount="-$5,000.00"
                        currency="USD"
                        type="debit"
                        status="Procesando"
                      />
                      <TableRow 
                        folio="EXC-4451"
                        date="Ayer, 16:45"
                        desc="Conversión USD a MXN"
                        amount="+$84,200.00"
                        currency="MXN"
                        type="credit"
                        status="Completado"
                      />
                      <TableRow 
                        folio="TRX-8918"
                        date="Ayer, 09:30"
                        desc="Pago Nómina Corporativa"
                        amount="-$125,000.00"
                        currency="MXN"
                        type="debit"
                        status="Completado"
                      />
                      <TableRow 
                        folio="POS-9921"
                        date="12 Mar, 21:10"
                        desc="Rechazo Cargo TDC"
                        amount="$450.00"
                        currency="MXN"
                        type="neutral"
                        status="Fallido"
                      />
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active 
          ? 'bg-[#c8322b]/10 text-[#c8322b]' 
          : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
      }`}
    >
      {icon}
      {label}
      {active && <div className="ml-auto w-1 h-4 rounded-full bg-[#c8322b]"></div>}
    </button>
  );
}

function ActionButton({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <button className="flex flex-col items-center justify-center gap-2 bg-[#0d1117] border border-gray-700/50 rounded-lg p-3 hover:border-[#c8322b]/50 hover:bg-[#c8322b]/5 transition-all group">
      <div className="text-gray-400 group-hover:text-[#c8322b] transition-colors">
        {icon}
      </div>
      <span className="text-xs font-medium text-gray-300">{label}</span>
    </button>
  );
}

function TableRow({ folio, date, desc, amount, currency, type, status }: any) {
  const amountColor = type === 'credit' ? 'text-white' : type === 'debit' ? 'text-white' : 'text-gray-500';
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Completado': return <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">Completado</span>;
      case 'Procesando': return <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-wider">Procesando</span>;
      case 'Fallido': return <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-red-500/10 text-red-500 border border-red-500/20 uppercase tracking-wider">Fallido</span>;
      default: return <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-gray-500/10 text-gray-500 border border-gray-500/20 uppercase tracking-wider">{status}</span>;
    }
  };

  return (
    <tr className="hover:bg-white/[0.02] transition-colors group">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-400 group-hover:text-white transition-colors">{folio}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{date}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{desc}</td>
      <td className={`px-6 py-4 whitespace-nowrap text-sm font-mono ${amountColor}`}>
        {amount} <span className="text-gray-500 text-xs ml-1">{currency}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {getStatusBadge(status)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
        <button className="p-1 hover:text-white hover:bg-white/10 rounded transition-colors">
          <MoreHorizontal size={16} />
        </button>
      </td>
    </tr>
  );
}
