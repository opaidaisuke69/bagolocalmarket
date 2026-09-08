import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserCheck, Package, ShoppingBag, DollarSign,
  AlertTriangle, CheckCircle, Truck, TrendingUp, Award,
} from 'lucide-react';
import { adminAPI } from '../../api/services';
import { SkeletonDashboard } from '../../components/common/Skeleton';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';

const fmt  = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const fmtN = (n) => Number(n || 0).toLocaleString('en-PH');
const COLORS = ['#133458','#112E81','#1d4ed8','#FFF449','#f59e0b','#10b981','#ef4444','#8b5cf6'];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      const res = await adminAPI.dashboard();
      setStats(res.data.stats);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDashboard(); }, []);
  useEffect(() => {
    const t = setInterval(fetchDashboard, 5000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <SkeletonDashboard />;

  const topCards = [
    { label: 'Total Buyers',      value: fmtN(stats?.total_buyers),     icon: Users,      color: 'text-blue-700',   bg: 'bg-blue-50',   iconBg: 'bg-blue-100' },
    { label: 'Total Sellers',     value: fmtN(stats?.total_sellers),    icon: UserCheck,  color: 'text-purple-700', bg: 'bg-purple-50', iconBg: 'bg-purple-100' },
    { label: 'Total Riders',      value: fmtN(stats?.total_riders),     icon: Truck,      color: 'text-cyan-700',   bg: 'bg-cyan-50',   iconBg: 'bg-cyan-100' },
    { label: 'Total Orders',      value: fmtN(stats?.total_orders),     icon: ShoppingBag,color: 'text-indigo-700', bg: 'bg-indigo-50', iconBg: 'bg-indigo-100' },
    { label: 'Completed Orders',  value: fmtN(stats?.completed_orders), icon: CheckCircle,color: 'text-green-700',  bg: 'bg-green-50',  iconBg: 'bg-green-100' },
    { label: 'Total GMV',         value: `₱${fmt(stats?.total_gmv)}`,   icon: DollarSign, color: 'text-emerald-700',bg: 'bg-emerald-50',iconBg: 'bg-emerald-100' },
    { label: 'Platform Commission',value:`₱${fmt(stats?.total_commission)}`,icon: TrendingUp,color:'text-amber-700',bg:'bg-amber-50',iconBg:'bg-amber-100' },
    { label: 'Rider Earnings',    value: `₱${fmt(stats?.total_rider_earnings)}`, icon: Truck, color: 'text-sky-700', bg: 'bg-sky-50', iconBg: 'bg-sky-100' },
  ];

  const alertCards = [
    { label: 'Pending Sellers', value: stats?.pending_sellers || 0, link: '/admin/seller-applications', color: 'text-yellow-700', bg: 'bg-yellow-50', icon: AlertTriangle },
    { label: 'Pending Riders',  value: stats?.pending_riders  || 0, link: '/admin/riders',              color: 'text-orange-700', bg: 'bg-orange-50', icon: Truck },
    { label: 'Pending Products',value: stats?.pending_products|| 0, link: '/admin/product-approvals',   color: 'text-red-700',    bg: 'bg-red-50',    icon: Package },
    { label: 'Banned Accounts', value: stats?.banned_accounts || 0, link: '/admin/users',              color: 'text-gray-700',   bg: 'bg-gray-100',  icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">

      {/* Alert strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {alertCards.map((c, i) => (
          <Link key={i} to={c.link}
            className={`${c.bg} rounded-xl px-4 py-3 flex items-center justify-between border hover:shadow-sm transition-shadow`}>
            <div>
              <p className={`text-xs font-medium ${c.color}`}>{c.label}</p>
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            </div>
            <c.icon size={20} className={c.color} />
          </Link>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {topCards.map((card, idx) => (
          <div key={idx} className={`${card.bg} rounded-xl p-4 border`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-medium ${card.color} opacity-80`}>{card.label}</p>
                <p className={`text-xl font-bold ${card.color} mt-1`}>{card.value}</p>
              </div>
              <div className={`w-10 h-10 ${card.iconBg} rounded-lg flex items-center justify-center`}>
                <card.icon size={20} className={card.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Orders & Revenue (Last 30 Days)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.orders_chart || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }}
                  tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count"   name="Orders"  stroke="#133458" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Order Status Distribution</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats?.order_status_distribution || []} dataKey="count" nameKey="status"
                  cx="50%" cy="50%" outerRadius={80} label={(e) => e.status}>
                  {(stats?.order_status_distribution || []).map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Buyer Growth (12 Months)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.buyer_growth || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#133458" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Seller Growth (12 Months)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.seller_growth || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#112E81" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Leaderboard tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Most Buyable Products */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Award size={16} className="text-amber-500" /> Most Sold Products
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 text-gray-500">#</th>
                  <th className="text-left py-2 text-gray-500">Product</th>
                  <th className="text-right py-2 text-gray-500">Sold</th>
                  <th className="text-right py-2 text-gray-500">Price</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.top_products || []).map((p, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 text-gray-400 font-medium">{i + 1}</td>
                    <td className="py-2">
                      <p className="font-medium text-gray-900 truncate max-w-[140px]">{p.name}</p>
                      <p className="text-gray-400">{p.store_name}</p>
                    </td>
                    <td className="py-2 text-right font-bold text-primary-800">{fmtN(p.sold_count)}</td>
                    <td className="py-2 text-right text-gray-600">₱{fmt(p.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sellers most products */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package size={16} className="text-purple-500" /> Sellers — Most Products
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 text-gray-500">#</th>
                  <th className="text-left py-2 text-gray-500">Seller</th>
                  <th className="text-right py-2 text-gray-500">Products</th>
                  <th className="text-right py-2 text-gray-500">Total Sold</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.sellers_most_products || []).map((s, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 text-gray-400 font-medium">{i + 1}</td>
                    <td className="py-2">
                      <p className="font-medium text-gray-900 truncate max-w-[140px]">{s.store_name || s.full_name}</p>
                    </td>
                    <td className="py-2 text-right font-bold text-purple-700">{fmtN(s.product_count)}</td>
                    <td className="py-2 text-right text-gray-600">{fmtN(s.total_sold)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sellers most sales */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-green-500" /> Sellers — Most Sales
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 text-gray-500">#</th>
                  <th className="text-left py-2 text-gray-500">Seller</th>
                  <th className="text-right py-2 text-gray-500">Revenue</th>
                  <th className="text-right py-2 text-gray-500">Orders</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.sellers_most_sales || []).map((s, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 text-gray-400 font-medium">{i + 1}</td>
                    <td className="py-2">
                      <p className="font-medium text-gray-900 truncate max-w-[140px]">{s.store_name || s.full_name}</p>
                    </td>
                    <td className="py-2 text-right font-bold text-green-700">₱{fmt(s.total_sales)}</td>
                    <td className="py-2 text-right text-gray-600">{fmtN(s.orders_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sellers most commission */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign size={16} className="text-amber-500" /> Sellers — Most Commission
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 text-gray-500">#</th>
                  <th className="text-left py-2 text-gray-500">Seller</th>
                  <th className="text-right py-2 text-gray-500">Commission</th>
                  <th className="text-right py-2 text-gray-500">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.sellers_most_commission || []).map((s, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 text-gray-400 font-medium">{i + 1}</td>
                    <td className="py-2">
                      <p className="font-medium text-gray-900 truncate max-w-[140px]">{s.store_name || s.full_name}</p>
                    </td>
                    <td className="py-2 text-right font-bold text-amber-700">₱{fmt(s.commission_contributed)}</td>
                    <td className="py-2 text-right text-gray-600">₱{fmt(s.seller_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              {(stats?.top_categories || []).map((cat, idx) => (
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
