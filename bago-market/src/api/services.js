import api from './axios';

// Auth
export const authAPI = {
  login: (data) => api.post('/auth/login.php', data),
  register: (data) => api.post('/auth/register.php', data),
  me: () => api.get('/auth/me.php'),
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
};

// Admin
export const adminAPI = {
  dashboard: () => api.get('/admin/dashboard.php'),
  sellers: (params) => api.get('/admin/sellers.php', { params }),
  updateSeller: (data) => api.put('/admin/sellers.php', data),
  products: (params) => api.get('/admin/products.php', { params }),
  updateProduct: (data) => api.put('/admin/products.php', data),
  users: (params) => api.get('/admin/users.php', { params }),
  updateUser: (data) => api.put('/admin/users.php', data),
  activities: (params) => api.get('/admin/activities.php', { params }),
};
