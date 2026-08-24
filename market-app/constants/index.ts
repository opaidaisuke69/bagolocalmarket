export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
];

export const CATEGORIES = [
  { id: 1, name: 'Food & Beverages', slug: 'food-beverages', icon: 'utensils' },
  { id: 2, name: 'Clothing', slug: 'clothing', icon: 'shirt' },
  { id: 3, name: 'Electronics', slug: 'electronics', icon: 'smartphone' },
  { id: 4, name: 'Home & Living', slug: 'home-living', icon: 'home' },
  { id: 5, name: 'Beauty & Care', slug: 'beauty-personal-care', icon: 'sparkles' },
  { id: 6, name: 'Agriculture', slug: 'agriculture', icon: 'leaf' },
  { id: 7, name: 'Local Products', slug: 'local-products', icon: 'map-pin' },
  { id: 8, name: 'Handmade', slug: 'handmade-products', icon: 'hand' },
  { id: 9, name: 'School Supplies', slug: 'school-supplies', icon: 'book-open' },
  { id: 10, name: 'Accessories', slug: 'accessories', icon: 'watch' },
];

export const COLORS = {
  primary: {
    900: '#0D0B61',
    800: '#112E81',
    700: '#133458',
    600: '#1a4a7a',
    500: '#1e5a9e',
    400: '#3b82d6',
    300: '#7baeec',
    200: '#bdd4f5',
    100: '#dce8fa',
    50: '#eef4fd',
  },
  accent: {
    500: '#eab308',
    400: '#FFF449',
    300: '#FFF78D',
    200: '#FEF2A0',
    100: '#fef9c3',
    50: '#fefce8',
  },
  gray: {
    900: '#111827',
    800: '#1f2937',
    700: '#374151',
    600: '#4b5563',
    500: '#6b7280',
    400: '#9ca3af',
    300: '#d1d5db',
    200: '#e5e7eb',
    100: '#f3f4f6',
    50: '#f9fafb',
  },
};
