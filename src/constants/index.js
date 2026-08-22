export const API_BASE_URL = '/api';

export const BARANGAYS = [
  'Abuanan', 'Alianza', 'Atipuluan', 'Bagroy', 'Balingasag',
  'Binubuhan', 'Busay', 'Calumangan', 'Caridad', 'Dulao',
  'Ilijan', 'Jorge L. Araneta', 'Lag-Asan', 'Ma-ao', 'Mailum',
  'Malingin', 'Napoles', 'Pacol', 'Población', 'Sagasa',
  'Sampinit', 'Tabunan', 'Taloc'
];

export const ORDER_STATUSES = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800' },
  preparing: { label: 'Preparing', color: 'bg-indigo-100 text-indigo-800' },
  ready_to_ship: { label: 'Ready to Ship', color: 'bg-purple-100 text-purple-800' },
  shipped: { label: 'Shipped', color: 'bg-cyan-100 text-cyan-800' },
  out_for_delivery: { label: 'Out for Delivery', color: 'bg-orange-100 text-orange-800' },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' }
};

export const PRODUCT_CONDITIONS = [
  { value: 'new', label: 'Brand New' },
  { value: 'used', label: 'Used' },
  { value: 'refurbished', label: 'Refurbished' }
];

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'best_selling', label: 'Best Selling' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' }
];

export const COLORS = {
  primary: {
    dark: '#0D0B61',
    medium: '#112E81',
    main: '#133458',
  },
  accent: {
    bright: '#FFF449',
    medium: '#FFF78D',
    light: '#FEF2A0',
  }
};
