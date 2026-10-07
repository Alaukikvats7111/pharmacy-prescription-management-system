import { useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Toaster, useFetch, fdate } from './ui';
import * as P from './pages';

const NAV = [
  ['/', 'Dashboard', '📊', P.Dashboard],
  ['/medicines', 'Medicines', '💊', P.Medicines],
  ['/categories', 'Categories', '🏷️', P.Categories],
  ['/manufacturers', 'Manufacturers', '🏭', P.Manufacturers],
  ['/suppliers', 'Suppliers', '🚚', P.Suppliers],
  ['/purchases', 'Purchases', '📥', P.Purchases],
  ['/inventory', 'Inventory', '📦', P.Inventory],
  ['/stock-movements', 'Stock Movements', '🔄', P.StockMovements],
  ['/customers', 'Customers', '👥', P.Customers],
  ['/prescriptions', 'Prescriptions', '📋', P.Prescriptions],
  ['/sales', 'Sales (POS)', '💳', P.Sales],
  ['/payments', 'Payments', '💰', P.Payments],
  ['/reports', 'Reports', '📈', P.Reports],
];

export default function App() {
  const [open, setOpen] = useState(false);
  const [bell, setBell] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const nav = useNavigate();
  const loc = useLocation();

  const { data } = useFetch('/alerts');
  const n = data ? (data.lowStock?.length || 0) + (data.expiring?.length || 0) : 0;
  const currentNav = NAV.find(([p]) => p === loc.pathname) || [0, 'PharmaCare', '℞'];
  const title = currentNav[1];

  const handleGlobalSearch = (e) => {
    if (e.key === 'Enter' && searchVal.trim()) {
      nav(`/medicines?q=${encodeURIComponent(searchVal.trim())}`);
      setSearchVal('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex">
      <Toaster />

      {/* Sidebar Overlay for Mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 shadow-sm`}
      >
        <div className="flex items-center gap-3 p-5 border-b border-slate-100">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-teal-500 text-white flex items-center justify-center font-bold text-xl shadow-sm">
            ℞
          </div>
          <div>
            <div className="text-base font-bold text-slate-800 leading-tight">PharmaCare</div>
            <div className="text-xs text-slate-400 font-medium">Pharmacy &amp; Stock System</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" onClick={() => setOpen(false)}>
          {NAV.map(([p, l, icon]) => (
            <NavLink
              key={p}
              to={p}
              end
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white font-medium shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <span className="text-base">{icon}</span>
              <span>{l}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold">
              PH
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">Licensed Pharmacist</p>
              <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span> MySQL Connected
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 px-4 lg:px-8 h-16 flex items-center gap-4">
          <button
            className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xl"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
          >
            ☰
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xl hidden sm:inline-block">{currentNav[2]}</span>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">{title}</h1>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Global Search Input */}
            <div className="relative hidden md:block">
              <input
                placeholder="Search medicine & press Enter…"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                onKeyDown={handleGlobalSearch}
                className="w-72 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 font-semibold bg-slate-200/80 px-1 rounded">↵</span>
            </div>

            {/* Alerts Dropdown Button */}
            <div className="relative">
              <button
                onClick={() => setBell(!bell)}
                className="relative rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-xs"
              >
                <span>🔔 Alerts</span>
                {n > 0 && (
                  <span className="rounded-full bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2">
                    {n}
                  </span>
                )}
              </button>

              {bell && (
                <div
                  className="absolute right-0 mt-2 w-84 max-h-96 overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-xl p-3 text-sm z-30"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-100">
                    <span className="font-semibold text-slate-800 text-xs uppercase tracking-wider">System Alerts</span>
                    <button className="text-slate-400 text-sm hover:text-slate-600" onClick={() => setBell(false)}>×</button>
                  </div>

                  {!n && <p className="text-slate-400 p-3 text-center text-xs">No low stock or expiry alerts.</p>}

                  <div className="space-y-1">
                    {data?.lowStock?.map((r) => (
                      <div key={'l' + r.batch_id} className="p-2 rounded-lg bg-amber-50/60 border border-amber-100/60 text-xs">
                        <div className="flex justify-between font-semibold text-amber-800">
                          <span>⚠️ Low Stock</span>
                          <span>Qty: {r.quantity}</span>
                        </div>
                        <div className="text-slate-700 font-medium mt-0.5">{r.medicine_name}</div>
                        <div className="text-slate-400 text-[11px]">Batch: {r.batch_number}</div>
                      </div>
                    ))}

                    {data?.expiring?.map((r) => (
                      <div
                        key={'e' + r.batch_id}
                        className={`p-2 rounded-lg border text-xs ${
                          r.days_left < 0 ? 'bg-rose-50/60 border-rose-100 text-rose-800' : 'bg-amber-50/60 border-amber-100 text-amber-800'
                        }`}
                      >
                        <div className="flex justify-between font-semibold">
                          <span>{r.days_left < 0 ? '⛔ Expired' : '⏰ Expiring Soon'}</span>
                          <span>{fdate(r.expiry_date)}</span>
                        </div>
                        <div className="text-slate-700 font-medium mt-0.5">{r.medicine_name}</div>
                        <div className="text-slate-400 text-[11px]">Batch: {r.batch_number} · Qty: {r.quantity}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
              Rx
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          <Routes>
            {NAV.map(([p, , , C]) => (
              <Route key={p} path={p} element={<C />} />
            ))}
          </Routes>
        </main>
      </div>
    </div>
  );
}
