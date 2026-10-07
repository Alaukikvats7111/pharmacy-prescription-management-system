import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });
api.interceptors.response.use((r) => r, (e) =>
  Promise.reject(new Error(e.response?.data?.message || (e.response ? 'Something went wrong.' : 'Unable to reach the server.'))));
export const toast = (msg, type = 'ok') => window.dispatchEvent(new CustomEvent('toast', { detail: { msg, type, id: Math.random() } }));
export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const fdate = (d) => (d ? new Date(String(d).replace(' ', 'T')).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const today = new Date().toISOString().slice(0, 10);
export const inp = 'w-full mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200';
export const btn = 'rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50';
export const btn2 = 'rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50';
export const card = 'bg-white rounded-2xl border border-slate-200 shadow-sm';
export const F = ({ l, children, span }) => <label className={`block text-sm ${span ? 'sm:col-span-2' : ''}`}><span className="text-slate-500">{l}</span>{children}</label>;

export function useDebounce(v, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}
export function useFetch(url, params) {
  const [data, setData] = useState(null), [loading, setL] = useState(true), [err, setE] = useState('');
  const key = JSON.stringify(params || {});
  const load = useCallback(() => {
    setL(true);
    return api.get(url, { params: JSON.parse(key) }).then((r) => { setData(r.data); setE(''); }).catch((e) => setE(e.message)).finally(() => setL(false));
  }, [url, key]);
  useEffect(() => { load(); }, [load]);
  return { data, loading, err, reload: load };
}

export function Toaster() {
  const [t, setT] = useState([]);
  useEffect(() => {
    const f = (e) => { setT((a) => [...a, e.detail]); setTimeout(() => setT((a) => a.filter((x) => x.id !== e.detail.id)), 3500); };
    window.addEventListener('toast', f);
    return () => window.removeEventListener('toast', f);
  }, []);
  return <div className="fixed top-4 right-4 z-50 space-y-2">{t.map((x) => <div key={x.id} className={`px-4 py-3 rounded-xl shadow-lg text-sm text-white ${x.type === 'ok' ? 'bg-emerald-600' : 'bg-rose-600'}`}>{x.msg}</div>)}</div>;
}
export const Modal = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-40 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-auto p-6`}>
      <div className="flex justify-between mb-4"><h3 className="font-semibold text-lg">{title}</h3><button onClick={onClose} className="text-slate-400 text-xl leading-none">×</button></div>
      {children}
    </div>
  </div>
);
const BC = { emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', rose: 'bg-rose-50 text-rose-700', blue: 'bg-blue-50 text-blue-700', slate: 'bg-slate-100 text-slate-600' };
const BM = { Healthy: 'emerald', 'Low Stock': 'amber', 'Out of Stock': 'rose', Expired: 'rose', Paid: 'emerald', Partial: 'amber', PURCHASE: 'blue', SALE: 'emerald', RETURN: 'amber', ADJUSTMENT: 'slate' };
export const Badge = ({ v }) => <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${BC[BM[v] || 'slate']}`}>{v}</span>;

export function Table({ cols, rows, loading, err, actions, pageSize = 10 }) {
  const keys = cols || (rows[0] ? Object.keys(rows[0]).map((k) => ({ k, l: k.replace(/_/g, ' ') })) : []);
  const [sort, setSort] = useState(null), [page, setPage] = useState(0);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const x = a[sort.k], y = b[sort.k], n = x !== '' && y !== '' && x != null && y != null && !isNaN(x) && !isNaN(y);
      return (n ? x - y : String(x ?? '').localeCompare(String(y ?? ''))) * sort.d;
    });
  }, [rows, sort]);
  useEffect(() => setPage(0), [rows.length]);
  if (err) return <div className="p-6 text-sm text-rose-700 bg-rose-50 rounded-xl m-4">{err}</div>;
  if (loading) return <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-8 rounded-lg bg-slate-100 animate-pulse" />)}</div>;
  if (!rows.length) return <div className="p-12 text-center text-slate-400 text-sm">No records found.</div>;
  const pages = Math.ceil(sorted.length / pageSize), view = sorted.slice(page * pageSize, (page + 1) * pageSize);
  return (
    <>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-left text-slate-500 border-b border-slate-100">
          {keys.map((c) => <th key={c.k} onClick={() => setSort({ k: c.k, d: sort?.k === c.k ? -sort.d : 1 })} className="px-4 py-3 font-medium capitalize cursor-pointer whitespace-nowrap select-none">{c.l}{sort?.k === c.k ? (sort.d > 0 ? ' ↑' : ' ↓') : ''}</th>)}
          {actions && <th className="px-4 py-3" />}
        </tr></thead>
        <tbody>{view.map((r, i) => (
          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60">
            {keys.map((c) => <td key={c.k} className="px-4 py-3 whitespace-nowrap">{c.r ? c.r(r) : (r[c.k] ?? '—')}</td>)}
            {actions && <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">{actions(r)}</td>}
          </tr>))}</tbody>
      </table></div>
      {pages > 1 && <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-500">
        <span>Page {page + 1} of {pages} · {rows.length} records</span>
        <span className="space-x-2"><button className={btn2} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><button className={btn2} disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button></span>
      </div>}
    </>
  );
}

