const API_BASE = 'http://10.30.253.85/BagoMarketPlace/bago-market/server/api';
const IMAGE_BASE = 'http://10.30.253.85/BagoMarketPlace/bago-market/server';

// ── State ──
let state = {
  user: JSON.parse(localStorage.getItem('rider_user') || 'null'),
  token: localStorage.getItem('rider_token') || null,
  orders: [],
  myDeliveries: [],
  activeTab: 'available',
  currentPage: 'dashboard', // dashboard | order_detail | pickup | deliver
  selectedOrder: null,
  proofImage: null,
  loading: false,
  toast: null,
};

// ── API Helpers ──
async function api(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function showToast(message, type = 'info') {
  state.toast = { message, type };
  render();
  setTimeout(() => { state.toast = null; render(); }, 3000);
}

// ── Auth ──
async function login(email, password) {
  try {
    state.loading = true; render();
    const data = await api('/auth/login.php', { method: 'POST', body: JSON.stringify({ email, password }) });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('rider_token', data.token);
    localStorage.setItem('rider_user', JSON.stringify(data.user));
    showToast('Welcome, ' + data.user.name, 'success');
    fetchOrders();
    startPolling();
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    state.loading = false; render();
  }
}

function logout() {
  state.token = null;
  state.user = null;
  state.currentPage = 'dashboard';
  localStorage.removeItem('rider_token');
  localStorage.removeItem('rider_user');
  stopPolling();
  render();
}

// ── Orders ──
async function fetchOrders() {
  if (!state.token) return;
  try {
    const [available, mine] = await Promise.all([
      api('/rider/orders.php?status=shipped'),
      api('/rider/orders.php?my_deliveries=1'),
    ]);
    state.orders = available.orders || [];
    state.myDeliveries = mine.orders || [];
    render();
  } catch (e) { /* silent */ }
}

async function uploadProof(imageData) {
  try {
    const data = await api('/rider/upload-proof.php', {
      method: 'POST',
      body: JSON.stringify({ image: imageData, type: 'delivery' })
    });
    return data.image_url;
  } catch {
    return imageData; // fallback: send base64 directly
  }
}

async function pickupOrder(orderId) {
  try {
    state.loading = true; render();
    let proofUrl = state.proofImage;
    if (proofUrl && proofUrl.startsWith('data:')) {
      proofUrl = await uploadProof(proofUrl);
    }
    await api('/rider/orders.php', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId, action: 'pickup', proof_image: proofUrl })
    });
    showToast('Order picked up successfully!', 'success');
    state.proofImage = null;
    state.currentPage = 'dashboard';
    state.activeTab = 'my_deliveries';
    fetchOrders();
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    state.loading = false; render();
  }
}

async function deliverOrder(orderId) {
  try {
    state.loading = true; render();
    let proofUrl = state.proofImage;
    if (proofUrl && proofUrl.startsWith('data:')) {
      proofUrl = await uploadProof(proofUrl);
    }
    await api('/rider/orders.php', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId, action: 'deliver', proof_image: proofUrl })
    });
    showToast('Order delivered successfully!', 'success');
    state.proofImage = null;
    state.currentPage = 'dashboard';
    fetchOrders();
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    state.loading = false; render();
  }
}

// ── Image capture ──
function captureImage() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { state.proofImage = reader.result; render(); };
    reader.readAsDataURL(file);
  };
  input.click();
}

// ── Realtime polling 1.5s ──
let pollInterval = null;
function startPolling() {
  stopPolling();
  pollInterval = setInterval(() => {
    if (state.token && state.currentPage === 'dashboard') fetchOrders();
  }, 1500);
}
function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

// ── Navigation ──
function viewOrder(order) {
  state.selectedOrder = order;
  state.currentPage = 'order_detail';
  state.proofImage = null;
  render();
}

function goToPickup(order) {
  state.selectedOrder = order;
  state.currentPage = 'pickup';
  state.proofImage = null;
  render();
}

function goToDeliver(order) {
  state.selectedOrder = order;
  state.currentPage = 'deliver';
  state.proofImage = null;
  render();
}

function goBack() {
  state.currentPage = 'dashboard';
  state.proofImage = null;
  render();
}

// ── Render Router ──
function render() {
  const app = document.getElementById('app');
  if (!state.user) { app.innerHTML = renderLogin(); return; }
  switch (state.currentPage) {
    case 'order_detail': app.innerHTML = renderOrderDetail(); break;
    case 'pickup': app.innerHTML = renderPickupPage(); break;
    case 'deliver': app.innerHTML = renderDeliverPage(); break;
    default: app.innerHTML = renderDashboard(); break;
  }
}

