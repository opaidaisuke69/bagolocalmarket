import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, XCircle, ChevronRight, ShoppingBag,
  RefreshCw, AlertCircle, Clock,
} from 'lucide-react';
import { ordersAPI } from '../../api/services';
import StatusBadge from '../../components/common/StatusBadge';
import { useToast } from '../../context/ToastContext';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { SkeletonTable } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';

/* ── status flow for the "next action" button ─────────────────────────────── */
const NEXT_ACTION = {
  confirmed:  { label: 'Start Preparing', next: 'preparing'       },
  preparing:  { label: 'Ready to Ship',   next: 'ready_to_ship'   },
  // ready_to_ship onward is handled by the rider
};

export default function SellerOrders() {
  const { showToast } = useToast();

  const [orders,     setOrders]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState('pending');
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pendingCount, setPendingCount] = useState(0);

  /* ── confirm / next-status dialog ──────────────────────────────────────── */
  const [actionOrder, setActionOrder] = useState(null);
  const [actionType,  setActionType]  = useState('');

  /* ── reject modal ───────────────────────────────────────────────────────── */
  const [showRejectModal,  setShowRejectModal]  = useState(false);
  const [rejectOrderId,    setRejectOrderId]    = useState(null);
  const [rejectOrderNum,   setRejectOrderNum]   = useState('');
  const [rejectReason,     setRejectReason]     = useState('');
  const [rejectSaving,     setRejectSaving]     = useState(false);

  /* ── fetch ──────────────────────────────────────────────────────────────── */
  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await ordersAPI.list({ status: activeTab, page, limit: 15 });
      setOrders(res.data.orders || []);
      setTotalPages(res.data.total_pages || 1);
    } catch { /* silent */ }
    finally { if (!silent) setLoading(false); }
  }, [activeTab, page]);

  /* Fetch pending count separately so badge always reflects reality */
  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await ordersAPI.list({ status: 'pending', page: 1, limit: 1 });
      setPendingCount(res.data.total || 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { fetchPendingCount(); }, [fetchPendingCount]);

  /* Real-time polling */
  useEffect(() => {
    const id = setInterval(() => {
      fetchOrders(true);
      fetchPendingCount();
    }, 5000);
    return () => clearInterval(id);
  }, [fetchOrders, fetchPendingCount]);

  /* ── confirm / next-action ──────────────────────────────────────────────── */
  const handleStatusUpdate = async () => {
    if (!actionOrder || !actionType) return;
    try {
      await ordersAPI.updateStatus({ order_id: actionOrder, status: actionType });
      showToast('Order status updated.', 'success');
      fetchOrders(true);
      fetchPendingCount();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update.', 'error');
    }
    setActionOrder(null);
    setActionType('');
  };

  /* ── confirm order (pending → confirmed) ────────────────────────────────── */
  const confirmOrder = (order) => {
    setActionOrder(order.id);
    setActionType('confirmed');
  };

  /* ── reject (cancel) order ──────────────────────────────────────────────── */
  const openReject = (order) => {
    setRejectOrderId(order.id);
    setRejectOrderNum(order.order_number);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const submitReject = async () => {
    if (!rejectReason.trim()) {
      showToast('Please enter a rejection reason.', 'warning');
      return;
    }
    setRejectSaving(true);
    try {
      await ordersAPI.updateStatus({
        order_id: rejectOrderId,
        status:   'cancelled',
        notes:    `Cancelled by seller: ${rejectReason.trim()}`,
      });
      showToast('Order rejected and cancelled.', 'success');
      setShowRejectModal(false);
      fetchOrders(true);
      fetchPendingCount();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to reject order.', 'error');
    } finally {
      setRejectSaving(false);
    }
  };

  /* ── tabs ────────────────────────────────────────────────────────────────── */
  const tabs = [
    { value: 'pending',       label: 'Pending'       },
    { value: 'confirmed',     label: 'Confirmed'     },
    { value: 'preparing',     label: 'Preparing'     },
    { value: 'ready_to_ship', label: 'Ready to Ship' },
    { value: 'shipped',       label: 'Shipped'       },
    { value: 'delivered',     label: 'Delivered'     },
    { value: 'cancelled',     label: 'Cancelled'     },
    { value: '',              label: 'All'           },
  ];

  const PRESET_REASONS = [
    'Item is out of stock',
    'Unable to fulfil order at this time',
    'Buyer requested cancellation',
    'Incorrect order details',
    'Fraudulent / suspicious order',
  ];

  /* ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5">

      {/* ── Pending alert banner ────────────────────────────────────────── */}
      {pendingCount > 0 && activeTab !== 'pending' && (
        <button
          onClick={() => { setActiveTab('pending'); setPage(1); }}
          className="w-full flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 hover:bg-amber-100 transition text-left"
        >
          <div className="w-8 h-8 bg-amber-400 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">
              {pendingCount} order{pendingCount !== 1 ? 's' : ''} waiting for your action
            </p>
            <p className="text-xs text-amber-600">Click to review pending orders</p>
          </div>
          <ChevronRight size={16} className="text-amber-500" />
        </button>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto bg-gray-100 p-1 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => { setActiveTab(tab.value); setPage(1); }}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
              activeTab === tab.value
                ? 'bg-white shadow text-primary-800'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
            {/* Pending badge */}
            {tab.value === 'pending' && pendingCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <SkeletonTable rows={6} cols={7} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No orders found"
          description="Orders will appear here once buyers place them."
        />
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Order</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Buyer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Products</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Total</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map(order => {
                  const isPending = order.status === 'pending';
                  const nextAct   = NEXT_ACTION[order.status];
                  return (
                    <tr key={order.id} className={`hover:bg-gray-50 transition ${isPending ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-primary-800 font-mono text-xs">{order.order_number}</p>
                        {isPending && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium mt-0.5">
                            <Clock size={9} /> Awaiting action
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{order.buyer_name}</td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-600 max-w-[160px] space-y-0.5">
                          {order.items?.map((item, idx) => (
                            <div key={idx} className="truncate">
                              {item.product_name}
                              {item.variation_label && (
                                <span className="text-primary-700 font-medium"> ({item.variation_label})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        ₱{Number(order.total_amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={order.status} type="order" />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(order.created_at).toLocaleDateString('en-PH', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">

                          {/* ── Pending: Confirm + Reject ── */}
                          {isPending && (
                            <>
                              <button
                                onClick={() => confirmOrder(order)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition"
                                title="Confirm order"
                              >
                                <CheckCircle size={12} /> Confirm
                              </button>
                              <button
                                onClick={() => openReject(order)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 transition"
                                title="Reject order"
                              >
                                <XCircle size={12} /> Reject
                              </button>
                            </>
                          )}

                          {/* ── Confirmed / Preparing: next step button ── */}
                          {!isPending && nextAct && (
                            <button
                              onClick={() => { setActionOrder(order.id); setActionType(nextAct.next); }}
                              className="px-3 py-1.5 bg-primary-800 text-white text-xs font-semibold rounded-lg hover:bg-primary-900 transition"
                            >
                              {nextAct.label}
                            </button>
                          )}

                          {/* ── No action available ── */}
                          {!isPending && !nextAct && (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t text-sm">
              <span className="text-gray-500">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >Prev</button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — Reject Order
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => !rejectSaving && setShowRejectModal(false)}
        title="Reject Order"
        size="sm"
      >
        <div className="space-y-4">
          {/* Warning strip */}
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
            <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">
                Reject order {rejectOrderNum}?
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                This will cancel the order and notify the buyer. This action cannot be undone.
              </p>
            </div>
          </div>

          {/* Preset reasons */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Quick reasons</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_REASONS.map(r => (
                <button
                  key={r}
                  onClick={() => setRejectReason(r)}
                  className={`text-xs px-3 py-1.5 rounded-xl border transition ${
                    rejectReason === r
                      ? 'bg-red-600 text-white border-red-600'
                      : 'text-gray-600 border-gray-200 hover:border-red-300 hover:text-red-600'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Custom reason textarea */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Enter reason for rejecting this order…"
              className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setShowRejectModal(false)}
              disabled={rejectSaving}
              className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={submitReject}
              disabled={rejectSaving || !rejectReason.trim()}
              className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {rejectSaving
                ? <><RefreshCw size={13} className="animate-spin" /> Rejecting…</>
                : <><XCircle size={13} /> Reject Order</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Confirm next-step dialog ─────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!actionOrder}
        onClose={() => setActionOrder(null)}
        onConfirm={handleStatusUpdate}
        title="Update Order Status"
        message={`Move order to "${actionType?.replace(/_/g, ' ')}"?`}
        confirmText="Update"
        variant="primary"
      />
    </div>
  );
}
