import { useState, useEffect } from 'react';
import { Search, AlertTriangle, Ban, RefreshCw, ShieldOff, Eye } from 'lucide-react';
import { adminAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/Skeleton';

export default function AdminUsers() {
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [role, setRole]             = useState('');
  const [status, setStatus]         = useState('');
  const [search, setSearch]         = useState('');
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [selected, setSelected]     = useState(null);
  const [actionModal, setActionModal] = useState({ open: false, userId: null, action: '', reason: '', severity: 'medium' });
  const { showToast } = useToast();

  const fetchUsers = async () => {
    try {
      const res = await adminAPI.users({ role, status, search, page, limit: 20 });
      setUsers(res.data.users);
      setTotalPages(res.data.total_pages);
      setTotal(res.data.total);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { setLoading(true); fetchUsers(); }, [role, status, search, page]);
  useEffect(() => {
    const t = setInterval(fetchUsers, 5000);
    return () => clearInterval(t);
  }, [role, status, search, page]);

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

  const actionColor = (a) => {
    if (a === 'ban' || a === 'suspend') return 'bg-red-600 hover:bg-red-700';
    if (a === 'warn') return 'bg-yellow-500 hover:bg-yellow-600';
    return 'bg-green-600 hover:bg-green-700';
  };

  const roleColor = (r) => {
    if (r === 'admin')  return 'bg-red-100 text-red-700';
    if (r === 'seller') return 'bg-purple-100 text-purple-700';
    if (r === 'rider')  return 'bg-cyan-100 text-cyan-700';
    return 'bg-blue-100 text-blue-700';
  };

  return (
    <div className="space-y-4">

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name or email…"
            className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
        </div>
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800">
          <option value="">All Roles</option>
          <option value="buyer">Buyers</option>
          <option value="seller">Sellers</option>
          <option value="rider">Riders</option>
          <option value="admin">Admins</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="warning">Warning</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
        <span className="self-center text-sm text-gray-500">{total} user{total !== 1 ? 's' : ''}</span>
      </div>

      {loading ? <SkeletonTable rows={8} cols={6} /> : (
        <>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Role</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Last Login</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-400">No users found.</td></tr>
                  ) : users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{user.full_name}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${roleColor(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={user.status} type="general" />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString('en-PH') : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(user.created_at).toLocaleDateString('en-PH')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button title="Warn" onClick={() => openAction(user, 'warn')}
                            className="p-1.5 hover:bg-yellow-50 rounded text-yellow-600" disabled={user.status === 'banned'}>
                            <AlertTriangle size={14} />
                          </button>
                          <button title="Suspend" onClick={() => openAction(user, 'suspend')}
                            className="p-1.5 hover:bg-orange-50 rounded text-orange-600" disabled={user.status === 'banned'}>
                            <ShieldOff size={14} />
                          </button>
                          <button title="Ban" onClick={() => openAction(user, 'ban')}
                            className="p-1.5 hover:bg-red-50 rounded text-red-600" disabled={user.status === 'banned'}>
                            <Ban size={14} />
                          </button>
                          {(user.status === 'banned' || user.status === 'suspended' || user.status === 'warning') && (
                            <button title="Reactivate" onClick={() => openAction(user, 'reactivate')}
                              className="p-1.5 hover:bg-green-50 rounded text-green-600">
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

      {/* Action Modal */}
      <Modal isOpen={actionModal.open}
        onClose={() => setActionModal({ open: false, userId: null, action: '', reason: '', severity: 'medium' })}
        title={`${actionModal.action.charAt(0).toUpperCase()}${actionModal.action.slice(1)} User`}
        size="sm">
        <div className="space-y-4">
          {actionModal.action !== 'reactivate' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea value={actionModal.reason}
                onChange={(e) => setActionModal({ ...actionModal, reason: e.target.value })}
                rows={3} placeholder="Provide a reason…"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800 resize-none" />
            </div>
          )}
          {actionModal.action === 'warn' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
              <select value={actionModal.severity}
                onChange={(e) => setActionModal({ ...actionModal, severity: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => setActionModal({ open: false, userId: null, action: '', reason: '', severity: 'medium' })}
              className="flex-1 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={handleAction}
              className={`flex-1 py-2.5 text-white rounded-lg text-sm font-medium ${actionColor(actionModal.action)}`}>
              Confirm {actionModal.action.charAt(0).toUpperCase()}{actionModal.action.slice(1)}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
