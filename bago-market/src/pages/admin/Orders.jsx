import { useState, useEffect, useCallback } from 'react';
import {
  Search, Eye, X, ChevronLeft, ChevronRight,
  ShoppingBag, Package, Truck, CheckCircle,
  XCircle, Clock, AlertTriangle
} from 'lucide-react';
import { adminAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/Skeleton';

const STATUS_STYLES = {
  pending:         { cls: 'bg-yellow-100 text-yellow-700',   icon: Clock,         label: 'Pending' },
  confirmed:       { cls: 'bg-blue-100 text-blue-700',       icon: CheckCircle,   label: 'Confirmed' },
  preparing:       { cls: 'bg-indigo-100 text-indigo-700',   icon: Package,       label: 'Preparing' },
  ready_to_ship:   { cls: 'bg-purple-100 text-purple-700',   icon: Package,       label: 'Ready to Ship' },
  shipped:         { cls: 'bg-cyan-100 text-cyan-700',       icon: Truck,         label: 'Shipped' },
  out_for_delivery:{ cls: 'bg-orange-100 text-orange-700',   icon: Truck,         label: 'Out for Delivery' },
  delivered:       { cls: 'bg-green-100 text-green-700',     icon: CheckCircle,   label: 'Delivered' },
  cancelled:       { cls: 'bg-red-100 text-red-700',         icon: XCircle,       label: 'Cancelled' },
};

const STATUSES = Object.entries(STATUS_STYLES).map(([k, v]) => ({ value: k, label: v.label }));

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { cls: 'bg-gray-100 text-gray-600', label: status };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.cls}`}>
      {status}
    </span>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className={`bg-white rounded-xl border p-4 border-l-4 ${color}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

