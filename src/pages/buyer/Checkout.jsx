import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Plus, Banknote, CheckCircle, Loader2 } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { addressesAPI, ordersAPI, barangaysAPI } from '../../api/services';
import Modal from '../../components/common/Modal';

export default function Checkout() {
  const { cart, fetchCart } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressForm, setAddressForm] = useState({
    recipient_name: '', contact_number: '', barangay_id: '', street_address: '', landmark: '', delivery_notes: '', is_default: false
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [addrRes, brgRes] = await Promise.all([
          addressesAPI.list(),
          barangaysAPI.list()
        ]);
        setAddresses(addrRes.data.addresses);
        setBarangays(brgRes.data.barangays);
        const defaultAddr = addrRes.data.addresses.find(a => a.is_default) || addrRes.data.addresses[0];
        if (defaultAddr) setSelectedAddress(defaultAddr.id);
      } catch {
        showToast('Failed to load addresses.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAddAddress = async (e) => {
    e.preventDefault();
    try {
      await addressesAPI.create(addressForm);
      showToast('Address added successfully.', 'success');
      const res = await addressesAPI.list();
      setAddresses(res.data.addresses);
      setShowAddressModal(false);
      setAddressForm({ recipient_name: '', contact_number: '', barangay_id: '', street_address: '', landmark: '', delivery_notes: '', is_default: false });
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add address.', 'error');
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      showToast('Please select a delivery address.', 'warning');
      return;
    }
    if (cart.items.length === 0) {
      showToast('Your cart is empty.', 'warning');
      return;
    }

    setPlacing(true);
    try {
      const items = cart.items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        variation_id: item.variation_id || null
      }));

      const res = await ordersAPI.create({ address_id: selectedAddress, items });
      showToast('Order placed successfully!', 'success');
      await fetchCart();
      navigate(`/orders`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to place order.', 'error');
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary-800" size={32} /></div>;
  }

  const deliveryFee = 50;
  const total = Number(cart.subtotal) + deliveryFee;

  return (
    <div className="pb-20 md:pb-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Delivery Address */}
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-primary-800" />
                <h2 className="font-semibold text-gray-900">Delivery Address</h2>
              </div>
              <button onClick={() => setShowAddressModal(true)} className="text-sm text-primary-800 hover:underline font-medium flex items-center gap-1">
                <Plus size={14} /> Add New
              </button>
            </div>

            {addresses.length === 0 ? (
              <p className="text-sm text-gray-500">No addresses found. Please add a delivery address.</p>
            ) : (
              <div className="space-y-3">
                {addresses.map(addr => (
                  <label key={addr.id}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedAddress === addr.id ? 'border-primary-800 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="address" value={addr.id} checked={selectedAddress === addr.id}
                      onChange={() => setSelectedAddress(addr.id)} className="mt-1 text-primary-800 focus:ring-primary-800" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{addr.recipient_name} • {addr.contact_number}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{addr.street_address}, {addr.barangay_name}, Bago City</p>
                      {addr.landmark && <p className="text-xs text-gray-400 mt-0.5">Landmark: {addr.landmark}</p>}
                      {addr.is_default && <span className="inline-block mt-1 text-[10px] bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full font-medium">Default</span>}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Banknote size={18} className="text-primary-800" />
              <h2 className="font-semibold text-gray-900">Payment Method</h2>
            </div>
            <div className="flex items-center gap-3 p-3 border-2 border-primary-800 bg-primary-50 rounded-lg">
              <CheckCircle size={18} className="text-primary-800" />
              <div>
                <p className="text-sm font-medium text-gray-900">Cash on Delivery (COD)</p>
                <p className="text-xs text-gray-500">Pay when your order arrives</p>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Order Items ({cart.item_count})</h2>
            <div className="divide-y">
              {cart.items.map(item => (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                    {item.product_image && <img src={item.product_image} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{item.product_name}</p>
                    <p className="text-xs text-gray-500">x{item.quantity}</p>
                  </div>
                  <p className="text-sm font-medium">₱{(item.price * item.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border p-5 sticky top-20">
            <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₱{Number(cart.subtotal).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Delivery Fee</span><span>₱{deliveryFee.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Payment</span><span>COD</span></div>
              <hr className="my-3" />
              <div className="flex justify-between text-base"><span className="font-semibold">Total</span><span className="font-bold text-primary-800">₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
            </div>

            <button onClick={handlePlaceOrder} disabled={placing || !selectedAddress}
              className="mt-5 w-full bg-primary-800 hover:bg-primary-900 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {placing ? <><Loader2 size={18} className="animate-spin" /> Placing Order...</> : 'Place Order'}
            </button>
          </div>
        </div>
      </div>

      {/* Add Address Modal */}
      <Modal isOpen={showAddressModal} onClose={() => setShowAddressModal(false)} title="Add Delivery Address" size="md">
        <form onSubmit={handleAddAddress} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name *</label>
              <input type="text" required value={addressForm.recipient_name} onChange={(e) => setAddressForm({ ...addressForm, recipient_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number *</label>
              <input type="tel" required value={addressForm.contact_number} onChange={(e) => setAddressForm({ ...addressForm, contact_number: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Barangay *</label>
            <select required value={addressForm.barangay_id} onChange={(e) => setAddressForm({ ...addressForm, barangay_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none">
              <option value="">Select Barangay</option>
              {barangays.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">Delivery only within Bago City, Negros Occidental</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Street / Purok / Sitio *</label>
            <input type="text" required value={addressForm.street_address} onChange={(e) => setAddressForm({ ...addressForm, street_address: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Landmark</label>
              <input type="text" value={addressForm.landmark} onChange={(e) => setAddressForm({ ...addressForm, landmark: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Notes</label>
              <input type="text" value={addressForm.delivery_notes} onChange={(e) => setAddressForm({ ...addressForm, delivery_notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none" />
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={addressForm.is_default} onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })} className="rounded text-primary-800" />
            <span className="text-sm text-gray-600">Set as default address</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowAddressModal(false)} className="flex-1 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 bg-primary-800 text-white rounded-lg text-sm font-medium hover:bg-primary-900">Save Address</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
