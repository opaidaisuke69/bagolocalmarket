import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package, Clock, Store, Star, ShoppingCart, CheckCircle, RefreshCw } from 'lucide-react';
import { ordersAPI, cartAPI } from '../../api/services';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import { SkeletonTable } from '../../components/common/Skeleton';
import RateProductsModal from '../../components/buyer/RateProductsModal';

export default function Orders() {
  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState('');
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [ratingOrder, setRatingOrder] = useState(null);
  const [buyingAgain, setBuyingAgain] = useState(null);
  // Track which order IDs are fully rated locally (updated immediately after modal closes)
  const [locallyRated, setLocallyRated] = useState({});

  const { showToast } = useToast();
  const { fetchCart } = useCart();
  const navigate = useNavigate();

  const fetchOrders = useCallback(async () => {
    try {
      const res = await ordersAPI.list({ status: activeTab, page, limit: 10 });
      setOrders(res.data.orders || []);
      setTotalPages(res.data.total_pages || 1);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }, [activeTab, page]);

  useEffect(() => {
    setLoading(true);
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const interval = setInterval(fetchOrders, 8000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleBuyAgain = async (orderId, items) => {
    setBuyingAgain(orderId);
    try {
      const uniqueItems = items.filter(
        (item, idx, arr) => arr.findIndex((i) => i.product_id === item.product_id) === idx
      );
      for (const item of uniqueItems) {
        await cartAPI.add({ product_id: item.product_id, quantity: item.quantity, variation_id: item.variation_id || null });
      }
      // Sync CartContext so Checkout sees the new items immediately
      await fetchCart();
      showToast('Items added to cart!', 'success');
      navigate('/checkout');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Some items could not be added to cart.';
      showToast(msg, 'error');
      await fetchCart();
      navigate('/checkout');
    } finally {
      setBuyingAgain(null);
    }
  };

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
      <div className="flex gap-1 overflow-x-auto mb-6 bg-gray-100 p-1 rounded-lg no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => { setActiveTab(tab.value); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-all ${
              activeTab === tab.value ? 'bg-white shadow text-primary-800' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonTable rows={3} cols={4} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders found"
          description="You haven't placed any orders yet."
          action={
            <Link to="/marketplace" className="px-4 py-2 bg-primary-800 text-white rounded-lg text-sm font-medium hover:bg-primary-900">
              Browse Products
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const storeName   = order.items?.[0]?.store_name || order.items?.[0]?.seller_name || 'Store';
            const isDelivered = order.status === 'delivered';
            const isCancelled = order.status === 'cancelled';
            const showActions = isDelivered || isCancelled;

            // Use locallyRated override first, then fall back to server data
            // Cast both to numbers to avoid string "0" vs number 0 issues
            const ratedCount  = locallyRated[order.id] != null
              ? Number(locallyRated[order.id])
              : Number(order.rated_count   ?? 0);
            const totalProds  = Number(order.total_products ?? 0);
            const fullyRated  = totalProds > 0 && ratedCount >= totalProds;
            const partialRated = ratedCount > 0 && !fullyRated;

            return (
              <div
                key={order.id}
                className="bg-white rounded-xl border hover:border-primary-200 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                <div className="p-4">
                  {/* Store header */}
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-50">
                    <div className="flex items-center gap-2">
                      <Store size={13} className="text-gray-500 shrink-0" />
                      <span className="text-sm font-semibold text-gray-800">{storeName}</span>
                    </div>
                    <StatusBadge status={order.status} type="order" />
                  </div>

                  {/* Items preview */}
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {order.items?.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="w-10 h-10 bg-gray-100 rounded-lg border-2 border-white overflow-hidden shrink-0">
                          {item.product_image && (
                            <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                      ))}
                      {order.items?.length > 3 && (
                        <div className="w-10 h-10 bg-gray-200 rounded-lg border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600 shrink-0">
                          +{order.items.length - 3}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-600 truncate">
                        {order.items?.map(i => i.product_name).join(', ')}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-gray-400">{order.items?.length} item(s)</p>
                        <span className="text-gray-200">·</span>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock size={10} />
                          {new Date(order.created_at).toLocaleDateString('en-PH', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary-800">
                        ₱{Number(order.total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] text-gray-400">COD</p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  {showActions && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">

                      {/* Buy Again */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBuyAgain(order.id, order.items);
                        }}
                        disabled={buyingAgain === order.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 touch-manipulation"
                      >
                        {buyingAgain === order.id
                          ? <RefreshCw size={13} className="animate-spin" />
                          : <ShoppingCart size={13} />
                        }
                        Buy Again
                      </button>

                      {/* Rate / View Rating */}
                      {isDelivered && (
                        fullyRated ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRatingOrder(order);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-green-200 bg-green-50 text-green-700 text-xs font-semibold rounded-xl hover:bg-green-100 active:bg-green-200 transition-colors touch-manipulation"
                          >
                            <CheckCircle size={13} />
                            View Rating
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRatingOrder(order);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-yellow-400 hover:bg-yellow-500 active:bg-yellow-600 text-yellow-900 text-xs font-semibold rounded-xl transition-colors touch-manipulation"
                          >
                            <Star size={13} className="fill-yellow-900" />
                            {partialRated ? 'Finish Rating' : 'Rate'}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    p === page ? 'bg-primary-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rate Products Modal */}
      {ratingOrder && (
        <RateProductsModal
          order={ratingOrder}
          onClose={() => setRatingOrder(null)}
          onAllReviewed={(reviewedProductIds) => {
            // Immediately update the button label without waiting for fetch
            if (reviewedProductIds != null) {
              const total = Number(ratingOrder.total_products ?? ratingOrder.items?.length ?? 0);
              setLocallyRated(prev => ({ ...prev, [ratingOrder.id]: total }));
            }
            fetchOrders();
            setRatingOrder(null);
          }}
        />
      )}
    </div>
  );
}
