import { useState, useEffect } from 'react';
import { Users, UserCheck, Package, ShoppingBag, DollarSign, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { adminAPI } from '../../api/services';
import { SkeletonDashboard } from '../../components/common/Skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      const res = await adminAPI.dashboard();
      setStats(res.data.stats);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  // Real-time polling
  useEffect(() => {
    const interval = setInterval(fetchDashboard, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <SkeletonDashboard />;

  const statCards = [
    { label: 'Total Buyers', value: stats?.total_buyers || 0, icon: Users, color: 'text-blue-700', bg: 'bg-blue-50', iconBg: 'bg-blue-100' },
    { label: 'Total Sellers', value: stats?.total_sellers || 0, icon: UserCheck, color: 'text-purple-700', bg: 'bg-purple-50', iconBg: 'bg-purple-100' },
    { label: 'Pending Sellers', value: stats?.pending_sellers || 0, icon: AlertTriangle, color: 'text-yellow-700', bg: 'bg-yellow-50', iconBg: 'bg-yellow-100' },
    { label: 'Total Products', value: stats?.total_products || 0, icon: Package, color: 'text-indigo-700', bg: 'bg-indigo-50', iconBg: 'bg-indigo-100' },
    { label: 'Pending Products', value: stats?.pending_products || 0, icon: Package, color: 'text-orange-700', bg: 'bg-orange-50', iconBg: 'bg-orange-100' },
    { label: 'Total Orders', value: stats?.total_orders || 0, icon: ShoppingBag, color: 'text-cyan-700', bg: 'bg-cyan-50', iconBg: 'bg-cyan-100' },
    { label: 'Completed Orders', value: stats?.completed_orders || 0, icon: CheckCircle, color: 'text-green-700', bg: 'bg-green-50', iconBg: 'bg-green-100' },
    { label: 'Marketplace GMV', value: `₱${Number(stats?.total_gmv || 0).toLocaleString()}`, icon: DollarSign, color: 'text-emerald-700', bg: 'bg-emerald-50', iconBg: 'bg-emerald-100' },
  ];

  const COLORS = ['#133458', '#112E81', '#0D0B61', '#FFF449', '#FFF78D', '#FEF2A0', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <div key={idx} className={`${card.bg} rounded-xl p-4 border`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-medium ${card.color} opacity-80`}>{card.label}</p>
                <p className={`text-2xl font-bold ${card.color} mt-1`}>{card.value}</p>
              </div>
              <div className={`w-10 h-10 ${card.iconBg} rounded-lg flex items-center justify-center`}>
                <card.icon size={20} className={card.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders Chart */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Orders & Revenue (Last 30 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.orders_chart || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" name="Orders" stroke="#133458" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#FFF449" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Status Distribution */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Order Status Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats?.order_status_distribution || []} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} label={(e) => e.status}>
                  {(stats?.order_status_distribution || []).map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Buyer Growth */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Buyer Growth (12 Months)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.buyer_growth || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#133458" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Seller Growth */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Seller Growth (12 Months)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.seller_growth || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#112E81" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Categories */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Top Categories</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2 text-gray-500 font-medium">Category</th>
                <th className="text-right py-2 text-gray-500 font-medium">Products</th>
                <th className="text-right py-2 text-gray-500 font-medium">Total Sold</th>
              </tr>
            </thead>
            <tbody>
              {stats?.top_categories?.map((cat, idx) => (
                <tr key={idx} className="border-b last:border-0">
                  <td className="py-2.5 font-medium text-gray-900">{cat.name}</td>
                  <td className="py-2.5 text-right text-gray-600">{cat.product_count}</td>
                  <td className="py-2.5 text-right font-medium text-gray-900">{cat.total_sold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
