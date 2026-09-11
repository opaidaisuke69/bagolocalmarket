import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, MapPin, Truck, Package, CheckCircle, Clock, XCircle, Star, ShoppingCart, RefreshCw } from 'lucide-react';
import { ordersAPI, productsAPI, cartAPI } from '../../api/services';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import StatusBadge from '../../components/common/StatusBadge';
import { PageLoader } from '../../components/common/LoadingSpinner';
import RateProductsModal from '../../components/buyer/RateProductsModal';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [showRateModal, setShowRateModal] = useState(false);
  const [buyingAgain, setBuyingAgain] = useState(false);
  // Track per-product review status for this order
  const [myReviews, setMyReviews]     = useState({}); // { product_id: reviewObj }

  const { addToCart, fetchCart } = useCart();
  const { showToast } = useToast();

  const fetchOrder = async () => {
    try {
      const res = await ordersAPI.detail(id);
      setOrder(res.data.order);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  const fetchMyReviews = async () => {
    try {
      const res = await productsAPI.myReviews({ order_id: id });
      setMyReviews(res.data.by_product || {});
    } catch {
      setMyReviews({});
    }
  };

  useEffect(() => {
    fetchOrder();
    fetchMyReviews();
  }, [id]);

  // Real-time polling
  useEffect(() => {
    const interval = setInterval(fetchOrder, 5000);
    return () => clearInterval(interval);
  }, [id]);

  const handleBuyAgain = async () => {
    setBuyingAgain(true);
    try {
      const uniqueItems = order.items.filter(
        (item, idx, arr) => arr.findIndex((i) => i.product_id === item.product_id) === idx
      );
      // Sequential adds then force a cart sync before navigating
      for (const item of uniqueItems) {
        await cartAPI.add({ product_id: item.product_id, quantity: item.quantity, variation_id: item.variation_id || null });
      }
      await fetchCart();
      navigate('/checkout');
    } catch {
      showToast('Failed to add items to cart.', 'error');
    } finally {
      setBuyingAgain(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!order) return <div className="text-center py-20 text-gray-500">Order not found.</div>;

  const timeline = [
    { status: 'pending', label: 'Order Placed', icon: Package },
    { status: 'confirmed', label: 'Seller Confirmed', icon: CheckCircle },
    { status: 'preparing', label: 'Preparing', icon: Package },
    { status: 'shipped', label: 'Shipped', icon: Truck },
    { status: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
    { status: 'delivered', label: 'Delivered', icon: CheckCircle },
  ];

  const statusOrder = ['pending', 'confirmed', 'preparing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered'];
  const currentIdx = statusOrder.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';
  const isDelivered = order.status === 'delivered';

  // Compute review state from myReviews
  const uniqueProductIds = [...new Set((order.items || []).map(i => i.product_id))];
  const reviewedIds      = uniqueProductIds.filter(pid => myReviews[pid]);
  const fullyRated       = uniqueProductIds.length > 0 && reviewedIds.length >= uniqueProductIds.length;
  const partiallyRated   = reviewedIds.length > 0 && !fullyRated;

  return (
    <>
    <div className="pb-20 md:pb-6">
      <Link to="/orders" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-800 mb-4">
        <ChevronLeft size={16} /> Back to Orders
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Order #{order.order_number}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Placed on {new Date(order.created_at).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <StatusBadge status={order.status} type="order" />
      </div>

      {/* ── Rate Products Banner (delivered orders) ── */}
      {isDelivered && (
        <div className={`mb-6 rounded-2xl p-4 flex items-center gap-4 border-2 ${
          fullyRated
            ? 'bg-green-50 border-green-200'
            : 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200'
        }`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            fullyRated ? 'bg-green-500' : 'bg-yellow-400'
          }`}>
            {fullyRated
              ? <CheckCircle size={22} className="text-white" />
              : <Star size={22} className="text-white fill-white" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm">
              {fullyRated ? 'You rated this order' : 'How was your order?'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {fullyRated
                ? `${reviewedIds.length} of ${uniqueProductIds.length} product${uniqueProductIds.length !== 1 ? 's' : ''} reviewed`
                : partiallyRated
                  ? `${reviewedIds.length} of ${uniqueProductIds.length} rated — finish rating`
                  : 'Your feedback helps sellers improve their products.'
              }
            </p>
          </div>
          <button
            onClick={() => setShowRateModal(true)}
            className={`shrink-0 flex items-center gap-1.5 font-bold text-sm px-4 py-2 rounded-xl transition-colors ${
              fullyRated
                ? 'bg-green-100 hover:bg-green-200 text-green-800'
                : 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900'
            }`}
          >
            {fullyRated ? (
              <><CheckCircle size={14} /> View Rating</>
            ) : (
              <><Star size={14} className="fill-yellow-900" /> {partiallyRated ? 'Finish Rating' : 'Rate Now'}</>
            )}
          </button>
        </div>
      )}

      {/* ── Buy Again / delivered actions ── */}
      {(isDelivered || isCancelled) && (
        <div className="mb-6">
          <button
            onClick={handleBuyAgain}
            disabled={buyingAgain}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-800 hover:bg-primary-900 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
          >
            {buyingAgain ? (
              <RefreshCw size={15} className="animate-spin" />
            ) : (
              <ShoppingCart size={15} />
            )}
            Buy Again
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Order Timeline */}
          {!isCancelled && (
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-900 mb-5">Order Progress</h3>
              <div className="flex items-start">
                {timeline.map((step, idx) => {
                  const stepIdx = statusOrder.indexOf(step.status);
                  const isCompleted = currentIdx >= stepIdx;
                  const isLast = idx === timeline.length - 1;
                  const Icon = step.icon;
                  // Check if the connecting line after this step should be filled
                  const nextStepIdx = idx < timeline.length - 1 ? statusOrder.indexOf(timeline[idx + 1].status) : -1;
                  const lineCompleted = currentIdx >= nextStepIdx;

                  return (
                    <div key={step.status} className="flex-1 flex flex-col items-center relative">
                      {/* Connecting line BEFORE this circle (except first) */}
                      {idx > 0 && (
                        <div className={`absolute top-4 right-1/2 w-full h-[3px] -translate-y-1/2 ${isCompleted ? 'bg-primary-800' : 'bg-gray-200'}`} />
                      )}
                      {/* Circle */}
                      <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-[3px] shrink-0 ${isCompleted ? 'bg-primary-800 border-primary-800 text-white' : 'bg-white border-gray-300 text-gray-400'}`}>
                        <Icon size={13} />
                      </div>
                      {/* Label */}
                      <span className={`text-[10px] text-center mt-2 leading-tight px-1 ${isCompleted ? 'text-primary-800 font-semibold' : 'text-gray-400'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isCancelled && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center gap-3">
              <XCircle size={20} className="text-red-500" />
              <div>
                <p className="font-medium text-red-800">Order Cancelled</p>
                {order.cancel_reason && <p className="text-sm text-red-600 mt-0.5">{order.cancel_reason}</p>}
              </div>
            </div>
          )}

          {/* Status History - Shopee-style Timeline */}
          {order.status_history?.length > 0 && (
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Order Activity</h3>
              <div className="relative pl-6 border-l-2 border-gray-100">
                {order.status_history.map((entry, idx) => {
                  const isLatest = idx === order.status_history.length - 1;
                  return (
                    <div key={idx} className="relative pb-5 last:pb-0">
                      <div className={`absolute -left-[25px] w-3 h-3 rounded-full border-2 ${isLatest ? 'bg-primary-800 border-primary-800' : 'bg-white border-primary-300'}`} />
                      <div>
                        <p className={`text-sm font-medium capitalize ${isLatest ? 'text-primary-800' : 'text-gray-900'}`}>
                          {entry.status.replace(/_/g, ' ')}
                        </p>
                        {entry.notes && <p className="text-xs text-gray-500 mt-0.5">{entry.notes}</p>}
                        <p className="text-[11px] text-gray-400 mt-1">
                          {new Date(entry.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                          {entry.changed_by_name && ` · ${entry.changed_by_name}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Order Items</h3>
            <div className="divide-y">
              {order.items?.map(item => {
                const itemReview = myReviews[item.product_id];
                return (
                  <div key={item.id} className="flex items-center gap-3 py-3">
                    <div className="w-14 h-14 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                      {item.product_image && (
                        <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.product_name}</p>
                      {item.variation_label && (
                        <p className="text-xs text-primary-700 font-semibold mt-0.5">{item.variation_label}</p>
                      )}
                      <p className="text-xs text-gray-500">{item.store_name} • x{item.quantity}</p>
                      {/* Show rating if this item has been reviewed */}
                      {itemReview && (
                        <div className="flex items-center gap-1 mt-0.5">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} size={10}
                              className={i <= itemReview.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-100'}
                            />
                          ))}
                          <span className="text-[10px] text-gray-400 ml-0.5">Rated</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-semibold shrink-0">
                      ₱{(item.price * item.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              })}
            </div>
            {isDelivered && (
              <button
                onClick={() => setShowRateModal(true)}
                className={`mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  fullyRated
                    ? 'border-2 border-green-200 text-green-700 hover:bg-green-50'
                    : 'border-2 border-yellow-300 text-yellow-700 hover:bg-yellow-50'
                }`}
              >
                {fullyRated ? (
                  <><CheckCircle size={15} className="text-green-500" /> View Ratings</>
                ) : (
                  <><Star size={15} className="fill-yellow-400 text-yellow-400" />
                    {partiallyRated ? 'Finish Rating Products' : 'Rate These Products'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Delivery Info */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><MapPin size={16} className="text-primary-800" /> Delivery Address</h3>
            <div className="text-sm space-y-1">
              <p className="font-medium text-gray-900">{order.recipient_name}</p>
              <p className="text-gray-600">{order.delivery_contact}</p>
              <p className="text-gray-600">{order.street_address}, {order.barangay_name}</p>
              <p className="text-gray-600">Bago City, Negros Occidental</p>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Payment Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Seller Subtotal</span>
                <span>₱{Number(order.subtotal).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              {order.commission_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Platform Fee ({Math.round((order.commission_rate || 0.02) * 100)}%)</span>
                  <span>₱{Number(order.commission_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500 flex items-center gap-1">
                  Shipping Fee
                  {order.distance_zone && (
                    <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full ml-1">
                      Zone {order.distance_zone}
                    </span>
                  )}
                </span>
                <span>₱{Number(order.delivery_fee).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between"><span className="text-gray-500">Payment</span><span>Cash on Delivery</span></div>
              <hr />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-primary-800">₱{Number(order.total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Delivery Status */}
          {order.delivery && (
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Truck size={16} className="text-primary-800" /> Delivery Info</h3>
              <div className="text-sm space-y-1">
                {(order.delivery.rider_name || order.delivery.delivery_person_name) && <p><span className="text-gray-500">Rider:</span> {order.delivery.rider_name || order.delivery.delivery_person_name}</p>}
                {(order.delivery.rider_contact || order.delivery.delivery_contact) && <p><span className="text-gray-500">Contact:</span> {order.delivery.rider_contact || order.delivery.delivery_contact}</p>}
                {order.delivery.estimated_delivery && <p><span className="text-gray-500">ETA:</span> {new Date(order.delivery.estimated_delivery).toLocaleDateString('en-PH')}</p>}
                {order.delivery.picked_up_at && <p><span className="text-gray-500">Picked up:</span> {new Date(order.delivery.picked_up_at).toLocaleString('en-PH')}</p>}
                {order.delivery.delivered_at && <p><span className="text-gray-500">Delivered:</span> {new Date(order.delivery.delivered_at).toLocaleString('en-PH')}</p>}
              </div>
            </div>
          )}

          {/* Rider Proof Photos */}
          {order.delivery && (order.delivery.pickup_proof || order.delivery.delivery_proof) && (
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Delivery Proof Photos</h3>
              <div className="space-y-4">
                {order.delivery.pickup_proof && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-2">📦 Pickup Proof</p>
                    <img src={order.delivery.pickup_proof.startsWith('/') ? order.delivery.pickup_proof : order.delivery.pickup_proof} alt="Pickup proof" className="w-full max-w-xs h-48 object-cover rounded-lg border" />
                    {order.delivery.picked_up_at && <p className="text-[11px] text-gray-400 mt-1">{new Date(order.delivery.picked_up_at).toLocaleString('en-PH')}</p>}
                  </div>
                )}
                {order.delivery.delivery_proof && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-2">✅ Delivery Proof</p>
                    <img src={order.delivery.delivery_proof.startsWith('/') ? order.delivery.delivery_proof : order.delivery.delivery_proof} alt="Delivery proof" className="w-full max-w-xs h-48 object-cover rounded-lg border" />
                    {order.delivery.delivered_at && <p className="text-[11px] text-gray-400 mt-1">{new Date(order.delivery.delivered_at).toLocaleString('en-PH')}</p>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* ── Rate Products Modal ── */}
    {showRateModal && (
      <RateProductsModal
        order={order}
        onClose={() => setShowRateModal(false)}
        onAllReviewed={() => {
          fetchMyReviews();
          setShowRateModal(false);
        }}
      />
    )}
    </>
  );
}
