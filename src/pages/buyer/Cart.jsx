import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingCart, ArrowRight } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import EmptyState from '../../components/common/EmptyState';

export default function Cart() {
  const { cart, updateQuantity, removeFromCart } = useCart();

  if (cart.items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="Your cart is empty"
        description="Looks like you haven't added any products to your cart yet."
        action={
          <Link to="/marketplace" className="px-5 py-2.5 bg-primary-800 text-white rounded-lg text-sm font-medium hover:bg-primary-900 inline-flex items-center gap-2">
            Browse Marketplace <ArrowRight size={16} />
          </Link>
        }
      />
    );
  }

  // Group by seller
  const groupedItems = cart.items.reduce((acc, item) => {
    const sellerId = item.seller_id;
    if (!acc[sellerId]) {
      acc[sellerId] = { seller_name: item.seller_name, store_name: item.store_name, items: [] };
    }
    acc[sellerId].items.push(item);
    return acc;
  }, {});

  return (
    <div className="pb-20 md:pb-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Shopping Cart ({cart.item_count} items)</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {Object.entries(groupedItems).map(([sellerId, group]) => (
            <div key={sellerId} className="bg-white rounded-xl border overflow-hidden">
              {/* Seller Header */}
              <div className="px-4 py-3 bg-gray-50 border-b">
                <p className="text-sm font-medium text-gray-900">{group.store_name || group.seller_name}</p>
              </div>

              {/* Items */}
              <div className="divide-y">
                {group.items.map(item => (
                  <div key={item.id} className="p-4 flex gap-4">
                    {/* Image */}
                    <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                      {item.product_image ? (
                        <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <ShoppingCart size={24} />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <Link to={`/product/${item.product_id}`} className="text-sm font-medium text-gray-900 hover:text-primary-800 line-clamp-2">
                        {item.product_name}
                      </Link>
                      <p className="text-xs text-gray-500 mt-0.5">{item.seller_barangay || 'Bago City'}</p>
                      <p className="text-primary-800 font-bold mt-1">
                        ₱{Number(item.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        {/* Quantity controls */}
                        <div className="flex items-center border rounded-lg">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2 py-1 hover:bg-gray-50">
                            <Minus size={14} />
                          </button>
                          <span className="px-3 py-1 border-x text-sm font-medium">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, Math.min(item.stock, item.quantity + 1))} className="px-2 py-1 hover:bg-gray-50">
                            <Plus size={14} />
                          </button>
                        </div>

                        {/* Subtotal and delete */}
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-900">
                            ₱{(item.price * item.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </span>
                          <button onClick={() => removeFromCart(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border p-5 sticky top-20">
            <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal ({cart.item_count} items)</span>
                <span className="font-medium">₱{Number(cart.subtotal).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Delivery Fee</span>
                <span className="font-medium">₱50.00</span>
              </div>
              <hr className="my-3" />
              <div className="flex justify-between text-base">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-primary-800">₱{(Number(cart.subtotal) + 50).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <Link to="/checkout"
              className="mt-5 w-full flex items-center justify-center gap-2 bg-primary-800 hover:bg-primary-900 text-white py-3 rounded-lg font-semibold transition-colors">
              Proceed to Checkout <ArrowRight size={16} />
            </Link>

            <Link to="/marketplace" className="mt-3 block text-center text-sm text-primary-800 hover:underline font-medium">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