// ── Pages ──
function renderLogin() {
  return `
    <div class="min-h-screen flex items-center justify-center px-6 bg-gradient-to-b from-primary-800 to-primary-900">
      <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg class="w-8 h-8 text-primary-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></svg>
          </div>
          <h1 class="text-xl font-bold text-gray-900">Bago Riders</h1>
          <p class="text-xs text-gray-500 mt-1">Delivery Partner App</p>
        </div>
        <div class="space-y-3">
          <input id="email" type="email" placeholder="Email" class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-800">
          <input id="password" type="password" placeholder="Password" class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-800">
          <button onclick="login(document.getElementById('email').value, document.getElementById('password').value)" class="w-full py-3.5 bg-primary-800 text-white rounded-xl font-bold text-sm ${state.loading ? 'opacity-50' : ''}" ${state.loading ? 'disabled' : ''}>
            ${state.loading ? 'Logging in...' : 'Login'}
          </button>
        </div>
      </div>
    </div>
    ${renderToast()}`;
}

function renderDashboard() {
  const available = state.orders;
  const myDeliveries = state.myDeliveries;
  const list = state.activeTab === 'available' ? available : myDeliveries;

  return `
    <div class="bg-primary-800 text-white px-4 pt-12 pb-4 sticky top-0 z-50">
      <div class="flex items-center justify-between mb-4">
        <div>
          <p class="text-[10px] text-white/50 uppercase tracking-wider">Rider Dashboard</p>
          <p class="font-bold text-base">${state.user.name}</p>
        </div>
        <button onclick="logout()" class="text-[11px] bg-white/10 px-3 py-1.5 rounded-lg border border-white/20">Logout</button>
      </div>
      <div class="flex bg-white/10 rounded-xl p-1">
        <button onclick="state.activeTab='available'; render()" class="flex-1 py-2.5 text-xs font-bold rounded-lg transition ${state.activeTab === 'available' ? 'bg-white text-primary-800 shadow' : 'text-white/70'}">
          Available (${available.length})
        </button>
        <button onclick="state.activeTab='my_deliveries'; render()" class="flex-1 py-2.5 text-xs font-bold rounded-lg transition ${state.activeTab === 'my_deliveries' ? 'bg-white text-primary-800 shadow' : 'text-white/70'}">
          My Deliveries (${myDeliveries.length})
        </button>
      </div>
    </div>

    <div class="px-4 py-3 space-y-3 pb-6">
      ${list.length === 0 ? `
        <div class="text-center py-20">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
          </div>
          <p class="text-gray-500 text-sm font-medium">${state.activeTab === 'available' ? 'No orders ready for pickup' : 'No active deliveries'}</p>
          <p class="text-gray-400 text-xs mt-1">Pull down or wait for new orders</p>
        </div>
      ` : list.map(o => renderOrderCard(o)).join('')}
    </div>
    ${renderToast()}`;
}

function renderOrderCard(order) {
  const isAvailable = order.status === 'shipped';
  const isInTransit = order.status === 'out_for_delivery';
  const isDelivered = order.status === 'delivered';
  const firstItem = (order.items || [])[0];
  const img = firstItem?.product_image ? `${IMAGE_BASE}${firstItem.product_image}` : '';

  return `
    <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm" onclick="viewOrder(${JSON.stringify(order).replace(/"/g, '&quot;')})">
      <div class="flex items-center justify-between px-4 pt-3 pb-2">
        <span class="text-[10px] text-gray-400 font-medium">${order.order_number || '#' + order.id}</span>
        <span class="text-[10px] font-bold px-2.5 py-1 rounded-full ${isAvailable ? 'bg-blue-50 text-blue-600' : isInTransit ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}">
          ${isAvailable ? '📦 READY' : isInTransit ? '🚗 IN TRANSIT' : '✅ DELIVERED'}
        </span>
      </div>
      <div class="px-4 pb-3">
        <div class="flex items-center gap-2 mb-2">
          <svg class="w-3.5 h-3.5 text-primary-800 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/></svg>
          <p class="text-xs text-gray-700 truncate">${order.recipient_name || 'Customer'} · ${order.barangay_name || 'Bago City'}</p>
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            ${img ? `<img src="${img}" class="w-8 h-8 rounded object-cover">` : ''}
            <span class="text-[11px] text-gray-500">${order.items_count || 1} item${(order.items_count||1) > 1 ? 's' : ''}</span>
          </div>
          <span class="text-sm font-bold text-primary-800">₱${Number(order.total_amount||0).toLocaleString()}</span>
        </div>
      </div>
    </div>`;
}

