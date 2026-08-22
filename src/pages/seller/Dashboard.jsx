import { useState, useEffect } from 'react';
import { DollarSign, ShoppingBag, Package, AlertTriangle, TrendingUp, CheckCircle } from 'lucide-react';
import { sellerAPI } from '../../api/services';
import { SkeletonDashboard } from '../../components/common/Skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

export default function SellerDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      const res = await sellerAPI.dashboard();
      setStats(res.data.stats);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  // Silent real-time poll — stats update in background
  useEffect(() => {
    const id = setInterval(fetchDashboard, 3000);
    return () => clearInterval(id);
  }, []);

  if (loading) return <SkeletonDashboard />;

  const statCards = [
    { label: 'Total Sales', value: `₱${Number(stats?.total_sales || 0).toLocaleString()}`, icon: DollarSign, color: 'bg-green-50 text-green-700', iconBg: 'bg-green-100' },
    { label: 'Total Orders', value: stats?.total_orders || 0, icon: ShoppingBag, color: 'bg-blue-50 text-blue-700', iconBg: 'bg-blue-100' },
    { label: 'Pending Orders', value: stats?.pending_orders || 0, icon: AlertTriangle, color: 'bg-yellow-50 text-yellow-700', iconBg: 'bg-yellow-100' },
    { label: 'Total Products', value: stats?.total_products || 0, icon: Package, color: 'bg-purple-50 text-purple-700', iconBg: 'bg-purple-100' },
    { label: 'Low Stock', value: stats?.low_stock || 0, icon: AlertTriangle, color: 'bg-red-50 text-red-700', iconBg: 'bg-red-100' },
    { label: 'Completed', value: stats?.completed_orders || 0, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-700', iconBg: 'bg-emerald-100' },
  ];

  const COLORS = ['#133458', '#112E81', '#0D0B61', '#FFF449', '#FFF78D', '#FEF2A0'];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card, idx) => (
          <div key={idx} className={`${card.color} rounded-xl p-4 border`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium opacity-80">{card.label}</p>
                <p className="text-2xl font-bold mt-1">{card.value}</p>
              </div>
              <div className={`w-10 h-10 ${card.iconBg} rounded-lg flex items-center justify-center`}>
                <card.icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-primary-800" /> Daily Sales (Last 30 Days)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.daily_sales || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => [`₱${Number(value).toLocaleString()}`, 'Sales']} />
                <Line type="monotone" dataKey="sales" stroke="#133458" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Products by Category */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Products by Category</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats?.products_by_category || []} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} label={(entry) => entry.name}>
                  {(stats?.products_by_category || []).map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Top Selling Products</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-gray-500 font-medium">Product</th>
                <th className="text-right py-2 text-gray-500 font-medium">Price</th>
                <th className="text-right py-2 text-gray-500 font-medium">Sold</th>
              </tr>
            </thead>
            <tbody>
              {stats?.top_products?.map((product, idx) => (
                <tr key={idx} className="border-b last:border-0">
                  <td className="py-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded overflow-hidden shrink-0">
                      {product.image && <img src={product.image} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <span className="font-medium text-gray-900 truncate max-w-48">{product.name}</span>
                  </td>
                  <td className="text-right text-gray-600">₱{Number(product.price).toLocaleString()}</td>
                  <td className="text-right font-medium text-gray-900">{product.sold_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
