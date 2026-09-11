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
  import Profile from './pages/buyer/Profile';

  // Seller Pages
  import SellerDashboard from './pages/seller/Dashboard';
  import SellerProducts from './pages/seller/Products';
  import AddProduct from './pages/seller/AddProduct';
  import EditProduct from './pages/seller/EditProduct';
  import SellerOrders from './pages/seller/Orders';
  import SellerShipping from './pages/seller/Shipping';
  import RemittanceSettings from './pages/seller/RemittanceSettings';
  import SellerReports from './pages/seller/Reports';
  import StoreSettings from './pages/seller/StoreSettings';
  import Inventory from './pages/seller/Inventory';

  // Auth Pages
  import SellerRegister from './pages/auth/SellerRegister';
  import VerifyEmail from './pages/auth/VerifyEmail';
  import ForgotPassword from './pages/auth/ForgotPassword';
  import ResetPassword from './pages/auth/ResetPassword';

  // Admin Pages
  import AdminDashboard from './pages/admin/Dashboard';
  import SellerApprovals from './pages/admin/SellerApprovals';
  import SellerCredentials from './pages/admin/SellerCredentials';
  import ProductApprovals from './pages/admin/ProductApprovals';
  import AdminUsers from './pages/admin/Users';
  import Riders from './pages/admin/Riders';
  import Commissions from './pages/admin/Commissions';
  import AdminRemittance from './pages/admin/Remittance';
  import SellerPayouts from './pages/admin/SellerPayouts';
  import AdminOrders from './pages/admin/Orders';
  import Categories from './pages/admin/Categories';
  import Activities from './pages/admin/Activities';
  import Warnings from './pages/admin/Warnings';
  import Buyers from './pages/admin/Buyers';

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
          {/* Redirect old login to home; keep register routes */}
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<Navigate to="/" replace />} />
          <Route path="/seller/register"  element={<SellerRegister />} />
          <Route path="/verify-email"     element={<VerifyEmail />} />
          <Route path="/forgot-password"  element={<ForgotPassword />} />
          <Route path="/reset-password"   element={<ResetPassword />} />

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
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* Seller */}
          <Route element={<ProtectedRoute roles={['seller']}><SellerLayout /></ProtectedRoute>}>
            <Route path="/seller" element={<SellerDashboard />} />
            <Route path="/seller/products" element={<SellerProducts />} />
            <Route path="/seller/add-product" element={<AddProduct />} />
            <Route path="/seller/edit-product/:id" element={<EditProduct />} />
            <Route path="/seller/orders" element={<SellerOrders />} />
            <Route path="/seller/shipping" element={<SellerShipping />} />
            <Route path="/seller/remittance" element={<RemittanceSettings />} />
            <Route path="/seller/reports"   element={<SellerReports />} />
            <Route path="/seller/inventory" element={<Inventory />} />
            <Route path="/seller/settings"  element={<StoreSettings />} />
          </Route>

          {/* Admin */}
          <Route element={<ProtectedRoute roles={['admin']}><AdminLayout /></ProtectedRoute>}>
            <Route path="/admin"                        element={<AdminDashboard />} />
            <Route path="/admin/sellers"                element={<SellerCredentials />} />
            <Route path="/admin/seller-applications"    element={<SellerApprovals />} />
            <Route path="/admin/riders"                 element={<Riders />} />
            <Route path="/admin/buyers"                 element={<Buyers />} />
            <Route path="/admin/products"               element={<ProductApprovals initialTab="" />} />
            <Route path="/admin/product-approvals"      element={<ProductApprovals initialTab="pending" />} />
            <Route path="/admin/orders"                 element={<AdminOrders />} />
            <Route path="/admin/categories"             element={<Categories />} />
            <Route path="/admin/commissions"            element={<Commissions />} />
            <Route path="/admin/remittances"            element={<AdminRemittance />} />
            <Route path="/admin/seller-payouts"         element={<SellerPayouts />} />
            <Route path="/admin/activities"             element={<Activities />} />
            <Route path="/admin/warnings"               element={<Warnings />} />
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
