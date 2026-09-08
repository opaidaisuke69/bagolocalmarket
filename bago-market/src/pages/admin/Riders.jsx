import { useState, useEffect } from 'react';
import { Search, CheckCircle, XCircle, Ban, RefreshCw, Eye, Truck } from 'lucide-react';
import { adminAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/Skeleton';

const IMAGE_BASE = import.meta.env.PROD ? '/server' : '';

const fmt  = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const fmtN = (n) => Number(n || 0).toLocaleString('en-PH');

export default function Riders() {
  const [riders, setRiders]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [status, setStatus]         = useState('pending');
  const [search, setSearch]         = useState('');
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [selected, setSelected]     = useState(null);   // rider being viewed
  const [actionModal, setActionModal] = useState({ open: false, riderId: null, action: '', reason: '' });
  const { showToast } = useToast();

  const fetchRiders = async () => {
    try {
      const res = await adminAPI.riders({ status, search, page, limit: 20 });
      setRiders(res.data.riders);
      setTotalPages(res.data.total_pages);
      setTotal(res.data.total);
    } catch {
      showToast('Failed to load riders.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setLoading(true); fetchRiders(); }, [status, search, page]);
  useEffect(() => {
    const t = setInterval(fetchRiders, 5000);
    return () => clearInterval(t);
  }, [status, search, page]);

  const handleAction = async () => {
    try {
      await adminAPI.updateRider({
        rider_id: actionModal.riderId,
        action:   actionModal.action,
        reason:   actionModal.reason,
      });
      showToast(`Rider ${actionModal.action} completed.`, 'success');
      setSelected(null);
      fetchRiders();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Action failed.', 'error');
    }
    setActionModal({ open: false, riderId: null, action: '', reason: '' });
  };

  const openAction = (rider, action) => {
    setActionModal({ open: true, riderId: rider.id, action, reason: '' });
  };

  const tabs = [
    { label: 'Pending',   value: 'pending' },
    { label: 'Approved',  value: 'approved' },
    { label: 'Rejected',  value: 'rejected' },
    { label: 'All',       value: '' },
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
          <input type="text" placeholder="Search name or email…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
        </div>
        <span className="text-sm text-gray-500">{total} rider{total !== 1 ? 's' : ''}</span>
      </div>

      {loading ? <SkeletonTable rows={6} cols={6} /> : (
        <>
          {riders.length === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
              <Truck size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No riders found.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Rider</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Deliveries</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Earned</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {riders.map(rider => (
                      <tr key={rider.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{rider.full_name}</p>
                          <p className="text-xs text-gray-400">{rider.email}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{rider.contact_number}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold
                            ${rider.approval_status === 'approved' ? 'bg-green-100 text-green-700'
                            : rider.approval_status === 'rejected' ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'}`}>
                            {rider.approval_status || 'pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmtN(rider.total_deliveries)}</td>
                        <td className="px-4 py-3 text-right font-medium text-green-700">₱{fmt(rider.total_earned)}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {new Date(rider.created_at).toLocaleDateString('en-PH')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button title="View credentials" onClick={() => setSelected(rider)}
                              className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><Eye size={14} /></button>
                            {rider.approval_status === 'pending' && <>
                              <button title="Approve" onClick={() => openAction(rider, 'approve')}
                                className="p-1.5 hover:bg-green-50 rounded text-green-600"><CheckCircle size={14} /></button>
                              <button title="Reject" onClick={() => openAction(rider, 'reject')}
                                className="p-1.5 hover:bg-red-50 rounded text-red-500"><XCircle size={14} /></button>
                            </>}
                            {rider.account_status !== 'banned' && rider.approval_status === 'approved' && (
                              <button title="Ban" onClick={() => openAction(rider, 'ban')}
                                className="p-1.5 hover:bg-red-50 rounded text-red-600"><Ban size={14} /></button>
                            )}
                            {(rider.account_status === 'banned' || rider.account_status === 'suspended') && (
                              <button title="Reactivate" onClick={() => openAction(rider, 'reactivate')}
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

      {/* Credentials Modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Rider Credentials" size="md">
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <span className="text-gray-500">Full Name</span>
              <span className="font-medium">{selected.full_name}</span>
              <span className="text-gray-500">Email</span>
              <span>{selected.email}</span>
              <span className="text-gray-500">Contact</span>
              <span>{selected.contact_number}</span>
              <span className="text-gray-500">Birthdate</span>
              <span>{selected.birthdate ? new Date(selected.birthdate).toLocaleDateString('en-PH') : '—'}</span>
              <span className="text-gray-500">Sex</span>
              <span className="capitalize">{selected.sex || '—'}</span>
              <span className="text-gray-500">Approval</span>
              <span className={`font-semibold ${selected.approval_status === 'approved' ? 'text-green-600' : selected.approval_status === 'rejected' ? 'text-red-600' : 'text-yellow-600'}`}>
                {selected.approval_status || 'pending'}
              </span>
              <span className="text-gray-500">Account Status</span>
              <span className="capitalize">{selected.account_status}</span>
              <span className="text-gray-500">Total Deliveries</span>
              <span className="font-medium">{fmtN(selected.total_deliveries)}</span>
              <span className="text-gray-500">Total Earned</span>
              <span className="font-medium text-green-700">₱{fmt(selected.total_earned)}</span>
              <span className="text-gray-500">Registered</span>
              <span>{new Date(selected.created_at).toLocaleDateString('en-PH')}</span>
            </div>

            {selected.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                <p className="font-semibold mb-1">Rejection Reason:</p>
                <p>{selected.rejection_reason}</p>
              </div>
            )}

            {/* Document images */}
            <div className="grid grid-cols-2 gap-4">
              {selected.driver_license_image && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Driver's License</p>
                  <a href={`${IMAGE_BASE}${selected.driver_license_image}`} target="_blank" rel="noopener noreferrer">
                    <img src={`${IMAGE_BASE}${selected.driver_license_image}`}
                      alt="Driver's license"
                      className="w-full h-36 object-cover rounded-lg border hover:opacity-90 transition-opacity" />
                  </a>
                </div>
              )}
              {selected.motorcycle_registration_image && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Motorcycle Registration</p>
                  <a href={`${IMAGE_BASE}${selected.motorcycle_registration_image}`} target="_blank" rel="noopener noreferrer">
                    <img src={`${IMAGE_BASE}${selected.motorcycle_registration_image}`}
                      alt="Motorcycle registration"
                      className="w-full h-36 object-cover rounded-lg border hover:opacity-90 transition-opacity" />
                  </a>
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 pt-2 border-t">
              {selected.approval_status === 'pending' && <>
                <button onClick={() => { openAction(selected, 'approve'); setSelected(null); }}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                  Approve
                </button>
                <button onClick={() => { openAction(selected, 'reject'); setSelected(null); }}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                  Reject
                </button>
              </>}
              {selected.account_status === 'active' && selected.approval_status === 'approved' && (
                <button onClick={() => { openAction(selected, 'ban'); setSelected(null); }}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                  Ban Rider
                </button>
              )}
              {(selected.account_status === 'banned' || selected.account_status === 'suspended') && (
                <button onClick={() => { openAction(selected, 'reactivate'); setSelected(null); }}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                  Reactivate
                </button>
              )}
              <button onClick={() => setSelected(null)}
                className="flex-1 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Action confirm modal */}
      <Modal isOpen={actionModal.open}
        onClose={() => setActionModal({ open: false, riderId: null, action: '', reason: '' })}
        title={`${actionModal.action.charAt(0).toUpperCase()}${actionModal.action.slice(1)} Rider`}
        size="sm">
        <div className="space-y-4">
          {actionModal.action !== 'approve' && actionModal.action !== 'reactivate' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea value={actionModal.reason}
                onChange={(e) => setActionModal({ ...actionModal, reason: e.target.value })}
                rows={3} placeholder="Provide a reason…"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800 resize-none" />
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => setActionModal({ open: false, riderId: null, action: '', reason: '' })}
              className="flex-1 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={handleAction}
              className={`flex-1 py-2.5 text-white rounded-lg text-sm font-medium
                ${actionModal.action === 'approve' || actionModal.action === 'reactivate' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              Confirm
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
