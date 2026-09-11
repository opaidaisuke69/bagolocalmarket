import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Eye, EyeOff, Trash2, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';

const TABS = [
  { key: '',         label: 'All'      },
  { key: 'pending',  label: 'Pending'  },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'hidden',   label: 'Hidden'   },
  { key: 'removed',  label: 'Removed'  },
];

const STATUS_BADGE = {
  approved: 'bg-green-100 text-green-700',
  pending:  'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
  hidden:   'bg-gray-100 text-gray-600',
  removed:  'bg-red-50 text-red-400',
};

export default function ProductApprovals({ initialTab = 'pending' }) {
  const [products,    setProducts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState(initialTab);
  const [search,      setSearch]      = useState('');
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [total,       setTotal]       = useState(0);
  const [counts,      setCounts]      = useState({});
  const [selected,    setSelected]    = useState(null);
  const [rejectModal, setRejectModal] = useState({ open: false, id: null, reason: '' });
  const { showToast } = useToast();

  // Reset tab + search when navigating between routes that share this component
  useEffect(() => {
    setTab(initialTab);
    setSearch('');
    setPage(1);
  }, [initialTab]);

  const fetchProducts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await adminAPI.products({ status: tab, search, page, limit: 20 });
      setProducts(res.data.products || []);
      setTotalPages(res.data.total_pages || 1);
      setTotal(res.data.total || 0);
      if (res.data.counts) setCounts(res.data.counts);
    } catch { /* silent */ }
    finally { if (!silent) setLoading(false); }
  }, [tab, search, page]);

  // Initial + filter-change load (shows skeleton)
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Silent background polling every 10s on pending tab, 30s on others
  useEffect(() => {
    const interval = tab === 'pending' ? 10_000 : 30_000;
    const t = setInterval(() => fetchProducts(true), interval);
    return () => clearInterval(t);
  }, [tab, fetchProducts]);

  const handleAction = async (productId, action, reason = '') => {
    try {
      await adminAPI.updateProduct({ product_id: productId, action, reason });
      showToast(`Product ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action + 'd'}.`, 'success');
      fetchProducts();
    } catch {
      showToast('Action failed.', 'error');
    }
  };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Products</h2>
        <p className="text-sm text-gray-500 mt-0.5">Review and manage all marketplace products</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPage(1); setSearch(''); }}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === t.key ? 'border-primary-800 text-primary-800' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
            {counts[t.key || 'all'] !== undefined && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                tab === t.key ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-500'
              }`}>
                {counts[t.key || 'all'] || 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search product name or seller…"
            className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
        </div>
        {search && (
          <button onClick={() => { setSearch(''); setPage(1); }}
            className="p-2 text-gray-400 hover:text-gray-600 border rounded-lg hover:bg-gray-50">
            <X size={15} />
          </button>
        )}
        <span className="self-center text-sm text-gray-500">{total} product{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {loading ? <SkeletonTable rows={8} cols={6} /> : products.length === 0 ? (
        <EmptyState title="No products found"
          description={tab === 'pending' ? 'All products have been reviewed.' : 'No products match your search.'} />
      ) : (
        <>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Seller</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Price</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map(product => (
                    <tr key={product.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                            {product.primary_image
                              ? <img src={product.primary_image} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No img</div>}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate max-w-48">{product.name}</p>
                            <p className="text-xs text-gray-400">Stock: {product.stock}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700 text-xs">{product.store_name || product.seller_name}</p>
                        <p className="text-xs text-gray-400">{product.barangay_name}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{product.category_name || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">₱{Number(product.price).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${STATUS_BADGE[product.approval_status] || 'bg-gray-100 text-gray-500'}`}>
                          {product.approval_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {/* Approve: pending or rejected → approve */}
                          {(product.approval_status === 'pending' || product.approval_status === 'rejected' || product.approval_status === 'hidden') && (
                            <button onClick={() => handleAction(product.id, 'approve')}
                              className="p-1.5 hover:bg-green-50 rounded text-green-600" title="Approve / Restore">
                              <CheckCircle size={16} />
                            </button>
                          )}
                          {/* Reject: pending only */}
                          {product.approval_status === 'pending' && (
                            <button onClick={() => setRejectModal({ open: true, id: product.id, reason: '' })}
                              className="p-1.5 hover:bg-red-50 rounded text-red-600" title="Reject">
                              <XCircle size={16} />
                            </button>
                          )}
                          {/* Hide: approved only */}
                          {product.approval_status === 'approved' && (
                            <button onClick={() => handleAction(product.id, 'hide')}
                              className="p-1.5 hover:bg-gray-100 rounded text-gray-500" title="Hide product">
                              <EyeOff size={16} />
                            </button>
                          )}
                          {/* Remove: any non-removed status */}
                          {product.approval_status !== 'removed' && (
                            <button onClick={() => handleAction(product.id, 'remove')}
                              className="p-1.5 hover:bg-red-50 rounded text-red-500" title="Remove product">
                              <Trash2 size={15} />
                            </button>
                          )}
                          {/* View detail */}
                          <button onClick={() => setSelected(product)}
                            className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="View details">
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Page {page} of {totalPages} · {total} products</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="flex items-center gap-1 px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">
                  <ChevronLeft size={14} /> Prev
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="flex items-center gap-1 px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Reject Modal */}
      <Modal isOpen={rejectModal.open} onClose={() => setRejectModal({ open: false, id: null, reason: '' })}
        title="Reject Product" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason *</label>
            <textarea value={rejectModal.reason} onChange={e => setRejectModal(r => ({ ...r, reason: e.target.value }))}
              rows={3} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none resize-none"
              placeholder="Why is this product being rejected?" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setRejectModal({ open: false, id: null, reason: '' })}
              className="flex-1 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button
              onClick={() => {
                handleAction(rejectModal.id, 'reject', rejectModal.reason);
                setRejectModal({ open: false, id: null, reason: '' });
              }}
              className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
              Reject
            </button>
          </div>
        </div>
      </Modal>

      {/* Product Detail Modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Product Details" size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              {selected.primary_image && (
                <img src={selected.primary_image} alt="" className="w-32 h-32 object-cover rounded-lg border" />
              )}
              <div className="flex-1 space-y-1 text-sm min-w-0">
                <h3 className="font-semibold text-lg text-gray-900">{selected.name}</h3>
                <p className="text-gray-500">{selected.category_name}</p>
                <p className="text-2xl font-bold text-primary-800">₱{Number(selected.price).toLocaleString()}</p>
                <p className="text-gray-600">Stock: {selected.stock}</p>
                <p className="text-gray-600">Seller: {selected.store_name || selected.seller_name}</p>
                <p className="text-gray-600">Barangay: {selected.barangay_name || 'N/A'}</p>
                <p className="text-gray-600">Sold: {selected.sold_count || 0} units</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${STATUS_BADGE[selected.approval_status] || 'bg-gray-100 text-gray-500'}`}>
                  {selected.approval_status}
                </span>
              </div>
            </div>
            {selected.description && (
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selected.description}</p>
            )}
            {/* Actions inside modal */}
            <div className="flex gap-2 pt-2 border-t flex-wrap">
              {(selected.approval_status === 'pending' || selected.approval_status === 'rejected' || selected.approval_status === 'hidden') && (
                <button onClick={() => { handleAction(selected.id, 'approve'); setSelected(null); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
                  <CheckCircle size={14} /> {selected.approval_status === 'hidden' ? 'Restore' : 'Approve'}
                </button>
              )}
              {selected.approval_status === 'pending' && (
                <button onClick={() => { setSelected(null); setRejectModal({ open: true, id: selected.id, reason: '' }); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">
                  <XCircle size={14} /> Reject
                </button>
              )}
              {selected.approval_status === 'approved' && (
                <button onClick={() => { handleAction(selected.id, 'hide'); setSelected(null); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600">
                  <EyeOff size={14} /> Hide
                </button>
              )}
              {selected.approval_status !== 'removed' && (
                <button onClick={() => { handleAction(selected.id, 'remove'); setSelected(null); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">
                  <Trash2 size={14} /> Remove
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
