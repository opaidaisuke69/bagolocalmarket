import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/api';

// Decode JWT payload and check expiry without verifying signature
function isTokenExpired(token: string): boolean {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    return payload.exp < Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

async function clearAuth() {
  await AsyncStorage.multiRemove(['token', 'user']);
}

// Simple fetch wrapper with auth
export async function request(endpoint: string, options: RequestInit = {}) {
  const token = await AsyncStorage.getItem('token');

  // Clear expired token before making the request
  if (token && isTokenExpired(token)) {
    await clearAuth();
    throw new Error('Session expired. Please log in again.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    await clearAuth();
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

function buildQuery(params: Record<string, any>): string {
  const query = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return query ? `?${query}` : '';
}

// Auth
export const authAPI = {
  login: (data: { email: string; password: string }) =>
    request('/auth/login.php', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: any) =>
    request('/auth/register.php', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request('/auth/me.php'),
  forgotPassword: (data: { email: string }) =>
    request('/auth/forgot-password.php', { method: 'POST', body: JSON.stringify(data) }),
  validateResetToken: (token: string) =>
    request(`/auth/reset-password.php?token=${encodeURIComponent(token)}`),
  resetPassword: (data: { token: string; password: string; confirm_password: string }) =>
    request('/auth/reset-password.php', { method: 'POST', body: JSON.stringify(data) }),
};

// Products
export const productsAPI = {
  list: (params: Record<string, any> = {}) =>
    request(`/products/list.php${buildQuery(params)}`),
  detail: (id: number) =>
    request(`/products/detail.php?id=${id}`),
};

// Cart
export const cartAPI = {
  get: () => request('/cart/get.php'),
  add: (data: { product_id: number; quantity: number }) =>
    request('/cart/add.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (data: { item_id: number; quantity: number }) =>
    request('/cart/update.php', { method: 'PUT', body: JSON.stringify(data) }),
  remove: (data: { item_id: number }) =>
    request('/cart/remove.php', { method: 'POST', body: JSON.stringify(data) }),
};

// Orders
export const ordersAPI = {
  create: (data: any) =>
    request('/orders/create.php', { method: 'POST', body: JSON.stringify(data) }),
  list: (params: Record<string, any> = {}) =>
    request(`/orders/list.php${buildQuery(params)}`),
  detail: (id: number) =>
    request(`/orders/detail.php?id=${id}`),
  updateStatus: (data: { order_id: number; status: string }) =>
    request('/orders/update-status.php', { method: 'PUT', body: JSON.stringify(data) }),
  shippingFee: (addressId: number, sellerIds: number[] = []) => {
    const params: Record<string, any> = { address_id: addressId };
    if (sellerIds.length > 0) params.seller_ids = sellerIds.join(',');
    return request(`/orders/shipping-fee.php${buildQuery(params)}`);
  },
};

// Categories
export const categoriesAPI = {
  list: () => request('/categories/list.php'),
};

// Recommendations
export const recommendationsAPI = {
  get: (params: Record<string, any> = {}) =>
    request(`/recommendations/get.php${buildQuery(params)}`),
  track: (data: any) =>
    request('/recommendations/track.php', { method: 'POST', body: JSON.stringify(data) }),
};

// Search
export const searchAPI = {
  search: (params: Record<string, any>) =>
    request(`/search/search.php${buildQuery(params)}`),
  history: () => request('/search/history.php'),
};

// Wishlist
export const wishlistAPI = {
  get: () => request('/wishlist/manage.php'),
  toggle: (data: { product_id: number }) =>
    request('/wishlist/manage.php', { method: 'POST', body: JSON.stringify(data) }),
};

// Notifications
export const notificationsAPI = {
  list: (params: Record<string, any> = {}) =>
    request(`/notifications/list.php${buildQuery(params)}`),
  markRead: (data: { id: number }) =>
    request('/notifications/list.php', { method: 'PUT', body: JSON.stringify(data) }),
};

// Addresses
export const addressesAPI = {
  list: () => request('/addresses/list.php'),
  create: (data: any) =>
    request('/addresses/manage.php', { method: 'POST', body: JSON.stringify(data) }),
  update: (data: any) =>
    request('/addresses/manage.php', { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request(`/addresses/manage.php?id=${id}`, { method: 'DELETE' }),
};