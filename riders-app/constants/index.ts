export const COLORS = {
  primary: '#0F2D69',
  primaryLight: '#1a3f8f',
  primaryDark: '#0a1f4a',
  accent: '#FF6B35',
  success: '#10b981',
  successLight: '#d1fae5',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  danger: '#ef4444',
  dangerLight: '#fee2e2',
  blue: '#3b82f6',
  blueLight: '#dbeafe',

  bg: '#f5f7fa',
  card: '#ffffff',
  border: '#f0f2f5',
  borderDark: '#e5e7eb',

  text: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  textLight: '#d1d5db',
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
};

export const CANCEL_REASONS = [
  'Customer is unreachable',
  'Wrong address / Cannot locate',
  'Customer refused to accept',
  'Item damaged during transit',
  'Vehicle breakdown',
  'Weather conditions',
  'Personal emergency',
  'Others',
];
