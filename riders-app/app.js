const API_BASE   = 'http://10.30.253.85/BagoMarketPlace/bago-market/server/api';
const IMAGE_BASE = 'http://10.30.253.85/BagoMarketPlace/bago-market/server';

// ── JWT helpers ───────────────────────────────────────────────────────────────
function isTokenExpired(token) {
  try {
    const p = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    return p.exp < Math.floor(Date.now() / 1000);
  } catch { return true; }
}
function clearAuth() {
  localStorage.removeItem('rider_token');
  localStorage.removeItem('rider_user');
}
(function() {
  const t = localStorage.getItem('rider_token');
  if (t && isTokenExpired(t)) clearAuth();
})();

// ── State ─────────────────────────────────────────────────────────────────────
let state = {
  user:          JSON.parse(localStorage.getItem('rider_user') || 'null'),
  token:         localStorage.getItem('rider_token') || null,
  orders:        [],
  myDeliveries:  [],
  activeTab:     'available',
  currentPage:   'dashboard',  // dashboard|order_detail|pickup|deliver|earnings|remittance|wallet
  selectedOrder: null,
  proofImage:    null,
  loading:       false,
  toast:         null,
  earnings:      null,
  earningsPeriod:'day',
  earningsDate:  new Date().toISOString().slice(0,10),
  remittanceData:null,
  accounts:      [],
  remitForm:     { amount:'', period_start:'', period_end:'', payment_method:'', reference_number:'', notes:'', receipt_image:null },
  walletForm:    { account_id:null, type:'gcash', label:'GCash', account_name:'', account_number:'', qr_code_image:null, is_primary:false },
  walletEditing: false,
};

