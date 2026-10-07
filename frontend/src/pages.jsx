import { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api, toast, inr, fdate, today, inp, btn, btn2, card, F, useFetch, Modal, Badge, Table, CrudPage, ListPage } from './ui';

// ---------- Helper for dropdown options ----------
const opt = (path, v, l) => ({ path, v, l });

// ---------- CRUD pages ----------
export const Medicines = () => (
  <CrudPage
    name="Medicine"
    title="Medicines"
    path="/medicines"
    id="medicine_id"
    fields={[
      { k: 'medicine_name', l: 'Medicine Name', req: 1 },
      { k: 'unit', l: 'Unit (e.g. Tablet, Strip, Syrup, Box)' },
      { k: 'category_id', l: 'Category', req: 1, opts: opt('/categories', 'category_id', 'category_name') },
      { k: 'manufacturer_id', l: 'Manufacturer', req: 1, opts: opt('/manufacturers', 'manufacturer_id', 'manufacturer_name') },
    ]}
    cols={[
      { k: 'medicine_id', l: 'ID' },
      { k: 'medicine_name', l: 'Medicine Name' },
      { k: 'unit', l: 'Unit' },
      { k: 'category_name', l: 'Category' },
      { k: 'manufacturer_name', l: 'Manufacturer' },
      {
        k: 'stock',
        l: 'Available Stock',
        r: (r) => (
          <span className={`font-semibold ${+r.stock <= 0 ? 'text-rose-600' : +r.stock < 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {r.stock ?? 0}
          </span>
        ),
      },
    ]}
  />
);

const simple = (name, title, path, id, f) => () => (
  <CrudPage
    name={name}
    title={title}
    path={path}
    id={id}
    fields={f.map(([k, l, req]) => ({ k, l, req }))}
    cols={[{ k: id, l: 'ID' }, ...f.map(([k, l]) => ({ k, l }))]}
    history={name === 'Customer'}
  />
);

export const Categories = simple('Category', 'Categories', '/categories', 'category_id', [
  ['category_name', 'Category Name', 1],
  ['description', 'Description'],
]);

// Actual DB column is contact_no
export const Manufacturers = simple('Manufacturer', 'Manufacturers', '/manufacturers', 'manufacturer_id', [
  ['manufacturer_name', 'Manufacturer Name', 1],
  ['contact_no', 'Contact Number'],
  ['address', 'Address'],
]);

// Actual DB column is contact_no
export const Suppliers = simple('Supplier', 'Suppliers', '/suppliers', 'supplier_id', [
  ['supplier_name', 'Supplier Name', 1],
  ['contact_no', 'Contact Number'],
  ['address', 'Address'],
]);

export const Customers = simple('Customer', 'Customers', '/customers', 'customer_id', [
  ['customer_name', 'Customer Name', 1],
  ['phone', 'Phone Number'],
  ['address', 'Address'],
]);

// ---------- Dashboard ----------
const Panel = ({ title, children }) => (
  <div className={card + ' p-5'}>
    <h3 className="font-semibold text-slate-800 mb-3">{title}</h3>
    {children}
  </div>
);

export function Dashboard() {
  const { data: d, loading, err } = useFetch('/dashboard');

  if (err) return <div className="p-6 rounded-xl bg-rose-50 text-rose-700 text-sm">{err}</div>;
  if (loading || !d) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  const S = [
    ['Total Medicines', d.stats.medicines, 'border-blue-500 text-blue-700'],
    ['Total Stock', d.stats.stock, 'border-emerald-500 text-emerald-700'],
    ["Today's Sales", inr(d.stats.todaySales), 'border-indigo-500 text-indigo-700'],
    ['Total Customers', d.stats.customers, 'border-teal-500 text-teal-700'],
    ['Low Stock Items', d.stats.lowStock, 'border-amber-500 text-amber-700'],
    ['Expiring Soon', d.stats.expiring, 'border-rose-500 text-rose-700'],
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {S.map(([l, v, c]) => (
          <div key={l} className={`${card} p-4 border-l-4 ${c}`}>
            <div className="text-xs text-slate-500 font-medium">{l}</div>
            <div className="text-2xl font-bold mt-1 text-slate-800">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="Sales, last 14 days">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={d.salesByDay}>
              <XAxis dataKey="d" tickFormatter={(s) => (s ? String(s).slice(5) : '')} fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(value) => [inr(value), 'Sales']} />
              <Line dataKey="total" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Stock by category">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={d.stockByCategory}>
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(value) => [value, 'Units']} />
              <Bar dataKey="qty" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Top-selling medicines">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={d.topSelling} layout="vertical">
              <XAxis type="number" fontSize={11} />
              <YAxis type="category" dataKey="name" width={100} fontSize={11} />
              <Tooltip formatter={(value) => [value, 'Units sold']} />
              <Bar dataKey="qty" fill="#3b82f6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Low stock alerts">
          {d.lowStock.length ? (
            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {d.lowStock.map((r) => (
                <div key={r.batch_id} className="flex justify-between py-2 text-sm">
                  <span>
                    <strong className="font-medium text-slate-700">{r.medicine_name}</strong>{' '}
                    <span className="text-slate-400">· Batch {r.batch_number}</span>
                  </span>
                  <span className="text-amber-600 font-semibold">Remaining: {r.quantity}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-3">All stock levels are healthy.</p>
          )}
        </Panel>

        <Panel title="Expiry alerts (within 30 days)">
          {d.expiring.length ? (
            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {d.expiring.map((r) => (
                <div key={r.batch_id} className="flex justify-between py-2 text-sm">
                  <span>
                    <strong className="font-medium text-slate-700">{r.medicine_name}</strong>{' '}
                    <span className="text-slate-400">· Batch {r.batch_number} · Qty {r.quantity}</span>
                  </span>
                  <span className={r.days_left < 0 ? 'text-rose-600 font-semibold' : 'text-amber-600 font-semibold'}>
                    {r.days_left < 0 ? 'Expired' : 'Expires'}: {fdate(r.expiry_date)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-3">No medicines expiring in the next 30 days.</p>
          )}
        </Panel>

        <Panel title="Recent sales">
          <Table
            pageSize={5}
            rows={d.recentSales}
            cols={[
              { k: 'sale_id', l: 'Sale ID' },
              { k: 'customer_name', l: 'Customer' },
              { k: 'sale_date', l: 'Date', r: (r) => fdate(r.sale_date) },
              { k: 'total_amount', l: 'Total', r: (r) => inr(r.total_amount) },
            ]}
          />
        </Panel>

        <Panel title="Recent purchases">
          <Table
            pageSize={5}
            rows={d.recentPurchases}
            cols={[
              { k: 'invoice_no', l: 'Invoice No.', r: (r) => r.invoice_no || r.invoice_number || '—' },
              { k: 'supplier_name', l: 'Supplier' },
              { k: 'purchase_date', l: 'Date', r: (r) => fdate(r.purchase_date) },
              { k: 'total_amount', l: 'Total', r: (r) => inr(r.total_amount) },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}

// ---------- Inventory ----------
const Sel = ({ v, set, opts, all }) => (
  <select value={v} onChange={(e) => set(e.target.value)} className={inp + ' !w-auto !mt-0'}>
    <option value="">{all}</option>
    {opts.map((o) =>
      Array.isArray(o) ? (
        <option key={o[0]} value={o[0]}>
          {o[1]}
        </option>
      ) : (
        <option key={o} value={o}>
          {o}
        </option>
      )
    )}
  </select>
);

export function Inventory() {
  const { data, loading, err } = useFetch('/inventory');
  const [f, setF] = useState({ q: '', medicine: '', supplier: '', status: '', expiry: '' });
  const s = (k) => (v) => setF({ ...f, [k]: v });

  const uniq = (k) => [...new Set((data || []).map((r) => r[k]).filter(Boolean))];
  const rows = (data || []).filter(
    (r) =>
      (!f.q || (r.medicine_name + ' ' + r.batch_number).toLowerCase().includes(f.q.toLowerCase())) &&
      (!f.medicine || r.medicine_name === f.medicine) &&
      (!f.supplier || r.supplier_name === f.supplier) &&
      (!f.status || r.status === f.status) &&
      (!f.expiry || (f.expiry === 'expired' ? r.status === 'Expired' : r.days_left >= 0 && r.days_left <= 30))
  );

  return (
    <div className={card}>
      <div className="p-4 flex flex-wrap gap-3 items-center">
        <input
          value={f.q}
          onChange={(e) => s('q')(e.target.value)}
          placeholder="Search medicine or batch…"
          className={inp + ' max-w-xs !mt-0'}
        />
        <Sel v={f.medicine} set={s('medicine')} opts={uniq('medicine_name')} all="All medicines" />
        <Sel v={f.supplier} set={s('supplier')} opts={uniq('supplier_name')} all="All suppliers" />
        <Sel v={f.status} set={s('status')} opts={['Healthy', 'Low Stock', 'Out of Stock', 'Expired']} all="All statuses" />
        <Sel v={f.expiry} set={s('expiry')} opts={[['soon', 'Expiring in 30 days'], ['expired', 'Expired']]} all="Any expiry" />
      </div>
      <Table
        loading={loading}
        err={err}
        rows={rows}
        cols={[
          { k: 'medicine_name', l: 'Medicine' },
          { k: 'batch_number', l: 'Batch No.' },
          { k: 'supplier_name', l: 'Supplier' },
          { k: 'manufacturing_date', l: 'Mfg Date', r: (r) => fdate(r.manufacturing_date) },
          { k: 'expiry_date', l: 'Expiry Date', r: (r) => fdate(r.expiry_date) },
          { k: 'quantity', l: 'Quantity', r: (r) => <span className="font-semibold">{r.quantity}</span> },
          { k: 'status', l: 'Stock Status', r: (r) => <Badge v={r.status} /> },
        ]}
      />
    </div>
  );
}

// ---------- Purchases ----------
export function Purchases() {
  const { data, loading, err, reload } = useFetch('/purchases');
  const sup = useFetch('/suppliers').data || [];
  const med = useFetch('/medicines').data || [];

  const emptyItem = {
    medicine_id: '',
    batch_number: '',
    manufacturing_date: '',
    expiry_date: '',
    quantity: '',
    amount: '',
  };

  const blank = {
    supplier_id: '',
    invoice_no: '',
    purchase_date: today,
    items: [{ ...emptyItem }],
  };

  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  const [view, setView] = useState(null);

  const setHeader = (k, v) => setF({ ...f, [k]: v });
  const setItem = (idx, k, v) => {
    const next = [...f.items];
    next[idx] = { ...next[idx], [k]: v };
    setF({ ...f, items: next });
  };
  const addItem = () => setF({ ...f, items: [...f.items, { ...emptyItem }] });
  const removeItem = (idx) => setF({ ...f, items: f.items.filter((_, i) => i !== idx) });

  const totalCalculated = f.items.reduce((acc, item) => acc + (+item.amount || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.supplier_id) return toast('Supplier is required.', 'err');
    if (!String(f.invoice_no).trim()) return toast('Invoice number is required.', 'err');
    if (!f.items.length) return toast('Add at least one medicine.', 'err');

    for (let idx = 0; idx < f.items.length; idx++) {
      const it = f.items[idx];
      if (!it.medicine_id) return toast(`Item #${idx + 1}: Medicine is required.`, 'err');
      if (!String(it.batch_number).trim()) return toast(`Item #${idx + 1}: Batch number is required.`, 'err');
      if (!it.manufacturing_date || !it.expiry_date) return toast(`Item #${idx + 1}: Manufacturing & Expiry dates are required.`, 'err');
      if (it.expiry_date <= it.manufacturing_date) return toast(`Item #${idx + 1}: Expiry date must be after manufacturing date.`, 'err');
      if (!(+it.quantity > 0)) return toast(`Item #${idx + 1}: Quantity must be greater than 0.`, 'err');
      if (!(+it.amount >= 0) || it.amount === '') return toast(`Item #${idx + 1}: Enter a valid purchase amount.`, 'err');
    }

    try {
      await api.post('/purchases', {
        supplier_id: f.supplier_id,
        invoice_no: f.invoice_no,
        purchase_date: f.purchase_date || today,
        items: f.items,
      });
      toast('Purchase recorded successfully.');
      setOpen(false);
      setF(blank);
      reload();
    } catch (x) {
      toast(x.message, 'err');
    }
  };

  return (
    <div className={card}>
      <div className="p-4 flex justify-between items-center">
        <h2 className="font-semibold text-slate-800">Purchase Records</h2>
        <button className={btn} onClick={() => setOpen(true)}>
          + New Purchase
        </button>
      </div>

      <Table
        loading={loading}
        err={err}
        rows={data || []}
        cols={[
          { k: 'purchase_id', l: 'Purchase ID' },
          { k: 'purchase_date', l: 'Date', r: (r) => fdate(r.purchase_date) },
          { k: 'invoice_no', l: 'Invoice No.', r: (r) => r.invoice_no || r.invoice_number },
          { k: 'supplier_name', l: 'Supplier' },
          { k: 'items_summary', l: 'Items / Batches', r: (r) => r.items_summary || '—' },
          { k: 'total_amount', l: 'Total Amount', r: (r) => inr(r.total_amount) },
        ]}
        actions={(r) => (
          <button className={btn2} onClick={() => setView(r)}>
            View
          </button>
        )}
      />

      {view && (
        <Modal wide title={`Purchase #${view.purchase_id} Details`} onClose={() => setView(null)}>
          <div className="space-y-4 text-sm">
            <div className="grid sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
              <div><span className="text-slate-400">Invoice No:</span> <strong className="ml-1">{view.invoice_no || view.invoice_number}</strong></div>
              <div><span className="text-slate-400">Purchase Date:</span> <strong className="ml-1">{fdate(view.purchase_date)}</strong></div>
              <div><span className="text-slate-400">Supplier:</span> <strong className="ml-1">{view.supplier_name || '—'}</strong></div>
              <div><span className="text-slate-400">Total Amount:</span> <strong className="ml-1 text-blue-600">{inr(view.total_amount)}</strong></div>
            </div>
            {view.items_summary && (
              <div>
                <h4 className="font-medium text-slate-700 mb-1">Items / Batches Purchased</h4>
                <p className="p-3 bg-slate-50 rounded-xl text-slate-600">{view.items_summary}</p>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button className={btn2} onClick={() => setView(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {open && (
        <Modal wide title="Record New Purchase" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3 pb-3 border-b border-slate-100">
              <F l="Supplier *">
                <select required className={inp} value={f.supplier_id} onChange={(e) => setHeader('supplier_id', e.target.value)}>
                  <option value="">Select Supplier…</option>
                  {sup.map((s) => (
                    <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>
                  ))}
                </select>
              </F>
              <F l="Invoice Number *">
                <input required className={inp} placeholder="INV-2026-001" value={f.invoice_no} onChange={(e) => setHeader('invoice_no', e.target.value)} />
              </F>
              <F l="Purchase Date">
                <input type="date" className={inp} value={f.purchase_date} onChange={(e) => setHeader('purchase_date', e.target.value)} />
              </F>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-semibold text-slate-700">Medicines / Batches</h4>
                <button type="button" className={btn2} onClick={addItem}>+ Add Item</button>
              </div>

              {f.items.map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                    <span>Item #{idx + 1}</span>
                    {f.items.length > 1 && (
                      <button type="button" className="text-rose-500 hover:text-rose-700" onClick={() => removeItem(idx)}>Remove</button>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-3 gap-2">
                    <F l="Medicine *">
                      <select required className={inp} value={item.medicine_id} onChange={(e) => setItem(idx, 'medicine_id', e.target.value)}>
                        <option value="">Select Medicine…</option>
                        {med.map((m) => (
                          <option key={m.medicine_id} value={m.medicine_id}>{m.medicine_name}</option>
                        ))}
                      </select>
                    </F>
                    <F l="Batch Number *">
                      <input required className={inp} placeholder="BATCH-001" value={item.batch_number} onChange={(e) => setItem(idx, 'batch_number', e.target.value)} />
                    </F>
                    <F l="Quantity (units) *">
                      <input required type="number" min="1" className={inp} placeholder="100" value={item.quantity} onChange={(e) => setItem(idx, 'quantity', e.target.value)} />
                    </F>
                    <F l="Manufacturing Date *">
                      <input required type="date" className={inp} value={item.manufacturing_date} onChange={(e) => setItem(idx, 'manufacturing_date', e.target.value)} />
                    </F>
                    <F l="Expiry Date *">
                      <input required type="date" className={inp} value={item.expiry_date} onChange={(e) => setItem(idx, 'expiry_date', e.target.value)} />
                    </F>
                    <F l="Item Total Cost (₹) *">
                      <input required type="number" min="0" step="0.01" className={inp} placeholder="500.00" value={item.amount} onChange={(e) => setItem(idx, 'amount', e.target.value)} />
                    </F>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="text-base font-semibold text-slate-700">
                Total Purchase Cost: <span className="text-blue-600">{inr(totalCalculated)}</span>
              </div>
              <div className="flex gap-2">
                <button type="button" className={btn2} onClick={() => setOpen(false)}>Cancel</button>
                <button className={btn}>Save Purchase &amp; Update Stock</button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------- Prescriptions ----------
export function Prescriptions() {
  const [n, setN] = useState(0);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(null);

  const cust = useFetch('/customers').data || [];
  const med = useFetch('/medicines').data || [];
  const presList = useFetch('/prescriptions', { n });

  const row = { medicine_id: '', dosage: '', duration: '', instructions: '' };
  const blank = {
    prescription_date: today,
    doctor_name: '',
    customer_name: '',
    notes: '',
    medicines: [row],
  };

  const [f, setF] = useState(blank);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setM = (i, k, v) => setF({ ...f, medicines: f.medicines.map((m, j) => (j === i ? { ...m, [k]: v } : m)) });

  const submit = async (e) => {
    e.preventDefault();
    if (!String(f.doctor_name).trim()) return toast('Doctor name is required.', 'err');
    if (!f.prescription_date) return toast('Prescription date is required.', 'err');
    if (!f.medicines.length || f.medicines.some((m) => !m.medicine_id || !String(m.dosage).trim())) {
      return toast('Each item requires a medicine and dosage.', 'err');
    }

    try {
      await api.post('/prescriptions', f);
      toast('Prescription saved successfully.');
      setOpen(false);
      setF(blank);
      setN((prev) => prev + 1);
    } catch (x) {
      toast(x.message, 'err');
    }
  };

  const showDetails = async (p) => {
    try {
      const res = await api.get(`/prescriptions/${p.prescription_id}`);
      setView(res.data);
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-slate-800">Prescriptions Management</h2>
        <button className={btn} onClick={() => setOpen(true)}>
          + New Prescription
        </button>
      </div>

      <div className={card}>
        <Table
          loading={presList.loading}
          err={presList.err}
          rows={presList.data || []}
          cols={[
            { k: 'prescription_id', l: 'Rx ID' },
            { k: 'prescription_date', l: 'Date', r: (r) => fdate(r.prescription_date) },
            { k: 'doctor_name', l: 'Doctor' },
            { k: 'customer_name', l: 'Customer / Patient' },
            { k: 'medicines', l: 'Prescribed Medicines', r: (r) => r.medicines || '—' },
            { k: 'notes', l: 'Notes', r: (r) => r.notes || '—' },
          ]}
          actions={(r) => (
            <button className={btn2} onClick={() => showDetails(r)}>
              View Details
            </button>
          )}
        />
      </div>

      {view && (
        <Modal wide title={`Prescription #${view.prescription_id} — Dr. ${view.doctor_name}`} onClose={() => setView(null)}>
          <div className="space-y-4 text-sm">
            <div className="grid sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
              <div><span className="text-slate-400">Date:</span> <strong className="ml-1">{fdate(view.prescription_date)}</strong></div>
              <div><span className="text-slate-400">Doctor:</span> <strong className="ml-1">{view.doctor_name}</strong></div>
              <div className="sm:col-span-2"><span className="text-slate-400">Notes / Patient:</span> <strong className="ml-1">{view.notes || '—'}</strong></div>
            </div>

            <div>
              <h4 className="font-semibold text-slate-800 mb-2">Prescribed Medications</h4>
              <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-50 text-slate-600 text-left">
                  <tr>
                    <th className="p-2 border-b">Medicine</th>
                    <th className="p-2 border-b">Dosage</th>
                    <th className="p-2 border-b">Duration</th>
                    <th className="p-2 border-b">Instructions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(view.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-medium">{it.medicine_name} {it.unit ? `(${it.unit})` : ''}</td>
                      <td className="p-2">{it.dosage || '—'}</td>
                      <td className="p-2">{it.duration || '—'}</td>
                      <td className="p-2 text-slate-500">{it.instructions || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button className={btn2} onClick={() => setView(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {open && (
        <Modal wide title="New Prescription" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
            <F l="Prescription Date *">
              <input required type="date" className={inp} value={f.prescription_date} onChange={set('prescription_date')} />
            </F>
            <F l="Doctor Name *">
              <input required className={inp} placeholder="Dr. R. Sharma" value={f.doctor_name} onChange={set('doctor_name')} />
            </F>
            <F l="Patient / Customer Name (Optional)">
              <input
                className={inp}
                placeholder="e.g. Rahul Sharma"
                list="cust-names"
                value={f.customer_name}
                onChange={set('customer_name')}
              />
              <datalist id="cust-names">
                {cust.map((c) => (
                  <option key={c.customer_id} value={c.customer_name} />
                ))}
              </datalist>
            </F>
            <F l="Notes / Diagnosis">
              <input className={inp} placeholder="Take after food" value={f.notes} onChange={set('notes')} />
            </F>

            <div className="sm:col-span-2 space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Medicines</span>
                <button type="button" className={btn2} onClick={() => setF({ ...f, medicines: [...f.medicines, row] })}>
                  + Add Medicine
                </button>
              </div>

              {f.medicines.map((m, i) => (
                <div key={i} className="grid sm:grid-cols-4 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <select required className={inp} value={m.medicine_id} onChange={(e) => setM(i, 'medicine_id', e.target.value)}>
                    <option value="">Select Medicine…</option>
                    {med.map((x) => (
                      <option key={x.medicine_id} value={x.medicine_id}>{x.medicine_name}</option>
                    ))}
                  </select>
                  <input required className={inp} placeholder="Dosage (1 tab twice daily)" value={m.dosage} onChange={(e) => setM(i, 'dosage', e.target.value)} />
                  <input className={inp} placeholder="Duration (5 days)" value={m.duration} onChange={(e) => setM(i, 'duration', e.target.value)} />
                  <div className="flex gap-2">
                    <input className={inp} placeholder="Instructions (After food)" value={m.instructions} onChange={(e) => setM(i, 'instructions', e.target.value)} />
                    {f.medicines.length > 1 && (
                      <button type="button" className="text-rose-500 font-bold px-2 hover:bg-rose-50 rounded" onClick={() => setF({ ...f, medicines: f.medicines.filter((_, j) => j !== i) })}>
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" className={btn2} onClick={() => setOpen(false)}>Cancel</button>
              <button className={btn}>Save Prescription</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------- Sales (POS) ----------
export function Sales() {
  const [n, setN] = useState(0);
  const cust = useFetch('/customers').data || [];
  const med = useFetch('/medicines').data || [];
  const inv = useFetch('/inventory');
  const salesFetch = useFetch('/sales', { n });

  const [c, setC] = useState('');
  const [rx, setRx] = useState('');
  const [cart, setCart] = useState([]);
  const [pay, setPay] = useState({ amount: '', method: 'Cash' });
  const [completedSale, setCompletedSale] = useState(null);

  const pres = useFetch('/prescriptions').data || [];

  const blankItem = { medicine_id: '', batch_id: '', quantity: '1', unit_price: '', discount: '0' };
  const [it, setIt] = useState(blankItem);

  // Available batches for selected medicine with active stock > 0
  const batches = (inv.data || []).filter(
    (b) => String(b.medicine_id) === String(it.medicine_id) && +b.quantity > 0 && b.status !== 'Expired'
  );

  const selectedBatch = batches.find((x) => String(x.batch_id) === String(it.batch_id));

  const total = cart.reduce((a, l) => a + l.total, 0);

  const setItemField = (k, v) => setIt({ ...it, [k]: v });

  const addToCart = () => {
    if (!it.medicine_id) return toast('Select a medicine.', 'err');
    if (!it.batch_id || !selectedBatch) return toast('Select an active batch.', 'err');

    const qty = +it.quantity;
    const price = +it.unit_price;
    const disc = +it.discount || 0;

    if (!Number.isInteger(qty) || qty <= 0) return toast('Quantity must be an integer greater than 0.', 'err');
    if (it.unit_price === '' || isNaN(price) || price < 0) return toast('Enter a valid unit price.', 'err');
    if (disc < 0 || disc > qty * price) return toast('Discount cannot exceed the total item price.', 'err');

    // Check available stock considering items already in cart
    const existingInCart = cart.filter((l) => l.batch_id === selectedBatch.batch_id).reduce((a, l) => a + l.quantity, 0);
    const available = selectedBatch.quantity - existingInCart;

    if (qty > available) {
      return toast(`Insufficient stock. Only ${available} units are available for this batch.`, 'err');
    }

    const itemTotal = qty * price - disc;
    setCart([
      ...cart,
      {
        batch_id: selectedBatch.batch_id,
        medicine_id: selectedBatch.medicine_id,
        name: selectedBatch.medicine_name,
        batch: selectedBatch.batch_number,
        quantity: qty,
        unit_price: price,
        discount: disc,
        total: itemTotal,
      },
    ]);

    setIt(blankItem);
  };

  const completeSale = async () => {
    if (!c) return toast('Select a customer to complete the sale.', 'err');
    if (!cart.length) return toast('Add at least one medicine item to the cart.', 'err');

    const amountToPay = pay.amount === '' ? total : +pay.amount;
    if (amountToPay < 0) return toast('Payment amount cannot be negative.', 'err');
    if (amountToPay > total + 0.001) return toast('Payment exceeds the total bill amount.', 'err');

    try {
      const res = await api.post('/sales', {
        customer_id: c,
        prescription_id: rx || null,
        items: cart,
        payment: { amount: amountToPay, method: pay.method },
      });

      const customerObj = cust.find((x) => String(x.customer_id) === String(c));
      setCompletedSale({
        sale_id: res.data.sale_id,
        customer_name: customerObj ? customerObj.customer_name : 'Customer',
        date: today,
        items: [...cart],
        total,
        paid: amountToPay,
        remaining: Math.max(0, total - amountToPay),
        method: pay.method,
      });

      toast('Sale completed successfully.');
      setCart([]);
      setC('');
      setRx('');
      setPay({ amount: '', method: 'Cash' });
      inv.reload();
      salesFetch.reload();
      setN((prev) => prev + 1);
    } catch (x) {
      toast(x.message, 'err');
    }
  };

  const viewReceipt = async (saleId) => {
    try {
      const res = await api.get(`/sales/${saleId}`);
      const paidSum = (res.data.payments || []).reduce((a, p) => a + +p.amount, 0);
      setCompletedSale({
        sale_id: res.data.sale_id,
        customer_name: res.data.customer_name,
        date: res.data.sale_date,
        items: res.data.items.map((i) => ({
          name: i.medicine_name,
          batch: i.batch_number,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount: i.discount,
          total: i.total,
        })),
        total: +res.data.total_amount,
        paid: paidSum,
        remaining: Math.max(0, +res.data.total_amount - paidSum),
        method: res.data.payments?.[0]?.payment_method || 'Cash',
      });
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Left Column: POS Item Selection */}
        <div className={card + ' p-5 lg:col-span-2 space-y-3'}>
          <h3 className="font-semibold text-slate-800 text-lg border-b border-slate-100 pb-2">Point of Sale (POS)</h3>

          <F l="Customer *">
            <select className={inp} value={c} onChange={(e) => setC(e.target.value)}>
              <option value="">Select Customer…</option>
              {cust.map((x) => (
                <option key={x.customer_id} value={x.customer_id}>
                  {x.customer_name} ({x.phone || 'No phone'})
                </option>
              ))}
            </select>
          </F>

          <F l="Prescription (Optional)">
            <select className={inp} value={rx} onChange={(e) => setRx(e.target.value)}>
              <option value="">None</option>
              {pres.map((p) => (
                <option key={p.prescription_id} value={p.prescription_id}>
                  #{p.prescription_id} · Dr. {p.doctor_name} · {fdate(p.prescription_date)}
                </option>
              ))}
            </select>
          </F>

          <div className="pt-2 border-t border-slate-100 space-y-3">
            <F l="Select Medicine *">
              <select
                className={inp}
                value={it.medicine_id}
                onChange={(e) => setIt({ ...it, medicine_id: e.target.value, batch_id: '' })}
              >
                <option value="">Select Medicine…</option>
                {med.map((m) => (
                  <option key={m.medicine_id} value={m.medicine_id}>
                    {m.medicine_name} ({m.stock ?? 0} in stock)
                  </option>
                ))}
              </select>
            </F>

            <F l="Select Available Batch *">
              <select
                className={inp}
                value={it.batch_id}
                onChange={(e) => setItemField('batch_id', e.target.value)}
              >
                <option value="">
                  {it.medicine_id && !batches.length ? 'No stock available for this medicine' : 'Select Batch…'}
                </option>
                {batches.map((b) => (
                  <option key={b.batch_id} value={b.batch_id}>
                    {b.batch_number} · Available: {b.quantity} · Expiry: {fdate(b.expiry_date)}
                  </option>
                ))}
              </select>
            </F>

            <div className="grid grid-cols-3 gap-2">
              <F l="Qty *">
                <input
                  type="number"
                  min="1"
                  max={selectedBatch ? selectedBatch.quantity : undefined}
                  className={inp}
                  value={it.quantity}
                  onChange={(e) => setItemField('quantity', e.target.value)}
                />
              </F>
              <F l="Price (₹) *">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="25.00"
                  className={inp}
                  value={it.unit_price}
                  onChange={(e) => setItemField('unit_price', e.target.value)}
                />
              </F>
              <F l="Discount (₹)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className={inp}
                  value={it.discount}
                  onChange={(e) => setItemField('discount', e.target.value)}
                />
              </F>
            </div>

            <button className={btn + ' w-full'} onClick={addToCart}>
              + Add to Cart
            </button>
          </div>
        </div>

        {/* Right Column: Cart & Checkout */}
        <div className={card + ' p-5 lg:col-span-3 flex flex-col justify-between'}>
          <div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
              <h3 className="font-semibold text-slate-800 text-lg">Cart Items ({cart.length})</h3>
              {cart.length > 0 && (
                <button className="text-xs text-rose-500 hover:underline" onClick={() => setCart([])}>
                  Clear cart
                </button>
              )}
            </div>

            <Table
              rows={cart}
              pageSize={50}
              cols={[
                {
                  k: 'name',
                  l: 'Medicine',
                  r: (r) => (
                    <div>
                      <strong className="font-medium text-slate-800">{r.name}</strong>
                      <div className="text-xs text-slate-400">Batch: {r.batch}</div>
                    </div>
                  ),
                },
                { k: 'quantity', l: 'Qty' },
                { k: 'unit_price', l: 'Price', r: (r) => inr(r.unit_price) },
                { k: 'discount', l: 'Discount', r: (r) => inr(r.discount) },
                { k: 'total', l: 'Total', r: (r) => inr(r.total) },
              ]}
              actions={(r) => (
                <button className="text-rose-600 text-xs hover:underline" onClick={() => setCart(cart.filter((x) => x !== r))}>
                  Remove
                </button>
              )}
            />
          </div>

          <div className="border-t border-slate-100 pt-4 mt-4 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500 font-medium">Subtotal Due</span>
              <span className="text-2xl font-bold text-blue-600">{inr(total)}</span>
            </div>

            <div className="grid sm:grid-cols-3 gap-2 items-end">
              <F l="Amount Paid (₹)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={total > 0 ? String(total) : '0.00'}
                  className={inp + ' !mt-0'}
                  value={pay.amount}
                  onChange={(e) => setPay({ ...pay, amount: e.target.value })}
                />
              </F>
              <F l="Payment Method">
                <select
                  className={inp + ' !mt-0'}
                  value={pay.method}
                  onChange={(e) => setPay({ ...pay, method: e.target.value })}
                >
                  {['Cash', 'UPI', 'Card', 'Net Banking'].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </F>
              <button
                disabled={!cart.length || !c}
                className={btn + ' !bg-emerald-600 hover:!bg-emerald-700 disabled:opacity-50 h-[38px]'}
                onClick={completeSale}
              >
                Complete Sale
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sale Success Receipt Modal */}
      {completedSale && (
        <Modal title={`Invoice / Receipt — Sale #${completedSale.sale_id}`} onClose={() => setCompletedSale(null)}>
          <div className="space-y-4 text-sm" id="printable-receipt">
            <div className="text-center pb-3 border-b border-slate-100">
              <h2 className="font-bold text-lg text-blue-700">PharmaCare Pharmacy</h2>
              <p className="text-xs text-slate-400">Prescription &amp; Medicine Stock Management</p>
              <p className="text-xs text-slate-500 mt-1">Invoice #{completedSale.sale_id} · Date: {fdate(completedSale.date)}</p>
            </div>

            <div className="flex justify-between text-xs text-slate-600 p-2 bg-slate-50 rounded-lg">
              <span>Customer: <strong>{completedSale.customer_name}</strong></span>
              <span>Method: <strong>{completedSale.method}</strong></span>
            </div>

            <table className="w-full text-xs border border-slate-100">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="p-2">Item</th>
                  <th className="p-2">Batch</th>
                  <th className="p-2">Qty</th>
                  <th className="p-2">Rate</th>
                  <th className="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {completedSale.items.map((it, i) => (
                  <tr key={i}>
                    <td className="p-2 font-medium">{it.name}</td>
                    <td className="p-2">{it.batch}</td>
                    <td className="p-2">{it.quantity}</td>
                    <td className="p-2">{inr(it.unit_price)}</td>
                    <td className="p-2 text-right">{inr(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-slate-100 pt-2 space-y-1 text-xs text-right">
              <div>Total Bill: <strong className="text-sm">{inr(completedSale.total)}</strong></div>
              <div>Amount Paid: <strong className="text-emerald-600">{inr(completedSale.paid)}</strong></div>
              <div>Remaining Due: <strong className="text-rose-600">{inr(completedSale.remaining)}</strong></div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                className={btn2}
                onClick={() => window.print()}
              >
                🖨 Print Receipt
              </button>
              <button
                className={btn}
                onClick={() => setCompletedSale(null)}
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Historical Sales Table */}
      <div className={card}>
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Completed Sales History</h3>
        </div>
        <Table
          loading={salesFetch.loading}
          err={salesFetch.err}
          rows={salesFetch.data || []}
          cols={[
            { k: 'sale_id', l: 'Sale ID' },
            { k: 'sale_date', l: 'Date', r: (r) => fdate(r.sale_date) },
            { k: 'customer_name', l: 'Customer' },
            { k: 'total_amount', l: 'Total Amount', r: (r) => inr(r.total_amount) },
            { k: 'paid', l: 'Paid', r: (r) => inr(r.paid) },
            { k: 'remaining', l: 'Due', r: (r) => inr(r.remaining) },
            { k: 'payment_status', l: 'Status', r: (r) => <Badge v={r.payment_status} /> },
          ]}
          actions={(r) => (
            <button className={btn2} onClick={() => viewReceipt(r.sale_id)}>
              View Receipt
            </button>
          )}
        />
      </div>
    </div>
  );
}

// ---------- Payments ----------
export function Payments() {
  const [n, setN] = useState(0);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ sale_id: '', amount: '', payment_method: 'Cash' });

  const sales = (useFetch('/sales', { n }).data || []).filter((s) => +s.remaining > 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.sale_id) return toast('Select a sale.', 'err');
    if (!(+f.amount > 0)) return toast('Amount must be greater than 0.', 'err');

    const selectedSale = sales.find((s) => String(s.sale_id) === String(f.sale_id));
    if (selectedSale && +f.amount > +selectedSale.remaining + 0.001) {
      return toast(`Payment cannot exceed outstanding balance of ${inr(selectedSale.remaining)}.`, 'err');
    }

    try {
      await api.post('/payments', f);
      toast('Payment recorded successfully.');
      setOpen(false);
      setF({ sale_id: '', amount: '', payment_method: 'Cash' });
      setN((prev) => prev + 1);
    } catch (x) {
      toast(x.message, 'err');
    }
  };

  const money = (k) => (r) => inr(r[k]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-slate-800">Payments &amp; Collections</h2>
        <button className={btn} onClick={() => setOpen(true)}>
          + Record Payment
        </button>
      </div>

      <ListPage
        key={n}
        title="Payments"
        path="/payments"
        dateKey="payment_date"
        cols={[
          { k: 'payment_id', l: 'Payment ID' },
          { k: 'sale_id', l: 'Sale ID' },
          { k: 'customer_name', l: 'Customer' },
          { k: 'payment_date', l: 'Date', r: (r) => fdate(r.payment_date) },
          { k: 'amount', l: 'Amount', r: money('amount') },
          { k: 'payment_method', l: 'Method' },
          { k: 'total_sale', l: 'Total Sale', r: money('total_sale') },
          { k: 'amount_paid', l: 'Paid Total', r: money('amount_paid') },
          { k: 'remaining', l: 'Remaining Due', r: money('remaining') },
          { k: 'payment_status', l: 'Status', r: (r) => <Badge v={r.payment_status} /> },
        ]}
      />

      {open && (
        <Modal title="Record Customer Payment" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            <F l="Sale with Due Balance *">
              <select
                required
                className={inp}
                value={f.sale_id}
                onChange={(e) => {
                  const sId = e.target.value;
                  const chosen = sales.find((x) => String(x.sale_id) === String(sId));
                  setF({ ...f, sale_id: sId, amount: chosen ? String(chosen.remaining) : '' });
                }}
              >
                <option value="">Select a sale with pending balance…</option>
                {sales.map((s) => (
                  <option key={s.sale_id} value={s.sale_id}>
                    Sale #{s.sale_id} · {s.customer_name} · Outstanding Due: {inr(s.remaining)}
                  </option>
                ))}
              </select>
            </F>

            <F l="Payment Amount (₹) *">
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                className={inp}
                placeholder="0.00"
                value={f.amount}
                onChange={(e) => setF({ ...f, amount: e.target.value })}
              />
            </F>

            <F l="Payment Method *">
              <select
                className={inp}
                value={f.payment_method}
                onChange={(e) => setF({ ...f, payment_method: e.target.value })}
              >
                {['Cash', 'UPI', 'Card', 'Net Banking'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </F>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" className={btn2} onClick={() => setOpen(false)}>Cancel</button>
              <button className={btn}>Save Payment</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------- Stock movements & Reports ----------
export const StockMovements = () => (
  <ListPage
    title="Stock Movements"
    path="/stock-movements"
    dateKey="movement_date"
    typeKey="movement_type"
    cols={[
      { k: 'movement_id', l: 'Movement ID' },
      { k: 'medicine_name', l: 'Medicine' },
      { k: 'batch_number', l: 'Batch' },
      { k: 'movement_type', l: 'Type', r: (r) => <Badge v={r.movement_type} /> },
      { k: 'quantity', l: 'Quantity' },
      { k: 'movement_date', l: 'Date & Time', r: (r) => fdate(r.movement_date) },
      { k: 'reference', l: 'Reference' },
    ]}
  />
);

const REPORTS = [
  ['sales', 'Sales Report', 'sale_date'],
  ['purchases', 'Purchases Report', 'purchase_date'],
  ['inventory', 'Inventory Report'],
  ['low-stock', 'Low Stock Report'],
  ['expiring', 'Expiring Medicines Report', 'expiry_date'],
  ['stock-movements', 'Stock Movements Report', 'movement_date'],
  ['customer-sales', 'Customer Sales Report'],
];

export function Reports() {
  const [r, setR] = useState(REPORTS[0]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {REPORTS.map((x) => (
          <button
            key={x[0]}
            onClick={() => setR(x)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              r[0] === x[0]
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {x[1]}
          </button>
        ))}
      </div>
      <ListPage key={r[0]} title={r[1]} path={`/reports/${r[0]}`} dateKey={r[2]} />
    </div>
  );
}
