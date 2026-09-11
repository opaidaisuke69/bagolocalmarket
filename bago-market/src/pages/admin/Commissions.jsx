import { useState, useEffect } from 'react';
import { DollarSign, Truck, TrendingUp, ShoppingBag, Search } from 'lucide-react';
import { adminAPI } from '../../api/services';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, LineChart, Line,
} from 'recharts';

const fmt  = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const fmtN = (n) => Number(n || 0).toLocaleString('en-PH');

export default function Commissions() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom]     = useState('');
  const [to, setTo]         = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);

  const fetchData = async () => {
    try {
      const res = await adminAPI.commissions({ from, to, search, page, limit: 20 });
      setData(res.data);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { setLoading(true); fetchData(); }, [from, to, search, page]);

  const summary = data?.summary || {};
  const orders  = data?.orders  || [];

  const summaryCards = [
    { label: 'Total GMV (Buyer Paid)',  value: `₱${fmt(summary.total_gmv)}`,           icon: ShoppingBag, color: 'text-indigo-700', bg: 'bg-indigo-50',
      sub: 'Product subtotal + shipping' },
    { label: 'Seller Subtotal',         value: `₱${fmt(summary.total_seller_subtotal)}`,icon: TrendingUp,  color: 'text-blue-700',   bg: 'bg-blue-50',
      sub: 'Before 2% platform deduction' },
    { label: 'Platform Commission (2%)',value: `₱${fmt(summary.total_commission)}`,     icon: DollarSign,  color: 'text-amber-700',  bg: 'bg-amber-50',
      sub: 'Deducted from seller payout' },
    { label: 'Rider Earnings',          value: `₱${fmt(summary.total_rider_earnings)}`, icon: Truck,       color: 'text-green-700',  bg: 'bg-green-50',
      sub: 'Shipping fees collected' },
  ];

  return (
    <div className="space-y-6">

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((c, i) => (
          <div key={i} className={`${c.bg} rounded-xl p-4 border`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-medium ${c.color} opacity-80`}>{c.label}</p>
                <p className={`text-lg font-bold ${c.color} mt-1`}>{c.value}</p>
                {c.sub && <p className={`text-[10px] opacity-60 ${c.color} mt-0.5`}>{c.sub}</p>}
              </div>
              <c.icon size={20} className={c.color} />
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Chart */}
      {(data?.monthly || []).length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Monthly Commission & Rider Earnings</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => `₱${fmt(v)}`} />
                <Bar dataKey="commission"    name="Commission"    fill="#f59e0b" radius={[4,4,0,0]} />
                <Bar dataKey="rider_earnings"name="Rider Earnings"fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top sellers by commission */}
      {(data?.top_sellers || []).length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Top Sellers by Commission Contribution</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2.5 text-gray-500 font-medium">#</th>
                  <th className="text-left px-3 py-2.5 text-gray-500 font-medium">Store</th>
                  <th className="text-right px-3 py-2.5 text-gray-500 font-medium">Seller Revenue</th>
                  <th className="text-right px-3 py-2.5 text-gray-500 font-medium">Commission (2%)</th>
                  <th className="text-right px-3 py-2.5 text-gray-500 font-medium">Seller Payout</th>
                  <th className="text-right px-3 py-2.5 text-gray-500 font-medium">Orders</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data.top_sellers || []).map((s, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-400 font-medium">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-gray-900">{s.store_name || s.full_name}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700">₱{fmt(s.seller_revenue)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-amber-700">₱{fmt(s.commission_contributed)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-blue-700">
                      ₱{fmt(Number(s.seller_revenue) - Number(s.commission_contributed))}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{fmtN(s.orders_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Order-Level Commission Breakdown</h3>
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search order / buyer..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
          </div>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
          {(from || to || search) && (
            <button onClick={() => { setFrom(''); setTo(''); setSearch(''); setPage(1); }}
              className="px-3 py-2 border rounded-lg text-sm text-gray-500 hover:bg-gray-50">Clear</button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2.5 text-gray-500 font-medium">Order</th>
                  <th className="text-left px-3 py-2.5 text-gray-500 font-medium">Buyer</th>
                  <th className="text-left px-3 py-2.5 text-gray-500 font-medium">Barangay</th>
                  <th className="text-right px-3 py-2.5 text-gray-500 font-medium">Subtotal</th>
                  <th className="text-right px-3 py-2.5 text-gray-500 font-medium">Commission (2%)</th>
                  <th className="text-right px-3 py-2.5 text-gray-500 font-medium">Seller Payout</th>
                  <th className="text-right px-3 py-2.5 text-gray-500 font-medium">Shipping</th>
                  <th className="text-right px-3 py-2.5 text-gray-500 font-medium">Buyer Total</th>
                  <th className="text-left px-3 py-2.5 text-gray-500 font-medium">Rider</th>
                  <th className="text-left px-3 py-2.5 text-gray-500 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-8 text-gray-400">No records found.</td></tr>
                ) : orders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-medium text-primary-800">{o.order_number}</td>
                    <td className="px-3 py-2.5 text-gray-700">{o.buyer_name}</td>
                    <td className="px-3 py-2.5 text-gray-500">{o.delivery_barangay}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">₱{fmt(o.subtotal)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-amber-700">
                      -₱{fmt(o.commission_amount)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-blue-700">
                      ₱{fmt(Number(o.subtotal) - Number(o.commission_amount))}
                    </td>
                    <td className="px-3 py-2.5 text-right text-green-700">₱{fmt(o.delivery_fee)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-gray-900">₱{fmt(o.total_amount)}</td>
                    <td className="px-3 py-2.5 text-gray-500">{o.rider_name || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-400">
                      {new Date(o.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data?.total_pages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t text-sm">
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
    </div>
  );
}
