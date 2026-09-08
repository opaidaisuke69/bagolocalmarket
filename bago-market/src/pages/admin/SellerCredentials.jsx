import { useState, useEffect } from 'react';
import { Search, CheckCircle, XCircle, Ban, RefreshCw, Eye, AlertTriangle } from 'lucide-react';
import { adminAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/Skeleton';

const IMAGE_BASE = import.meta.env.PROD ? '/server' : '';

const fmt  = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const fmtN = (n) => Number(n || 0).toLocaleString('en-PH');

export default function SellerCredentials() {
  const [sellers, setSellers]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [status, setStatus]         = useState('');
  const [search, setSearch]         = useState('');
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [selected, setSelected]     = useState(null);
  const [actionModal, setActionModal] = useState({ open: false, sellerId: null, action: '', reason: '' });
  const { showToast } = useToast();

  const fetchSellers = async () => {
    try {
      const res = await adminAPI.sellers({ status, search, page, limit: 20 });
      setSellers(res.data.sellers);
      setTotalPages(res.data.total_pages);
      setTotal(res.data.total);
    } catch {
      showToast('Failed to load sellers.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setLoading(true); fetchSellers(); }, [status, search, page]);
  useEffect(() => {
    const t = setInterval(fetchSellers, 5000);
    return () => clearInterval(t);
  }, [status, search, page]);

  const handleAction = async () => {
    try {
      await adminAPI.updateSeller({
        seller_id: actionModal.sellerId,
        action:    actionModal.action,
        reason:    actionModal.reason,
      });
      showToast(`Seller ${actionModal.action} completed.`, 'success');
      setSelected(null);
      fetchSellers();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Action failed.', 'error');
    }
    setActionModal({ open: false, sellerId: null, action: '', reason: '' });
  };

  const openAction = (seller, action) =>
    setActionModal({ open: true, sellerId: seller.id, action, reason: '' });

  const tabs = [
    { label: 'All',      value: '' },
    { label: 'Approved', value: 'approved' },
    { label: 'Pending',  value: 'pending' },
    { label: 'Rejected', value: 'rejected' },
  ];

  return (
    <div className="space-y-4">

      {/* Tabs + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {tabs.map(t => (
            <button key={t.value}
              onClick={() => { setStatus(t.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                ${status === t.value ? 'bg-white shadow text-primary-800' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search seller or store…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
        </div>
        <span className="text-sm text-gray-500">{total} seller{total !== 1 ? 's' : ''}</span>
      </div>

      {loading ? <SkeletonTable rows={8} cols={7} /> : (
        <>
          {sellers.length === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center text-gray-400 text-sm">
              No sellers found.
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Seller</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Store</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Barangay</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Approval</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Account</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Sales</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sellers.map(seller => (
                      <tr key={seller.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{seller.full_name}</p>
                          <p className="text-xs text-gray-400">{seller.email}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700 text-sm">{seller.store_name}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{seller.barangay_name || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold
                            ${seller.approval_status === 'approved' ? 'bg-green-100 text-green-700'
                            : seller.approval_status === 'rejected' ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'}`}>
                            {seller.approval_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={seller.account_status} type="general" />
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 text-xs">₱{fmt(seller.total_sales)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button title="View credentials" onClick={() => setSelected(seller)}
                              className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><Eye size={14} /></button>
                            {seller.approval_status === 'pending' && <>
                              <button title="Approve" onClick={() => openAction(seller, 'approve')}
                                className="p-1.5 hover:bg-green-50 rounded text-green-600"><CheckCircle size={14} /></button>
                              <button title="Reject" onClick={() => openAction(seller, 'reject')}
                                className="p-1.5 hover:bg-red-50 rounded text-red-500"><XCircle size={14} /></button>
                            </>}
                            {seller.account_status === 'active' && (
                              <button title="Warn" onClick={() => openAction(seller, 'warn')}
                                className="p-1.5 hover:bg-yellow-50 rounded text-yellow-600"><AlertTriangle size={14} /></button>
                            )}
                            {seller.account_status !== 'banned' && (
                              <button title="Ban" onClick={() => openAction(seller, 'ban')}
                                className="p-1.5 hover:bg-red-50 rounded text-red-600"><Ban size={14} /></button>
                            )}
                            {(seller.account_status === 'banned' || seller.account_status === 'suspended') && (
                              <button title="Reactivate" onClick={() => openAction(seller, 'reactivate')}
                                className="p-1.5 hover:bg-green-50 rounded text-green-600"><RefreshCw size={14} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Prev</button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Credentials detail modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Seller Credentials" size="md">
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <span className="text-gray-500">Full Name</span>
              <span className="font-medium">{selected.full_name}</span>
              <span className="text-gray-500">Email</span>
              <span>{selected.email}</span>
              <span className="text-gray-500">Contact</span>
              <span>{selected.contact_number}</span>
              <span className="text-gray-500">Store Name</span>
              <span className="font-medium">{selected.store_name}</span>
              <span className="text-gray-500">Barangay</span>
              <span>{selected.barangay_name || '—'}</span>
              <span className="text-gray-500">Approval</span>
              <span className={`font-semibold capitalize
                ${selected.approval_status === 'approved' ? 'text-green-600'
                : selected.approval_status === 'rejected' ? 'text-red-600'
                : 'text-yellow-600'}`}>
                {selected.approval_status}
              </span>
              <span className="text-gray-500">Account Status</span>
              <span className="capitalize">{selected.account_status}</span>
              <span className="text-gray-500">Rating</span>
              <span>{Number(selected.rating || 0).toFixed(1)} ⭐</span>
              <span className="text-gray-500">Total Sales</span>
              <span className="font-medium text-green-700">₱{fmt(selected.total_sales)}</span>
              <span className="text-gray-500">Total Orders</span>
              <span>{fmtN(selected.total_orders)}</span>
              <span className="text-gray-500">Registered</span>
              <span>{new Date(selected.created_at).toLocaleDateString('en-PH')}</span>
            </div>

            {selected.store_description && (
              <div>
                <p className="text-gray-500 text-xs font-medium mb-1">Store Description</p>
                <p className="text-gray-700 text-sm bg-gray-50 rounded-lg p-3">{selected.store_description}</p>
              </div>
            )}

            {/* Valid ID */}
            {(selected.valid_id_image || selected.verification_document) && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">
                  Valid ID {selected.valid_id_type ? `(${selected.valid_id_type})` : ''}
                </p>
                <a href={`${IMAGE_BASE}${selected.valid_id_image || selected.verification_document}`}
                  target="_blank" rel="noopener noreferrer">
                  <img
                    src={`${IMAGE_BASE}${selected.valid_id_image || selected.verification_document}`}
                    alt="Valid ID"
                    className="w-full max-h-52 object-cover rounded-lg border hover:opacity-90 transition-opacity" />
                </a>
              </div>
            )}

            {/* Quick actions */}
            <div className="flex gap-2 pt-2 border-t flex-wrap">
              {selected.approval_status === 'pending' && <>
                <button onClick={() => { openAction(selected, 'approve'); setSelected(null); }}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 min-w-[80px]">
                  Approve
                </button>
                <button onClick={() => { openAction(selected, 'reject'); setSelected(null); }}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 min-w-[80px]">
                  Reject
                </button>
              </>}
              {selected.account_status === 'active' && (
                <button onClick={() => { openAction(selected, 'ban'); setSelected(null); }}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 min-w-[80px]">
                  Ban Seller
                </button>
              )}
              {(selected.account_status === 'banned' || selected.account_status === 'suspended') && (
                <button onClick={() => { openAction(selected, 'reactivate'); setSelected(null); }}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 min-w-[80px]">
                  Reactivate
                </button>
              )}
              <button onClick={() => setSelected(null)}
                className="flex-1 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 min-w-[80px]">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Action confirm modal */}
      <Modal isOpen={actionModal.open}
        onClose={() => setActionModal({ open: false, sellerId: null, action: '', reason: '' })}
        title={`${actionModal.action.charAt(0).toUpperCase()}${actionModal.action.slice(1)} Seller`}
        size="sm">
        <div className="space-y-4">
          {!['approve', 'reactivate'].includes(actionModal.action) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea value={actionModal.reason}
                onChange={(e) => setActionModal({ ...actionModal, reason: e.target.value })}
                rows={3} placeholder="Provide a reason…"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800 resize-none" />
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => setActionModal({ open: false, sellerId: null, action: '', reason: '' })}
              className="flex-1 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={handleAction}
              className={`flex-1 py-2.5 text-white rounded-lg text-sm font-medium
                ${['approve','reactivate'].includes(actionModal.action) ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              Confirm
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