export default function AdminOrders() {
  const [orders,      setOrders]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [stats,       setStats]       = useState({});
  const [search,      setSearch]      = useState('');
  const [statusFilt,  setStatusFilt]  = useState('');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [total,       setTotal]       = useState(0);
  const [detail,      setDetail]      = useState(null);
  const [detailLoad,  setDetailLoad]  = useState(false);
  const [actionModal, setActionModal] = useState({ open: false, order: null, status: '', notes: '' });
  const { showToast } = useToast();

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await adminAPI.orders({ search, status: statusFilt, from: dateFrom, to: dateTo, page, limit: 20 });
      setOrders(res.data.orders || []);
      setTotalPages(res.data.total_pages || 1);
      setTotal(res.data.total || 0);
      setStats(res.data.stats || {});
    } catch { /* silent */ }
    finally { if (!silent) setLoading(false); }
  }, [search, statusFilt, dateFrom, dateTo, page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Silent background polling every 15s
  useEffect(() => {
    const t = setInterval(() => fetchOrders(true), 15_000);
    return () => clearInterval(t);
  }, [fetchOrders]);

  const openDetail = async (order) => {
    setDetail(order);
    setDetailLoad(true);
    try {
      const res = await adminAPI.orderDetail(order.id);
      setDetail(res.data.order || order);
    } catch { /* use summary */ }
    finally { setDetailLoad(false); }
  };

  const handleStatusChange = async () => {
    try {
      await adminAPI.updateOrderStatus({ order_id: actionModal.order.id, status: actionModal.status, notes: actionModal.notes });
      showToast('Order status updated.', 'success');
      setActionModal({ open: false, order: null, status: '', notes: '' });
      setDetail(null);
      fetchOrders();
    } catch {
      showToast('Failed to update order.', 'error');
    }
  };

  const fmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div className="space-y-5">

      /* Header — no manual Refresh button, data auto-polls every 15s */
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Orders</h2>
        <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString()} total orders in the marketplace</p>
      </div>

      {/* Stats */}
      {Object.keys(stats).length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Orders"     value={stats.total?.toLocaleString() || 0}     color="border-blue-400" />
          <StatCard label="Delivered"        value={stats.delivered?.toLocaleString() || 0}  color="border-green-400" />
          <StatCard label="In Progress"      value={stats.in_progress?.toLocaleString() || 0}color="border-yellow-400" />
          <StatCard label="Cancelled"        value={stats.cancelled?.toLocaleString() || 0}  color="border-red-400" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 bg-white rounded-xl border">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Order #, buyer name, email…"
            className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
        </div>
        <select value={statusFilt} onChange={e => { setStatusFilt(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
        {(search || statusFilt || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setStatusFilt(''); setDateFrom(''); setDateTo(''); setPage(1); }}
            className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 border border-red-200 rounded-lg flex items-center gap-1">
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? <SkeletonTable rows={10} cols={7} /> : (
        <>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Order</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Buyer</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Seller(s)</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-14">
                      <ShoppingBag size={36} className="mx-auto text-gray-200 mb-2" />
                      <p className="text-gray-400">No orders found.</p>
                    </td></tr>
                  ) : orders.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <p className="font-mono font-semibold text-xs text-gray-800">{o.order_number}</p>
                        <p className="text-[10px] text-gray-400">{o.items_count} item{o.items_count !== 1 ? 's' : ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-xs">{o.buyer_name}</p>
                        <p className="text-[10px] text-gray-400 truncate max-w-32">{o.buyer_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-600 truncate max-w-32">{o.seller_names || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(o.total_amount)}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={o.status} /></td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(o.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openDetail(o)}
                            className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="View detail">
                            <Eye size={15} />
                          </button>
                          {o.status !== 'delivered' && o.status !== 'cancelled' && (
                            <button onClick={() => setActionModal({ open: true, order: o, status: 'cancelled', notes: '' })}
                              className="p-1.5 hover:bg-red-50 rounded text-red-600" title="Cancel order">
                              <XCircle size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Page {page} of {totalPages} · {total.toLocaleString()} orders</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="flex items-center gap-1 px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">
                  <ChevronLeft size={14} /> Prev
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="flex items-center gap-1 px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Order Detail Modal */}
      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={`Order #${detail?.order_number || ''}`} size="lg">
        {detail && (
          <div className="space-y-5">
            {detailLoad && <p className="text-sm text-gray-400 text-center py-4">Loading details…</p>}

            {/* Summary row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Status</p>
                <StatusBadge status={detail.status} />
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Total</p>
                <p className="font-bold text-gray-900">{fmt(detail.total_amount)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Placed</p>
                <p className="font-medium text-gray-900">{fmtDate(detail.created_at)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Payment</p>
                <p className="font-medium text-gray-900 capitalize">{detail.payment_method || 'COD'}</p>
              </div>
            </div>

            {/* Buyer */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Buyer</p>
              <div className="text-sm space-y-0.5">
                <p className="font-medium text-gray-900">{detail.buyer_name}</p>
                <p className="text-gray-500">{detail.buyer_email}</p>
                {detail.delivery_address && <p className="text-gray-500">{detail.delivery_address}</p>}
              </div>
            </div>

            {/* Items */}
            {detail.items && detail.items.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items ({detail.items.length})</p>
                <div className="space-y-2">
                  {detail.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                      {item.image && <img src={item.image} alt="" className="w-10 h-10 object-cover rounded" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.seller_name} · Qty: {item.quantity}</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-800">{fmt(item.item_subtotal)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Override */}
            {detail.status !== 'delivered' && detail.status !== 'cancelled' && (
              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <AlertTriangle size={13} className="text-orange-500" /> Admin Override
                </p>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.filter(s => s.value !== detail.status).map(s => (
                    <button key={s.value}
                      onClick={() => setActionModal({ open: true, order: detail, status: s.value, notes: '' })}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        s.value === 'cancelled' ? 'border-red-200 text-red-600 hover:bg-red-50' :
                        'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}>
                      → {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Status Change Confirm Modal */}
      <Modal isOpen={actionModal.open}
        onClose={() => setActionModal({ open: false, order: null, status: '', notes: '' })}
        title="Change Order Status" size="sm">
        {actionModal.order && (
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
              Change order <strong>{actionModal.order.order_number}</strong> to{' '}
              <strong className="capitalize">{actionModal.status.replace(/_/g, ' ')}</strong>?
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes (optional)</label>
              <textarea
                value={actionModal.notes}
                onChange={e => setActionModal(a => ({ ...a, notes: e.target.value }))}
                rows={3} placeholder="Reason for status override…"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setActionModal({ open: false, order: null, status: '', notes: '' })}
                className="flex-1 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleStatusChange}
                className={`flex-1 py-2.5 text-white rounded-lg text-sm font-medium ${
                  actionModal.status === 'cancelled' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-800 hover:bg-primary-900'
                }`}>
                Confirm Change
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
