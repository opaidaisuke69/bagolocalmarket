import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, Search, Ban, RefreshCw,
  ShieldOff, ChevronLeft, ChevronRight, X, Filter
} from 'lucide-react';
import { adminAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { SkeletonTable } from '../../components/common/Skeleton';

const SEVERITY_STYLES = {
  low:    'bg-yellow-50 text-yellow-700 border border-yellow-200',
  medium: 'bg-orange-50 text-orange-700 border border-orange-200',
  high:   'bg-red-50 text-red-700 border border-red-200',
};

const ROLE_COLORS = {
  buyer:  'bg-blue-100 text-blue-700',
  seller: 'bg-purple-100 text-purple-700',
  rider:  'bg-cyan-100 text-cyan-700',
};

export default function Warnings() {
  const [warnings,    setWarnings]    = useState([]);
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState('warnings');   // 'warnings' | 'banned'
  const [search,      setSearch]      = useState('');
  const [severity,    setSeverity]    = useState('');
  const [role,        setRole]        = useState('');
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [total,       setTotal]       = useState(0);
  const [actionModal, setActionModal] = useState({ open: false, user: null, action: '', reason: '', severity: 'medium' });
  const { showToast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'warnings') {
        const res = await adminAPI.warnings({ search, severity, page, limit: 20 });
        setWarnings(res.data.warnings || []);
        setTotalPages(res.data.total_pages || 1);
        setTotal(res.data.total || 0);
      } else {
        const res = await adminAPI.users({ status: 'banned', search, role, page, limit: 20 });
        setUsers(res.data.users || []);
        setTotalPages(res.data.total_pages || 1);
        setTotal(res.data.total || 0);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [tab, search, severity, role, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async () => {
    try {
      await adminAPI.updateUser({
        user_id:  actionModal.user.id || actionModal.user.user_id,
        action:   actionModal.action,
        reason:   actionModal.reason,
        severity: actionModal.severity,
      });
      showToast(`Action "${actionModal.action}" completed.`, 'success');
      setActionModal({ open: false, user: null, action: '', reason: '', severity: 'medium' });
      fetchData();
    } catch {
      showToast('Action failed.', 'error');
    }
  };

  const openAction = (user, action) =>
    setActionModal({ open: true, user, action, reason: '', severity: 'medium' });

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Warnings & Bans</h2>
        <p className="text-sm text-gray-500 mt-0.5">Review issued warnings and manage banned accounts</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {[
          { key: 'warnings', label: 'Warning History', icon: AlertTriangle },
          { key: 'banned',   label: 'Banned Accounts', icon: Ban },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPage(1); setSearch(''); }}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-primary-800 text-primary-800' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name or email…"
            className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
        </div>
        {tab === 'warnings' && (
          <select value={severity} onChange={e => { setSeverity(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800">
            <option value="">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        )}
        {tab === 'banned' && (
          <select value={role} onChange={e => { setRole(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800">
            <option value="">All Roles</option>
            <option value="buyer">Buyers</option>
            <option value="seller">Sellers</option>
            <option value="rider">Riders</option>
          </select>
        )}
        <span className="self-center text-sm text-gray-500">{total} record{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Warning History Table */}
      {loading ? <SkeletonTable rows={8} cols={5} /> : tab === 'warnings' ? (
        <>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Role</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Severity</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Reason</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Issued By</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Date</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {warnings.length === 0 ? (
                    <tr><td colSpan={7} className="py-14 text-center">
                      <AlertTriangle size={32} className="mx-auto text-gray-200 mb-2" />
                      <p className="text-gray-400">No warnings on record.</p>
                    </td></tr>
                  ) : warnings.map(w => (
                    <tr key={w.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{w.user_name}</p>
                        <p className="text-xs text-gray-400">{w.user_email}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${ROLE_COLORS[w.user_role] || 'bg-gray-100 text-gray-600'}`}>
                          {w.user_role || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${SEVERITY_STYLES[w.severity] || ''}`}>
                          {w.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-600 max-w-xs truncate" title={w.reason}>{w.reason || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-500">{w.issued_by_name || 'Admin'}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(w.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button title="Suspend user" onClick={() => openAction({ id: w.user_id, full_name: w.user_name }, 'suspend')}
                            className="p-1.5 hover:bg-orange-50 rounded text-orange-500">
                            <ShieldOff size={14} />
                          </button>
                          <button title="Ban user" onClick={() => openAction({ id: w.user_id, full_name: w.user_name }, 'ban')}
                            className="p-1.5 hover:bg-red-50 rounded text-red-500">
                            <Ban size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Banned Accounts Table */
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.length === 0 ? (
                  <tr><td colSpan={5} className="py-14 text-center">
                    <Ban size={32} className="mx-auto text-gray-200 mb-2" />
                    <p className="text-gray-400">No banned accounts found.</p>
                  </td></tr>
                ) : users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{u.full_name}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={u.status} type="general" />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-center">
                      <button title="Reactivate" onClick={() => openAction(u, 'reactivate')}
                        className="flex items-center gap-1 mx-auto px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100">
                        <RefreshCw size={12} /> Reactivate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Page {page} of {totalPages}</span>
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

      {/* Action Modal */}
      <Modal
        isOpen={actionModal.open}
        onClose={() => setActionModal({ open: false, user: null, action: '', reason: '', severity: 'medium' })}
        title={`${actionModal.action.charAt(0).toUpperCase()}${actionModal.action.slice(1)} User`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            User: <strong>{actionModal.user?.full_name}</strong>
          </p>
          {actionModal.action !== 'reactivate' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea value={actionModal.reason}
                onChange={e => setActionModal(a => ({ ...a, reason: e.target.value }))}
                rows={3} placeholder="Provide a reason…"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800 resize-none" />
            </div>
          )}
          {actionModal.action === 'warn' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
              <select value={actionModal.severity}
                onChange={e => setActionModal(a => ({ ...a, severity: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => setActionModal({ open: false, user: null, action: '', reason: '', severity: 'medium' })}
              className="flex-1 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={handleAction}
              className={`flex-1 py-2.5 text-white rounded-lg text-sm font-medium ${
                actionModal.action === 'ban' || actionModal.action === 'suspend' ? 'bg-red-600 hover:bg-red-700' :
                actionModal.action === 'reactivate' ? 'bg-green-600 hover:bg-green-700' :
                'bg-yellow-500 hover:bg-yellow-600'
              }`}>
              Confirm
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
