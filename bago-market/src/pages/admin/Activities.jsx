import { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Search, User, ChevronLeft, ChevronRight, X, Wifi, WifiOff } from 'lucide-react';
import { adminAPI } from '../../api/services';
import { SkeletonTable } from '../../components/common/Skeleton';

const ACTION_COLORS = {
  approve:          'bg-green-100 text-green-700',
  reject:           'bg-red-100 text-red-700',
  ban:              'bg-red-100 text-red-800 font-bold',
  suspend:          'bg-orange-100 text-orange-700',
  warn:             'bg-yellow-100 text-yellow-700',
  reactivate:       'bg-blue-100 text-blue-700',
  create:           'bg-purple-100 text-purple-700',
  update:           'bg-cyan-100 text-cyan-700',
  delete:           'bg-gray-100 text-gray-700',
  release:          'bg-green-100 text-green-700',
  processing:       'bg-indigo-100 text-indigo-700',
  cancel:           'bg-red-100 text-red-600',
  verify:           'bg-teal-100 text-teal-700',
  hide:             'bg-gray-100 text-gray-600',
  remove:           'bg-red-50 text-red-500',
  product_approve:  'bg-green-100 text-green-700',
  product_reject:   'bg-red-100 text-red-700',
  product_hide:     'bg-gray-100 text-gray-600',
  product_remove:   'bg-red-50 text-red-500',
};

const TARGET_ICONS = {
  seller:      '🏪',
  product:     '📦',
  user:        '👤',
  rider:       '🚴',
  order:       '🛒',
  payout:      '💰',
  remittance:  '💳',
  category:    '🏷️',
  settings:    '⚙️',
  account:     '🔐',
};

const POLL_INTERVAL = 8000; // 8 s real-time poll

