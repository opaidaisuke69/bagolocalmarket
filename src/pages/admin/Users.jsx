import { useState, useEffect } from 'react';
import { Search, AlertTriangle, Ban, RefreshCw } from 'lucide-react';
import { adminAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/Skeleton';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionModal, setActionModal] = useState({ open: false, userId: null, action: '', reason: '' });
  const { showToast } = useToast();

  const fetchUsers = async () => {
    try {
      const res = await adminAPI.users({ role, status, search, page, limit: 20 });
      setUsers(res.data.users);
      setTotalPages(res.data.total_pages);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setLoading(true); fetchUsers(); }, [role, status, search, page]);

  useEffect(() => {
    const interval = setInterval(fetchUsers, 3000);
    return () => clearInterval(interval);
  }, [role, status, search, page]);

  const handleAction = async () => {
    try {
      await adminAPI.updateUser({ user_id: actionModal.userId, action: actionModal.action, reason: actionModal.reason });
      showToast(`User ${actionModal.action} action completed.`, 'success');
      fetchUsers();
    } catch {
      showToast('Action failed.', 'error');
    }
    setActionModal({ open: false, userId: null, action: '', reason: '' });
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none" />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none">
          <option value="">All Roles</option>
          <option value="buyer">Buyers</option>
          <option value="seller">Sellers</option>
          <option value="admin">Admins</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="warning">Warning</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {loading ? <SkeletonTable rows={8} cols={6} /> : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{user.full_name}</td>
                    <td className="px-4 py-3 text-gray-600">{user.email}</td>
                    <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium capitalize">{user.role}</span></td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={user.status} type="general" /></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(user.created_at).toLocaleDateString('en-PH')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setActionModal({ open: true, userId: user.id, action: 'warn', reason: '' })}
                          className="p-1.5 hover:bg-yellow-50 rounded text-yellow-600" title="Warn"><AlertTriangle size={14} /></button>
                        <button onClick={() => setActionModal({ open: true, userId: user.id, action: 'ban', reason: '' })}
                          className="p-1.5 hover:bg-red-50 rounded text-red-600" title="Ban"><Ban size={14} /></button>
                        {(user.status === 'banned' || user.status === 'suspended') && (
                          <button onClick={() => setActionModal({ open: true, userId: user.id, action: 'reactivate', reason: '' })}
                            className="p-1.5 hover:bg-green-50 rounded text-green-600" title="Reactivate"><RefreshCw size={14} /></button>
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

      {/* Action Modal */}
      <Modal isOpen={actionModal.open} onClose={() => setActionModal({ open: false, userId: null, action: '', reason: '' })} title={`${actionModal.action?.charAt(0).toUpperCase()}${actionModal.action?.slice(1)} User`} size="sm">
        <div className="space-y-4">
          {actionModal.action !== 'reactivate' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea value={actionModal.reason} onChange={(e) => setActionModal({ ...actionModal, reason: e.target.value })} rows={3}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none resize-none" placeholder="Provide a reason..." />
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => setActionModal({ open: false, userId: null, action: '', reason: '' })} className="flex-1 py-2.5 border rounded-lg text-sm font-medium">Cancel</button>
            <button onClick={handleAction}
              className={`flex-1 py-2.5 text-white rounded-lg text-sm font-medium ${actionModal.action === 'ban' ? 'bg-red-600' : actionModal.action === 'warn' ? 'bg-yellow-600' : 'bg-green-600'}`}>
              Confirm
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
