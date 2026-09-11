import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, ShoppingBag, Package, DollarSign,
  Download, FileText, FileSpreadsheet, RefreshCw, AlertTriangle,
  CheckCircle, XCircle, Calendar, Filter, ChevronDown,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sellerAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';

const fmt  = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const fmtN = (n) => Number(n || 0).toLocaleString('en-PH');

/* ── Preset date ranges ──────────────────────────────────────────────────── */
const today    = () => new Date().toISOString().split('T')[0];
const daysAgo  = (d) => { const dt = new Date(); dt.setDate(dt.getDate() - d); return dt.toISOString().split('T')[0]; };
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
const yearStart  = () => new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];

const PRESETS = [
  { label: 'Today',       from: today(),      to: today()      },
  { label: 'Last 7 days', from: daysAgo(6),   to: today()      },
  { label: 'Last 30 days',from: daysAgo(29),  to: today()      },
  { label: 'This month',  from: monthStart(),  to: today()      },
  { label: 'This year',   from: yearStart(),   to: today()      },
];

const KPI_DEFS = [
  { key: 'gross_revenue',    label: 'Gross Revenue',   icon: DollarSign,  bg: 'bg-blue-50',    text: 'text-blue-700',   fmt: true  },
  { key: 'commission',       label: 'Commission (2%)', icon: TrendingUp,  bg: 'bg-amber-50',   text: 'text-amber-700',  fmt: true  },
  { key: 'net_revenue',      label: 'Net Revenue',     icon: CheckCircle, bg: 'bg-green-50',   text: 'text-green-700',  fmt: true  },
  { key: 'order_count',      label: 'Orders',          icon: ShoppingBag, bg: 'bg-indigo-50',  text: 'text-indigo-700', fmt: false },
  { key: 'units_sold',       label: 'Units Sold',      icon: Package,     bg: 'bg-purple-50',  text: 'text-purple-700', fmt: false },
  { key: 'pending_orders',   label: 'Pending',         icon: AlertTriangle,bg:'bg-yellow-50',  text: 'text-yellow-700', fmt: false },
  { key: 'cancelled_orders', label: 'Cancelled',       icon: XCircle,     bg: 'bg-red-50',     text: 'text-red-700',    fmt: false },
  { key: 'active_products',  label: 'Active Products', icon: Package,     bg: 'bg-teal-50',    text: 'text-teal-700',   fmt: false },
];

const ORDER_STATUS_OPTS = [
  { value: '',            label: 'All statuses'  },
  { value: 'pending',     label: 'Pending'       },
  { value: 'confirmed',   label: 'Confirmed'     },
  { value: 'preparing',   label: 'Preparing'     },
  { value: 'delivered',   label: 'Delivered'     },
  { value: 'cancelled',   label: 'Cancelled'     },
];

