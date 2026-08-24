import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Eye } from 'lucide-react';
import { adminAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';

export default function ProductApprovals() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [rejectModal, setRejectModal] = useState({ open: false, id: null, reason: '' });
  const { showToast } = useToast();

  const fetchProducts = async () => {
    try {
      const res = await adminAPI.products({ status: 'pending' });
      setProducts(res.data.products);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  useEffect(() => {
    const interval = setInterval(fetchProducts, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (productId, action, reason = '') => {
    try {
      await adminAPI.updateProduct({ product_id: productId, action, reason });
      showToast(`Product ${action}d successfully.`, 'success');
      fetchProducts();
    } catch {
      showToast('Action failed.', 'error');
    }
  };

  if (loading) return <SkeletonTable rows={5} cols={5} />;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Product Approvals ({products.length})</h2>

      {products.length === 0 ? (
        <EmptyState title="No pending products" description="All products have been reviewed." />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Seller</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Price</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden shrink-0">
                          {product.primary_image && <img src={product.primary_image} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <span className="font-medium text-gray-900 truncate max-w-40">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{product.store_name || product.seller_name}</td>
                    <td className="px-4 py-3 text-gray-600">{product.category_name}</td>
                    <td className="px-4 py-3 text-right font-medium">₱{Number(product.price).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleAction(product.id, 'approve')} className="p-1.5 hover:bg-green-50 rounded text-green-600" title="Approve">
                          <CheckCircle size={16} />
                        </button>
                        <button onClick={() => setRejectModal({ open: true, id: product.id, reason: '' })} className="p-1.5 hover:bg-red-50 rounded text-red-600" title="Reject">
                          <XCircle size={16} />
                        </button>
                        <button onClick={() => setSelectedProduct(product)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="View">
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      <Modal isOpen={rejectModal.open} onClose={() => setRejectModal({ open: false, id: null, reason: '' })} title="Reject Product" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason *</label>
            <textarea value={rejectModal.reason} onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })} rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none resize-none" placeholder="Why is this product being rejected?" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setRejectModal({ open: false, id: null, reason: '' })} className="flex-1 py-2.5 border rounded-lg text-sm font-medium">Cancel</button>
            <button onClick={() => { handleAction(rejectModal.id, 'reject', rejectModal.reason); setRejectModal({ open: false, id: null, reason: '' }); }}
              className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Reject</button>
          </div>
        </div>
      </Modal>

      {/* Product Detail Modal */}
      <Modal isOpen={!!selectedProduct} onClose={() => setSelectedProduct(null)} title="Product Details" size="lg">
        {selectedProduct && (
          <div className="space-y-4">
            <div className="flex gap-4">
              {selectedProduct.primary_image && <img src={selectedProduct.primary_image} alt="" className="w-32 h-32 object-cover rounded-lg" />}
              <div className="space-y-1 text-sm">
                <h3 className="font-semibold text-lg">{selectedProduct.name}</h3>
                <p className="text-gray-500">{selectedProduct.category_name}</p>
                <p className="text-xl font-bold text-primary-800">₱{Number(selectedProduct.price).toLocaleString()}</p>
                <p className="text-gray-600">Stock: {selectedProduct.stock} • Seller: {selectedProduct.store_name}</p>
                <p className="text-gray-600">Barangay: {selectedProduct.barangay_name || 'N/A'}</p>
              </div>
            </div>
            {selectedProduct.description && <p className="text-sm text-gray-600">{selectedProduct.description}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
