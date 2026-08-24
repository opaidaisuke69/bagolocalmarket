import { useState, useEffect } from 'react';
import { ordersAPI } from '../../api/services';
import StatusBadge from '../../components/common/StatusBadge';
import { useToast } from '../../context/ToastContext';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { SkeletonTable } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import { ShoppingBag } from 'lucide-react';

export default function SellerOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionOrder, setActionOrder] = useState(null);
  const [actionType, setActionType] = useState('');
  const { showToast } = useToast();

  const fetchOrders = async () => {
    try {
      const res = await ordersAPI.list({ status: activeTab, page, limit: 10 });
      setOrders(res.data.orders);
      setTotalPages(res.data.total_pages);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setLoading(true); fetchOrders(); }, [activeTab, page]);

  // Real-time polling
  useEffect(() => {
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, [activeTab, page]);

  const handleStatusUpdate = async () => {
    if (!actionOrder || !actionType) return;
    try {
      await ordersAPI.updateStatus({ order_id: actionOrder, status: actionType });
      showToast('Order status updated.', 'success');
      fetchOrders();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update.', 'error');
    }
    setActionOrder(null);
    setActionType('');
  };

  const getNextAction = (status) => {
    const map = {
      pending: { label: 'Confirm Order', next: 'confirmed' },
      confirmed: { label: 'Prepare', next: 'preparing' },
      preparing: { label: 'Ready to Ship', next: 'ready_to_ship' },
      // Seller stops here — rider picks up from ready_to_ship
      // ready_to_ship: rider handles pickup → shipped
      // shipped: rider handles → out_for_delivery
      // out_for_delivery: rider handles → delivered
    };
    return map[status];
  };

  const tabs = [
    { value: '', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'preparing', label: 'Preparing' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto mb-6 bg-gray-100 p-1 rounded-lg">
        {tabs.map(tab => (
          <button key={tab.value} onClick={() => { setActiveTab(tab.value); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-all ${activeTab === tab.value ? 'bg-white shadow text-primary-800' : 'text-gray-600'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? <SkeletonTable rows={5} cols={6} /> : orders.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No orders found" description="Orders from buyers will appear here." />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Order</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Buyer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Products</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map(order => {
                  const nextAction = getNextAction(order.status);
                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 text-xs">{order.order_number}</td>
                      <td className="px-4 py-3 text-gray-600">{order.buyer_name}</td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-600 max-w-32 truncate">
                          {order.items?.map(i => i.product_name).join(', ')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">₱{Number(order.total_amount).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={order.status} type="order" /></td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString('en-PH')}</td>
                      <td className="px-4 py-3 text-center">
                        {nextAction && (
                          <button
                            onClick={() => { setActionOrder(order.id); setActionType(nextAction.next); }}
                            className="px-3 py-1.5 bg-primary-800 text-white text-xs rounded-lg font-medium hover:bg-primary-900">
                            {nextAction.label}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={!!actionOrder} onClose={() => setActionOrder(null)} onConfirm={handleStatusUpdate}
        title="Update Order Status" message={`Are you sure you want to update this order status to "${actionType?.replace(/_/g, ' ')}"?`} confirmText="Update" variant="primary" />
    </div>
  );
}
