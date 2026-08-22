import { useState, useEffect } from 'react';
import { sellerAPI, ordersAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';
import StatusBadge from '../../components/common/StatusBadge';
import { SkeletonTable } from '../../components/common/Skeleton';
import { Truck, Package, CheckCircle, XCircle, Clock, Eye, MapPin, Camera, ChevronDown, ChevronUp } from 'lucide-react';

export default function Shipping() {
  const [pickupRequests, setPickupRequests] = useState([]);
  const [readyOrders, setReadyOrders] = useState([]);
  const [activeShipments, setActiveShipments] = useState([]);
  const [deliveredOrders, setDeliveredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requests');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const { showToast } = useToast();

  const fetchData = async () => {
    try {
      const [reqRes, readyRes, activeRes, deliveredRes] = await Promise.all([
        sellerAPI.pickupRequests(),
        ordersAPI.list({ status: 'ready_to_ship', limit: 50 }),
        ordersAPI.list({ status: 'to_receive', limit: 50 }),
        ordersAPI.list({ status: 'delivered', limit: 30 }),
      ]);
      setPickupRequests(reqRes.data.requests || []);
      setReadyOrders(readyRes.data.orders || []);
      setActiveShipments(activeRes.data.orders || []);
      setDeliveredOrders(deliveredRes.data.orders || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handlePickupAction = async (requestId, action) => {
    try {
      await sellerAPI.handlePickupRequest({ request_id: requestId, action });
      showToast(action === 'approve' ? 'Rider approved and assigned!' : 'Request rejected.', 'success');
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to process request.', 'error');
    }
  };

  const viewOrderDetail = async (orderId) => {
    if (expandedOrder === orderId) { setExpandedOrder(null); setOrderDetail(null); return; }
    try {
      const res = await ordersAPI.detail(orderId);
      setOrderDetail(res.data.order);
      setExpandedOrder(orderId);
    } catch {}
  };

  const tabs = [
    { key: 'requests', label: 'Pickup Requests', count: pickupRequests.length, icon: Truck },
    { key: 'ready', label: 'Ready to Ship', count: readyOrders.length, icon: Package },
    { key: 'active', label: 'In Transit', count: activeShipments.length, icon: Truck },
    { key: 'delivered', label: 'Delivered', count: deliveredOrders.length, icon: CheckCircle },
  ];

  if (loading) return <SkeletonTable rows={4} cols={5} />;

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shipping & Delivery</h1>
        <p className="text-sm text-gray-500 mt-1">Track orders, manage rider requests, and view delivery proofs</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto bg-gray-100 p-1 rounded-lg">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md whitespace-nowrap transition-all ${activeTab === tab.key ? 'bg-white shadow text-primary-800' : 'text-gray-600 hover:text-gray-900'}`}>
            <tab.icon size={14} />
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'}`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Pickup Requests */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-xl border">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-900">Pending Rider Requests</h2>
            <p className="text-xs text-gray-500 mt-1">Approve a rider to assign them for order pickup</p>
          </div>
          {pickupRequests.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <Clock size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No pending requests</p>
              <p className="text-xs text-gray-400 mt-1">Riders will request when your orders are ready</p>
            </div>
          ) : (
            <div className="divide-y">
              {pickupRequests.map(req => (
                <div key={req.id} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50">
                  <div className="w-11 h-11 bg-blue-50 rounded-full flex items-center justify-center shrink-0 border border-blue-100">
                    <span className="text-lg">🛵</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{req.rider_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Order <span className="font-medium">#{req.order_number}</span> · ₱{Number(req.total_amount || 0).toLocaleString()}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {req.rider_contact && <span className="text-xs text-gray-400">📞 {req.rider_contact}</span>}
                      <span className="text-xs text-gray-400">{new Date(req.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handlePickupAction(req.id, 'reject')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100">
                      <XCircle size={13} /> Reject
                    </button>
                    <button onClick={() => handlePickupAction(req.id, 'approve')} className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-primary-800 rounded-lg hover:bg-primary-900">
                      <CheckCircle size={13} /> Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ready to Ship */}
      {activeTab === 'ready' && (
        <div className="bg-white rounded-xl border">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-900">Waiting for Rider</h2>
            <p className="text-xs text-gray-500 mt-1">These orders are packed and waiting for a rider to request pickup</p>
          </div>
          {readyOrders.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <Package size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No orders waiting</p>
            </div>
          ) : (
            <div className="divide-y">
              {readyOrders.map(order => (
                <div key={order.id} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50">
                  <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                    <Package size={18} className="text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{order.order_number}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{order.recipient_name || order.buyer_name} · {order.barangay_name}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">₱{Number(order.total_amount).toLocaleString()}</p>
                  <StatusBadge status={order.status} type="order" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Shipments (In Transit) */}
      {activeTab === 'active' && (
        <div className="bg-white rounded-xl border">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-900">In Transit</h2>
            <p className="text-xs text-gray-500 mt-1">Orders currently being delivered by riders</p>
          </div>
          {activeShipments.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <Truck size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No active shipments</p>
            </div>
          ) : (
            <div className="divide-y">
              {activeShipments.map(order => (
                <div key={order.id}>
                  <div className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer" onClick={() => viewOrderDetail(order.id)}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${order.status === 'out_for_delivery' ? 'bg-orange-50' : 'bg-green-50'}`}>
                      <Truck size={18} className={order.status === 'out_for_delivery' ? 'text-orange-500' : 'text-green-500'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{order.order_number}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{order.recipient_name || order.buyer_name}</p>
                    </div>
                    <StatusBadge status={order.status} type="order" />
                    {expandedOrder === order.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                  {expandedOrder === order.id && orderDetail && renderOrderTimeline(orderDetail)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delivered */}
      {activeTab === 'delivered' && (
        <div className="bg-white rounded-xl border">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-900">Delivered Orders</h2>
            <p className="text-xs text-gray-500 mt-1">Completed deliveries with proof photos and timeline</p>
          </div>
          {deliveredOrders.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <CheckCircle size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No delivered orders yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {deliveredOrders.map(order => (
                <div key={order.id}>
                  <div className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer" onClick={() => viewOrderDetail(order.id)}>
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                      <CheckCircle size={18} className="text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{order.order_number}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{order.recipient_name || order.buyer_name} · {order.barangay_name}</p>
                    </div>
                    <p className="text-sm font-semibold text-primary-800">₱{Number(order.total_amount).toLocaleString()}</p>
                    {expandedOrder === order.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                  {expandedOrder === order.id && orderDetail && renderOrderTimeline(orderDetail)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function renderOrderTimeline(order) {
  const timeline = order.status_history || [];
  const delivery = order.delivery || {};

  return (
    <div className="px-5 pb-5 border-t bg-gray-50">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
        {/* Timeline */}
        <div className="bg-white rounded-xl border p-4">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Clock size={13} /> Order Timeline
          </h4>
          {timeline.length === 0 ? (
            <p className="text-xs text-gray-400">No history available</p>
          ) : (
            <div className="relative pl-5 border-l-2 border-gray-200 space-y-4">
              {timeline.map((entry, idx) => (
                <div key={idx} className="relative">
                  <div className={`absolute -left-[21px] w-2.5 h-2.5 rounded-full ${idx === timeline.length - 1 ? 'bg-primary-800' : 'bg-gray-300'}`} />
                  <p className="text-sm font-medium text-gray-900 capitalize">{entry.status.replace(/_/g, ' ')}</p>
                  {entry.notes && <p className="text-xs text-gray-500 mt-0.5">{entry.notes}</p>}
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {new Date(entry.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                    {entry.changed_by_name && ` · ${entry.changed_by_name}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rider & Delivery Info */}
        <div className="space-y-4">
          {/* Rider Info */}
          {(delivery.rider_name || delivery.delivery_person_name) && (
            <div className="bg-white rounded-xl border p-4">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Truck size={13} /> Rider
              </h4>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-50 rounded-full flex items-center justify-center">
                  <span className="text-base">🛵</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{delivery.rider_name || delivery.delivery_person_name}</p>
                  {(delivery.rider_contact || delivery.delivery_contact) && (
                    <p className="text-xs text-gray-500">{delivery.rider_contact || delivery.delivery_contact}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500 space-y-1">
                {delivery.picked_up_at && <p>Picked up: {new Date(delivery.picked_up_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</p>}
                {delivery.delivered_at && <p>Delivered: {new Date(delivery.delivered_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</p>}
              </div>
            </div>
          )}

          {/* Delivery Address */}
          <div className="bg-white rounded-xl border p-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <MapPin size={13} /> Delivery Address
            </h4>
            <p className="text-sm font-medium text-gray-900">{order.recipient_name}</p>
            <p className="text-xs text-gray-500 mt-1">{order.street_address}, {order.barangay_name}</p>
            {order.delivery_contact && <p className="text-xs text-gray-500 mt-1">📞 {order.delivery_contact}</p>}
          </div>

          {/* Proof Photos */}
          {(delivery.pickup_proof || delivery.delivery_proof) && (
            <div className="bg-white rounded-xl border p-4">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Camera size={13} /> Proof Photos
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {delivery.pickup_proof && (
                  <div>
                    <p className="text-[11px] font-medium text-gray-500 mb-1.5">📦 Pickup</p>
                    <img src={delivery.pickup_proof} alt="Pickup proof" className="w-full h-32 object-cover rounded-lg border" />
                    {delivery.picked_up_at && <p className="text-[10px] text-gray-400 mt-1">{new Date(delivery.picked_up_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</p>}
                  </div>
                )}
                {delivery.delivery_proof && (
                  <div>
                    <p className="text-[11px] font-medium text-gray-500 mb-1.5">✅ Delivery</p>
                    <img src={delivery.delivery_proof} alt="Delivery proof" className="w-full h-32 object-cover rounded-lg border" />
                    {delivery.delivered_at && <p className="text-[10px] text-gray-400 mt-1">{new Date(delivery.delivered_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</p>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
