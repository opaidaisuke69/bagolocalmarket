import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, Eye, MoreVertical } from 'lucide-react';
import { sellerAPI, productsAPI } from '../../api/services';
import StatusBadge from '../../components/common/StatusBadge';
import { useToast } from '../../context/ToastContext';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import { SkeletonTable } from '../../components/common/Skeleton';

export default function SellerProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { showToast } = useToast();

  const fetchProducts = async () => {
    try {
      const res = await sellerAPI.products({ search, status, page, limit: 10 });
      setProducts(res.data.products);
      setTotalPages(res.data.total_pages);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setLoading(true); fetchProducts(); }, [search, status, page]);

  // Real-time polling
  useEffect(() => {
    const interval = setInterval(fetchProducts, 3000);
    return () => clearInterval(interval);
  }, [search, status, page]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await productsAPI.delete(deleteTarget);
      showToast('Product deleted successfully.', 'success');
      fetchProducts();
    } catch {
      showToast('Failed to delete product.', 'error');
    }
    setDeleteTarget(null);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex gap-3 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <Link to="/seller/add-product" className="flex items-center gap-2 px-4 py-2.5 bg-primary-800 text-white rounded-lg text-sm font-medium hover:bg-primary-900">
          <Plus size={16} /> Add Product
        </Link>
      </div>

      {/* Products Table */}
      {loading ? <SkeletonTable rows={5} cols={5} /> : products.length === 0 ? (
        <EmptyState title="No products yet" description="You haven't posted any products yet." action={
          <Link to="/seller/add-product" className="px-4 py-2 bg-primary-800 text-white rounded-lg text-sm font-medium hover:bg-primary-900">Add Your First Product</Link>
        } />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Price</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Stock</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Sold</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                          {product.primary_image && <img src={product.primary_image} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <span className="font-medium text-gray-900 truncate max-w-40">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{product.category_name}</td>
                    <td className="px-4 py-3 text-right font-medium">₱{Number(product.price).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={product.stock <= 5 ? 'text-red-600 font-medium' : 'text-gray-600'}>{product.stock}</span>
                    </td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={product.approval_status} type="product" /></td>
                    <td className="px-4 py-3 text-right text-gray-600">{product.sold_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Link to={`/seller/edit-product/${product.id}`} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><Edit2 size={14} /></Link>
                        <button onClick={() => setDeleteTarget(product.id)} className="p-1.5 hover:bg-red-50 rounded text-red-600"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 p-4 border-t">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded text-sm font-medium ${p === page ? 'bg-primary-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Product" message="Are you sure you want to delete this product? This action cannot be undone." confirmText="Delete" />
    </div>
  );
}
