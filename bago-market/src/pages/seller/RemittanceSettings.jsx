import { useState, useEffect, useRef } from 'react';
import {
  Wallet, Plus, Trash2, Edit2, Star, Upload, QrCode, CheckCircle,
  Clock, XCircle, RefreshCw, AlertCircle, ChevronDown, ChevronUp,
  Banknote, CreditCard, Smartphone, MoreHorizontal, Eye, X,
} from 'lucide-react';
import { sellerAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/common/Modal';

const IMAGE_BASE = import.meta.env.PROD ? '/server' : '';
const fmt  = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const fmtN = (n) => Number(n || 0).toLocaleString('en-PH');

const PAYOUT_STATUS = {
  pending:    { label: 'Pending',    bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock       },
  processing: { label: 'Processing', bg: 'bg-blue-100',   text: 'text-blue-700',   icon: RefreshCw   },
  released:   { label: 'Released',   bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle },
  cancelled:  { label: 'Cancelled',  bg: 'bg-gray-100',   text: 'text-gray-500',   icon: XCircle     },
};

const ACCOUNT_TYPES = [
  { value: 'gcash', label: 'GCash',       icon: Smartphone, color: 'bg-blue-50 text-blue-700 border-blue-200'   },
  { value: 'maya',  label: 'Maya',        icon: Smartphone, color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'bank',  label: 'Bank',        icon: Banknote,   color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'others',label: 'Others',      icon: CreditCard, color: 'bg-purple-50 text-purple-700 border-purple-200' },
];

function TypeTag({ type }) {
  const t = ACCOUNT_TYPES.find(a => a.value === type) || ACCOUNT_TYPES[3];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${t.color}`}>
      <t.icon size={9} />
      {t.label.toUpperCase()}
    </span>
  );
}

function StatusBadge({ status }) {
  const m = PAYOUT_STATUS[status] || PAYOUT_STATUS.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${m.bg} ${m.text}`}>
      <m.icon size={10} />
      {m.label}
    </span>
  );
}

const EMPTY_FORM = {
  type: 'gcash',
  label: '',
  account_name: '',
  account_number: '',
  bank_name: '',
  qr_code_image: null,
  is_primary: false,
};

