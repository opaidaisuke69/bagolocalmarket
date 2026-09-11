import api from './axios';

// Auth
export const authAPI = {
  login: (data) => api.post('/auth/login.php', data),
  // Buyer registration (JSON)
  register: (data) => api.post('/auth/register.php', data),
  // Seller registration (multipart/form-data with file uploads)
  registerSeller: (formData) => api.post('/auth/register.php', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  me: () => api.get('/auth/me.php'),
  verifyEmail: (token) => api.get('/auth/verify-email.php', { params: { token } }),
  resendVerification: (data) => api.post('/auth/resend-verification.php', data),
  forgotPassword: (data) => api.post('/auth/forgot-password.php', data),
  validateResetToken: (token) => api.get('/auth/reset-password.php', { params: { token } }),
  resetPassword: (data) => api.post('/auth/reset-password.php', data),
};

// Products
export const productsAPI = {
  list: (params) => api.get('/products/list.php', { params }),
  detail: (id) => api.get('/products/detail.php', { params: { id } }),
  create: (data) => api.post('/products/create.php', data),
  update: (data) => api.put('/products/update.php', data),
  delete: (id) => api.post('/products/delete.php', { id }),
  upload: (formData) => api.post('/products/upload.php', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  reviews: (params) => api.get('/products/reviews.php', { params }),
  submitReview: (data) => api.post('/products/review.php', data),
  updateReview: (data) => api.put('/products/review.php', data),
  myReviews: (params) => api.get('/products/my-reviews.php', { params }),
};

// Cart
export const cartAPI = {
  get: () => api.get('/cart/get.php'),
  add: (data) => api.post('/cart/add.php', data),
  update: (data) => api.put('/cart/update.php', data),
  remove: (data) => api.post('/cart/remove.php', data),
};

// Orders
export const ordersAPI = {
  create: (data) => api.post('/orders/create.php', data),
  list: (params) => api.get('/orders/list.php', { params }),
  detail: (id) => api.get('/orders/detail.php', { params: { id } }),
  updateStatus: (data) => api.put('/orders/update-status.php', data),
  shippingFee: (addressId, sellerIds = []) => {
    const params = { address_id: addressId };
    if (sellerIds.length > 0) params.seller_ids = sellerIds.join(',');
    return api.get('/orders/shipping-fee.php', { params });
  },
};

// Recommendations
export const recommendationsAPI = {
  get: (params) => api.get('/recommendations/get.php', { params }),
  track: (data) => api.post('/recommendations/track.php', data),
};

// Categories
export const categoriesAPI = {
  list: () => api.get('/categories/list.php'),
};

// Addresses
export const addressesAPI = {
  list: () => api.get('/addresses/list.php'),
  create: (data) => api.post('/addresses/manage.php', data),
  update: (data) => api.put('/addresses/manage.php', data),
  delete: (id) => api.delete(`/addresses/manage.php?id=${id}`),
};

// Wishlist
export const wishlistAPI = {
  get: () => api.get('/wishlist/manage.php'),
  toggle: (data) => api.post('/wishlist/manage.php', data),
};

// Notifications
export const notificationsAPI = {
  list: (params) => api.get('/notifications/list.php', { params }),
  markRead: (data) => api.put('/notifications/list.php', data),
};

// Search
export const searchAPI = {
  search: (params) => api.get('/search/search.php', { params }),
  history: () => api.get('/search/history.php'),
  deleteItem: (query) => api.delete('/search/history.php', { data: { query } }),
  clearAll: () => api.delete('/search/history.php'),
  popular: (limit = 10) => api.get('/search/popular.php', { params: { limit } }),
};

// Barangays
export const barangaysAPI = {
  list: () => api.get('/barangays/list.php'),
};

// Seller
export const sellerAPI = {
  dashboard: () => api.get('/seller/dashboard.php'),
  products: (params) => api.get('/seller/products.php', { params }),
  pickupRequests: (params) => api.get('/seller/pickup-requests.php', { params }),
  handlePickupRequest: (data) => api.post('/seller/pickup-requests.php', data),
  // Remittance accounts & payout history
  remittance: () => api.get('/seller/remittance.php'),
  addRemittanceAccount: (data) => api.post('/seller/remittance.php', data),
  updateRemittanceAccount: (data) => api.put('/seller/remittance.php', data),
  deleteRemittanceAccount: (accountId) => api.delete(`/seller/remittance.php?account_id=${accountId}`),
  // Reports
  reports: (params) => api.get('/seller/reports.php', { params }),
  // Store settings
  storeSettings: () => api.get('/seller/store-settings.php'),
  saveStoreSettings: (data) => api.post('/seller/store-settings.php', data),
  // Inventory
  inventory: (params) => api.get('/seller/inventory.php', { params }),
  updateStock: (data) => api.put('/seller/inventory.php', data),
  bulkUpdateStock: (data) => api.post('/seller/inventory.php', data),
};

// Admin
export const adminAPI = {
  // Dashboard
  dashboard: () => api.get('/admin/dashboard.php'),

  // Sellers
  sellers: (params) => api.get('/admin/sellers.php', { params }),
  updateSeller: (data) => api.put('/admin/sellers.php', data),

  // Products
  products: (params) => api.get('/admin/products.php', { params }),
  updateProduct: (data) => api.put('/admin/products.php', data),

  // Users
  users: (params) => api.get('/admin/users.php', { params }),
  updateUser: (data) => api.put('/admin/users.php', data),

  // Warnings history
  warnings: (params) => api.get('/admin/warnings.php', { params }),

  // Activity log
  activities: (params) => api.get('/admin/activities.php', { params }),

  // Riders
  riders: (params) => api.get('/admin/riders.php', { params }),
  updateRider: (data) => api.put('/admin/riders.php', data),

  // Commissions
  commissions: (params) => api.get('/admin/commissions.php', { params }),

  // Remittances (rider)
  remittances: (params) => api.get('/admin/remittance.php', { params }),
  addQrCode: (data) => api.post('/admin/remittance.php', data),
  updateRemittance: (data) => api.put('/admin/remittance.php', data),
  deleteQrCode: (id) => api.delete(`/admin/remittance.php?qr_id=${id}`),

  // Seller payouts
  sellerPayoutSummary: () => api.get('/admin/seller-payouts.php', { params: { action: 'summary' } }),
  sellerPayouts: (params) => api.get('/admin/seller-payouts.php', { params: { action: 'payouts', ...params } }),
  sellerPayoutAccounts: (sellerId) => api.get('/admin/seller-payouts.php', { params: { action: 'seller_accounts', seller_id: sellerId } }),
  createSellerPayout: (data) => api.post('/admin/seller-payouts.php', data),
  updateSellerPayout: (data) => api.put('/admin/seller-payouts.php', data),
  deleteSellerPayout: (payoutId) => api.delete(`/admin/seller-payouts.php?payout_id=${payoutId}`),

  // Orders (admin)
  orders: (params) => api.get('/admin/orders.php', { params }),
  orderDetail: (id) => api.get('/admin/orders.php', { params: { action: 'detail', id } }),
  updateOrderStatus: (data) => api.put('/admin/orders.php', data),

  // Categories
  categories: () => api.get('/admin/categories.php'),
  createCategory: (data) => api.post('/admin/categories.php', data),
  updateCategory: (data) => api.put('/admin/categories.php', data),
  deleteCategory: (id) => api.delete(`/admin/categories.php?id=${id}`),

  // Platform settings
  getSettings: () => api.get('/admin/settings.php'),
  saveSettings: (data) => api.put('/admin/settings.php', data),

  // Admin notifications
  notifications: (params) => api.get('/admin/notifications.php', { params }),
  markNotificationsRead: (data = { mark_all: true }) => api.put('/admin/notifications.php', data),
};
