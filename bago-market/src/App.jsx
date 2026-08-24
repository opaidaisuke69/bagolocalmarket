import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { CartProvider } from './context/CartContext';
import { AuthModalProvider } from './context/AuthModalContext';
import Toast from './components/common/Toast';
import { PageLoader } from './components/common/LoadingSpinner';

// Layouts
import PublicLayout from './layouts/PublicLayout';
import BuyerLayout from './layouts/BuyerLayout';
import SellerLayout from './layouts/SellerLayout';
import AdminLayout from './layouts/AdminLayout';

// Buyer Pages
import Home from './pages/buyer/Home';
import Marketplace from './pages/buyer/Marketplace';
import ProductDetail from './pages/buyer/ProductDetail';
import Cart from './pages/buyer/Cart';
import Checkout from './pages/buyer/Checkout';
import Orders from './pages/buyer/Orders';
import OrderDetail from './pages/buyer/OrderDetail';
import Wishlist from './pages/buyer/Wishlist';
import Recommendations from './pages/buyer/Recommendations';

// Seller Pages
import SellerDashboard from './pages/seller/Dashboard';
import SellerProducts from './pages/seller/Products';
import AddProduct from './pages/seller/AddProduct';
import EditProduct from './pages/seller/EditProduct';
import SellerOrders from './pages/seller/Orders';
import SellerShipping from './pages/seller/Shipping';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import SellerApprovals from './pages/admin/SellerApprovals';
import ProductApprovals from './pages/admin/ProductApprovals';
import AdminUsers from './pages/admin/Users';

// Route Guards
function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) {
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    if (user.role === 'seller') return <Navigate to="/seller" replace />;
    return <Navigate to="/" replace />;
  }
  return children;
}

// Listens for login events and navigates WITHOUT a page reload
function NavigationHandler() {
  const navigate = useNavigate();
  useEffect(() => {
    const handler = (e) => {
      const { role } = e.detail;
      if (role === 'seller') navigate('/seller');
      else if (role === 'admin') navigate('/admin');
      // buyer stays on current page
    };
    window.addEventListener('app:navigate', handler);
    return () => window.removeEventListener('app:navigate', handler);
  }, [navigate]);
  return null;
}

function AppRoutes() {
  return (
    <>
      <NavigationHandler />
      <Routes>
        {/* Redirect old auth pages to home */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Navigate to="/" replace />} />

        {/* Public pages — browsable without login */}
        <Route element={<CartProvider><AuthModalProvider><PublicLayout /></AuthModalProvider></CartProvider>}>
          <Route path="/" element={<Home />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/product/:id" element={<ProductDetail />} />
        </Route>

        {/* Protected buyer pages */}
        <Route element={<ProtectedRoute roles={['buyer']}><CartProvider><AuthModalProvider><BuyerLayout /></AuthModalProvider></CartProvider></ProtectedRoute>}>
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/profile" element={<div className="text-center py-20 text-gray-500">Profile page</div>} />
        </Route>

        {/* Seller */}
        <Route element={<ProtectedRoute roles={['seller']}><SellerLayout /></ProtectedRoute>}>
          <Route path="/seller" element={<SellerDashboard />} />
          <Route path="/seller/products" element={<SellerProducts />} />
          <Route path="/seller/add-product" element={<AddProduct />} />
          <Route path="/seller/edit-product/:id" element={<EditProduct />} />
          <Route path="/seller/orders" element={<SellerOrders />} />
          <Route path="/seller/shipping" element={<SellerShipping />} />
          <Route path="/seller/reports" element={<div className="text-center py-20 text-gray-500">Seller reports</div>} />
          <Route path="/seller/inventory" element={<div className="text-center py-20 text-gray-500">Inventory management</div>} />
          <Route path="/seller/settings" element={<div className="text-center py-20 text-gray-500">Store settings</div>} />
        </Route>

        {/* Admin */}
        <Route element={<ProtectedRoute roles={['admin']}><AdminLayout /></ProtectedRoute>}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/sellers" element={<AdminUsers />} />
          <Route path="/admin/seller-applications" element={<SellerApprovals />} />
          <Route path="/admin/buyers" element={<AdminUsers />} />
          <Route path="/admin/products" element={<ProductApprovals />} />
          <Route path="/admin/product-approvals" element={<ProductApprovals />} />
          <Route path="/admin/orders" element={<div className="text-center py-20 text-gray-500">All marketplace orders</div>} />
          <Route path="/admin/categories" element={<div className="text-center py-20 text-gray-500">Category management</div>} />
          <Route path="/admin/reports" element={<div className="text-center py-20 text-gray-500">Marketplace reports</div>} />
          <Route path="/admin/activities" element={<div className="text-center py-20 text-gray-500">Activity monitoring</div>} />
          <Route path="/admin/warnings" element={<div className="text-center py-20 text-gray-500">Warnings & bans</div>} />
          <Route path="/admin/settings" element={<div className="text-center py-20 text-gray-500">System settings</div>} />
        </Route>

        {/* 404 */}
        <Route path="*" element={
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
              <p className="text-gray-600 mb-4">Page not found</p>
              <a href="/" className="text-primary-800 hover:underline font-medium">Go home</a>
            </div>
          </div>
        } />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <Toast />
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ToastProvider>
  );
}
