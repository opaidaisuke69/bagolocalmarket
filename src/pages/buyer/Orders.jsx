import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, Clock, ChevronRight } from 'lucide-react';
import { ordersAPI } from '../../api/services';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import { SkeletonTable } from '../../components/common/Skeleton';
import { ORDER_STATUSES } from '../../constants';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

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

  useEffect(() => {
    setLoading(true);
    fetchOrders();
  }, [activeTab, page]);

  // Real-time polling
  useEffect(() => {
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, [activeTab, page]);

  const tabs = [
    { value: '', label: 'All' },
    { value: 'to_pay', label: 'To Pay' },
    { value: 'to_ship', label: 'To Ship' },
    { value: 'to_receive', label: 'To Receive' },
    { value: 'delivered', label: 'To Rate' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="pb-20 md:pb-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Orders</h1>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto mb-6 bg-gray-100 p-1 rounded-lg">
        {tabs.map(tab => (
          <button key={tab.value} onClick={() => { setActiveTab(tab.value); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-all ${activeTab === tab.value ? 'bg-white shadow text-primary-800' : 'text-gray-600 hover:text-gray-900'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? <SkeletonTable rows={3} cols={4} /> : orders.length === 0 ? (
        <EmptyState icon={Package} title="No orders found" description="You haven't placed any orders yet." action={
          <Link to="/marketplace" className="px-4 py-2 bg-primary-800 text-white rounded-lg text-sm font-medium hover:bg-primary-900">Browse Products</Link>
        } />
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <Link key={order.id} to={`/orders/${order.id}`} className="block bg-white rounded-xl border hover:border-primary-200 hover:shadow-sm transition-all">
              <div className="p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">{order.order_number}</span>
                    <StatusBadge status={order.status} type="order" />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock size={12} />
                    {new Date(order.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>

                {/* Items preview */}
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {order.items?.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="w-10 h-10 bg-gray-100 rounded-lg border-2 border-white overflow-hidden">
                        {item.product_image && <img src={item.product_image} alt="" className="w-full h-full object-cover" />}
                      </div>
                    ))}
                    {order.items?.length > 3 && (
                      <div className="w-10 h-10 bg-gray-200 rounded-lg border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600">
                        +{order.items.length - 3}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-600 truncate">
                      {order.items?.map(i => i.product_name).join(', ')}
                    </p>
                    <p className="text-xs text-gray-400">{order.items?.length} item(s)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary-800">₱{Number(order.total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                    <p className="text-[10px] text-gray-400">COD</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </div>
            </Link>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${p === page ? 'bg-primary-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