export function CrudPage({ name, title, path, id, fields, cols, history }) {
  const [sp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || ''), dq = useDebounce(q);
  const { data, loading, err, reload } = useFetch(path, { search: dq });
  const [form, setForm] = useState(null), [del, setDel] = useState(null), [view, setView] = useState(null), [opts, setOpts] = useState({});
  useEffect(() => { fields.filter((f) => f.opts).forEach((f) => api.get(f.opts.path).then((r) => setOpts((o) => ({ ...o, [f.k]: r.data })))); }, []);
  const save = async (e) => {
    e.preventDefault();
    const miss = fields.find((f) => f.req && !String(form[f.k] ?? '').trim());
    if (miss) return toast(`${miss.l} is required.`, 'err');
    try {
      form[id] ? await api.put(`${path}/${form[id]}`, form) : await api.post(path, form);
      toast(`${name} ${form[id] ? 'updated' : 'added'} successfully.`); setForm(null); reload();
    } catch (x) { toast(x.message, 'err'); }
  };
  const remove = async () => {
    try { await api.delete(`${path}/${del[id]}`); toast(`${name} deleted successfully.`); reload(); }
    catch (x) { toast(x.message, 'err'); }
    setDel(null);
  };
  return (
    <div className={card}>
      <div className="p-4 flex gap-3 items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${title.toLowerCase()}…`} className={inp + ' max-w-xs !mt-0'} />
        <button className={btn + ' ml-auto'} onClick={() => setForm({})}>+ Add {name}</button>
      </div>
      <Table loading={loading} err={err} rows={data || []} cols={cols}
        actions={(r) => <><button className={btn2} onClick={() => setView(r)}>View</button><button className={btn2} onClick={() => setForm({ ...r })}>Edit</button><button className={btn2 + ' !text-rose-600'} onClick={() => setDel(r)}>Delete</button></>} />
      {form && <Modal title={`${form[id] ? 'Edit' : 'Add'} ${name}`} onClose={() => setForm(null)}>
        <form onSubmit={save} className="space-y-3">
          {fields.map((f) => <F key={f.k} l={f.l + (f.req ? ' *' : '')}>
            {f.opts
              ? <select className={inp} value={form[f.k] ?? ''} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}><option value="">Select…</option>{(opts[f.k] || []).map((o) => <option key={o[f.opts.v]} value={o[f.opts.v]}>{o[f.opts.l]}</option>)}</select>
              : <input className={inp} value={form[f.k] ?? ''} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} />}
          </F>)}
          <div className="flex justify-end gap-2 pt-2"><button type="button" className={btn2} onClick={() => setForm(null)}>Cancel</button><button className={btn}>Save {name.toLowerCase()}</button></div>
        </form>
      </Modal>}
      {del && <Modal title="Confirm delete" onClose={() => setDel(null)}>
        <p className="text-sm text-slate-600">Are you sure you want to delete this item?</p>
        <div className="flex justify-end gap-2 pt-4"><button className={btn2} onClick={() => setDel(null)}>Cancel</button><button className={btn + ' !bg-rose-600'} onClick={remove}>Delete</button></div>
      </Modal>}
      {view && <Modal wide title={`${name} details`} onClose={() => setView(null)}>
        <dl className="grid sm:grid-cols-2 gap-3 text-sm">{Object.entries(view).map(([k, v]) => <div key={k}><dt className="text-slate-400 capitalize">{k.replace(/_/g, ' ')}</dt><dd>{v ?? '—'}</dd></div>)}</dl>
        {history && <History url={`${path}/${view[id]}/history`} />}
      </Modal>}
    </div>
  );
}
function History({ url }) {
  const { data, loading, err } = useFetch(url);
  return <div className="mt-6 space-y-4">{[['Sales history', 'sales'], ['Prescriptions', 'prescriptions']].map(([l, k]) =>
    <div key={k}><h4 className="font-medium text-sm mb-1">{l}</h4><div className="border border-slate-100 rounded-xl"><Table pageSize={5} loading={loading} err={err} rows={data?.[k] || []} /></div></div>)}</div>;
}

export function ListPage({ title, path, cols, dateKey, typeKey, params }) {
  const { data, loading, err } = useFetch(path, params);
  const [q, setQ] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState(''), [type, setType] = useState('');
  const rows = useMemo(() => (data || []).filter((r) =>
    (!q || Object.values(r).join(' ').toLowerCase().includes(q.toLowerCase())) &&
    (!dateKey || ((!from || String(r[dateKey]).slice(0, 10) >= from) && (!to || String(r[dateKey]).slice(0, 10) <= to)))
    && (!typeKey || !type || r[typeKey] === type)), [data, q, from, to, type, dateKey, typeKey]);
  const types = typeKey ? [...new Set((data || []).map((r) => r[typeKey]))] : [];
  const csv = () => {
    if (!rows.length) return toast('Nothing to export.', 'err');
    const ks = Object.keys(rows[0]), t = [ks.join(','), ...rows.map((r) => ks.map((k) => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv' })); a.download = `${title}.csv`; a.click();
  };
  return (
    <div className={card}>
      <div className="p-4 flex flex-wrap gap-3 items-end">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className={inp + ' max-w-xs !mt-0'} />
        {dateKey && <><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp + ' !w-auto !mt-0'} /><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp + ' !w-auto !mt-0'} /></>}
        {typeKey && <select value={type} onChange={(e) => setType(e.target.value)} className={inp + ' !w-auto !mt-0'}><option value="">All types</option>{types.map((t) => <option key={t}>{t}</option>)}</select>}
        <button className={btn2 + ' ml-auto'} onClick={csv}>Export CSV</button>
      </div>
      <Table loading={loading} err={err} rows={rows} cols={cols} />
    </div>
  );
}
