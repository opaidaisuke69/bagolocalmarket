import { useState, useEffect, useCallback } from 'react';
import { Search, AlertTriangle, Ban, RefreshCw, ShieldOff, Users } from 'lucide-react';
import { adminAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/Skeleton';

export default function Buyers() {
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [status,      setStatus]      = useState('');
  const [search,      setSearch]      = useState('');
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [total,       setTotal]       = useState(0);
  const [actionModal, setActionModal] = useState({ open: false, userId: null, action: '', reason: '', severity: 'medium' });
  const { showToast } = useToast();

  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await adminAPI.users({ role: 'buyer', status, search, page, limit: 20 });
      setUsers(res.data.users || []);
      setTotalPages(res.data.total_pages || 1);
      setTotal(res.data.total || 0);
    } catch { /* silent */ }
    finally { if (!silent) setLoading(false); }
  }, [status, search, page]);

  // Initial + filter-change load (shows skeleton)
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Silent background polling every 15s (no skeleton flash)
  useEffect(() => {
    const t = setInterval(() => fetchUsers(true), 15_000);
    return () => clearInterval(t);
  }, [fetchUsers]);

  const handleAction = async () => {
    try {
      await adminAPI.updateUser({
        user_id:  actionModal.userId,
        action:   actionModal.action,
        reason:   actionModal.reason,
        severity: actionModal.severity,
      });
      showToast(`User ${actionModal.action} action completed.`, 'success');
      fetchUsers();
    } catch {
      showToast('Action failed.', 'error');
    }
    setActionModal({ open: false, userId: null, action: '', reason: '', severity: 'medium' });
  };

  const openAction = (user, action) =>
    setActionModal({ open: true, userId: user.id, action, reason: '', severity: 'medium' });

  const actionBtnColor = (a) => {
    if (a === 'ban' || a === 'suspend') return 'bg-red-600 hover:bg-red-700';
    if (a === 'warn') return 'bg-yellow-500 hover:bg-yellow-600';
    return 'bg-green-600 hover:bg-green-700';
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never';

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Buyers</h2>
        <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString()} registered buyer{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name or email…"
            className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800"
          />
        </div>
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="warning">Warning</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {/* Table */}
      {loading ? <SkeletonTable rows={8} cols={6} /> : (
        <>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Buyer</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Last Login</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center">
                        <Users size={36} className="mx-auto text-gray-200 mb-2" />
                        <p className="text-gray-400">No buyers found.</p>
                      </td>
                    </tr>
                  ) : users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{user.full_name}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {user.contact_number || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={user.status} type="general" />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {user.last_login_at ? fmtDate(user.last_login_at) : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {fmtDate(user.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            title="Warn"
                            onClick={() => openAction(user, 'warn')}
                            disabled={user.status === 'banned'}
                            className="p-1.5 hover:bg-yellow-50 rounded text-yellow-600 disabled:opacity-30"
                          >
                            <AlertTriangle size={14} />
                          </button>
                          <button
                            title="Suspend"
                            onClick={() => openAction(user, 'suspend')}
                            disabled={user.status === 'banned'}
                            className="p-1.5 hover:bg-orange-50 rounded text-orange-600 disabled:opacity-30"
                          >
                            <ShieldOff size={14} />
                          </button>
                          <button
                            title="Ban"
                            onClick={() => openAction(user, 'ban')}
                            disabled={user.status === 'banned'}
                            className="p-1.5 hover:bg-red-50 rounded text-red-600 disabled:opacity-30"
                          >
                            <Ban size={14} />
                          </button>
                          {(user.status === 'banned' || user.status === 'suspended' || user.status === 'warning') && (
                            <button
                              title="Reactivate"
                              onClick={() => openAction(user, 'reactivate')}
                              className="p-1.5 hover:bg-green-50 rounded text-green-600"
                            >
                              <RefreshCw size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >Prev</button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >Next</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Action Modal */}
      <Modal
        isOpen={actionModal.open}
        onClose={() => setActionModal({ open: false, userId: null, action: '', reason: '', severity: 'medium' })}
        title={`${actionModal.action.charAt(0).toUpperCase()}${actionModal.action.slice(1)} Buyer`}
        size="sm"
      >
        <div className="space-y-4">
          {actionModal.action !== 'reactivate' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea
                value={actionModal.reason}
                onChange={e => setActionModal(a => ({ ...a, reason: e.target.value }))}
                rows={3}
                placeholder="Provide a reason…"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800 resize-none"
              />
            </div>
          )}
          {actionModal.action === 'warn' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
              <select
                value={actionModal.severity}
                onChange={e => setActionModal(a => ({ ...a, severity: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setActionModal({ open: false, userId: null, action: '', reason: '', severity: 'medium' })}
              className="flex-1 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50"
            >Cancel</button>
            <button
              onClick={handleAction}
              className={`flex-1 py-2.5 text-white rounded-lg text-sm font-medium ${actionBtnColor(actionModal.action)}`}
            >
              Confirm {actionModal.action.charAt(0).toUpperCase()}{actionModal.action.slice(1)}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