export default function Reports() {
  const { showToast } = useToast();

  /* ── Filters ─────────────────────────────────────────────────────────── */
  const [from,       setFrom]      = useState(monthStart());
  const [to,         setTo]        = useState(today());
  const [groupBy,    setGroupBy]   = useState('day');
  const [orderStatus,setOrderStatus] = useState('');
  const [activeTab,  setActiveTab] = useState('overview'); // overview | orders | products | payouts

  /* ── Data ────────────────────────────────────────────────────────────── */
  const [summary,  setSummary]  = useState(null);
  const [series,   setSeries]   = useState([]);
  const [orders,   setOrders]   = useState([]);
  const [products, setProducts] = useState([]);
  const [payouts,  setPayouts]  = useState([]);
  const [loading,  setLoading]  = useState(false);

  /* ── Fetch all report data ────────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, serRes, ordRes, prodRes, payRes] = await Promise.all([
        sellerAPI.reports({ type: 'summary', from, to }),
        sellerAPI.reports({ type: 'sales',   from, to, group: groupBy }),
        sellerAPI.reports({ type: 'orders',  from, to, status: orderStatus }),
        sellerAPI.reports({ type: 'products',from, to }),
        sellerAPI.reports({ type: 'payouts' }),
      ]);
      setSummary(sumRes.data?.summary  || null);
      setSeries(serRes.data?.series    || []);
      setOrders(ordRes.data?.orders    || []);
      setProducts(prodRes.data?.products || []);
      setPayouts(payRes.data?.payouts  || []);
    } catch { showToast('Failed to load report data.', 'error'); }
    finally { setLoading(false); }
  }, [from, to, groupBy, orderStatus]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const applyPreset = (p) => { setFrom(p.from); setTo(p.to); };

  /* ══════════════════════════════════════════════════════════════════════
     EXCEL EXPORTS
  ══════════════════════════════════════════════════════════════════════ */
  const exportOrdersExcel = () => {
    const rows = orders.map(o => ({
      'Order #':        o.order_number,
      'Date':           new Date(o.created_at).toLocaleDateString('en-PH'),
      'Buyer':          o.buyer_name,
      'Barangay':       o.barangay || '',
      'Products':       o.products,
      'Qty':            o.total_qty,
      'Subtotal (₱)':   Number(o.subtotal),
      'Commission (₱)': Number(o.commission),
      'Net Payout (₱)': Number(o.net_payout),
      'Shipping (₱)':   Number(o.delivery_fee),
      'Total (₱)':      Number(o.total_amount),
      'Status':         o.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, `orders_${from}_${to}.xlsx`);
    showToast('Orders exported to Excel.', 'success');
  };

  const exportProductsExcel = () => {
    const rows = products.map(p => ({
      'Product':        p.product_name,
      'Category':       p.category,
      'Price (₱)':      Number(p.price),
      'Units Sold':     Number(p.units_sold),
      'Gross (₱)':      Number(p.gross_revenue),
      'Commission (₱)': Number(p.commission),
      'Net (₱)':        Number(p.net_revenue),
      'Stock Left':     Number(p.stock),
      'Status':         p.approval_status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, `products_${from}_${to}.xlsx`);
    showToast('Products exported to Excel.', 'success');
  };

  const exportPayoutsExcel = () => {
    const rows = payouts.map(p => ({
      'Period':         `${p.payout_period_start} → ${p.payout_period_end}`,
      'Orders':         Number(p.order_count),
      'Gross (₱)':      Number(p.gross_amount),
      'Commission (₱)': Number(p.commission_amount),
      'Net (₱)':        Number(p.net_amount),
      'Method':         p.payment_method || '',
      'Account':        p.account_label  || '',
      'Reference':      p.reference_number || '',
      'Status':         p.status,
      'Released At':    p.released_at ? new Date(p.released_at).toLocaleDateString('en-PH') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payouts');
    XLSX.writeFile(wb, `payouts.xlsx`);
    showToast('Payouts exported to Excel.', 'success');
  };

  /* ══════════════════════════════════════════════════════════════════════
     PDF EXPORTS
  ══════════════════════════════════════════════════════════════════════ */
  const buildPdfHeader = (doc, title) => {
    doc.setFontSize(16);
    doc.setTextColor(19, 52, 88);
    doc.text('Bago Shop Express — Seller Report', 14, 18);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(title, 14, 26);
    doc.text(`Period: ${from}  →  ${to}`, 14, 33);
    doc.setTextColor(0);
    return 40;
  };

  const exportOrdersPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const startY = buildPdfHeader(doc, 'Orders Report');
    autoTable(doc, {
      startY,
      head: [['Order #','Date','Buyer','Products','Qty','Subtotal','Commission','Net Payout','Status']],
      body: orders.map(o => [
        o.order_number,
        new Date(o.created_at).toLocaleDateString('en-PH'),
        o.buyer_name,
        o.products?.substring(0, 40) || '',
        o.total_qty,
        `₱${fmt(o.subtotal)}`,
        `₱${fmt(o.commission)}`,
        `₱${fmt(o.net_payout)}`,
        o.status,
      ]),
      styles:       { fontSize: 8 },
      headStyles:   { fillColor: [19, 52, 88] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    doc.save(`orders_${from}_${to}.pdf`);
    showToast('Orders exported to PDF.', 'success');
  };

  const exportProductsPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const startY = buildPdfHeader(doc, 'Top Products Report');
    autoTable(doc, {
      startY,
      head: [['Product','Category','Price','Units Sold','Gross','Commission','Net','Stock']],
      body: products.map(p => [
        p.product_name?.substring(0, 35),
        p.category,
        `₱${fmt(p.price)}`,
        fmtN(p.units_sold),
        `₱${fmt(p.gross_revenue)}`,
        `₱${fmt(p.commission)}`,
        `₱${fmt(p.net_revenue)}`,
        fmtN(p.stock),
      ]),
      styles:       { fontSize: 8 },
      headStyles:   { fillColor: [19, 52, 88] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    doc.save(`products_${from}_${to}.pdf`);
    showToast('Products exported to PDF.', 'success');
  };

  const exportSummaryPDF = () => {
    const doc = new jsPDF();
    const startY = buildPdfHeader(doc, 'Sales Summary Report');
    if (summary) {
      autoTable(doc, {
        startY,
        head: [['Metric', 'Value']],
        body: [
          ['Gross Revenue',    `₱${fmt(summary.gross_revenue)}`],
          ['Commission (2%)',  `₱${fmt(summary.commission)}`],
          ['Net Revenue',      `₱${fmt(summary.net_revenue)}`],
          ['Orders Delivered', fmtN(summary.order_count)],
          ['Units Sold',       fmtN(summary.units_sold)],
          ['Pending Orders',   fmtN(summary.pending_orders)],
          ['Cancelled Orders', fmtN(summary.cancelled_orders)],
          ['Active Products',  fmtN(summary.active_products)],
          ['Low Stock',        fmtN(summary.low_stock)],
          ['Out of Stock',     fmtN(summary.out_of_stock)],
        ],
        headStyles: { fillColor: [19, 52, 88] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });
    }
    // Sales series table
    if (series.length > 0) {
      doc.addPage();
      buildPdfHeader(doc, 'Sales Series');
      autoTable(doc, {
        startY: 40,
        head: [['Period','Gross (₱)','Commission (₱)','Net (₱)','Orders','Units']],
        body: series.map(r => [r.label, fmt(r.gross), fmt(r.commission), fmt(r.net), r.orders, r.units]),
        headStyles: { fillColor: [19, 52, 88] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });
    }
    doc.save(`summary_${from}_${to}.pdf`);
    showToast('Summary exported to PDF.', 'success');
  };

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════ */
  const TABS = [
    { value: 'overview',  label: 'Overview'  },
    { value: 'orders',    label: `Orders (${orders.length})`   },
    { value: 'products',  label: `Products (${products.length})` },
    { value: 'payouts',   label: `Payouts (${payouts.length})` },
  ];

  return (
    <div className="space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your sales, orders, and earnings</p>
        </div>
        <button onClick={fetchAll} disabled={loading}
          className="flex items-center gap-2 text-sm text-gray-600 border rounded-xl px-4 py-2 hover:bg-gray-50 transition disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ── Date filter bar ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Preset chips */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button key={p.label}
                onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                  from === p.from && to === p.to
                    ? 'bg-primary-800 text-white border-primary-800'
                    : 'text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-800'
                }`}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom range */}
          <div className="flex items-center gap-2 ml-auto">
            <Calendar size={14} className="text-gray-400" />
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="px-3 py-1.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-800" />
            <span className="text-gray-400 text-sm">→</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="px-3 py-1.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-800" />
          </div>

          {/* Group by */}
          <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
            className="px-3 py-1.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-800">
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {KPI_DEFS.map(k => (
          <div key={k.key} className={`${k.bg} rounded-2xl p-4 border border-transparent`}>
            <div className="flex items-center justify-between mb-2">
              <p className={`text-xs font-semibold ${k.text} opacity-75 uppercase tracking-wide`}>{k.label}</p>
              <k.icon size={16} className={k.text} />
            </div>
            {loading
              ? <div className="h-7 bg-white/60 rounded-lg animate-pulse" />
              : <p className={`text-2xl font-black ${k.text}`}>
                  {summary ? (k.fmt ? `₱${fmt(summary[k.key])}` : fmtN(summary[k.key])) : '—'}
                </p>}
          </div>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit overflow-x-auto">
        {TABS.map(t => (
          <button key={t.value} onClick={() => setActiveTab(t.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === t.value ? 'bg-white shadow text-primary-800' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          OVERVIEW TAB
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Export row */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={exportSummaryPDF}
              className="flex items-center gap-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-100 transition">
              <FileText size={14} /> Export Summary PDF
            </button>
          </div>

          {/* Area chart — revenue */}
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Revenue Over Time</h3>
            {loading
              ? <div className="h-56 bg-gray-100 rounded-xl animate-pulse" />
              : series.length === 0
                ? <p className="text-sm text-gray-400 text-center py-16">No data for this period</p>
                : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={series}>
                        <defs>
                          <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#133458" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#133458" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v) => `₱${fmt(v)}`} />
                        <Legend />
                        <Area type="monotone" dataKey="gross" name="Gross" stroke="#133458" fill="url(#grossGrad)" strokeWidth={2} dot={false} />
                        <Area type="monotone" dataKey="net"   name="Net"   stroke="#16a34a" fill="url(#netGrad)"   strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )
            }
          </div>

          {/* Bar chart — orders & units */}
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Orders & Units Sold</h3>
            {loading
              ? <div className="h-56 bg-gray-100 rounded-xl animate-pulse" />
              : series.length === 0
                ? <p className="text-sm text-gray-400 text-center py-16">No data for this period</p>
                : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={series}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="orders" name="Orders" fill="#133458" radius={[4,4,0,0]} />
                        <Bar dataKey="units"  name="Units"  fill="#f59e0b" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
            }
          </div>

          {/* Series data table */}
          {series.length > 0 && (
            <div className="bg-white rounded-2xl border overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Sales Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Period','Gross','Commission','Net','Orders','Units'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {series.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-700 font-medium">{r.label}</td>
                        <td className="px-4 py-2.5 text-gray-700">₱{fmt(r.gross)}</td>
                        <td className="px-4 py-2.5 text-amber-600">₱{fmt(r.commission)}</td>
                        <td className="px-4 py-2.5 font-semibold text-green-700">₱{fmt(r.net)}</td>
                        <td className="px-4 py-2.5 text-gray-600">{fmtN(r.orders)}</td>
                        <td className="px-4 py-2.5 text-gray-600">{fmtN(r.units)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ORDERS TAB
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select value={orderStatus} onChange={e => setOrderStatus(e.target.value)}
              className="px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-800">
              {ORDER_STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="flex gap-2 ml-auto">
              <button onClick={exportOrdersExcel}
                className="flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2 hover:bg-green-100 transition">
                <FileSpreadsheet size={14} /> Excel
              </button>
              <button onClick={exportOrdersPDF}
                className="flex items-center gap-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-100 transition">
                <FileText size={14} /> PDF
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border overflow-hidden">
            {loading
              ? <div className="h-40 flex items-center justify-center text-gray-400 text-sm animate-pulse">Loading…</div>
              : orders.length === 0
                ? <div className="py-16 text-center text-gray-400 text-sm">No orders in this period.</div>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          {['Order #','Date','Buyer','Products','Qty','Subtotal','Commission','Net Payout','Status'].map(h => (
                            <th key={h} className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {orders.map((o, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-mono text-xs text-primary-800 font-semibold">{o.order_number}</td>
                            <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">{new Date(o.created_at).toLocaleDateString('en-PH')}</td>
                            <td className="px-4 py-2.5 text-gray-700">{o.buyer_name}</td>
                            <td className="px-4 py-2.5 text-gray-500 max-w-[180px] truncate text-xs">{o.products}</td>
                            <td className="px-4 py-2.5 text-center text-gray-700">{o.total_qty}</td>
                            <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">₱{fmt(o.subtotal)}</td>
                            <td className="px-4 py-2.5 text-amber-600 whitespace-nowrap">₱{fmt(o.commission)}</td>
                            <td className="px-4 py-2.5 font-semibold text-green-700 whitespace-nowrap">₱{fmt(o.net_payout)}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                o.status === 'delivered'  ? 'bg-green-100 text-green-700' :
                                o.status === 'cancelled'  ? 'bg-red-100 text-red-700' :
                                o.status === 'pending'    ? 'bg-yellow-100 text-yellow-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>{o.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
            }
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          PRODUCTS TAB
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex gap-2 justify-end">
            <button onClick={exportProductsExcel}
              className="flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2 hover:bg-green-100 transition">
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button onClick={exportProductsPDF}
              className="flex items-center gap-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-100 transition">
              <FileText size={14} /> PDF
            </button>
          </div>

          <div className="bg-white rounded-2xl border overflow-hidden">
            {loading
              ? <div className="h-40 flex items-center justify-center text-gray-400 text-sm animate-pulse">Loading…</div>
              : products.length === 0
                ? <div className="py-16 text-center text-gray-400 text-sm">No product sales in this period.</div>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          {['#','Product','Category','Price','Units Sold','Gross','Commission','Net','Stock'].map(h => (
                            <th key={h} className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {products.map((p, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                            <td className="px-4 py-2.5 font-medium text-gray-900 max-w-[200px] truncate">{p.product_name}</td>
                            <td className="px-4 py-2.5 text-gray-500">{p.category}</td>
                            <td className="px-4 py-2.5 text-gray-700">₱{fmt(p.price)}</td>
                            <td className="px-4 py-2.5 text-center font-semibold text-gray-800">{fmtN(p.units_sold)}</td>
                            <td className="px-4 py-2.5 text-gray-700">₱{fmt(p.gross_revenue)}</td>
                            <td className="px-4 py-2.5 text-amber-600">₱{fmt(p.commission)}</td>
                            <td className="px-4 py-2.5 font-semibold text-green-700">₱{fmt(p.net_revenue)}</td>
                            <td className="px-4 py-2.5">
                              <span className={`font-semibold ${Number(p.stock) === 0 ? 'text-red-600' : Number(p.stock) <= 5 ? 'text-orange-500' : 'text-gray-700'}`}>
                                {fmtN(p.stock)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
            }
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          PAYOUTS TAB
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">
          <div className="flex gap-2 justify-end">
            <button onClick={exportPayoutsExcel}
              className="flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2 hover:bg-green-100 transition">
              <FileSpreadsheet size={14} /> Excel
            </button>
          </div>

          <div className="bg-white rounded-2xl border overflow-hidden">
            {payouts.length === 0
              ? <div className="py-16 text-center text-gray-400 text-sm">No payout records yet.</div>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {['Period','Orders','Gross','Commission','Net Payout','Method / Account','Reference','Status','Released'].map(h => (
                          <th key={h} className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {payouts.map((p, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{p.payout_period_start} → {p.payout_period_end}</td>
                          <td className="px-4 py-2.5 text-gray-600 text-center">{p.order_count}</td>
                          <td className="px-4 py-2.5 text-gray-700">₱{fmt(p.gross_amount)}</td>
                          <td className="px-4 py-2.5 text-amber-600">₱{fmt(p.commission_amount)}</td>
                          <td className="px-4 py-2.5 font-bold text-green-700">₱{fmt(p.net_amount)}</td>
                          <td className="px-4 py-2.5 text-gray-600 text-xs">{p.account_label || p.payment_method || '—'}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{p.reference_number || '—'}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              p.status==='released'   ? 'bg-green-100 text-green-700' :
                              p.status==='processing' ? 'bg-blue-100 text-blue-700'   :
                              p.status==='cancelled'  ? 'bg-gray-100 text-gray-500'   :
                              'bg-yellow-100 text-yellow-700'
                            }`}>{p.status}</span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                            {p.released_at ? new Date(p.released_at).toLocaleDateString('en-PH') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>
        </div>
      )}
    </div>
  );
}
