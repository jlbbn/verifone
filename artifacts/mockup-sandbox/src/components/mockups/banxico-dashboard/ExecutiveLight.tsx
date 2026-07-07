import React, { Activity, useState } from "react";
import { 
  LayoutDashboard, 
  ArrowRightLeft, 
  Wallet, 
  CreditCard, 
  FileText, 
  Bitcoin, 
  Key,
  TrendingUp,
  TrendingDown,
  Bell,
  Search,
  Menu,
  ChevronDown,
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Building2,
  Settings
} from "lucide-react";

export function ExecutiveLight() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeItem, setActiveItem] = useState("Dashboard");

  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Transacciones", icon: ArrowRightLeft },
    { name: "Caja", icon: Wallet },
    { name: "Enrutamiento POS", icon: CreditCard },
    { name: "Registros", icon: FileText },
    { name: "Exchange Crypto", icon: Bitcoin },
    { name: "Claves Encriptadas", icon: Key },
  ];

  const tickerData = [
    { symbol: "BTC/USD", price: "$64,230.50", change: "+2.4%", up: true },
    { symbol: "ETH/USD", price: "$3,450.20", change: "+1.1%", up: true },
    { symbol: "XRP/USD", price: "$0.5840", change: "-0.5%", up: false },
    { symbol: "USD/MXN", price: "$16.85", change: "-0.2%", up: false },
    { symbol: "CAD/MXN", price: "$12.34", change: "+0.4%", up: true },
    { symbol: "ON (TIIE)", price: "11.25%", change: "0.0%", up: true },
  ];

  const transactions = [
    { id: "TX-9921", date: "15 Jun 2026, 14:30", desc: "Transferencia SPEI a HSBC", amount: "-$125,000.00", currency: "MXN", status: "Completada" },
    { id: "TX-9920", date: "15 Jun 2026, 11:15", desc: "Liquidación POS Terminal 4", amount: "+$42,500.00", currency: "MXN", status: "Completada" },
    { id: "TX-9919", date: "14 Jun 2026, 16:45", desc: "Compra Bitcoin (OTC)", amount: "-$2,500,000.00", currency: "USD", status: "Pendiente" },
    { id: "TX-9918", date: "14 Jun 2026, 09:20", desc: "Pago Proveedores (Swift)", amount: "-$85,000.00", currency: "USD", status: "Completada" },
    { id: "TX-9917", date: "13 Jun 2026, 18:10", desc: "Depósito Efectivo Caja", amount: "+$1,200,000.00", currency: "MXN", status: "Fallida" },
    { id: "TX-9916", date: "13 Jun 2026, 10:05", desc: "Liquidación Exchange", amount: "+$450,000.00", currency: "USD", status: "Completada" },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Completada":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200">Completada</span>;
      case "Pendiente":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">Pendiente</span>;
      case "Fallida":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-200">Fallida</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans flex flex-col overflow-hidden">
      {/* HEADER - BANXICO RED */}
      <header className="h-16 bg-[#c8322b] text-white flex items-center justify-between px-4 lg:px-6 z-20 shadow-md flex-shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 hover:bg-white/10 rounded-md transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            <span className="text-lg font-semibold tracking-wide">BANXICO PLUS</span>
          </div>
        </div>

        <div className="flex items-center gap-4 lg:gap-6">
          <div className="hidden md:flex relative text-white/80 focus-within:text-white transition-colors">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Buscar transacción..." 
              className="bg-black/10 border border-white/20 rounded-full pl-9 pr-4 py-1.5 text-sm outline-none focus:bg-black/20 focus:border-white/40 transition-all w-64 placeholder:text-white/50"
            />
          </div>
          
          <button className="relative p-1 hover:bg-white/10 rounded-md transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-yellow-400 rounded-full border border-[#c8322b]"></span>
          </button>

          <div className="flex items-center gap-3 border-l border-white/20 pl-4 lg:pl-6">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium leading-none">José Luis Barrientos</div>
              <div className="text-[11px] text-white/70 uppercase tracking-wider mt-1">Admin</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-white text-[#c8322b] flex items-center justify-center font-bold text-sm shadow-sm">
              JB
            </div>
            <ChevronDown className="w-4 h-4 text-white/70" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <aside 
          className={`bg-white border-r border-gray-200 transition-all duration-300 ease-in-out flex-shrink-0 z-10 shadow-sm
            ${isSidebarOpen ? 'w-64' : 'w-0 lg:w-20'} 
            overflow-hidden`}
        >
          <div className="py-6 px-3 flex flex-col h-full gap-1">
            <div className={`px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider ${!isSidebarOpen && 'lg:hidden'}`}>
              Menú Principal
            </div>
            {navItems.map((item) => {
              const isActive = activeItem === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => setActiveItem(item.name)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 w-full text-left group
                    ${isActive 
                      ? 'bg-red-50 text-[#c8322b] font-medium border-l-4 border-[#c8322b] !rounded-l-none' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent !rounded-l-none'
                    }`}
                >
                  <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[#c8322b]' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  <span className={`whitespace-nowrap transition-opacity duration-200 ${!isSidebarOpen ? 'opacity-0 lg:hidden' : 'opacity-100'}`}>
                    {item.name}
                  </span>
                </button>
              )
            })}

            <div className="mt-auto">
              <button
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 w-full text-left text-gray-500 hover:bg-gray-50 hover:text-gray-900`}
              >
                <Settings className="w-5 h-5 flex-shrink-0" />
                <span className={`whitespace-nowrap ${!isSidebarOpen ? 'opacity-0 lg:hidden' : 'opacity-100'}`}>
                  Configuración
                </span>
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto bg-[#f8f9fa]">
          
          {/* TICKER */}
          <div className="bg-white border-b border-gray-200 py-2.5 px-4 lg:px-8 flex items-center shadow-sm overflow-x-auto hide-scrollbar">
            <div className="flex gap-8 items-center min-w-max">
              <div className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#c8322b] animate-pulse"></span>
                Mercados Live
              </div>
              <div className="w-px h-4 bg-gray-200"></div>
              {tickerData.map((ticker, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-600">{ticker.symbol}</span>
                  <span className="font-semibold text-gray-900 tabular-nums">{ticker.price}</span>
                  <span className={`flex items-center text-xs font-medium ${ticker.up ? 'text-green-600' : 'text-red-600'}`}>
                    {ticker.up ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                    {ticker.change}
                  </span>
                  {i < tickerData.length - 1 && <div className="w-px h-3 bg-gray-200 ml-4"></div>}
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
            
            {/* GREETING & ACTIONS */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Resumen Ejecutivo</h1>
                <p className="text-gray-500 mt-1">Bienvenido de nuevo, José Luis. Última conexión: Hoy, 08:42 AM.</p>
              </div>
              <div className="flex gap-3">
                <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Estado de Cuenta
                </button>
                <button className="px-4 py-2 bg-[#c8322b] rounded-lg text-sm font-medium text-white hover:bg-[#a82a24] transition-colors shadow-sm">
                  Nueva Transferencia
                </button>
              </div>
            </div>

            {/* BALANCE CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Main Balance */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-32 h-32 bg-red-50 rounded-bl-full -mr-10 -mt-10 transition-transform"></div>
                <div className="flex items-center justify-between mb-4 relative">
                  <h3 className="text-sm font-medium text-gray-500">Saldo Disponible (USD)</h3>
                  <div className="p-2 bg-red-50 text-[#c8322b] rounded-lg">
                    <Wallet className="w-5 h-5" />
                  </div>
                </div>
                <div className="relative">
                  <div className="text-4xl font-bold text-gray-900 tabular-nums tracking-tight">
                    $1,250,000.<span className="text-gray-400 text-2xl">00</span>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-sm">
                    <span className="flex items-center text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded">
                      <ArrowUpRight className="w-3 h-3 mr-1" />
                      2.4%
                    </span>
                    <span className="text-gray-500">vs mes anterior</span>
                  </div>
                </div>
              </div>

              {/* MXN Balance */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-500">Saldo Operativo (MXN)</h3>
                  <div className="p-2 bg-gray-50 text-gray-600 rounded-lg">
                    <Activity className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-900 tabular-nums tracking-tight">
                    $18,450,230.<span className="text-gray-400 text-xl">50</span>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-sm">
                    <span className="flex items-center text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded">
                      <ArrowUpRight className="w-3 h-3 mr-1" />
                      5.1%
                    </span>
                    <span className="text-gray-500">vs mes anterior</span>
                  </div>
                </div>
              </div>

              {/* Crypto Balance */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-500">Activos Digitales (USD)</h3>
                  <div className="p-2 bg-gray-50 text-gray-600 rounded-lg">
                    <Bitcoin className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-900 tabular-nums tracking-tight">
                    $485,300.<span className="text-gray-400 text-xl">00</span>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-sm">
                    <span className="flex items-center text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded">
                      <ArrowDownRight className="w-3 h-3 mr-1" />
                      1.2%
                    </span>
                    <span className="text-gray-500">vs mes anterior</span>
                  </div>
                </div>
              </div>
            </div>

            {/* TRANSACTIONS TABLE */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-white">
                <h2 className="text-base font-semibold text-gray-900">Transacciones Recientes</h2>
                <button className="text-sm font-medium text-[#c8322b] hover:text-[#a82a24]">Ver todas</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-medium">
                      <th className="px-6 py-4">ID Ref</th>
                      <th className="px-6 py-4">Fecha</th>
                      <th className="px-6 py-4">Descripción</th>
                      <th className="px-6 py-4 text-right">Monto</th>
                      <th className="px-6 py-4 text-center">Estado</th>
                      <th className="px-6 py-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4 text-gray-500 font-mono text-xs">{tx.id}</td>
                        <td className="px-6 py-4 text-gray-500">{tx.date}</td>
                        <td className="px-6 py-4 text-gray-900 font-medium">{tx.desc}</td>
                        <td className={`px-6 py-4 text-right tabular-nums font-semibold ${
                          tx.amount.startsWith('+') ? 'text-green-600' : 'text-gray-900'
                        }`}>
                          {tx.amount} <span className="text-xs text-gray-500 ml-1 font-normal">{tx.currency}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {getStatusBadge(tx.status)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors opacity-0 group-hover:opacity-100">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>
      </div>
      
      {/* Inline styles for hiding scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
