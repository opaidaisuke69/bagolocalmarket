import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Eye } from 'lucide-react';
import { adminAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';

export default function SellerApprovals() {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [action, setAction] = useState({ seller: null, type: '', reason: '' });
  const [showReject, setShowReject] = useState(false);
  const { showToast } = useToast();

  const fetchSellers = async () => {
    try {
      const res = await adminAPI.sellers({ status: 'pending' });
      setSellers(res.data.sellers);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSellers(); }, []);

  // Real-time polling
  useEffect(() => {
    const interval = setInterval(fetchSellers, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (sellerId, actionType, reason = '') => {
    try {
      await adminAPI.updateSeller({ seller_id: sellerId, action: actionType, reason });
      showToast(`Seller ${actionType}d successfully.`, 'success');
      fetchSellers();
    } catch {
      showToast('Action failed.', 'error');
    }
  };

  if (loading) return <SkeletonTable rows={5} cols={5} />;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Seller Applications ({sellers.length})</h2>

      {sellers.length === 0 ? (
        <EmptyState title="No pending applications" description="All seller applications have been reviewed." />
      ) : (
        <div className="space-y-4">
          {sellers.map(seller => (
            <div key={seller.id} className="bg-white rounded-xl border p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{seller.store_name}</h3>
                  <p className="text-sm text-gray-500">{seller.full_name} • {seller.email}</p>
                  <p className="text-sm text-gray-500">{seller.barangay_name}, Bago City • {seller.contact_number}</p>
                  <p className="text-xs text-gray-400 mt-1">Applied: {new Date(seller.created_at).toLocaleDateString('en-PH')}</p>
                </div>
                <StatusBadge status={seller.approval_status} type="general" />
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={() => handleAction(seller.id, 'approve')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                  <CheckCircle size={14} /> Approve
                </button>
                <button onClick={() => { setAction({ seller: seller.id, type: 'reject', reason: '' }); setShowReject(true); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                  <XCircle size={14} /> Reject
                </button>
                <button onClick={() => setSelectedSeller(seller)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
                  <Eye size={14} /> View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      <Modal isOpen={showReject} onClose={() => setShowReject(false)} title="Reject Seller Application" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason *</label>
            <textarea value={action.reason} onChange={(e) => setAction({ ...action, reason: e.target.value })} rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none resize-none" placeholder="Provide a reason..." />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowReject(false)} className="flex-1 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={() => { handleAction(action.seller, 'reject', action.reason); setShowReject(false); }}
              className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Reject</button>
          </div>
        </div>
      </Modal>

      {/* View Detail Modal */}
      <Modal isOpen={!!selectedSeller} onClose={() => setSelectedSeller(null)} title="Seller Details" size="md">
        {selectedSeller && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-gray-500">Name:</span><span className="font-medium">{selectedSeller.full_name}</span>
              <span className="text-gray-500">Email:</span><span>{selectedSeller.email}</span>
              <span className="text-gray-500">Contact:</span><span>{selectedSeller.contact_number}</span>
              <span className="text-gray-500">Store:</span><span className="font-medium">{selectedSeller.store_name}</span>
              <span className="text-gray-500">Barangay:</span><span>{selectedSeller.barangay_name}</span>
              <span className="text-gray-500">Applied:</span><span>{new Date(selectedSeller.created_at).toLocaleDateString('en-PH')}</span>
            </div>
            {selectedSeller.store_description && (
              <div><span className="text-gray-500">Description:</span><p className="mt-1">{selectedSeller.store_description}</p></div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