// ── API ───────────────────────────────────────────────────────────────────────
async function api(endpoint, options = {}) {
  if (state.token && isTokenExpired(state.token)) { logout(); throw new Error('Session expired.'); }
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const res  = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (res.status === 401) { logout(); throw new Error('Session expired.'); }
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

const fmt  = n => Number(n||0).toLocaleString('en-PH', { minimumFractionDigits:2 });
const fmtN = n => Number(n||0).toLocaleString('en-PH');

function showToast(message, type = 'info') {
  state.toast = { message, type };
  render();
  setTimeout(() => { state.toast = null; render(); }, 3500);
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function login(email, password) {
  try {
    state.loading = true; render();
    const data = await api('/auth/login.php', { method:'POST', body:JSON.stringify({ email, password }) });
    state.token = data.token;
    state.user  = data.user;
    localStorage.setItem('rider_token', data.token);
    localStorage.setItem('rider_user', JSON.stringify(data.user));
    showToast('Welcome, ' + (data.user.full_name || data.user.name), 'success');
    fetchOrders();
    startPolling();
  } catch(e) { showToast(e.message, 'error'); }
  finally    { state.loading = false; render(); }
}

function logout() {
  state.token = null; state.user = null;
  state.currentPage = 'dashboard';
  clearAuth(); stopPolling(); render();
}

// ── Orders ────────────────────────────────────────────────────────────────────
async function fetchOrders() {
  if (!state.token) return;
  try {
    const [available, mine] = await Promise.all([
      api('/rider/orders.php?status=shipped'),
      api('/rider/orders.php?my_deliveries=1'),
    ]);
    state.orders      = available.orders || [];
    state.myDeliveries = mine.orders    || [];
    render();
  } catch(e) {}
}

async function uploadProof(imageData) {
  try {
    const data = await api('/rider/upload-proof.php', { method:'POST', body:JSON.stringify({ image:imageData, type:'delivery' }) });
    return data.image_url;
  } catch { return imageData; }
}

async function pickupOrder(orderId) {
  try {
    state.loading = true; render();
    let proofUrl = state.proofImage;
    if (proofUrl && proofUrl.startsWith('data:')) proofUrl = await uploadProof(proofUrl);
    await api('/rider/orders.php', { method:'POST', body:JSON.stringify({ order_id:orderId, action:'pickup', proof_image:proofUrl }) });
    showToast('Order picked up!', 'success');
    state.proofImage = null; state.currentPage = 'dashboard'; state.activeTab = 'my_deliveries';
    fetchOrders();
  } catch(e) { showToast(e.message, 'error'); }
  finally    { state.loading = false; render(); }
}

async function deliverOrder(orderId) {
  try {
    state.loading = true; render();
    let proofUrl = state.proofImage;
    if (proofUrl && proofUrl.startsWith('data:')) proofUrl = await uploadProof(proofUrl);
    await api('/rider/orders.php', { method:'POST', body:JSON.stringify({ order_id:orderId, action:'deliver', proof_image:proofUrl }) });
    showToast('Order delivered!', 'success');
    state.proofImage = null; state.currentPage = 'dashboard';
    fetchOrders();
    fetchEarnings();
  } catch(e) { showToast(e.message, 'error'); }
  finally    { state.loading = false; render(); }
}

// ── Earnings ──────────────────────────────────────────────────────────────────
async function fetchEarnings() {
  try {
    const data = await api(`/rider/earnings.php?period=${state.earningsPeriod}&date=${state.earningsDate}`);
    state.earnings = data;
    render();
  } catch(e) { showToast('Failed to load earnings.', 'error'); }
}

// ── Remittance ────────────────────────────────────────────────────────────────
async function fetchRemittance() {
  try {
    const data = await api('/rider/remittance.php');
    state.remittanceData = data;
    render();
  } catch(e) { showToast('Failed to load remittance data.', 'error'); }
}

async function fetchAccounts() {
  try {
    const data = await api('/rider/remittance.php?accounts=1');
    state.accounts = data.accounts || [];
    render();
  } catch(e) {}
}

async function submitRemittance() {
  const f = state.remitForm;
  if (!f.amount || !f.period_start || !f.period_end || !f.receipt_image) {
    showToast('Please fill all required fields and attach a receipt.', 'warning'); return;
  }
  try {
    state.loading = true; render();
    await api('/rider/remittance.php', { method:'POST', body:JSON.stringify({ ...f, amount:parseFloat(f.amount) }) });
    showToast('Remittance submitted!', 'success');
    state.remitForm = { amount:'', period_start:'', period_end:'', payment_method:'', reference_number:'', notes:'', receipt_image:null };
    fetchRemittance();
    state.currentPage = 'remittance';
  } catch(e) { showToast(e.message, 'error'); }
  finally    { state.loading = false; render(); }
}

async function saveWalletAccount() {
  const f = state.walletForm;
  if (!f.label || !f.account_name || !f.account_number) {
    showToast('Label, account name, and number are required.', 'warning'); return;
  }
  try {
    state.loading = true; render();
    await api('/rider/remittance.php', { method:'POST', body:JSON.stringify({ action:'save_account', ...f }) });
    showToast('Account saved!', 'success');
    state.walletEditing = false;
    state.walletForm = { account_id:null, type:'gcash', label:'GCash', account_name:'', account_number:'', qr_code_image:null, is_primary:false };
    fetchAccounts();
    state.currentPage = 'wallet';
  } catch(e) { showToast(e.message, 'error'); }
  finally    { state.loading = false; render(); }
}

async function deleteAccount(id) {
  if (!confirm('Remove this account?')) return;
  try {
    await api(`/rider/remittance.php?account_id=${id}`, { method:'DELETE' });
    showToast('Account removed.', 'success');
    fetchAccounts();
  } catch(e) { showToast(e.message, 'error'); }
}

// ── Image capture helper ──────────────────────────────────────────────────────
function captureImageFor(target) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  if (target === 'proof') input.capture = 'environment';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (target === 'proof') { state.proofImage = reader.result; }
      else if (target === 'receipt') { state.remitForm.receipt_image = reader.result; }
      else if (target === 'wallet_qr') { state.walletForm.qr_code_image = reader.result; }
      render();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// ── Nav ───────────────────────────────────────────────────────────────────────
let pollInterval = null;
function startPolling() { stopPolling(); pollInterval = setInterval(() => { if (state.token && state.currentPage === 'dashboard') fetchOrders(); }, 3000); }
function stopPolling()  { if (pollInterval) { clearInterval(pollInterval); pollInterval = null; } }

function goTo(page) {
  state.currentPage = page;
  state.proofImage  = null;
  if (page === 'earnings')   fetchEarnings();
  if (page === 'remittance') fetchRemittance();
  if (page === 'wallet')     fetchAccounts();
  render();
}
function viewOrder(order)  { state.selectedOrder = order; state.currentPage = 'order_detail'; state.proofImage = null; render(); }
function goToPickup(order) { state.selectedOrder = order; state.currentPage = 'pickup';       state.proofImage = null; render(); }
function goToDeliver(order){ state.selectedOrder = order; state.currentPage = 'deliver';      state.proofImage = null; render(); }
function goBack()          { state.currentPage = state.currentPage === 'order_detail' ? 'dashboard' : 'dashboard'; state.proofImage = null; render(); }

// ── Bottom nav ────────────────────────────────────────────────────────────────
function renderBottomNav() {
  const tabs = [
    { page:'dashboard',  icon:'🚗', label:'Orders' },
    { page:'earnings',   icon:'💰', label:'Earnings' },
    { page:'remittance', icon:'📤', label:'Remit' },
    { page:'wallet',     icon:'💳', label:'Wallet' },
  ];
  const cur = ['order_detail','pickup','deliver'].includes(state.currentPage) ? 'dashboard' : state.currentPage;
  return `<div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-50 safe-bottom">
    ${tabs.map(t => `
      <button onclick="goTo('${t.page}')" class="flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${cur===t.page?'text-primary-800':'text-gray-400'}">
        <span class="text-lg leading-none">${t.icon}</span>
        <span class="text-[10px] font-semibold">${t.label}</span>
      </button>`).join('')}
  </div>`;
}

// ── RENDER ROUTER ─────────────────────────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  if (!state.user) { app.innerHTML = renderLogin(); return; }
  switch (state.currentPage) {
    case 'order_detail': app.innerHTML = renderOrderDetail(); break;
    case 'pickup':       app.innerHTML = renderPickupPage();  break;
    case 'deliver':      app.innerHTML = renderDeliverPage(); break;
    case 'earnings':     app.innerHTML = renderEarnings();    break;
    case 'remittance':   app.innerHTML = renderRemittance();  break;
    case 'wallet':       app.innerHTML = renderWallet();      break;
    default:             app.innerHTML = renderDashboard();   break;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGES
// ══════════════════════════════════════════════════════════════════════════════

function renderLogin() {
  return `<div class="min-h-screen flex items-center justify-center px-6 bg-gradient-to-b from-primary-800 to-primary-900">
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
        <button onclick="login(document.getElementById('email').value, document.getElementById('password').value)"
          class="w-full py-3.5 bg-primary-800 text-white rounded-xl font-bold text-sm ${state.loading?'opacity-50':''}" ${state.loading?'disabled':''}>
          ${state.loading ? 'Logging in...' : 'Login'}
        </button>
      </div>
    </div>
  </div>${renderToast()}`;
}

function renderDashboard() {
  const available = state.orders;
  const myDeliveries = state.myDeliveries;
  const list = state.activeTab === 'available' ? available : myDeliveries;
  const today = state.earnings?.today;

  return `
  <div class="bg-primary-800 text-white px-4 pt-12 pb-4 sticky top-0 z-40">
    <div class="flex items-center justify-between mb-3">
      <div>
        <p class="text-[10px] text-white/50 uppercase tracking-wider">Rider Dashboard</p>
        <p class="font-bold text-base">${state.user.full_name || state.user.name}</p>
      </div>
      <button onclick="logout()" class="text-[11px] bg-white/10 px-3 py-1.5 rounded-lg border border-white/20">Logout</button>
    </div>
    ${today ? `
    <div class="grid grid-cols-3 gap-2 mb-3">
      <div class="bg-white/10 rounded-xl p-2.5 text-center">
        <p class="text-[9px] text-white/60 uppercase">Today</p>
        <p class="font-bold text-sm">${fmtN(today.today_deliveries)}</p>
        <p class="text-[9px] text-white/50">deliveries</p>
      </div>
      <div class="bg-white/10 rounded-xl p-2.5 text-center">
        <p class="text-[9px] text-white/60 uppercase">Collections</p>
        <p class="font-bold text-sm">₱${fmt(today.today_collections)}</p>
        <p class="text-[9px] text-white/50">COD collected</p>
      </div>
      <div class="bg-yellow-400/20 rounded-xl p-2.5 text-center">
        <p class="text-[9px] text-yellow-200 uppercase">Commission</p>
        <p class="font-bold text-sm text-yellow-300">₱${fmt(today.today_commission)}</p>
        <p class="text-[9px] text-yellow-200/60">earned today</p>
      </div>
    </div>` : ''}
    <div class="flex bg-white/10 rounded-xl p-1">
      <button onclick="state.activeTab='available'; render()" class="flex-1 py-2 text-xs font-bold rounded-lg transition ${state.activeTab==='available'?'bg-white text-primary-800 shadow':'text-white/70'}">
        Available (${available.length})
      </button>
      <button onclick="state.activeTab='my_deliveries'; render()" class="flex-1 py-2 text-xs font-bold rounded-lg transition ${state.activeTab==='my_deliveries'?'bg-white text-primary-800 shadow':'text-white/70'}">
        My Deliveries (${myDeliveries.length})
      </button>
    </div>
  </div>
  <div class="px-4 py-3 space-y-3 pb-24">
    ${list.length === 0 ? `
      <div class="text-center py-16">
        <p class="text-5xl mb-3">📦</p>
        <p class="text-gray-500 text-sm font-medium">${state.activeTab==='available'?'No orders ready for pickup':'No active deliveries'}</p>
        <p class="text-gray-400 text-xs mt-1">Pull down or wait for new orders</p>
      </div>` : list.map(o => renderOrderCard(o)).join('')}
  </div>
  ${renderBottomNav()}${renderToast()}`;
}

function renderOrderCard(order) {
  const isAvailable = order.status === 'shipped';
  const isInTransit = order.status === 'out_for_delivery';
  const isDelivered = order.status === 'delivered';
  const firstItem   = (order.items || [])[0];
  const img = firstItem?.product_image ? `${IMAGE_BASE}${firstItem.product_image}` : '';
  const commission  = Number(order.rider_earning || order.delivery_fee || 0);

  return `<div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" onclick="viewOrder(${JSON.stringify(order).replace(/"/g,'&quot;')})">
    <div class="flex items-center justify-between px-4 pt-3 pb-2">
      <span class="text-[10px] text-gray-400 font-medium">${order.order_number || '#'+order.id}</span>
      <span class="text-[10px] font-bold px-2.5 py-1 rounded-full ${isAvailable?'bg-blue-50 text-blue-600':isInTransit?'bg-orange-50 text-orange-600':'bg-green-50 text-green-600'}">
        ${isAvailable?'📦 READY':isInTransit?'🚗 IN TRANSIT':'✅ DELIVERED'}
      </span>
    </div>
    <div class="px-4 pb-3">
      <div class="flex items-center gap-2 mb-2">
        <svg class="w-3.5 h-3.5 text-primary-800 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/></svg>
        <p class="text-xs text-gray-700 truncate">${order.recipient_name||'Customer'} · ${order.barangay_name||'Bago City'}</p>
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          ${img?`<img src="${img}" class="w-8 h-8 rounded object-cover">`:''}
          <div>
            <span class="text-[11px] text-gray-500">${order.items_count||1} item${(order.items_count||1)>1?'s':''}</span>
            <span class="text-[10px] ml-2 text-green-600 font-semibold">+₱${fmt(commission)} fee</span>
          </div>
        </div>
        <span class="text-sm font-bold text-primary-800">₱${fmt(order.total_amount)}</span>
      </div>
    </div>
  </div>`;
}

function renderOrderDetail() {
  const o = state.selectedOrder; if (!o) { goBack(); return ''; }
  const isAvailable = o.status === 'shipped';
  const isInTransit = o.status === 'out_for_delivery';
  const commission  = Number(o.rider_earning || o.delivery_fee || 0);

  return `
  <div class="bg-primary-800 text-white px-4 pt-12 pb-4">
    <div class="flex items-center gap-3">
      <button onclick="goBack()" class="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
      </button>
      <span class="font-bold text-sm">Order ${o.order_number||'#'+o.id}</span>
    </div>
  </div>
  <div class="px-4 py-4 space-y-3 pb-24">
    <div class="bg-white rounded-xl p-4 border border-gray-100">
      <p class="text-[10px] text-gray-400 uppercase font-bold mb-2">Deliver To</p>
      <p class="text-sm font-bold text-gray-900">${o.recipient_name||'Customer'}</p>
      <p class="text-xs text-gray-500 mt-1">${o.street_address||''}${o.barangay_name?', '+o.barangay_name:''}, Bago City</p>
      ${o.contact_number?`<p class="text-xs text-primary-800 font-semibold mt-2">📞 ${o.contact_number}</p>`:''}
    </div>
    <div class="bg-white rounded-xl p-4 border border-gray-100">
      <p class="text-[10px] text-gray-400 uppercase font-bold mb-2">Items (${o.items_count||(o.items||[]).length})</p>
      ${(o.items||[]).map(item => {
        const img = item.product_image?`${IMAGE_BASE}${item.product_image}`:'';
        const lineSub  = Number(item.item_subtotal  || item.price * item.quantity || 0);
        const lineComm = Number(item.commission_amount || 0);
        const lineTotal= Number(item.item_total || lineSub || 0);
        return `<div class="flex items-center gap-3 py-2 border-t border-gray-50 first:border-0">
          ${img?`<img src="${img}" class="w-12 h-12 rounded-lg object-cover">`:'<div class="w-12 h-12 bg-gray-100 rounded-lg"></div>'}
          <div class="flex-1 min-w-0">
            <p class="text-xs text-gray-800 truncate">${item.product_name}</p>
            <p class="text-[10px] text-gray-400">x${item.quantity} · ${item.store_name||'Store'}</p>
            ${lineComm>0?`<p class="text-[10px] text-amber-600">Platform fee: ₱${fmt(lineComm)}</p>`:''}
          </div>
          <p class="text-xs font-bold">₱${fmt(lineTotal||lineSub)}</p>
        </div>`;
      }).join('')}
      <div class="border-t border-gray-100 mt-2 pt-2 space-y-1">
        <div class="flex justify-between text-xs text-gray-500">
          <span>Seller Subtotal</span><span>₱${fmt(o.subtotal||0)}</span>
        </div>
        ${Number(o.commission_amount||0)>0?`
        <div class="flex justify-between text-xs text-amber-600">
          <span>Platform Commission (2%)</span><span>₱${fmt(o.commission_amount)}</span>
        </div>`:''}
        <div class="flex justify-between text-xs text-green-600 font-semibold">
          <span>Your Shipping Fee</span><span>₱${fmt(commission)}</span>
        </div>
        <div class="flex justify-between text-sm font-bold text-primary-800 pt-1 border-t border-gray-100">
          <span>Total (COD)</span><span>₱${fmt(o.total_amount)}</span>
        </div>
      </div>
    </div>
    ${o.pickup_proof?`
      <div class="bg-white rounded-xl p-4 border border-gray-100">
        <p class="text-[10px] text-gray-400 uppercase font-bold mb-2">Pickup Proof</p>
        <img src="${o.pickup_proof.startsWith('/')?IMAGE_BASE+o.pickup_proof:o.pickup_proof}" class="w-full h-40 object-cover rounded-lg">
      </div>`:''}
    ${o.delivery_proof?`
      <div class="bg-white rounded-xl p-4 border border-gray-100">
        <p class="text-[10px] text-gray-400 uppercase font-bold mb-2">Delivery Proof</p>
        <img src="${o.delivery_proof.startsWith('/')?IMAGE_BASE+o.delivery_proof:o.delivery_proof}" class="w-full h-40 object-cover rounded-lg">
      </div>`:''}
    ${isAvailable?`<button onclick="goToPickup(state.selectedOrder)" class="w-full py-3.5 bg-primary-800 text-white rounded-xl font-bold text-sm">📦 Pick Up This Order</button>`
    :isInTransit ?`<button onclick="goToDeliver(state.selectedOrder)" class="w-full py-3.5 bg-green-600 text-white rounded-xl font-bold text-sm">✅ Mark as Delivered</button>`
    :`<div class="text-center py-3 text-green-600 font-semibold text-sm">✅ Delivered</div>`}
  </div>
  ${renderBottomNav()}${renderToast()}`;
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
  <div class="px-4 py-4 space-y-4 pb-6">
    <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <p class="text-xs text-blue-800 font-semibold mb-1">📦 Confirm Pickup</p>
      <p class="text-[11px] text-blue-600">Take a photo as proof you've picked up the order from the seller.</p>
    </div>
    <div class="bg-white rounded-xl border border-gray-100 p-4">
      <p class="text-xs font-bold text-gray-700 mb-3">Proof of Pickup</p>
      ${state.proofImage?`
        <div class="relative">
          <img src="${state.proofImage}" class="w-full h-48 object-cover rounded-lg border border-gray-200">
          <button onclick="state.proofImage=null; render()" class="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full text-xs font-bold">✕</button>
        </div>
        <button onclick="captureImageFor('proof')" class="w-full mt-3 py-2.5 border border-gray-200 rounded-lg text-xs text-gray-600 font-medium">Retake</button>
      `:`
        <button onclick="captureImageFor('proof')" class="w-full py-8 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center gap-2">
          <span class="text-3xl">📷</span>
          <span class="text-xs text-gray-500 font-medium">Tap to take photo</span>
        </button>`}
    </div>
    <button onclick="pickupOrder(${o.id})" class="w-full py-3.5 bg-primary-800 text-white rounded-xl font-bold text-sm ${state.loading?'opacity-50':''}" ${state.loading?'disabled':''}>
      ${state.loading?'⏳ Processing...':'✓ Confirm Pickup'}
    </button>
  </div>${renderToast()}`;
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
  <div class="px-4 py-4 space-y-4 pb-6">
    <div class="bg-green-50 border border-green-200 rounded-xl p-4">
      <p class="text-xs text-green-800 font-semibold mb-1">✅ Confirm Delivery</p>
      <p class="text-[11px] text-green-600">Take a photo as proof the order was delivered to the customer.</p>
    </div>
    <div class="bg-white rounded-xl border border-gray-100 p-4">
      <p class="text-[10px] text-gray-400 uppercase font-bold mb-1">Delivering To</p>
      <p class="text-sm font-bold text-gray-900">${o.recipient_name||'Customer'}</p>
      <p class="text-xs text-gray-500">${o.street_address||''}${o.barangay_name?', '+o.barangay_name:''}</p>
    </div>
    <div class="bg-white rounded-xl border border-gray-100 p-4">
      <p class="text-xs font-bold text-gray-700 mb-3">Proof of Delivery</p>
      ${state.proofImage?`
        <div class="relative">
          <img src="${state.proofImage}" class="w-full h-48 object-cover rounded-lg border border-gray-200">
          <button onclick="state.proofImage=null; render()" class="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full text-xs font-bold">✕</button>
        </div>
        <button onclick="captureImageFor('proof')" class="w-full mt-3 py-2.5 border border-gray-200 rounded-lg text-xs text-gray-600 font-medium">Retake</button>
      `:`
        <button onclick="captureImageFor('proof')" class="w-full py-8 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center gap-2">
          <span class="text-3xl">📷</span>
          <span class="text-xs text-gray-500 font-medium">Tap to take photo</span>
        </button>`}
    </div>
    <button onclick="deliverOrder(${o.id})" class="w-full py-3.5 bg-green-600 text-white rounded-xl font-bold text-sm ${state.loading?'opacity-50':''}" ${state.loading?'disabled':''}>
      ${state.loading?'⏳ Processing...':'✓ Confirm Delivery'}
    </button>
  </div>${renderToast()}`;
}

// ── EARNINGS PAGE ─────────────────────────────────────────────────────────────
function renderEarnings() {
  const e = state.earnings;
  const periods = [
    { v:'day',   l:'Today' },
    { v:'week',  l:'Week' },
    { v:'month', l:'Month' },
    { v:'year',  l:'Year' },
  ];

  return `
  <div class="bg-primary-800 text-white px-4 pt-12 pb-4 sticky top-0 z-40">
    <p class="font-bold text-base mb-3">💰 Earnings & Collections</p>
    <div class="flex bg-white/10 rounded-xl p-1 gap-1">
      ${periods.map(p => `
        <button onclick="state.earningsPeriod='${p.v}'; fetchEarnings()"
          class="flex-1 py-2 text-xs font-bold rounded-lg transition ${state.earningsPeriod===p.v?'bg-white text-primary-800 shadow':'text-white/70'}">
          ${p.l}
        </button>`).join('')}
    </div>
  </div>
  <div class="px-4 py-4 space-y-4 pb-24">
    ${!e ? `<div class="text-center py-16 text-gray-400 text-sm">Loading...</div>` : `

    <!-- Period label -->
    <p class="text-xs text-gray-400 text-center">${e.start === e.end ? e.start : e.start + ' → ' + e.end}</p>

    <!-- Summary cards -->
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-white rounded-2xl border border-gray-100 p-4">
        <p class="text-[10px] text-gray-400 uppercase mb-1">Deliveries</p>
        <p class="text-2xl font-bold text-primary-800">${fmtN(e.summary?.deliveries_count)}</p>
      </div>
      <div class="bg-yellow-50 rounded-2xl border border-yellow-100 p-4">
        <p class="text-[10px] text-yellow-600 uppercase mb-1">Your Commission</p>
        <p class="text-2xl font-bold text-yellow-700">₱${fmt(e.summary?.total_commission)}</p>
      </div>
      <div class="bg-white rounded-2xl border border-gray-100 p-4">
        <p class="text-[10px] text-gray-400 uppercase mb-1">COD Collected</p>
        <p class="text-xl font-bold text-gray-900">₱${fmt(e.summary?.total_collections)}</p>
      </div>
      <div class="bg-green-50 rounded-2xl border border-green-100 p-4">
        <p class="text-[10px] text-green-600 uppercase mb-1">Shipping Fees</p>
        <p class="text-xl font-bold text-green-700">₱${fmt(e.summary?.total_shipping_fees)}</p>
      </div>
    </div>

    <!-- All-time totals -->
    <div class="bg-primary-800 rounded-2xl p-4 text-white">
      <p class="text-xs text-white/60 uppercase mb-2">All-Time Summary</p>
      <div class="grid grid-cols-3 gap-2 text-center">
        <div>
          <p class="text-lg font-bold">${fmtN(e.all_time?.total_deliveries)}</p>
          <p class="text-[10px] text-white/50">Deliveries</p>
        </div>
        <div>
          <p class="text-lg font-bold">₱${fmt(e.all_time?.lifetime_commission)}</p>
          <p class="text-[10px] text-white/50">Commission</p>
        </div>
        <div>
          <p class="text-lg font-bold">₱${fmt(e.all_time?.lifetime_collections)}</p>
          <p class="text-[10px] text-white/50">Collections</p>
        </div>
      </div>
    </div>

    <!-- Daily chart bars (simple CSS) -->
    ${e.daily_breakdown?.length > 0 ? `
    <div class="bg-white rounded-2xl border border-gray-100 p-4">
      <p class="text-xs font-bold text-gray-700 mb-3">Daily Breakdown</p>
      <div class="space-y-2">
        ${e.daily_breakdown.map(d => {
          const maxComm = Math.max(...e.daily_breakdown.map(x => Number(x.commission)));
          const pct = maxComm > 0 ? (Number(d.commission) / maxComm * 100) : 0;
          return `<div>
            <div class="flex justify-between text-[10px] text-gray-500 mb-0.5">
              <span>${new Date(d.date+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'})}</span>
              <span class="font-semibold text-yellow-700">₱${fmt(d.commission)} · ${fmtN(d.deliveries)} deliv</span>
            </div>
            <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div class="h-full bg-yellow-400 rounded-full" style="width:${pct.toFixed(1)}%"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- Order list -->
    ${e.orders?.length > 0 ? `
    <div class="bg-white rounded-2xl border border-gray-100 p-4">
      <p class="text-xs font-bold text-gray-700 mb-3">Delivered Orders</p>
      <div class="space-y-3">
        ${e.orders.map(o => `
          <div class="border-b border-gray-50 pb-3 last:border-0 last:pb-0">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs font-semibold text-gray-900">${o.order_number}</p>
                <p class="text-[10px] text-gray-400">${o.recipient_name} · ${o.barangay_name}</p>
                <p class="text-[10px] text-gray-400">${new Date(o.delivered_at).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</p>
              </div>
              <div class="text-right">
                <p class="text-xs font-bold text-primary-800">₱${fmt(o.total_amount)}</p>
                <p class="text-[10px] text-yellow-600 font-semibold">+₱${fmt(o.rider_earning||o.delivery_fee)} fee</p>
              </div>
            </div>
            ${o.items?.length > 0 ? `
            <div class="mt-2 space-y-1">
              ${o.items.map(i => `
                <div class="flex justify-between text-[10px] text-gray-500">
                  <span class="truncate max-w-[180px]">${i.product_name} x${i.quantity}</span>
                  <span class="text-amber-500 shrink-0">comm ₱${fmt(i.commission_amount)}</span>
                </div>`).join('')}
            </div>` : ''}
          </div>`).join('')}
      </div>
    </div>` : `<p class="text-center text-gray-400 text-sm py-6">No deliveries in this period.</p>`}
    `}
  </div>
  ${renderBottomNav()}${renderToast()}`;
}

// ── REMITTANCE PAGE ───────────────────────────────────────────────────────────
function renderRemittance() {
  const d  = state.remittanceData;
  const qr = d?.qr_codes || [];
  const list = d?.remittances || [];
  const f  = state.remitForm;

  return `
  <div class="bg-primary-800 text-white px-4 pt-12 pb-4 sticky top-0 z-40">
    <p class="font-bold text-base">📤 Remittance</p>
    <p class="text-xs text-white/50 mt-0.5">Submit COD collections to the marketplace</p>
  </div>
  <div class="px-4 py-4 space-y-4 pb-24">

    ${d ? `
    <!-- Pending amount -->
    <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4">
      <p class="text-xs text-amber-700 font-semibold uppercase mb-1">💰 Pending Remittance</p>
      <p class="text-2xl font-bold text-amber-800">₱${fmt(d.pending_amount)}</p>
      <p class="text-[10px] text-amber-600 mt-1">Total COD collections not yet remitted</p>
    </div>

    <!-- Admin QR codes -->
    ${qr.length > 0 ? `
    <div class="bg-white rounded-2xl border border-gray-100 p-4">
      <p class="text-xs font-bold text-gray-700 mb-3">📱 Remit To</p>
      <div class="space-y-3">
        ${qr.map(q => `
          <div class="border border-gray-100 rounded-xl p-3">
            <div class="flex items-center gap-3">
              ${q.qr_code_image ? `<img src="${IMAGE_BASE}${q.qr_code_image}" class="w-16 h-16 rounded-lg border object-cover">` : `<div class="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">📱</div>`}
              <div>
                <p class="text-xs font-bold text-gray-900">${q.label}</p>
                <p class="text-xs text-gray-500">${q.account_name}</p>
                <p class="text-xs font-semibold text-primary-800">${q.account_number}</p>
              </div>
            </div>
          </div>`).join('')}
      </div>
    </div>` : ''}

    <!-- Submit form -->
    <div class="bg-white rounded-2xl border border-gray-100 p-4">
      <p class="text-xs font-bold text-gray-700 mb-3">Submit Remittance Receipt</p>
      <div class="space-y-3">
        <div>
          <label class="text-[11px] text-gray-500 font-medium block mb-1">Amount Remitted (₱) *</label>
          <input type="number" placeholder="0.00" value="${f.amount}"
            oninput="state.remitForm.amount=this.value"
            class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-800">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[11px] text-gray-500 font-medium block mb-1">Period Start *</label>
            <input type="date" value="${f.period_start}"
              oninput="state.remitForm.period_start=this.value"
              class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-800">
          </div>
          <div>
            <label class="text-[11px] text-gray-500 font-medium block mb-1">Period End *</label>
            <input type="date" value="${f.period_end}"
              oninput="state.remitForm.period_end=this.value"
              class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-800">
          </div>
        </div>
        <div>
          <label class="text-[11px] text-gray-500 font-medium block mb-1">Payment Method</label>
          <input type="text" placeholder="GCash, Maya, Bank Transfer…" value="${f.payment_method}"
            oninput="state.remitForm.payment_method=this.value"
            class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-800">
        </div>
        <div>
          <label class="text-[11px] text-gray-500 font-medium block mb-1">Reference Number</label>
          <input type="text" placeholder="Transaction reference" value="${f.reference_number}"
            oninput="state.remitForm.reference_number=this.value"
            class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-800">
        </div>
        <div>
          <label class="text-[11px] text-gray-500 font-medium block mb-1">Receipt Photo *</label>
          ${f.receipt_image ? `
            <div class="relative">
              <img src="${f.receipt_image}" class="w-full h-40 object-cover rounded-xl border border-gray-200">
              <button onclick="state.remitForm.receipt_image=null; render()" class="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full text-xs font-bold">✕</button>
            </div>
            <button onclick="captureImageFor('receipt')" class="w-full mt-2 py-2 border border-gray-200 rounded-xl text-xs text-gray-600">Retake</button>
          ` : `
            <button onclick="captureImageFor('receipt')" class="w-full py-6 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center gap-2">
              <span class="text-2xl">📷</span>
              <span class="text-xs text-gray-500">Tap to attach receipt</span>
            </button>`}
        </div>
        <div>
          <label class="text-[11px] text-gray-500 font-medium block mb-1">Notes</label>
          <textarea placeholder="Optional notes…" oninput="state.remitForm.notes=this.value" rows="2"
            class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-800 resize-none">${f.notes}</textarea>
        </div>
        <button onclick="submitRemittance()" class="w-full py-3.5 bg-primary-800 text-white rounded-xl font-bold text-sm ${state.loading?'opacity-50':''}" ${state.loading?'disabled':''}>
          ${state.loading?'⏳ Submitting...':'📤 Submit Remittance'}
        </button>
      </div>
    </div>

    <!-- History -->
    ${list.length > 0 ? `
    <div class="bg-white rounded-2xl border border-gray-100 p-4">
      <p class="text-xs font-bold text-gray-700 mb-3">Remittance History</p>
      <div class="space-y-3">
        ${list.map(r => {
          const statusColor = r.status==='verified'?'text-green-600 bg-green-50':r.status==='rejected'?'text-red-600 bg-red-50':'text-yellow-600 bg-yellow-50';
          return `<div class="border border-gray-100 rounded-xl p-3">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-xs font-bold text-gray-900">₱${fmt(r.amount)}</p>
                <p class="text-[10px] text-gray-400">${r.period_start} → ${r.period_end}</p>
                ${r.payment_method?`<p class="text-[10px] text-gray-400">${r.payment_method}${r.reference_number?' · #'+r.reference_number:''}</p>`:''}
                ${r.rejection_reason?`<p class="text-[10px] text-red-500 mt-1">${r.rejection_reason}</p>`:''}
              </div>
              <span class="text-[10px] font-bold px-2 py-1 rounded-full ${statusColor}">${r.status.toUpperCase()}</span>
            </div>
            ${r.receipt_image?`<img src="${IMAGE_BASE}${r.receipt_image}" class="w-full h-24 object-cover rounded-lg mt-2 border">` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}
    ` : `<div class="text-center py-16 text-gray-400 text-sm">Loading...</div>`}
  </div>
  ${renderBottomNav()}${renderToast()}`;
}

// ── WALLET / PAYMENT ACCOUNTS PAGE ───────────────────────────────────────────
function renderWallet() {
  const accounts = state.accounts;
  const f = state.walletForm;
  const types = ['gcash','maya','bank','others'];
  const typeLabels = { gcash:'GCash', maya:'Maya', bank:'Bank Account', others:'Other' };

  return `
  <div class="bg-primary-800 text-white px-4 pt-12 pb-4 sticky top-0 z-40">
    <p class="font-bold text-base">💳 My Payment Accounts</p>
    <p class="text-xs text-white/50 mt-0.5">E-wallets and bank accounts for receiving payments</p>
  </div>
  <div class="px-4 py-4 space-y-4 pb-24">

    <!-- Account list -->
    ${accounts.length > 0 ? `
    <div class="space-y-3">
      ${accounts.map(a => {
        const typeIcon = a.type==='gcash'?'💙':a.type==='maya'?'💚':a.type==='bank'?'🏦':'💳';
        return `<div class="bg-white rounded-2xl border border-gray-100 p-4">
          <div class="flex items-start gap-3">
            <span class="text-2xl">${typeIcon}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-sm font-bold text-gray-900">${a.label}</p>
                ${a.is_primary?`<span class="text-[9px] bg-primary-100 text-primary-800 px-1.5 py-0.5 rounded-full font-bold">PRIMARY</span>`:''}
              </div>
              <p class="text-xs text-gray-600">${a.account_name}</p>
              <p class="text-xs font-semibold text-primary-800">${a.account_number}</p>
            </div>
            ${a.qr_code_image?`<img src="${IMAGE_BASE}${a.qr_code_image}" class="w-12 h-12 rounded-lg border object-cover shrink-0">`:''}
          </div>
          <div class="flex gap-2 mt-3">
            <button onclick="state.walletForm={account_id:${a.id},type:'${a.type}',label:'${a.label}',account_name:'${a.account_name}',account_number:'${a.account_number}',qr_code_image:'${a.qr_code_image||''}',is_primary:${a.is_primary?'true':'false'}};state.walletEditing=true;render()"
              class="flex-1 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600">✏️ Edit</button>
            <button onclick="deleteAccount(${a.id})"
              class="flex-1 py-2 border border-red-100 rounded-lg text-xs font-medium text-red-500">🗑 Remove</button>
          </div>
        </div>`;
      }).join('')}
    </div>` : `
    <div class="text-center py-8 text-gray-400">
      <p class="text-4xl mb-2">💳</p>
      <p class="text-sm">No payment accounts yet.</p>
      <p class="text-xs mt-1">Add one below to receive payments.</p>
    </div>`}

    <!-- Add / edit form -->
    <div class="bg-white rounded-2xl border border-gray-100 p-4">
      <p class="text-xs font-bold text-gray-700 mb-3">${state.walletEditing ? '✏️ Edit Account' : '➕ Add Account'}</p>
      <div class="space-y-3">
        <div>
          <label class="text-[11px] text-gray-500 font-medium block mb-1">Account Type</label>
          <div class="grid grid-cols-4 gap-2">
            ${types.map(t => `
              <button onclick="state.walletForm.type='${t}';state.walletForm.label='${typeLabels[t]}';render()"
                class="py-2 rounded-xl text-xs font-bold border transition ${f.type===t?'bg-primary-800 text-white border-primary-800':'bg-gray-50 text-gray-600 border-gray-200'}">
                ${t==='gcash'?'💙 GCash':t==='maya'?'💚 Maya':t==='bank'?'🏦 Bank':'💳 Other'}
              </button>`).join('')}
          </div>
        </div>
        <div>
          <label class="text-[11px] text-gray-500 font-medium block mb-1">Label</label>
          <input type="text" placeholder="e.g. GCash Personal" value="${f.label}"
            oninput="state.walletForm.label=this.value"
            class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-800">
        </div>
        <div>
          <label class="text-[11px] text-gray-500 font-medium block mb-1">Account Name *</label>
          <input type="text" placeholder="Your full name" value="${f.account_name}"
            oninput="state.walletForm.account_name=this.value"
            class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-800">
        </div>
        <div>
          <label class="text-[11px] text-gray-500 font-medium block mb-1">Account Number *</label>
          <input type="text" placeholder="Phone number or account number" value="${f.account_number}"
            oninput="state.walletForm.account_number=this.value"
            class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-800">
        </div>
        <div>
          <label class="text-[11px] text-gray-500 font-medium block mb-1">QR Code (optional)</label>
          ${f.qr_code_image && f.qr_code_image.length > 5 ? `
            <div class="flex items-center gap-3">
              <img src="${f.qr_code_image.startsWith('data:')?f.qr_code_image:IMAGE_BASE+f.qr_code_image}" class="w-16 h-16 rounded-lg border object-cover">
              <div class="flex-1">
                <button onclick="captureImageFor('wallet_qr')" class="w-full py-2 border border-gray-200 rounded-xl text-xs text-gray-600">Change QR</button>
                <button onclick="state.walletForm.qr_code_image=null;render()" class="w-full mt-1 py-1.5 border border-red-100 rounded-xl text-xs text-red-500">Remove</button>
              </div>
            </div>` : `
            <button onclick="captureImageFor('wallet_qr')" class="w-full py-5 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center gap-1.5">
              <span class="text-2xl">📷</span>
              <span class="text-xs text-gray-500">Tap to upload QR code</span>
            </button>`}
        </div>
        <label class="flex items-center gap-2">
          <input type="checkbox" ${f.is_primary?'checked':''} onchange="state.walletForm.is_primary=this.checked" class="rounded">
          <span class="text-xs text-gray-600">Set as primary account</span>
        </label>
        <div class="flex gap-3">
          ${state.walletEditing ? `
            <button onclick="state.walletEditing=false;state.walletForm={account_id:null,type:'gcash',label:'GCash',account_name:'',account_number:'',qr_code_image:null,is_primary:false};render()"
              class="flex-1 py-3 border rounded-xl text-sm font-medium text-gray-600">Cancel</button>` : ''}
          <button onclick="saveWalletAccount()" class="flex-1 py-3 bg-primary-800 text-white rounded-xl font-bold text-sm ${state.loading?'opacity-50':''}" ${state.loading?'disabled':''}>
            ${state.loading?'⏳ Saving...':'💾 Save Account'}
          </button>
        </div>
      </div>
    </div>
  </div>
  ${renderBottomNav()}${renderToast()}`;
}

function renderToast() {
  if (!state.toast) return '';
  const colors = { success:'bg-green-500', error:'bg-red-500', info:'bg-primary-800', warning:'bg-amber-500' };
  return `<div class="fixed top-4 left-4 right-4 z-[999]">
    <div class="${colors[state.toast.type]||colors.info} text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-lg text-center">
      ${state.toast.message}
    </div>
  </div>`;
}

// ── Init ──────────────────────────────────────────────────────────────────────
render();
if (state.token) {
  fetchOrders();
  fetchEarnings();
  startPolling();
}