function renderOrderDetail() {
  const o = state.selectedOrder;
  if (!o) { goBack(); return ''; }
  const isAvailable = o.status === 'shipped';
  const isInTransit = o.status === 'out_for_delivery';

  return `
    <div class="bg-primary-800 text-white px-4 pt-12 pb-4">
      <div class="flex items-center gap-3">
        <button onclick="goBack()" class="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <span class="font-bold text-sm">Order ${o.order_number || '#' + o.id}</span>
      </div>
    </div>
    <div class="px-4 py-4 space-y-3">
      <!-- Customer -->
      <div class="bg-white rounded-xl p-4 border border-gray-100">
        <p class="text-[10px] text-gray-400 uppercase font-bold mb-2">Deliver To</p>
        <p class="text-sm font-bold text-gray-900">${o.recipient_name || 'Customer'}</p>
        <p class="text-xs text-gray-500 mt-1">${o.street_address || ''}${o.barangay_name ? ', ' + o.barangay_name : ''}, Bago City</p>
        ${o.contact_number ? `<p class="text-xs text-primary-800 font-semibold mt-2">📞 ${o.contact_number}</p>` : ''}
      </div>
      <!-- Items -->
      <div class="bg-white rounded-xl p-4 border border-gray-100">
        <p class="text-[10px] text-gray-400 uppercase font-bold mb-2">Items (${o.items_count || (o.items||[]).length})</p>
        ${(o.items || []).map(item => {
          const img = item.product_image ? `${IMAGE_BASE}${item.product_image}` : '';
          return `
            <div class="flex items-center gap-3 py-2 border-t border-gray-50 first:border-0">
              ${img ? `<img src="${img}" class="w-12 h-12 rounded-lg object-cover">` : '<div class="w-12 h-12 bg-gray-100 rounded-lg"></div>'}
              <div class="flex-1 min-w-0">
                <p class="text-xs text-gray-800 truncate">${item.product_name}</p>
                <p class="text-[10px] text-gray-400">x${item.quantity} · ${item.store_name || 'Store'}</p>
              </div>
              <p class="text-xs font-bold">₱${Number(item.price * item.quantity).toLocaleString()}</p>
            </div>`;
        }).join('')}
        <div class="flex justify-between pt-3 border-t border-gray-100 mt-2">
          <span class="text-xs text-gray-500">Total (COD)</span>
          <span class="text-base font-bold text-primary-800">₱${Number(o.total_amount||0).toLocaleString()}</span>
        </div>
      </div>
      <!-- Proof images if available -->
      ${o.pickup_proof ? `
        <div class="bg-white rounded-xl p-4 border border-gray-100">
          <p class="text-[10px] text-gray-400 uppercase font-bold mb-2">Pickup Proof</p>
          <img src="${o.pickup_proof.startsWith('/') ? IMAGE_BASE + o.pickup_proof : o.pickup_proof}" class="w-full h-40 object-cover rounded-lg">
        </div>
      ` : ''}
      ${o.delivery_proof ? `
        <div class="bg-white rounded-xl p-4 border border-gray-100">
          <p class="text-[10px] text-gray-400 uppercase font-bold mb-2">Delivery Proof</p>
          <img src="${o.delivery_proof.startsWith('/') ? IMAGE_BASE + o.delivery_proof : o.delivery_proof}" class="w-full h-40 object-cover rounded-lg">
        </div>
      ` : ''}
      <!-- Action -->
      ${isAvailable ? `
        <button onclick="goToPickup(state.selectedOrder)" class="w-full py-3.5 bg-primary-800 text-white rounded-xl font-bold text-sm">
          📦 Pick Up This Order
        </button>
      ` : isInTransit ? `
        <button onclick="goToDeliver(state.selectedOrder)" class="w-full py-3.5 bg-green-600 text-white rounded-xl font-bold text-sm">
          ✅ Mark as Delivered
        </button>
      ` : `
        <div class="text-center py-3 text-green-600 font-semibold text-sm">✅ Delivered</div>
      `}
    </div>
    ${renderToast()}`;
}