export default function Activities() {
  const [activities,  setActivities]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [actionFilt,  setActionFilt]  = useState('');
  const [targetFilt,  setTargetFilt]  = useState('');
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [total,       setTotal]       = useState(0);
  const [allActions,  setAllActions]  = useState([]);
  const [allTargets,  setAllTargets]  = useState([]);
  const [live,        setLive]        = useState(true);   // real-time on/off
  const [lastPoll,    setLastPoll]    = useState(null);   // Date of last poll
  const [newCount,    setNewCount]    = useState(0);      // new rows since last page load
  const latestTsRef   = useRef(0);   // highest created_at ts seen
  const pollTimerRef  = useRef(null);
  const isPage1       = page === 1 && !search && !actionFilt && !targetFilt;

  // ── Full fetch (page change / filter change) ─────────────────────────────
  const fetchFull = useCallback(async (resetNew = false) => {
    setLoading(true);
    try {
      const res = await adminAPI.activities({
        page,
        limit: 50,
        search,
        action_filter: actionFilt,
        target_type:   targetFilt,
      });
      const data = res.data;
      setActivities(data.activities || []);
      setTotalPages(data.total_pages || 1);
      setTotal(data.total || 0);
      if (data.all_actions?.length) setAllActions(data.all_actions);
      if (data.all_targets?.length) setAllTargets(data.all_targets);
      if (data.latest_ts)           latestTsRef.current = data.latest_ts;
      if (resetNew)                 setNewCount(0);
      setLastPoll(new Date());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [page, search, actionFilt, targetFilt]);

  // ── Real-time incremental poll (page 1 only, no filters) ─────────────────
  const pollNew = useCallback(async () => {
    if (!isPage1 || !live) return;
    try {
      const res = await adminAPI.activities({
        page:    1,
        limit:   50,
        since:   latestTsRef.current,
      });
      const data  = res.data;
      const fresh = data.activities || [];
      if (fresh.length === 0) { setLastPoll(new Date()); return; }

      // Prepend new rows, keep total under 200 to avoid memory leak
      setActivities(prev => {
        const merged = [...fresh, ...prev];
        return merged.slice(0, 200);
      });
      setTotal(t => t + fresh.length);
      setNewCount(c => c + fresh.length);
      latestTsRef.current = data.latest_ts || latestTsRef.current;
      setLastPoll(new Date());
    } catch { /* silent */ }
  }, [isPage1, live]);

  // Initial load
  useEffect(() => { fetchFull(true); }, [fetchFull]);

  // Poll timer
  useEffect(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (live) {
      pollTimerRef.current = setInterval(pollNew, POLL_INTERVAL);
    }
    return () => clearInterval(pollTimerRef.current);
  }, [live, pollNew]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, actionFilt, targetFilt]);

  const clearFilters = () => { setSearch(''); setActionFilt(''); setTargetFilt(''); setPage(1); };
  const hasFilters   = search || actionFilt || targetFilt;

  const formatDate = (d) =>
    new Date(d).toLocaleString('en-PH', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

  const relativeTime = (d) => {
    const secs = Math.floor((Date.now() - new Date(d)) / 1000);
    if (secs < 60)   return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400)return `${Math.floor(secs / 3600)}h ago`;
    return formatDate(d);
  };

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Activity Log</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-gray-500">{total.toLocaleString()} admin actions recorded</p>
            {lastPoll && (
              <span className="text-xs text-gray-400">
                · updated {relativeTime(lastPoll)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live toggle */}
          <button
            onClick={() => setLive(l => !l)}
            title={live ? 'Pause real-time updates' : 'Resume real-time updates'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              live
                ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            {live ? <Wifi size={13} /> : <WifiOff size={13} />}
            {live ? 'Live' : 'Paused'}
            {live && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
          </button>

          {/* New rows badge */}
          {newCount > 0 && (
            <button
              onClick={() => { setNewCount(0); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              ↑ {newCount} new
            </button>
          )}
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 p-4 bg-white rounded-xl border">
        {/* Search — server-side */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search admin name, action, details…"
            className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800"
          />
        </div>

        {/* Action filter */}
        <select
          value={actionFilt}
          onChange={e => setActionFilt(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800"
        >
          <option value="">All Actions</option>
          {allActions.map(a => (
            <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1).replace(/_/g, ' ')}</option>
          ))}
        </select>

        {/* Target type filter */}
        <select
          value={targetFilt}
          onChange={e => setTargetFilt(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800"
        >
          <option value="">All Targets</option>
          {allTargets.map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>

        {/* Clear */}
        {hasFilters && (
          <button onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {loading ? <SkeletonTable rows={8} cols={5} /> : (
        <>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Date & Time</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Admin</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Target</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activities.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-14">
                        <Activity size={36} className="mx-auto text-gray-200 mb-2" />
                        <p className="text-gray-400 text-sm">No activity records found.</p>
                      </td>
                    </tr>
                  ) : activities.map((act, idx) => {
                    // highlight rows that arrived via real-time poll
                    const isNew = newCount > 0 && idx < newCount;
                    return (
                      <tr key={act.id} className={`transition-colors ${isNew ? 'bg-blue-50/60' : 'hover:bg-gray-50/60'}`}>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          <p className="font-medium text-gray-600">{relativeTime(act.created_at)}</p>
                          <p className="text-[10px]">{formatDate(act.created_at)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                              <User size={13} className="text-primary-700" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-xs leading-tight">{act.full_name || 'System'}</p>
                              <p className="text-[10px] text-gray-400 capitalize">{act.role || 'admin'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${ACTION_COLORS[act.action] || 'bg-gray-100 text-gray-600'}`}>
                            {(act.action || '—').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-gray-600 text-xs whitespace-nowrap">
                            <span>{TARGET_ICONS[act.target_type] || '📋'}</span>
                            <span className="capitalize">{act.target_type || '—'}</span>
                            {act.target_id && act.target_id !== '0' && (
                              <span className="text-gray-400">#{act.target_id}</span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="text-xs text-gray-500 truncate" title={act.details}>
                            {act.details || '—'}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Page {page} of {totalPages} · {total.toLocaleString()} records</span>
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
    </div>
  );
}
