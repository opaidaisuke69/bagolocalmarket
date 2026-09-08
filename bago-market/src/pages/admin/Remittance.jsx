import { useState, useEffect, useRef } from 'react';
import { Search, CheckCircle, XCircle, Plus, Trash2, QrCode, Upload } from 'lucide-react';
import { adminAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/Skeleton';

const IMAGE_BASE = import.meta.env.PROD ? '/server' : '';
const fmt  = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const fmtN = (n) => Number(n || 0).toLocaleString('en-PH');

export default function AdminRemittance() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [status, setStatus]     = useState('pending');
  const [page, setPage]         = useState(1);
  const [selected, setSelected] = useState(null);    // remittance being actioned
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject]     = useState(false);
  const [showQrModal, setShowQrModal]   = useState(false);
  const [qrForm, setQrForm]     = useState({ id: null, label: '', type: 'gcash', account_name: '', account_number: '', qr_code_image: null, is_active: true });
  const fileRef = useRef();
  const { showToast } = useToast();

  const fetchData = async () => {
    try {
      const res = await adminAPI.remittances({ status, page, limit: 20 });
      setData(res.data);
    } catch { showToast('Failed to load remittance data.', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { setLoading(true); fetchData(); }, [status, page]);
  useEffect(() => {
    const t = setInterval(fetchData, 8000);
    return () => clearInterval(t);
  }, [status, page]);

  const handleVerify = async (id) => {
    try {
      await adminAPI.updateRemittance({ remittance_id: id, action: 'verify' });
      showToast('Remittance verified.', 'success');
      fetchData();
    } catch { showToast('Action failed.', 'error'); }
  };

  const handleReject = async () => {
    try {
      await adminAPI.updateRemittance({ remittance_id: selected.id, action: 'reject', reason: rejectReason });
      showToast('Remittance rejected.', 'success');
      setShowReject(false);
      setSelected(null);
      fetchData();
    } catch { showToast('Action failed.', 'error'); }
  };

  const handleQrImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setQrForm(f => ({ ...f, qr_code_image: reader.result }));
    reader.readAsDataURL(file);
  };

  const saveQrCode = async () => {
    if (!qrForm.label || !qrForm.account_name || !qrForm.account_number) {
      showToast('Label, account name, and number are required.', 'warning'); return;
    }
    try {
      await adminAPI.addQrCode(qrForm);
      showToast(qrForm.id ? 'QR code updated.' : 'QR code added.', 'success');
      setShowQrModal(false);
      setQrForm({ id: null, label: '', type: 'gcash', account_name: '', account_number: '', qr_code_image: null, is_active: true });
      fetchData();
    } catch { showToast('Failed to save QR code.', 'error'); }
  };

  const deleteQr = async (id) => {
    if (!confirm('Remove this QR code?')) return;
    try {
      await adminAPI.deleteQrCode(id);
      showToast('QR code removed.', 'success');
      fetchData();
    } catch { showToast('Failed to remove.', 'error'); }
  };

  const tabs = [
    { label: 'Pending',  value: 'pending' },
    { label: 'Verified', value: 'verified' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'All',      value: '' },
  ];

  const typeColors = { gcash: 'bg-blue-100 text-blue-700', maya: 'bg-green-100 text-green-700', bank: 'bg-gray-100 text-gray-700', others: 'bg-purple-100 text-purple-700' };

  return (
    <div className="space-y-5">

      {/* Summary cards */}
      {data?.summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-xs text-yellow-600 font-medium">Pending</p>
            <p className="text-xl font-bold text-yellow-800">₱{fmt(data.summary.pending)}</p>
            <p className="text-xs text-yellow-500">{fmtN(data.summary.pending_count)} submissions</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs text-green-600 font-medium">Verified</p>
            <p className="text-xl font-bold text-green-800">₱{fmt(data.summary.verified)}</p>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs text-gray-500 font-medium">QR Codes</p>
            <p className="text-xl font-bold text-gray-900">{data.qr_codes?.length || 0}</p>
            <button onClick={() => { setQrForm({ id: null, label: '', type: 'gcash', account_name: '', account_number: '', qr_code_image: null, is_active: true }); setShowQrModal(true); }}
              className="text-xs text-primary-800 hover:underline mt-1 flex items-center gap-1">
              <Plus size={11} /> Add QR
            </button>
          </div>
        </div>
      )}

      {/* Admin QR codes section */}
      {(data?.qr_codes || []).length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><QrCode size={16} /> Remittance QR Codes</h3>
            <button onClick={() => { setQrForm({ id: null, label: '', type: 'gcash', account_name: '', account_number: '', qr_code_image: null, is_active: true }); setShowQrModal(true); }}
              className="text-sm text-primary-800 border border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-50 flex items-center gap-1">
              <Plus size={13} /> Add
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.qr_codes.map(qr => (
              <div key={qr.id} className={`border rounded-xl p-4 ${qr.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                <div className="flex items-start gap-3">
                  {qr.qr_code_image ? (
                    <img src={`${IMAGE_BASE}${qr.qr_code_image}`} alt="QR" className="w-16 h-16 object-cover rounded-lg border" />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">📱</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-gray-900">{qr.label}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${typeColors[qr.type] || typeColors.others}`}>{qr.type}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{qr.account_name}</p>
                    <p className="text-xs font-semibold text-primary-800">{qr.account_number}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => { setQrForm({ id: qr.id, label: qr.label, type: qr.type, account_name: qr.account_name, account_number: qr.account_number, qr_code_image: qr.qr_code_image, is_active: qr.is_active }); setShowQrModal(true); }}
                    className="flex-1 py-1.5 border rounded-lg text-xs text-gray-600 hover:bg-gray-50">Edit</button>
                  <button onClick={() => deleteQr(qr.id)}
                    className="p-1.5 border border-red-100 rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Remittance submissions table */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-semibold text-gray-900">Rider Remittances</h3>
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            {tabs.map(t => (
              <button key={t.value} onClick={() => { setStatus(t.value); setPage(1); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${status === t.value ? 'bg-white shadow text-primary-800' : 'text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? <div className="p-8 text-center text-gray-400 text-sm">Loading...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Rider</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Period</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Method</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Receipt</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(!data?.remittances || data.remittances.length === 0) ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400">No remittances found.</td></tr>
                ) : data.remittances.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.rider_name}</p>
                      <p className="text-xs text-gray-400">{r.rider_contact}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">₱{fmt(r.amount)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {r.period_start}<br/>{r.period_end !== r.period_start ? `→ ${r.period_end}` : ''}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      <p>{r.payment_method || '—'}</p>
                      {r.reference_number && <p className="text-gray-400">#{r.reference_number}</p>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold
                        ${r.status === 'verified' ? 'bg-green-100 text-green-700'
                        : r.status === 'rejected' ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'}`}>
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.receipt_image && (
                        <a href={`${IMAGE_BASE}${r.receipt_image}`} target="_blank" rel="noopener noreferrer">
                          <img src={`${IMAGE_BASE}${r.receipt_image}`} alt="Receipt"
                            className="w-12 h-12 object-cover rounded-lg border hover:opacity-80 transition-opacity" />
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'pending' && (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleVerify(r.id)}
                            className="p-1.5 hover:bg-green-50 rounded text-green-600" title="Verify">
                            <CheckCircle size={15} />
                          </button>
                          <button onClick={() => { setSelected(r); setRejectReason(''); setShowReject(true); }}
                            className="p-1.5 hover:bg-red-50 rounded text-red-500" title="Reject">
                            <XCircle size={15} />
                          </button>
                        </div>
                      )}
                      {r.status === 'rejected' && r.rejection_reason && (
                        <p className="text-xs text-red-400 max-w-[120px] truncate">{r.rejection_reason}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data?.total_pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t text-sm">
            <span className="text-gray-500">Page {page} of {data.total_pages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Prev</button>
              <button disabled={page >= data.total_pages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Reject modal */}
      <Modal isOpen={showReject} onClose={() => setShowReject(false)} title="Reject Remittance" size="sm">
        <div className="space-y-4">
          {selected && <p className="text-sm text-gray-600">Rejecting ₱{fmt(selected.amount)} from {selected.rider_name}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
              placeholder="e.g. Amount does not match records…"
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800 resize-none" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowReject(false)} className="flex-1 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={handleReject} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Reject</button>
          </div>
        </div>
      </Modal>

      {/* QR code modal */}
      <Modal isOpen={showQrModal} onClose={() => setShowQrModal(false)} title={qrForm.id ? 'Edit QR Code' : 'Add Remittance QR Code'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Label *</label>
            <input type="text" placeholder="e.g. GCash - Admin" value={qrForm.label}
              onChange={e => setQrForm(f => ({ ...f, label: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={qrForm.type} onChange={e => setQrForm(f => ({ ...f, type: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800">
              <option value="gcash">GCash</option>
              <option value="maya">Maya</option>
              <option value="bank">Bank</option>
              <option value="others">Others</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Name *</label>
            <input type="text" value={qrForm.account_name}
              onChange={e => setQrForm(f => ({ ...f, account_name: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Number *</label>
            <input type="text" value={qrForm.account_number}
              onChange={e => setQrForm(f => ({ ...f, account_number: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">QR Code Image</label>
            <input type="file" ref={fileRef} accept="image/*" onChange={handleQrImage} className="hidden" />
            {qrForm.qr_code_image && (qrForm.qr_code_image.startsWith('data:') || qrForm.qr_code_image.startsWith('/')) ? (
              <div className="flex items-center gap-3">
                <img src={qrForm.qr_code_image.startsWith('/') ? `${IMAGE_BASE}${qrForm.qr_code_image}` : qrForm.qr_code_image}
                  alt="QR" className="w-20 h-20 object-cover rounded-lg border" />
                <button onClick={() => fileRef.current.click()}
                  className="flex-1 py-2 border rounded-lg text-xs text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1">
                  <Upload size={13} /> Change
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current.click()}
                className="w-full py-5 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center gap-2 hover:border-primary-800 transition">
                <QrCode size={24} className="text-gray-400" />
                <span className="text-xs text-gray-500">Upload QR code image</span>
              </button>
            )}
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={qrForm.is_active} onChange={e => setQrForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
            <span className="text-sm text-gray-600">Active (visible to riders)</span>
          </label>
          <div className="flex gap-3">
            <button onClick={() => setShowQrModal(false)} className="flex-1 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={saveQrCode} className="flex-1 py-2.5 bg-primary-800 text-white rounded-lg text-sm font-medium hover:bg-primary-900">Save</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
