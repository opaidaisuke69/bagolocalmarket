import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, RefreshCw, Save, Edit2,
  AlertTriangle, XCircle, CheckCircle, Package, Boxes,
  TrendingUp, Plus, Minus,
} from 'lucide-react';
import { sellerAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';

const IMAGE_BASE = import.meta.env.PROD ? '/server' : '';
const fmtN = (n) => Number(n || 0).toLocaleString('en-PH');
const fmt  = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

/* ── stock level meta ─────────────────────────────────────────────────────── */
function stockMeta(stock) {
  const n = Number(stock);
  if (n === 0) return { label: 'Out of Stock', bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500',    bar: 'bg-red-400'    };
  if (n <= 10)  return { label: 'Low Stock',    bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400', bar: 'bg-orange-400' };
  return               { label: 'In Stock',     bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500',  bar: 'bg-green-500'  };
}

/* ── inline stock input ───────────────────────────────────────────────────── */
function StockInput({ value, onChange, onSave, saving }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-7 h-7 rounded-lg border flex items-center justify-center text-gray-500 hover:bg-gray-100 transition"
      >
        <Minus size={12} />
      </button>
      <input
        type="number" min="0"
        value={value}
        onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        className="w-16 text-center py-1 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-primary-800 outline-none"
      />
      <button
        onClick={() => onChange(value + 1)}
        className="w-7 h-7 rounded-lg border flex items-center justify-center text-gray-500 hover:bg-gray-100 transition"
      >
        <Plus size={12} />
      </button>
      <button
        onClick={onSave}
        disabled={saving}
        className="w-7 h-7 rounded-lg bg-primary-800 flex items-center justify-center text-white hover:bg-primary-900 disabled:opacity-50 transition"
        title="Save"
      >
        {saving ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
      </button>
    </div>
  );
}

const STOCK_FILTERS = [
  { value: '',    label: 'All'          },
  { value: 'out', label: 'Out of Stock' },
  { value: 'low', label: 'Low (≤10)'   },
  { value: 'ok',  label: 'Healthy'     },
];

export default function Inventory() {
  const { showToast } = useToast();

  /* ── filter state ─────────────────────────────────────────────────────── */
  const [search,      setSearch]      = useState('');
  const [category,    setCategory]    = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [page,        setPage]        = useState(1);

  /* ── data ─────────────────────────────────────────────────────────────── */
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  /* ── per-row edit state: { [productId]: { stock, varStocks:{[varId]:n} } } */
  const [edits,   setEdits]   = useState({});
  /* ── saving state: { [key]: bool }  key = `p${id}` or `v${id}` ─────────── */
  const [saving,  setSaving]  = useState({});
  /* ── expanded product rows ────────────────────────────────────────────── */
  const [expanded, setExpanded] = useState({});

  /* ── bulk save state ──────────────────────────────────────────────────── */
  const [bulkSaving, setBulkSaving] = useState(false);

  /* ── fetch ────────────────────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sellerAPI.inventory({ search, category, stock_filter: stockFilter, page });
      const d = res.data;
      setData(d);

      // initialise edits from loaded products
      const init = {};
      (d.products || []).forEach(p => {
        init[p.id] = {
          stock:     Number(p.stock),
          varStocks: Object.fromEntries((p.variations || []).map(v => [v.id, Number(v.stock)])),
        };
      });
      setEdits(init);
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'Unknown error';
      showToast(`Inventory load failed: ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [search, category, stockFilter, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── save single product stock ───────────────────────────────────────── */
  const saveProductStock = async (productId) => {
    const key = `p${productId}`;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      await sellerAPI.updateStock({ product_id: productId, stock: edits[productId]?.stock ?? 0 });
      showToast('Stock updated.', 'success');
      fetchData();
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed.', 'error');
    } finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
  };

  /* ── save single variation stock ────────────────────────────────────── */
  const saveVariationStock = async (productId, varId) => {
    const key = `v${varId}`;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      await sellerAPI.updateStock({
        product_id:   productId,
        variation_id: varId,
        stock:        edits[productId]?.varStocks?.[varId] ?? 0,
      });
      showToast('Variation stock updated.', 'success');
      fetchData();
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed.', 'error');
    } finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
  };

  /* ── bulk save all edited rows ───────────────────────────────────────── */
  const bulkSave = async () => {
    if (!data?.products) return;
    setBulkSaving(true);
    const items = [];
    data.products.forEach(p => {
      const e = edits[p.id];
      if (!e) return;
      if ((p.variations || []).length > 0) {
        p.variations.forEach(v => {
          if (e.varStocks?.[v.id] !== v.stock) {
            items.push({ product_id: p.id, variation_id: v.id, stock: e.varStocks?.[v.id] ?? v.stock });
          }
        });
      } else {
        if (e.stock !== p.stock) {
          items.push({ product_id: p.id, stock: e.stock });
        }
      }
    });

    if (items.length === 0) { showToast('No changes to save.', 'warning'); setBulkSaving(false); return; }

    try {
      const res = await sellerAPI.bulkUpdateStock({ action: 'bulk_update', items });
      showToast(res.data?.message || 'Bulk update done.', 'success');
      fetchData();
    } catch (e) {
      showToast(e.response?.data?.message || 'Bulk save failed.', 'error');
    } finally {
      setBulkSaving(false);
    }
  };

  /* ── helpers ──────────────────────────────────────────────────────────── */
  const setProductStock = (pid, val) =>
    setEdits(e => ({ ...e, [pid]: { ...e[pid], stock: val } }));

  const setVarStock = (pid, vid, val) =>
    setEdits(e => ({
      ...e,
      [pid]: { ...e[pid], varStocks: { ...e[pid]?.varStocks, [vid]: val } },
    }));

  const toggleExpand = (pid) =>
    setExpanded(ex => ({ ...ex, [pid]: !ex[pid] }));

  const clearFilters = () => { setSearch(''); setCategory(''); setStockFilter(''); setPage(1); };

  const stats = data?.stats || {};
  const products = data?.products || [];
  const categories = data?.categories || [];

  /* ══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage stock levels for all your products</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData}
            className="flex items-center gap-1.5 text-sm text-gray-600 border rounded-xl px-3 py-2 hover:bg-gray-50 transition">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={bulkSave} disabled={bulkSaving}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-primary-800 rounded-xl px-4 py-2 hover:bg-primary-900 disabled:opacity-60 transition">
            {bulkSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {bulkSaving ? 'Saving…' : 'Save All Changes'}
          </button>
        </div>
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Products', value: fmtN(stats.total_products), icon: Package,       bg: 'bg-blue-50',   text: 'text-blue-700'   },
          { label: 'Total Units',    value: fmtN(stats.total_units),    icon: Boxes,          bg: 'bg-indigo-50', text: 'text-indigo-700' },
          { label: 'Total Sold',     value: fmtN(stats.total_sold),     icon: TrendingUp,     bg: 'bg-purple-50', text: 'text-purple-700' },
          { label: 'Out of Stock',   value: fmtN(stats.out_of_stock),   icon: XCircle,        bg: 'bg-red-50',    text: 'text-red-700'    },
          { label: 'Low Stock',      value: fmtN(stats.low_stock),      icon: AlertTriangle,  bg: 'bg-orange-50', text: 'text-orange-700' },
          { label: 'Healthy',        value: fmtN(stats.healthy),        icon: CheckCircle,    bg: 'bg-green-50',  text: 'text-green-700'  },
        ].map((c, i) => (
          <div key={i} className={`${c.bg} rounded-2xl p-3 border border-transparent`}>
            <div className="flex items-center justify-between mb-1">
              <p className={`text-[10px] font-semibold ${c.text} opacity-75 uppercase tracking-wide`}>{c.label}</p>
              <c.icon size={13} className={c.text} />
            </div>
            {loading
              ? <div className="h-6 bg-white/60 rounded animate-pulse" />
              : <p className={`text-xl font-black ${c.text}`}>{c.value}</p>}
          </div>
        ))}
      </div>

      {/* ── Filters ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" placeholder="Search products…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-8 pr-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-800"
          />
        </div>

        <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-800">
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {STOCK_FILTERS.map(f => (
            <button key={f.value}
              onClick={() => { setStockFilter(f.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                stockFilter === f.value ? 'bg-white shadow text-primary-800' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {(search || category || stockFilter) && (
          <button onClick={clearFilters}
            className="flex items-center gap-1.5 text-xs text-gray-500 border rounded-xl px-3 py-2 hover:bg-gray-50 transition">
            <XCircle size={13} /> Clear Filters
          </button>
        )}
      </div>

      {/* ── Product table ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        {/* Table header */}
        <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1.5fr_1fr_80px] gap-4 px-5 py-3 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <span>Product</span>
          <span>Category</span>
          <span className="text-right">Price</span>
          <span className="text-center">Stock / Edit</span>
          <span className="text-center">Sold</span>
          <span></span>
        </div>

        {loading ? (
          <div className="divide-y">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="px-5 py-4 flex gap-4 animate-pulse">
                <div className="w-12 h-12 bg-gray-100 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-4 text-gray-400">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
              <Boxes size={32} className="opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-gray-700">No products found</p>
              {data?.debug?.all_products_count > 0 ? (
                <p className="text-sm text-amber-600 mt-1">
                  You have {data.debug.all_products_count} product(s) but none match the current filters.
                </p>
              ) : (
                <p className="text-sm text-gray-400 mt-1 max-w-xs">
                  Your inventory shows all products you've listed. Add your first product to get started.
                </p>
              )}
            </div>
            <div className="flex gap-3">
              {(search || category || stockFilter) ? (
                <button onClick={clearFilters}
                  className="flex items-center gap-2 bg-primary-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-900 transition">
                  <XCircle size={15} /> Clear Filters
                </button>
              ) : (
                <Link to="/seller/add-product"
                  className="flex items-center gap-2 bg-primary-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-900 transition">
                  <Plus size={15} /> Add New Product
                </Link>
              )}
              <Link to="/seller/products"
                className="flex items-center gap-2 border text-gray-600 text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-gray-50 transition">
                View Products
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {products.map(product => {
              const edit    = edits[product.id] || { stock: product.stock, varStocks: {} };
              const hasVars = (product.variations?.length ?? 0) > 0;
              // total shown in header for variant products = sum of edited var stocks
              const varTotal = hasVars
                ? product.variations.reduce((s, v) => s + (edit.varStocks?.[v.id] ?? v.stock), 0)
                : null;
              const displayStock = hasVars ? varTotal : edit.stock;
              const meta = stockMeta(displayStock);

              return (
                <div key={product.id} className="border-b last:border-b-0">

                  {/* ── Product header row ─────────────────────────── */}
                  <div className={`px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-4 ${hasVars ? 'bg-gray-50/40' : 'hover:bg-gray-50/60'} transition`}>

                    {/* Thumbnail + name */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0 border">
                        {product.image
                          ? <img src={`${IMAGE_BASE}${product.image}`} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Package size={18} className="text-gray-300" /></div>}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate max-w-[260px]">{product.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                            {meta.label} · {fmtN(displayStock)} units
                          </span>
                          {product.category && (
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                              {product.category}
                            </span>
                          )}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            product.approval_status === 'approved' ? 'bg-green-50 text-green-600' :
                            product.approval_status === 'pending'  ? 'bg-yellow-50 text-yellow-600' :
                            'bg-red-50 text-red-600'
                          }`}>{product.approval_status}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right side: price + sold + stock + edit */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Price</p>
                        <p className="text-sm font-semibold text-gray-800">₱{fmt(product.price)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Sold</p>
                        <p className="text-sm font-semibold text-gray-700">{fmtN(product.sold_count)}</p>
                      </div>

                      {/* ── NO variants: direct editable stock input ── */}
                      {!hasVars && (
                        <div className="flex flex-col items-end gap-1">
                          <p className="text-xs text-gray-400">Stock</p>
                          <StockInput
                            value={edit.stock}
                            onChange={val => setProductStock(product.id, val)}
                            onSave={() => saveProductStock(product.id)}
                            saving={!!saving[`p${product.id}`]}
                          />
                        </div>
                      )}

                      {/* ── HAS variants: read-only total with lock hint ── */}
                      {hasVars && (
                        <div className="flex flex-col items-end gap-1">
                          <p className="text-xs text-gray-400">Total Stock</p>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-black ${meta.text}`}>
                              {fmtN(varTotal)}
                            </span>
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                              edit per variant ↓
                            </span>
                          </div>
                        </div>
                      )}

                      <Link to={`/seller/edit-product/${product.id}`}
                        className="p-2 text-gray-400 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition"
                        title="Edit product">
                        <Edit2 size={14} />
                      </Link>
                    </div>
                  </div>

                  {/* ── Variant breakdown — always visible, stock editable per-variant ── */}
                  {hasVars && (
                    <div className="border-t">
                      {/* Section label */}
                      <div className="px-6 pt-3 pb-1 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Variant Stock Breakdown
                        </span>
                        <span className="text-[10px] text-gray-300">
                          — edit each variant individually below
                        </span>
                      </div>

                      {/* Variant column headers */}
                      <div className="grid grid-cols-[1fr_120px_200px] gap-x-4 px-6 py-2 bg-gray-100/60 border-y text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        <span>Variant</span>
                        <span className="text-right">Price Adj.</span>
                        <span className="text-center">Stock</span>
                      </div>

                      {product.variations.map((v, vi) => {
                        const vStock = edit.varStocks?.[v.id] ?? v.stock;
                        const vMeta  = stockMeta(vStock);
                        const isLast = vi === product.variations.length - 1;
                        return (
                          <div key={v.id}
                            className={`grid grid-cols-[1fr_120px_200px] gap-x-4 items-center px-6 py-3 hover:bg-indigo-50/30 transition ${!isLast ? 'border-b border-gray-100' : ''}`}
                          >
                            {/* Variant label + status */}
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${vMeta.dot}`} />
                              <span className="text-sm font-semibold text-gray-800 truncate">{v.label}</span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${vMeta.bg} ${vMeta.text}`}>
                                {vMeta.label}
                              </span>
                            </div>

                            {/* Price adjustment */}
                            <div className="text-right">
                              {Number(v.price_adjustment) !== 0 ? (
                                <span className={`text-xs font-semibold ${v.price_adjustment > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                  {v.price_adjustment > 0 ? '+' : ''}₱{fmt(Math.abs(v.price_adjustment))}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-300">base price</span>
                              )}
                            </div>

                            {/* Per-variant stock input */}
                            <div className="flex justify-center">
                              <StockInput
                                value={vStock}
                                onChange={val => setVarStock(product.id, v.id, val)}
                                onSave={() => saveVariationStock(product.id, v.id)}
                                saving={!!saving[`v${v.id}`]}
                              />
                            </div>
                          </div>
                        );
                      })}

                      {/* Combined total footer */}
                      <div className="flex items-center justify-between px-6 py-2.5 bg-primary-50/50 border-t border-primary-100/60">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-primary-800">
                            Combined Total
                          </span>
                          <span className="text-[10px] text-primary-500">
                            ({product.variations.length} variant{product.variations.length !== 1 ? 's' : ''})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black ${meta.text}`}>
                            {fmtN(varTotal)} units
                          </span>
                          <span className="text-[10px] text-gray-400 bg-white border rounded-full px-2 py-0.5">
                            auto-summed
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {data?.total_pages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t text-sm">
            <span className="text-gray-500">
              Page {page} of {data.total_pages} · {fmtN(data.total)} products
            </span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Prev</button>
              <button disabled={page >= data.total_pages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