export default function RemittanceSettings() {
  const { showToast } = useToast();

  /* ── data ─────────────────────────────────────────────────────────────────── */
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  /* ── tabs ─────────────────────────────────────────────────────────────────── */
  const [tab, setTab] = useState('accounts'); // accounts | payouts

  /* ── account form modal ───────────────────────────────────────────────────── */
  const [showForm, setShowForm]     = useState(false);
  const [editAccount, setEditAccount] = useState(null); // null = add, object = edit
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const qrRef = useRef();

  /* ── payout detail modal ──────────────────────────────────────────────────── */
  const [showPayoutDetail, setShowPayoutDetail] = useState(false);
  const [detailPayout, setDetailPayout]         = useState(null);

  /* ── payout history expanded ──────────────────────────────────────────────── */
  const [payoutFilter, setPayoutFilter] = useState('');

  /* ── fetch ────────────────────────────────────────────────────────────────── */
  const fetchData = async () => {
    try {
      const res = await sellerAPI.remittance();
      setData(res.data);
    } catch { showToast('Failed to load remittance data.', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  /* ── open add/edit form ───────────────────────────────────────────────────── */
  const openAdd = () => {
    setEditAccount(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const openEdit = (acct) => {
    setEditAccount(acct);
    setForm({
      type:           acct.type,
      label:          acct.label,
      account_name:   acct.account_name,
      account_number: acct.account_number,
      bank_name:      acct.bank_name || '',
      qr_code_image:  acct.qr_code_image || null,
      is_primary:     !!acct.is_primary,
    });
    setShowForm(true);
  };

  /* ── QR image ─────────────────────────────────────────────────────────────── */
  const handleQrFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, qr_code_image: reader.result }));
    reader.readAsDataURL(file);
  };

  /* ── save account ─────────────────────────────────────────────────────────── */
  const saveAccount = async () => {
    if (!form.label.trim() || !form.account_name.trim() || !form.account_number.trim()) {
      showToast('Label, account name, and number are required.', 'warning'); return;
    }
    if (form.type === 'bank' && !form.bank_name.trim()) {
      showToast('Bank name is required for bank accounts.', 'warning'); return;
    }
    setSaving(true);
    try {
      const payload = {
        type:           form.type,
        label:          form.label.trim(),
        account_name:   form.account_name.trim(),
        account_number: form.account_number.trim(),
        bank_name:      form.bank_name.trim(),
        is_primary:     form.is_primary,
        qr_code_image:  form.qr_code_image?.startsWith('data:') ? form.qr_code_image : null,
      };

      if (editAccount) {
        await sellerAPI.updateRemittanceAccount({ ...payload, account_id: editAccount.id, action: 'update' });
        showToast('Account updated.', 'success');
      } else {
        await sellerAPI.addRemittanceAccount(payload);
        showToast('Account added.', 'success');
      }
      setShowForm(false);
      fetchData();
    } catch (e) {
      showToast(e.response?.data?.message || 'Save failed.', 'error');
    } finally { setSaving(false); }
  };

  /* ── set primary ──────────────────────────────────────────────────────────── */
  const setPrimary = async (acct) => {
    if (acct.is_primary) return;
    try {
      await sellerAPI.updateRemittanceAccount({ account_id: acct.id, action: 'set_primary' });
      showToast('Primary account updated.', 'success');
      fetchData();
    } catch { showToast('Failed to update.', 'error'); }
  };

  /* ── remove account ───────────────────────────────────────────────────────── */
  const removeAccount = async (acct) => {
    if (!confirm(`Remove "${acct.label}" account?`)) return;
    try {
      await sellerAPI.deleteRemittanceAccount(acct.id);
      showToast('Account removed.', 'success');
      fetchData();
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to remove.', 'error');
    }
  };

  /* ── filtered payouts ─────────────────────────────────────────────────────── */
  const filteredPayouts = (data?.payouts || []).filter(p =>
    !payoutFilter || p.status === payoutFilter
  );

  /* ══════════════════════════════════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const accounts = data?.accounts || [];
  const summary  = data?.summary  || {};
  const unpaid   = data?.unpaid   || {};

  return (
    <div className="space-y-6">

      {/* ── Earnings summary strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Received',  value: `₱${fmt(summary.total_received)}`,   sub: `${fmtN(summary.released_count)} payouts`,   bg: 'bg-green-50 border-green-200',  text: 'text-green-700'  },
          { label: 'Processing',      value: `₱${fmt(summary.total_processing)}`, sub: `${fmtN(summary.processing_count)} payouts`,  bg: 'bg-blue-50 border-blue-200',    text: 'text-blue-700'   },
          { label: 'Pending',         value: `₱${fmt(summary.total_pending)}`,    sub: `${fmtN(summary.pending_count)} payouts`,     bg: 'bg-yellow-50 border-yellow-200',text: 'text-yellow-700' },
          { label: 'Awaiting Payout', value: `₱${fmt(unpaid.unpaid_net)}`,        sub: `${fmtN(unpaid.unpaid_order_count)} orders`,  bg: 'bg-orange-50 border-orange-200',text: 'text-orange-700' },
        ].map((c, i) => (
          <div key={i} className={`${c.bg} border rounded-xl p-4`}>
            <p className={`text-xs font-semibold ${c.text} opacity-75 uppercase tracking-wide`}>{c.label}</p>
            <p className={`text-2xl font-bold ${c.text} mt-1`}>{c.value}</p>
            <p className={`text-xs ${c.text} opacity-60 mt-1`}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Unpaid earnings callout ────────────────────────────────────────── */}
      {Number(unpaid.unpaid_net) > 0 && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <AlertCircle size={18} className="text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-orange-800">
              ₱{fmt(unpaid.unpaid_net)} in delivered orders awaiting payout
            </p>
            <p className="text-xs text-orange-600 mt-0.5">
              {fmtN(unpaid.unpaid_order_count)} orders • Gross ₱{fmt(unpaid.unpaid_gross)} — Commission -₱{fmt(unpaid.unpaid_commission)}. The admin will distribute this to your primary account.
            </p>
          </div>
        </div>
      )}

      {/* ── No accounts callout ───────────────────────────────────────────── */}
      {accounts.length === 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">No payout account set up yet</p>
            <p className="text-xs text-red-600 mt-0.5">
              Add at least one remittance account so the admin knows where to send your payouts.
            </p>
          </div>
        </div>
      )}

      {/* ── Tab switcher ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { value: 'accounts', label: 'Payout Accounts' },
          { value: 'payouts',  label: `Payout History (${(data?.payouts || []).length})` },
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
          TAB 1 — Payout Accounts
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'accounts' && (
        <div className="space-y-3">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Remittance Accounts</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Add up to 5 accounts. Mark one as primary — that's where the admin will send your payouts.
              </p>
            </div>
            {accounts.length < 5 && (
              <button onClick={openAdd}
                className="flex items-center gap-1.5 bg-primary-800 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary-900 transition">
                <Plus size={15} /> Add Account
              </button>
            )}
          </div>

          {/* Account cards */}
          {accounts.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center py-16 gap-3">
              <Wallet size={44} className="text-gray-300" />
              <p className="text-sm text-gray-400 font-medium">No payout accounts yet</p>
              <button onClick={openAdd}
                className="flex items-center gap-1.5 text-sm text-primary-800 font-semibold border border-primary-200 rounded-xl px-4 py-2 hover:bg-primary-50 transition">
                <Plus size={14} /> Add your first account
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {accounts.map(acct => (
                <div key={acct.id}
                  className={`bg-white rounded-2xl border-2 p-5 transition ${
                    acct.is_primary ? 'border-primary-300 shadow-md shadow-primary-100' : 'border-gray-100 hover:border-gray-200'
                  }`}>
                  <div className="flex items-start gap-4">
                    {/* QR or type icon — larger */}
                    <div className="shrink-0">
                      {acct.qr_code_image ? (
                        <a href={`${IMAGE_BASE}${acct.qr_code_image}`} target="_blank" rel="noopener noreferrer">
                          <img src={`${IMAGE_BASE}${acct.qr_code_image}`}
                            className="w-20 h-20 object-cover rounded-xl border hover:opacity-80 transition" alt="QR" />
                        </a>
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center">
                          {acct.type === 'gcash' || acct.type === 'maya'
                            ? <Smartphone size={30} className="text-gray-400" />
                            : <Banknote size={30} className="text-gray-400" />}
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <TypeTag type={acct.type} />
                        {acct.is_primary && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-50 text-primary-800 border border-primary-200">
                            <Star size={9} fill="currentColor" /> PRIMARY
                          </span>
                        )}
                      </div>
                      <p className="text-base font-bold text-gray-900">{acct.label}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{acct.account_name}</p>
                      <p className="text-lg font-mono font-bold text-primary-800 mt-1">{acct.account_number}</p>
                      {acct.bank_name && (
                        <p className="text-xs text-gray-400 mt-0.5">{acct.bank_name}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions row at bottom */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                    {!acct.is_primary && (
                      <button onClick={() => setPrimary(acct)}
                        className="flex items-center gap-1.5 text-xs text-gray-600 border rounded-lg px-3 py-2 hover:bg-gray-50 hover:border-primary-300 hover:text-primary-800 transition flex-1 justify-center">
                        <Star size={12} /> Set as Primary
                      </button>
                    )}
                    {acct.is_primary && (
                      <div className="flex items-center gap-1.5 text-xs text-primary-700 flex-1">
                        <CheckCircle size={13} />
                        Admin sends payouts here by default
                      </div>
                    )}
                    <button onClick={() => openEdit(acct)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 border rounded-lg px-3 py-2 hover:bg-gray-50 transition">
                      <Edit2 size={13} /> Edit
                    </button>
                    <button onClick={() => removeAccount(acct)}
                      className="flex items-center gap-1.5 text-xs text-red-500 border border-red-100 rounded-lg px-3 py-2 hover:bg-red-50 transition">
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>
              ))}

              {accounts.length < 5 && (
                <button onClick={openAdd}
                  className="border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center py-12 gap-3 text-gray-400 hover:border-primary-300 hover:text-primary-800 transition min-h-[180px]">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <Plus size={22} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold">Add Account</p>
                    <p className="text-xs mt-0.5">{accounts.length}/5 used</p>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2 — Payout History
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'payouts' && (
        <div className="space-y-3">
          {/* Filter tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {[
              { value: '',           label: 'All' },
              { value: 'pending',    label: 'Pending' },
              { value: 'processing', label: 'Processing' },
              { value: 'released',   label: 'Released' },
            ].map(f => (
              <button key={f.value} onClick={() => setPayoutFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  payoutFilter === f.value ? 'bg-white shadow text-primary-800' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          {filteredPayouts.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-100 rounded-2xl flex flex-col items-center py-16 gap-2">
              <Wallet size={40} className="text-gray-200" />
              <p className="text-sm text-gray-400">No payout records yet</p>
              <p className="text-xs text-gray-300">Payouts will appear here once the admin distributes them</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredPayouts.map(p => {
                const released = p.status === 'released';
                return (
                  <div key={p.id}
                    className={`bg-white rounded-2xl border p-5 ${released ? 'border-green-200 bg-green-50/30' : 'border-gray-100'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Period + status */}
                        <div className="flex items-center gap-2 flex-wrap mb-3">
                          <StatusBadge status={p.status} />
                          <span className="text-xs text-gray-400">
                            {p.payout_period_start}
                            {p.payout_period_end !== p.payout_period_start && ` → ${p.payout_period_end}`}
                          </span>
                          <span className="text-xs text-gray-400">{fmtN(p.order_count)} orders</span>
                        </div>

                        {/* Net amount — hero */}
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Net Payout</p>
                        <p className={`text-3xl font-black mt-0.5 ${released ? 'text-green-700' : 'text-gray-900'}`}>
                          ₱{fmt(p.net_amount)}
                        </p>

                        {/* Gross / commission breakdown */}
                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                          <span>Gross <span className="font-semibold text-gray-700">₱{fmt(p.gross_amount)}</span></span>
                          <span>Commission <span className="font-semibold text-amber-600">-₱{fmt(p.commission_amount)}</span></span>
                        </div>

                        {/* Account it was sent to */}
                        {p.account_type && (
                          <div className="flex items-center gap-2 mt-3 flex-wrap">
                            <TypeTag type={p.account_type} />
                            <span className="text-xs text-gray-600 font-medium">{p.account_holder}</span>
                            <span className="text-xs font-mono text-primary-800">{p.account_number}</span>
                          </div>
                        )}
                        {p.reference_number && (
                          <p className="text-xs text-gray-400 mt-1">Ref: {p.reference_number}</p>
                        )}
                        {!p.account_type && p.payment_method && (
                          <p className="text-xs text-gray-500 mt-2">{p.payment_method}</p>
                        )}
                      </div>

                      {/* Right side: receipt + details */}
                      <div className="flex flex-col items-end gap-3 shrink-0">
                        {p.receipt_image && (
                          <a href={`${IMAGE_BASE}${p.receipt_image}`} target="_blank" rel="noopener noreferrer">
                            <img src={`${IMAGE_BASE}${p.receipt_image}`}
                              className="w-16 h-16 object-cover rounded-xl border hover:opacity-80 transition"
                              alt="Proof" title="View proof of payment" />
                          </a>
                        )}
                        <button onClick={() => { setDetailPayout(p); setShowPayoutDetail(true); }}
                          className="text-xs text-gray-400 hover:text-primary-800 flex items-center gap-1 transition border rounded-lg px-2.5 py-1.5 hover:border-primary-300">
                          <Eye size={12} /> Details
                        </button>
                      </div>
                    </div>

                    {/* Released footer */}
                    {p.released_at && (
                      <div className="mt-4 pt-3 border-t border-green-100 text-xs text-green-600 flex items-center gap-1.5">
                        <CheckCircle size={12} />
                        Released{p.released_by_name ? ` by ${p.released_by_name}` : ''} on{' '}
                        {new Date(p.released_at).toLocaleDateString('en-PH', {
                          year: 'numeric', month: 'long', day: 'numeric',
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — Add / Edit Account
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)}
        title={editAccount ? 'Edit Payout Account' : 'Add Payout Account'}
        size="sm">
        <div className="space-y-4">

          {/* Type selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Account Type *</label>
            <div className="grid grid-cols-4 gap-2">
              {ACCOUNT_TYPES.map(t => (
                <button key={t.value}
                  onClick={() => setForm(f => ({ ...f, type: t.value }))}
                  className={`py-3 flex flex-col items-center gap-1 rounded-xl border-2 text-xs font-semibold transition ${
                    form.type === t.value
                      ? 'border-primary-400 bg-primary-50 text-primary-800'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  <t.icon size={18} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Label *</label>
            <input type="text" value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder={`e.g. ${form.type === 'gcash' ? 'GCash - Personal' : form.type === 'maya' ? 'Maya Account' : form.type === 'bank' ? 'BDO Savings' : 'Palawan Express'}`}
              className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-800" />
          </div>

          {/* Bank name — only for bank type */}
          {form.type === 'bank' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bank Name *</label>
              <input type="text" value={form.bank_name}
                onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
                placeholder="e.g. BDO, BPI, UnionBank…"
                className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-800" />
            </div>
          )}

          {/* Account name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Account Name *</label>
            <input type="text" value={form.account_name}
              onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))}
              placeholder="Full name on the account"
              className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-800" />
          </div>

          {/* Account number */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {form.type === 'bank' ? 'Account Number *' : 'Mobile Number / Account Number *'}
            </label>
            <input type="text" value={form.account_number}
              onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))}
              placeholder={form.type === 'bank' ? '0000-0000-0000-0000' : '09XX-XXX-XXXX'}
              className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-800" />
          </div>

          {/* QR code image */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">QR Code (optional)</label>
            <input type="file" accept="image/*" ref={qrRef} className="hidden" onChange={handleQrFile} />
            {form.qr_code_image ? (
              <div className="flex items-center gap-3">
                <img
                  src={form.qr_code_image.startsWith('data:') ? form.qr_code_image : `${IMAGE_BASE}${form.qr_code_image}`}
                  alt="QR" className="w-16 h-16 object-cover rounded-xl border" />
                <div className="flex flex-col gap-1.5">
                  <button onClick={() => qrRef.current.click()}
                    className="text-xs text-gray-500 border rounded-lg px-3 py-1.5 hover:bg-gray-50 flex items-center gap-1">
                    <Upload size={11} /> Change
                  </button>
                  <button onClick={() => setForm(f => ({ ...f, qr_code_image: null }))}
                    className="text-xs text-red-400 border border-red-100 rounded-lg px-3 py-1.5 hover:bg-red-50 flex items-center gap-1">
                    <X size={11} /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => qrRef.current.click()}
                className="w-full py-6 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center gap-2 text-gray-400 hover:border-primary-300 hover:text-primary-800 transition">
                <QrCode size={22} />
                <span className="text-xs">Upload your QR code</span>
              </button>
            )}
          </div>

          {/* Set as primary toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setForm(f => ({ ...f, is_primary: !f.is_primary }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.is_primary ? 'bg-primary-800' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_primary ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Set as Primary</p>
              <p className="text-xs text-gray-400">Admin will send payouts here by default</p>
            </div>
          </label>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={saveAccount} disabled={saving}
              className="flex-1 py-2.5 bg-primary-800 text-white rounded-xl text-sm font-semibold hover:bg-primary-900 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {saving ? 'Saving…' : editAccount ? 'Update' : 'Add Account'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — Payout Detail
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={showPayoutDetail} onClose={() => setShowPayoutDetail(false)}
        title="Payout Details" size="sm">
        {detailPayout && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Status</span>
              <StatusBadge status={detailPayout.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Period</span>
              <span className="font-medium">
                {detailPayout.payout_period_start}
                {detailPayout.payout_period_end !== detailPayout.payout_period_start
                  ? ` → ${detailPayout.payout_period_end}` : ''}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Orders</span>
              <span>{fmtN(detailPayout.order_count)}</span>
            </div>

            <div className="border-t pt-3 space-y-2">
              {[
                { label: 'Gross Revenue', value: `₱${fmt(detailPayout.gross_amount)}`,      cls: '' },
                { label: 'Commission',    value: `-₱${fmt(detailPayout.commission_amount)}`, cls: 'text-amber-600' },
                { label: 'Net Payout',    value: `₱${fmt(detailPayout.net_amount)}`,         cls: 'text-green-700 font-bold text-base' },
              ].map((r, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-gray-500">{r.label}</span>
                  <span className={r.cls}>{r.value}</span>
                </div>
              ))}
            </div>

            {detailPayout.account_type && (
              <div className="border-t pt-3 space-y-1.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sent To</p>
                <TypeTag type={detailPayout.account_type} />
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
              <div className="border-t pt-3">
                <p className="text-xs text-gray-400 mb-1">Notes</p>
                <p className="text-gray-700">{detailPayout.notes}</p>
              </div>
            )}

            {detailPayout.receipt_image && (
              <div className="border-t pt-3">
                <p className="text-xs text-gray-400 mb-2">Proof of Payment</p>
                <a href={`${IMAGE_BASE}${detailPayout.receipt_image}`} target="_blank" rel="noopener noreferrer">
                  <img src={`${IMAGE_BASE}${detailPayout.receipt_image}`}
                    className="w-full rounded-xl border object-cover max-h-52 hover:opacity-90 transition"
                    alt="Payment proof" />
                </a>
              </div>
            )}

            {detailPayout.released_at && (
              <p className="text-xs text-gray-400 border-t pt-3">
                Released{detailPayout.released_by_name ? ` by ${detailPayout.released_by_name}` : ''} on{' '}
                {new Date(detailPayout.released_at).toLocaleDateString('en-PH', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
