import { useState, useEffect, useRef } from 'react';
import {
  Wallet, TrendingUp, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Upload, RefreshCw, Search, Receipt, Store, Banknote,
  AlertCircle, Eye, X, Send, Info,
} from 'lucide-react';
import { adminAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/common/Modal';

const IMAGE_BASE = import.meta.env.PROD ? '/server' : '';
const fmt  = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const fmtN = (n) => Number(n || 0).toLocaleString('en-PH');

const STATUS_META = {
  pending:    { label: 'Pending',    bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  processing: { label: 'Processing', bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-400'   },
  released:   { label: 'Released',   bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  cancelled:  { label: 'Cancelled',  bg: 'bg-gray-100',   text: 'text-gray-500',   dot: 'bg-gray-400'   },
};

const TYPE_COLORS = {
  gcash:  'bg-blue-100 text-blue-700',
  maya:   'bg-green-100 text-green-700',
  bank:   'bg-indigo-100 text-indigo-700',
  others: 'bg-purple-100 text-purple-700',
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${m.bg} ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function AmountRow({ label, value, cls = '', border = false }) {
  return (
    <div className={`flex justify-between items-center text-sm ${border ? 'border-t pt-2 mt-1' : ''}`}>
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold ${cls}`}>{value}</span>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="flex flex-col items-center py-16 gap-3 text-gray-400">
      <Wallet size={36} className="opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export default function SellerPayouts() {
  const { showToast } = useToast();

  const [tab, setTab] = useState('pending_earnings');

  /* ── pending earnings ──────────────────────────────────────────────────────── */
  const [summary, setSummary]               = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [expandedSeller, setExpandedSeller] = useState(null);

  /* ── payout history ────────────────────────────────────────────────────────── */
  const [history, setHistory]               = useState(null);
  const [historyLoading, setHistLoading]    = useState(true);
  const [histStatus, setHistStatus]         = useState('');
  const [histSearch, setHistSearch]         = useState('');
  const [histPage, setHistPage]             = useState(1);

  /* ── payout form ───────────────────────────────────────────────────────────── */
  const [showForm, setShowForm]             = useState(false);
  const [formSeller, setFormSeller]         = useState(null);
  const [sellerAccounts, setSellerAccounts] = useState([]);
  const [accountsLoading, setAccLoading]   = useState(false);
  const [form, setForm] = useState({
    remittance_account_id: '',
    payment_method: '',
    reference_number: '',
    notes: '',
    status: 'pending',
    receipt_image: null,
  });
  const [formSaving, setFormSaving] = useState(false);
  const receiptRef = useRef();

  /* ── release modal ─────────────────────────────────────────────────────────── */
  const [showRelease, setShowRelease]       = useState(false);
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [releaseForm, setReleaseForm] = useState({
    reference_number: '', payment_method: '', receipt_image: null, remittance_account_id: '',
  });
  const [releaseSaving, setReleaseSaving]   = useState(false);
  const releaseReceiptRef = useRef();

  /* ── detail modal ──────────────────────────────────────────────────────────── */
  const [showDetail, setShowDetail]     = useState(false);
  const [detailPayout, setDetailPayout] = useState(null);

  /* ── fetch ─────────────────────────────────────────────────────────────────── */
  const fetchSummary = async (silent = false) => {
    if (!silent) setSummaryLoading(true);
    try {
      const res = await adminAPI.sellerPayoutSummary();
      setSummary(res.data);
    } catch { if (!silent) showToast('Failed to load pending earnings.', 'error'); }
    finally { if (!silent) setSummaryLoading(false); }
  };

  const fetchHistory = async (silent = false) => {
    if (!silent) setHistLoading(true);
    try {
      const res = await adminAPI.sellerPayouts({ status: histStatus, search: histSearch, page: histPage });
      setHistory(res.data);
    } catch { if (!silent) showToast('Failed to load payout history.', 'error'); }
    finally { if (!silent) setHistLoading(false); }
  };

  useEffect(() => { fetchSummary(); }, []);
  useEffect(() => { fetchHistory(); }, [histStatus, histSearch, histPage]);

  // Silent background polling every 20s
  useEffect(() => {
    const t = setInterval(() => { fetchSummary(true); fetchHistory(true); }, 20_000);
    return () => clearInterval(t);
  }, [histStatus, histSearch, histPage]);

  /* ── open payout form ──────────────────────────────────────────────────────── */
  const openPayoutForm = async (seller) => {
    setFormSeller(seller);
    setForm({
      remittance_account_id: seller.payout_account_id || '',
      payment_method:        seller.payout_label      || '',
      reference_number:      '',
      notes:                 '',
      status:                'pending',
      receipt_image:         null,
    });
    setShowForm(true);
    setAccLoading(true);
    try {
      const res = await adminAPI.sellerPayoutAccounts(seller.seller_id);
      setSellerAccounts(res.data.accounts || []);
    } catch { setSellerAccounts([]); }
    finally { setAccLoading(false); }
  };

  const handleFormChange = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'remittance_account_id') {
        const acct = sellerAccounts.find(a => String(a.id) === String(value));
        if (acct) next.payment_method = acct.label;
      }
      return next;
    });
  };

  /* ── save payout (amounts computed server-side) ────────────────────────────── */
  const savePayout = async () => {
    setFormSaving(true);
    try {
      const res = await adminAPI.createSellerPayout({
        seller_id:            formSeller.seller_id,
        remittance_account_id: form.remittance_account_id || null,
        payment_method:       form.payment_method  || null,
        reference_number:     form.reference_number || null,
        notes:                form.notes            || null,
        status:               form.status,
        receipt_image:        form.receipt_image,
      });
      showToast(
        `Payout created — ₱${fmt(res.data?.net)} net to ${formSeller.store_name || formSeller.seller_name}`,
        'success'
      );
      setShowForm(false);
      fetchSummary();
      fetchHistory();
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to create payout.', 'error');
    } finally { setFormSaving(false); }
  };

  /* ── release payout ────────────────────────────────────────────────────────── */
  const openRelease = async (payout) => {
    setSelectedPayout(payout);
    setReleaseForm({
      reference_number:      payout.reference_number || '',
      payment_method:        payout.payment_method   || '',
      receipt_image:         null,
      remittance_account_id: payout.remittance_account_id || '',
    });
    setShowRelease(true);
    try {
      const res = await adminAPI.sellerPayoutAccounts(payout.seller_id);
      setSellerAccounts(res.data.accounts || []);
    } catch { setSellerAccounts([]); }
  };

  const doRelease = async () => {
    setReleaseSaving(true);
    try {
      await adminAPI.updateSellerPayout({
        payout_id:            selectedPayout.id,
        action:               'release',
        reference_number:     releaseForm.reference_number     || null,
        payment_method:       releaseForm.payment_method       || null,
        receipt_image:        releaseForm.receipt_image,
        remittance_account_id: releaseForm.remittance_account_id || null,
      });
      showToast('Payout released.', 'success');
      setShowRelease(false);
      fetchHistory();
      fetchSummary();
    } catch (e) {
      showToast(e.response?.data?.message || 'Release failed.', 'error');
    } finally { setReleaseSaving(false); }
  };

  const changeStatus = async (payout, action) => {
    if (!confirm({ processing: 'Mark as processing?', cancel: 'Cancel this payout?' }[action])) return;
    try {
      await adminAPI.updateSellerPayout({ payout_id: payout.id, action });
      showToast('Updated.', 'success');
      fetchHistory(); fetchSummary();
    } catch { showToast('Action failed.', 'error'); }
  };

  const readImage = (file, cb) => {
    const r = new FileReader();
    r.onload = () => cb(r.result);
    r.readAsDataURL(file);
  };

  /* ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5">

      {/* ── Summary strip ─────────────────────────────────────────────────── */}
      {summary?.totals && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Sellers Awaiting Payout', value: fmtN(summary.totals.total_sellers),          icon: Store,      bg: 'bg-orange-50 border-orange-200',  text: 'text-orange-700' },
            { label: 'Total Gross Revenue',      value: `₱${fmt(summary.totals.total_gross)}`,       icon: TrendingUp, bg: 'bg-blue-50 border-blue-200',      text: 'text-blue-700'   },
            { label: 'Platform Commission (2%)', value: `₱${fmt(summary.totals.total_commission)}`,  icon: Banknote,   bg: 'bg-amber-50 border-amber-200',    text: 'text-amber-700'  },
            { label: 'Total Net Payable',        value: `₱${fmt(summary.totals.total_net)}`,         icon: Wallet,     bg: 'bg-green-50 border-green-200',    text: 'text-green-700'  },
          ].map((c, i) => (
            <div key={i} className={`${c.bg} border rounded-xl p-4`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-xs font-medium ${c.text} opacity-75`}>{c.label}</p>
                  <p className={`text-xl font-bold ${c.text} mt-1`}>{c.value}</p>
                </div>
                <c.icon size={18} className={c.text} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { value: 'pending_earnings', label: 'Pending Payouts' },
          { value: 'history',          label: 'Payout History'  },
        ].map(t => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.value ? 'bg-white shadow text-primary-800' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1 — Pending Payouts
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'pending_earnings' && (
        <div className="bg-white rounded-xl border">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div>
              <h3 className="font-semibold text-gray-900">Sellers Awaiting Payout</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Amounts computed from delivered orders — 2% commission auto-deducted
              </p>
            </div>
          </div>

          {summaryLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm animate-pulse">Loading…</div>
          ) : !summary?.sellers?.length ? (
            <Empty text="All sellers are paid up — great job!" />
          ) : (
            <div className="divide-y">
              {summary.sellers.map(seller => (
                <div key={seller.seller_id}>
                  <div className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                      <Store size={18} className="text-primary-800" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 text-sm">{seller.store_name || seller.seller_name}</p>
                        <span className="text-xs text-gray-400">{seller.seller_email}</span>
                      </div>
                      {seller.payout_account_id ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[seller.payout_type] || TYPE_COLORS.others}`}>
                            {seller.payout_type?.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500">{seller.payout_account_name}</span>
                          <span className="text-xs font-semibold text-gray-700">{seller.payout_account_number}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-orange-500 mt-0.5 flex items-center gap-1">
                          <AlertCircle size={11} /> No payout account set
                        </p>
                      )}
                    </div>

                    {/* Amounts — read-only, sourced from server */}
                    <div className="hidden sm:flex items-center gap-5 text-right">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Orders</p>
                        <p className="text-sm font-bold text-gray-700">{fmtN(seller.order_count)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Gross</p>
                        <p className="text-sm font-semibold text-gray-700">₱{fmt(seller.gross_amount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-amber-500 uppercase tracking-wide">-Commission</p>
                        <p className="text-sm text-amber-600">₱{fmt(seller.commission_amount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-green-600 uppercase tracking-wide font-semibold">Net Payout</p>
                        <p className="text-lg font-black text-green-700">₱{fmt(seller.net_amount)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setExpandedSeller(expandedSeller === seller.seller_id ? null : seller.seller_id)}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
                        {expandedSeller === seller.seller_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <button onClick={() => openPayoutForm(seller)}
                        className="flex items-center gap-1.5 bg-primary-800 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-primary-900 transition">
                        <Send size={13} /> Pay Out
                      </button>
                    </div>
                  </div>

                  {/* Mobile amounts */}
                  <div className="sm:hidden flex gap-3 px-5 pb-3 text-xs text-gray-500 flex-wrap">
                    <span>{fmtN(seller.order_count)} orders</span>
                    <span>Gross ₱{fmt(seller.gross_amount)}</span>
                    <span className="text-amber-600">-₱{fmt(seller.commission_amount)} commission</span>
                    <span className="font-bold text-green-700">Net ₱{fmt(seller.net_amount)}</span>
                  </div>

                  {/* Expanded breakdown */}
                  {expandedSeller === seller.seller_id && (
                    <div className="px-5 pb-5 bg-gray-50 border-t">
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">

                        {/* Earnings breakdown card */}
                        <div className="bg-white rounded-xl border p-4 space-y-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Payout Breakdown</p>
                          <AmountRow label="Gross Revenue (all delivered orders)" value={`₱${fmt(seller.gross_amount)}`} />
                          <AmountRow label="Platform Commission (2%)" value={`-₱${fmt(seller.commission_amount)}`} cls="text-amber-600" />
                          <AmountRow label="Net Payout" value={`₱${fmt(seller.net_amount)}`} cls="text-green-700 text-base" border />
                          <p className="text-[10px] text-gray-400 pt-1 flex items-center gap-1">
                            <Info size={10} /> Commission deducted from seller earnings, not added to buyer price
                          </p>
                          <p className="text-xs text-gray-400">{fmtN(seller.order_count)} orders covered</p>
                          {seller.earliest_order && (
                            <p className="text-xs text-gray-400">
                              {new Date(seller.earliest_order).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                              {' → '}
                              {new Date(seller.latest_order).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          )}
                        </div>

                        {/* Remittance account card */}
                        <div className="bg-white rounded-xl border p-4 space-y-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Send Payout To</p>
                          {seller.payout_account_id ? (
                            <>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[seller.payout_type] || TYPE_COLORS.others}`}>
                                  {seller.payout_type?.toUpperCase()}
                                </span>
                                <span className="text-xs font-semibold text-gray-700">{seller.payout_label}</span>
                              </div>
                              <p className="font-semibold text-gray-900">{seller.payout_account_name}</p>
                              <p className="text-primary-800 font-mono font-bold">{seller.payout_account_number}</p>
                              {seller.payout_bank_name && <p className="text-xs text-gray-400">{seller.payout_bank_name}</p>}
                            </>
                          ) : (
                            <div className="flex items-start gap-2 text-orange-500 text-sm">
                              <AlertCircle size={14} className="mt-0.5" />
                              <span>Seller hasn't configured a payout account. You can still create the payout.</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button onClick={() => openPayoutForm(seller)}
                          className="flex items-center gap-2 bg-primary-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-900 transition">
                          <Send size={15} /> Distribute Payout — ₱{fmt(seller.net_amount)}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2 — Payout History
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'history' && (
        <div className="bg-white rounded-xl border">
          {history?.summary && (
            <div className="grid grid-cols-3 gap-4 p-4 border-b bg-gray-50 rounded-t-xl">
              {[
                { label: 'Pending',    value: `₱${fmt(history.summary.pending_amount)}`,    count: history.summary.pending_count,    cls: 'text-yellow-700' },
                { label: 'Processing', value: `₱${fmt(history.summary.processing_amount)}`, count: history.summary.processing_count, cls: 'text-blue-700'   },
                { label: 'Released',   value: `₱${fmt(history.summary.released_amount)}`,   count: history.summary.released_count,   cls: 'text-green-700'  },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <p className={`text-base font-bold ${s.cls}`}>{s.value}</p>
                  <p className="text-xs text-gray-400">{fmtN(s.count)} {s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-3 p-4 border-b">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search seller / reference…" value={histSearch}
                onChange={e => { setHistSearch(e.target.value); setHistPage(1); }}
                className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {['', 'pending', 'processing', 'released', 'cancelled'].map(s => (
                <button key={s} onClick={() => { setHistStatus(s); setHistPage(1); }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${histStatus === s ? 'bg-white shadow text-primary-800' : 'text-gray-500 hover:text-gray-700'}`}>
                  {s ? STATUS_META[s]?.label : 'All'}
                </button>
              ))}
            </div>
          </div>

          {historyLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm animate-pulse">Loading…</div>
          ) : !history?.payouts?.length ? (
            <Empty text="No payout records found." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Seller / Store</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Period</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">Gross</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">Commission</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">Net Payout</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Send To</th>
                    <th className="text-center px-4 py-3 text-gray-500 font-medium">Status</th>
                    <th className="text-center px-4 py-3 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {history.payouts.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{p.store_name || p.seller_name}</p>
                        <p className="text-xs text-gray-400">{p.seller_email}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        <p>{p.payout_period_start}</p>
                        {p.payout_period_end !== p.payout_period_start && <p className="text-gray-400">→ {p.payout_period_end}</p>}
                        <p className="text-gray-400">{fmtN(p.order_count)} orders</p>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">₱{fmt(p.gross_amount)}</td>
                      <td className="px-4 py-3 text-right text-amber-600">-₱{fmt(p.commission_amount)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">₱{fmt(p.net_amount)}</td>
                      <td className="px-4 py-3">
                        {p.account_type ? (
                          <div>
                            <div className="flex items-center gap-1">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[p.account_type] || TYPE_COLORS.others}`}>
                                {p.account_type.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-gray-800">{p.account_holder}</p>
                            <p className="text-xs font-mono text-primary-800">{p.account_number}</p>
                            {p.reference_number && <p className="text-[10px] text-gray-400">Ref: {p.reference_number}</p>}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">{p.payment_method || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setDetailPayout(p); setShowDetail(true); }}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-500" title="View">
                            <Eye size={14} />
                          </button>
                          {(p.status === 'pending' || p.status === 'processing') && (
                            <button onClick={() => openRelease(p)}
                              className="p-1.5 hover:bg-green-50 rounded text-green-600" title="Release">
                              <CheckCircle size={14} />
                            </button>
                          )}
                          {p.status === 'pending' && (
                            <button onClick={() => changeStatus(p, 'processing')}
                              className="p-1.5 hover:bg-blue-50 rounded text-blue-500" title="Mark processing">
                              <Clock size={14} />
                            </button>
                          )}
                          {(p.status === 'pending' || p.status === 'processing') && (
                            <button onClick={() => changeStatus(p, 'cancel')}
                              className="p-1.5 hover:bg-red-50 rounded text-red-400" title="Cancel">
                              <XCircle size={14} />
                            </button>
                          )}
                          {p.receipt_image && (
                            <a href={`${IMAGE_BASE}${p.receipt_image}`} target="_blank" rel="noopener noreferrer">
                              <img src={`${IMAGE_BASE}${p.receipt_image}`}
                                className="w-8 h-8 object-cover rounded border hover:opacity-80" alt="receipt" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {history?.total_pages > 1 && (
            <div className="flex items-center justify-between p-4 border-t text-sm">
              <span className="text-gray-500">Page {histPage} of {history.total_pages}</span>
              <div className="flex gap-2">
                <button disabled={histPage <= 1} onClick={() => setHistPage(p => p - 1)}
                  className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Prev</button>
                <button disabled={histPage >= history.total_pages} onClick={() => setHistPage(p => p + 1)}
                  className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — Create Payout
          Amounts are READ-ONLY — computed from actual order_items on the server.
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)}
        title={`Distribute Payout — ${formSeller?.store_name || formSeller?.seller_name || ''}`}
        size="md">
        {formSeller && (
          <div className="space-y-4">

            {/* Amounts summary — read-only */}
            <div className="bg-gray-50 rounded-xl border p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Payout Amounts (auto-calculated from orders)
              </p>
              <AmountRow label="Gross Revenue" value={`₱${fmt(formSeller.gross_amount)}`} />
              <AmountRow label="Platform Commission (2%)" value={`-₱${fmt(formSeller.commission_amount)}`} cls="text-amber-600" />
              <AmountRow label="Net Payout to Seller" value={`₱${fmt(formSeller.net_amount)}`} cls="text-green-700 text-base" border />
              <p className="text-[10px] text-gray-400 pt-1 flex items-center gap-1">
                <Info size={10} /> Based on {fmtN(formSeller.order_count)} delivered, unpaid orders.
                Amounts are locked — computed server-side.
              </p>
            </div>

            {/* Remittance account */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Send To (Seller Account)</label>
              {accountsLoading ? (
                <p className="text-xs text-gray-400 py-2 animate-pulse">Loading accounts…</p>
              ) : sellerAccounts.length === 0 ? (
                <div className="flex items-center gap-2 text-orange-500 text-xs py-2 bg-orange-50 rounded-lg px-3">
                  <AlertCircle size={13} />
                  <span>No remittance account configured. Payout will still be created.</span>
                </div>
              ) : (
                <select value={form.remittance_account_id}
                  onChange={e => handleFormChange('remittance_account_id', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800">
                  <option value="">— Select account —</option>
                  {sellerAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      [{a.type?.toUpperCase()}] {a.label} — {a.account_name} ({a.account_number})
                      {a.is_primary ? ' ★' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Payment method + reference */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                <input type="text" placeholder="GCash, Maya, BDO…" value={form.payment_method}
                  onChange={e => handleFormChange('payment_method', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reference Number</label>
                <input type="text" placeholder="Transaction ref…" value={form.reference_number}
                  onChange={e => handleFormChange('reference_number', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
              </div>
            </div>

            {/* Initial status */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Initial Status</label>
              <select value={form.status} onChange={e => handleFormChange('status', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800">
                <option value="pending">Pending — will send later</option>
                <option value="processing">Processing — payment in progress</option>
                <option value="released">Released — already sent</option>
              </select>
            </div>

            {/* Proof of payment */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Proof of Payment (optional)</label>
              <input type="file" accept="image/*" ref={receiptRef} className="hidden"
                onChange={e => { if (e.target.files[0]) readImage(e.target.files[0], img => handleFormChange('receipt_image', img)); }} />
              {form.receipt_image ? (
                <div className="flex items-center gap-3">
                  <img src={form.receipt_image} alt="receipt" className="w-16 h-16 object-cover rounded-xl border" />
                  <button onClick={() => receiptRef.current.click()}
                    className="text-xs text-gray-500 border rounded-lg px-3 py-1.5 hover:bg-gray-50 flex items-center gap-1">
                    <Upload size={12} /> Change
                  </button>
                  <button onClick={() => handleFormChange('receipt_image', null)}
                    className="p-1.5 text-red-400 hover:bg-red-50 rounded"><X size={13} /></button>
                </div>
              ) : (
                <button onClick={() => receiptRef.current.click()}
                  className="w-full py-6 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center gap-2 text-gray-400 hover:border-primary-300 hover:text-primary-800 transition">
                  <Receipt size={20} />
                  <span className="text-xs">Upload proof of payment</span>
                </button>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
              <textarea value={form.notes} onChange={e => handleFormChange('notes', e.target.value)}
                rows={2} placeholder="Internal notes…"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800 resize-none" />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={savePayout} disabled={formSaving}
                className="flex-1 py-2.5 bg-primary-800 text-white rounded-xl text-sm font-semibold hover:bg-primary-900 disabled:opacity-60 flex items-center justify-center gap-2">
                {formSaving ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                {formSaving ? 'Processing…' : `Send ₱${fmt(formSeller.net_amount)}`}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — Release Payout
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={showRelease} onClose={() => setShowRelease(false)} title="Release Payout" size="sm">
        {selectedPayout && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1">
              <p className="text-xs text-green-600 font-medium">Releasing payout to</p>
              <p className="font-bold text-green-900">{selectedPayout.store_name || selectedPayout.seller_name}</p>
              <div className="flex gap-4 text-xs text-green-700 pt-1">
                <span>Gross ₱{fmt(selectedPayout.gross_amount)}</span>
                <span>Commission -₱{fmt(selectedPayout.commission_amount)}</span>
                <span className="font-black text-base text-green-800">Net ₱{fmt(selectedPayout.net_amount)}</span>
              </div>
            </div>

            {sellerAccounts.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Send To</label>
                <select value={releaseForm.remittance_account_id}
                  onChange={e => {
                    const acct = sellerAccounts.find(a => String(a.id) === e.target.value);
                    setReleaseForm(f => ({
                      ...f, remittance_account_id: e.target.value,
                      payment_method: acct ? acct.label : f.payment_method,
                    }));
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800">
                  <option value="">— Select account —</option>
                  {sellerAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      [{a.type?.toUpperCase()}] {a.account_name} — {a.account_number}{a.is_primary ? ' ★' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
              <input type="text" value={releaseForm.payment_method}
                onChange={e => setReleaseForm(f => ({ ...f, payment_method: e.target.value }))}
                placeholder="GCash, Maya, BDO…"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reference / Transaction Number</label>
              <input type="text" value={releaseForm.reference_number}
                onChange={e => setReleaseForm(f => ({ ...f, reference_number: e.target.value }))}
                placeholder="e.g. 9XA1234567890"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Proof of Payment</label>
              <input type="file" accept="image/*" ref={releaseReceiptRef} className="hidden"
                onChange={e => { if (e.target.files[0]) readImage(e.target.files[0], img => setReleaseForm(f => ({ ...f, receipt_image: img }))); }} />
              {releaseForm.receipt_image ? (
                <div className="flex items-center gap-3">
                  <img src={releaseForm.receipt_image} alt="receipt" className="w-14 h-14 object-cover rounded-lg border" />
                  <button onClick={() => releaseReceiptRef.current.click()}
                    className="text-xs text-gray-500 border rounded-lg px-3 py-1.5 hover:bg-gray-50">Change</button>
                </div>
              ) : (
                <button onClick={() => releaseReceiptRef.current.click()}
                  className="w-full py-5 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center gap-2 text-gray-400 hover:border-green-300 hover:text-green-700 transition">
                  <Upload size={18} />
                  <span className="text-xs">Upload payment screenshot</span>
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowRelease(false)}
                className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={doRelease} disabled={releaseSaving}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {releaseSaving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                {releaseSaving ? 'Releasing…' : 'Confirm Release'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — Payout Detail
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title="Payout Details" size="sm">
        {detailPayout && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Seller</span><span className="font-semibold">{detailPayout.store_name || detailPayout.seller_name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Status</span><StatusBadge status={detailPayout.status} /></div>
            <div className="flex justify-between"><span className="text-gray-500">Period</span><span className="font-medium">{detailPayout.payout_period_start} → {detailPayout.payout_period_end}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Orders</span><span>{fmtN(detailPayout.order_count)}</span></div>
            <div className="border-t pt-3 space-y-2">
              <AmountRow label="Gross Revenue"      value={`₱${fmt(detailPayout.gross_amount)}`} />
              <AmountRow label="Commission (2%)"    value={`-₱${fmt(detailPayout.commission_amount)}`} cls="text-amber-600" />
              <AmountRow label="Net Payout"         value={`₱${fmt(detailPayout.net_amount)}`}  cls="text-green-700 font-bold text-base" border />
            </div>
            {detailPayout.account_type && (
              <div className="border-t pt-3 space-y-1.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sent To</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[detailPayout.account_type] || TYPE_COLORS.others}`}>
                  {detailPayout.account_type.toUpperCase()}
                </span>
                <p className="font-semibold text-gray-800">{detailPayout.account_holder}</p>
                <p className="font-mono text-primary-800">{detailPayout.account_number}</p>
                {detailPayout.bank_name && <p className="text-xs text-gray-400">{detailPayout.bank_name}</p>}
              </div>
            )}
            {detailPayout.reference_number && (
              <div className="flex justify-between border-t pt-3">
                <span className="text-gray-500">Reference</span>
                <span className="font-mono font-semibold">{detailPayout.reference_number}</span>
              </div>
            )}
            {detailPayout.notes && (
              <div className="border-t pt-3"><p className="text-xs text-gray-400 mb-1">Notes</p><p>{detailPayout.notes}</p></div>
            )}
            {detailPayout.receipt_image && (
              <div className="border-t pt-3">
                <p className="text-xs text-gray-400 mb-2">Proof of Payment</p>
                <a href={`${IMAGE_BASE}${detailPayout.receipt_image}`} target="_blank" rel="noopener noreferrer">
                  <img src={`${IMAGE_BASE}${detailPayout.receipt_image}`}
                    className="w-full rounded-xl border object-cover max-h-48 hover:opacity-90 transition" alt="receipt" />
                </a>
              </div>
            )}
            {detailPayout.released_by_name && (
              <p className="text-xs text-gray-400 border-t pt-3">
                Released by {detailPayout.released_by_name} on{' '}
                {detailPayout.released_at ? new Date(detailPayout.released_at).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' }) : '—'}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