function renderPickupPage() {
  const o = state.selectedOrder;
  return `
    <div class="bg-primary-800 text-white px-4 pt-12 pb-4">
      <div class="flex items-center gap-3">
        <button onclick="goBack()" class="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <span class="font-bold text-sm">Pickup Confirmation</span>
      </div>
    </div>
    <div class="px-4 py-4 space-y-4">
      <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p class="text-xs text-blue-800 font-semibold mb-1">📦 Confirm Pickup</p>
        <p class="text-[11px] text-blue-600">Take a photo as proof that you've picked up the order from the seller.</p>
      </div>

      <!-- Photo capture -->
      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <p class="text-xs font-bold text-gray-700 mb-3">Proof of Pickup</p>
        ${state.proofImage ? `
          <div class="relative">
            <img src="${state.proofImage}" class="w-full h-48 object-cover rounded-lg border border-gray-200">
            <button onclick="state.proofImage=null; render()" class="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">✕</button>
          </div>
          <button onclick="captureImage()" class="w-full mt-3 py-2.5 border border-gray-200 rounded-lg text-xs text-gray-600 font-medium">Retake Photo</button>
        ` : `
          <button onclick="captureImage()" class="w-full py-8 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary-800 transition">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <span class="text-xs text-gray-500 font-medium">Tap to take photo</span>
          </button>
        `}
      </div>

      <!-- Confirm button -->
      <button onclick="pickupOrder(${o.id})" class="w-full py-3.5 bg-primary-800 text-white rounded-xl font-bold text-sm ${state.loading ? 'opacity-50' : ''}" ${state.loading ? 'disabled' : ''}>
        ${state.loading ? '⏳ Processing...' : '✓ Confirm Pickup'}
      </button>
      <p class="text-[10px] text-gray-400 text-center">Order status will change to "Out for Delivery"</p>
    </div>
    ${renderToast()}`;
}

function renderDeliverPage() {
  const o = state.selectedOrder;
  return `
    <div class="bg-green-700 text-white px-4 pt-12 pb-4">
      <div class="flex items-center gap-3">
        <button onclick="goBack()" class="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <span class="font-bold text-sm">Delivery Confirmation</span>
      </div>
    </div>
    <div class="px-4 py-4 space-y-4">
      <div class="bg-green-50 border border-green-200 rounded-xl p-4">
        <p class="text-xs text-green-800 font-semibold mb-1">✅ Confirm Delivery</p>
        <p class="text-[11px] text-green-600">Take a photo as proof that the order has been delivered to the customer.</p>
      </div>

      <!-- Delivery info -->
      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <p class="text-[10px] text-gray-400 uppercase font-bold mb-1">Delivering To</p>
        <p class="text-sm font-bold text-gray-900">${o.recipient_name || 'Customer'}</p>
        <p class="text-xs text-gray-500">${o.street_address || ''}${o.barangay_name ? ', ' + o.barangay_name : ''}</p>
      </div>

      <!-- Photo capture -->
      <div class="bg-white rounded-xl border border-gray-100 p-4">
        <p class="text-xs font-bold text-gray-700 mb-3">Proof of Delivery</p>
        ${state.proofImage ? `
          <div class="relative">
            <img src="${state.proofImage}" class="w-full h-48 object-cover rounded-lg border border-gray-200">
            <button onclick="state.proofImage=null; render()" class="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">✕</button>
          </div>
          <button onclick="captureImage()" class="w-full mt-3 py-2.5 border border-gray-200 rounded-lg text-xs text-gray-600 font-medium">Retake Photo</button>
        ` : `
          <button onclick="captureImage()" class="w-full py-8 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-green-600 transition">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <span class="text-xs text-gray-500 font-medium">Tap to take photo</span>
          </button>
        `}
      </div>

      <!-- Confirm button -->
      <button onclick="deliverOrder(${o.id})" class="w-full py-3.5 bg-green-600 text-white rounded-xl font-bold text-sm ${state.loading ? 'opacity-50' : ''}" ${state.loading ? 'disabled' : ''}>
        ${state.loading ? '⏳ Processing...' : '✓ Confirm Delivery'}
      </button>
      <p class="text-[10px] text-gray-400 text-center">Order status will change to "Delivered"</p>
    </div>
    ${renderToast()}`;
}

function renderToast() {
  if (!state.toast) return '';
  const colors = { success: 'bg-green-500', error: 'bg-red-500', info: 'bg-primary-800', warning: 'bg-amber-500' };
  return `
    <div class="fixed top-4 left-4 right-4 z-[999] toast">
      <div class="${colors[state.toast.type] || colors.info} text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-lg text-center">
        ${state.toast.message}
      </div>
    </div>`;
}

// ── Init ──
render();
if (state.token) { fetchOrders(); startPolling(); }
