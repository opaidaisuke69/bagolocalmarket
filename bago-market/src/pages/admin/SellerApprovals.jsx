import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Eye, Store } from 'lucide-react';
import { adminAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';

const IMAGE_BASE = import.meta.env.PROD ? '/server' : '';

export default function SellerApprovals() {
  const [sellers, setSellers]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [rejectModal, setRejectModal] = useState({ open: false, sellerId: null, reason: '' });
  const { showToast } = useToast();

  const fetchSellers = async () => {
    try {
      const res = await adminAPI.sellers({ status: 'pending', limit: 50 });
      setSellers(res.data.sellers);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSellers(); }, []);
  useEffect(() => {
    const t = setInterval(fetchSellers, 4000);
    return () => clearInterval(t);
  }, []);

  const handleAction = async (sellerId, actionType, reason = '') => {
    try {
      await adminAPI.updateSeller({ seller_id: sellerId, action: actionType, reason });
      showToast(`Seller ${actionType === 'approve' ? 'approved' : 'rejected'} successfully.`, 'success');
      setSelectedSeller(null);
      fetchSellers();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Action failed.', 'error');
    }
  };

  if (loading) return <SkeletonTable rows={5} cols={4} />;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">
        Pending Seller Applications
        <span className="ml-2 text-sm font-normal text-gray-400">({sellers.length})</span>
      </h2>

      {sellers.length === 0 ? (
        <EmptyState title="No pending applications" description="All seller applications have been reviewed." />
      ) : (
        <div className="space-y-4">
          {sellers.map(seller => (
            <div key={seller.id} className="bg-white rounded-xl border p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Store size={16} className="text-primary-800 shrink-0" />
                    <h3 className="font-semibold text-gray-900 truncate">{seller.store_name}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{seller.full_name} • {seller.email}</p>
                  <p className="text-sm text-gray-500">{seller.barangay_name ? `${seller.barangay_name}, ` : ''}Bago City • {seller.contact_number}</p>
                  {seller.valid_id_type && (
                    <p className="text-xs text-gray-400 mt-1">ID Type: {seller.valid_id_type}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    Applied: {new Date(seller.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>

                {/* Valid ID thumbnail */}
                {(seller.valid_id_image || seller.verification_document) && (
                  <img
                    src={`${IMAGE_BASE}${seller.valid_id_image || seller.verification_document}`}
                    alt="Valid ID"
                    className="w-20 h-14 object-cover rounded-lg border shrink-0 cursor-pointer hover:opacity-90"
                    onClick={() => setSelectedSeller(seller)}
                  />
                )}
              </div>

              {/* Sample product thumbnails */}
              {seller.sample_products?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-2">Sample Products ({seller.sample_products.length})</p>
                  <div className="flex gap-2 flex-wrap">
                    {seller.sample_products.slice(0, 5).map((img, i) => (
                      <img key={i} src={`${IMAGE_BASE}${img}`} alt=""
                        className="w-14 h-14 object-cover rounded-lg border" />
                    ))}
                    {seller.sample_products.length > 5 && (
                      <div className="w-14 h-14 bg-gray-100 rounded-lg border flex items-center justify-center text-xs text-gray-500 font-medium">
                        +{seller.sample_products.length - 5}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button onClick={() => handleAction(seller.id, 'approve')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                  <CheckCircle size={14} /> Approve
                </button>
                <button onClick={() => setRejectModal({ open: true, sellerId: seller.id, reason: '' })}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                  <XCircle size={14} /> Reject
                </button>
                <button onClick={() => setSelectedSeller(seller)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                  <Eye size={14} /> Full Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full credentials modal */}
      <Modal isOpen={!!selectedSeller} onClose={() => setSelectedSeller(null)} title="Seller Application Details" size="lg">
        {selectedSeller && (
          <div className="space-y-5 text-sm">

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
              <span className="text-gray-500">Full Name</span>
              <span className="font-medium">{selectedSeller.full_name}</span>
              <span className="text-gray-500">Email</span>
              <span>{selectedSeller.email}</span>
              <span className="text-gray-500">Contact Number</span>
              <span>{selectedSeller.contact_number}</span>
              <span className="text-gray-500">Store Name</span>
              <span className="font-semibold text-primary-800">{selectedSeller.store_name}</span>
              <span className="text-gray-500">Barangay</span>
              <span>{selectedSeller.barangay_name || '—'}</span>
              <span className="text-gray-500">Valid ID Type</span>
              <span>{selectedSeller.valid_id_type || '—'}</span>
              <span className="text-gray-500">Applied</span>
              <span>{new Date(selectedSeller.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>

            {selectedSeller.store_description && (
              <div>
                <p className="text-gray-500 text-xs font-medium mb-1">Store Description</p>
                <p className="bg-gray-50 rounded-lg p-3 text-gray-700">{selectedSeller.store_description}</p>
              </div>
            )}

            {/* Valid ID */}
            {(selectedSeller.valid_id_image || selectedSeller.verification_document) && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">
                  Government-Issued ID {selectedSeller.valid_id_type ? `— ${selectedSeller.valid_id_type}` : ''}
                </p>
                <a href={`${IMAGE_BASE}${selectedSeller.valid_id_image || selectedSeller.verification_document}`}
                  target="_blank" rel="noopener noreferrer">
                  <img
                    src={`${IMAGE_BASE}${selectedSeller.valid_id_image || selectedSeller.verification_document}`}
                    alt="Valid ID"
                    className="w-full max-h-56 object-contain rounded-xl border bg-gray-50 hover:opacity-90 transition-opacity" />
                </a>
                <p className="text-[11px] text-gray-400 mt-1">Click to open full size</p>
              </div>
            )}

            {/* Sample products */}
            {selectedSeller.sample_products?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">
                  Sample Products ({selectedSeller.sample_products.length})
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {selectedSeller.sample_products.map((img, i) => (
                    <a key={i} href={`${IMAGE_BASE}${img}`} target="_blank" rel="noopener noreferrer">
                      <img src={`${IMAGE_BASE}${img}`} alt={`Sample ${i + 1}`}
                        className="w-full aspect-square object-cover rounded-lg border hover:opacity-90 transition-opacity" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-2 border-t">
              <button onClick={() => { handleAction(selectedSeller.id, 'approve'); }}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center justify-center gap-2">
                <CheckCircle size={15} /> Approve Seller
              </button>
              <button onClick={() => { setSelectedSeller(null); setRejectModal({ open: true, sellerId: selectedSeller.id, reason: '' }); }}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 flex items-center justify-center gap-2">
                <XCircle size={15} /> Reject
              </button>
              <button onClick={() => setSelectedSeller(null)}
                className="px-5 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject reason modal */}
      <Modal isOpen={rejectModal.open} onClose={() => setRejectModal({ open: false, sellerId: null, reason: '' })}
        title="Reject Seller Application" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason *</label>
            <textarea value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
              rows={4} placeholder="Provide a clear reason for rejection…"
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800 resize-none" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setRejectModal({ open: false, sellerId: null, reason: '' })}
              className="flex-1 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={() => { handleAction(rejectModal.sellerId, 'reject', rejectModal.reason); setRejectModal({ open: false, sellerId: null, reason: '' }); }}
              className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
              Confirm Reject
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
