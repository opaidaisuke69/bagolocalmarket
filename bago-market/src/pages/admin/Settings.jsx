import { useState, useEffect } from 'react';
import { Save, Settings as SettingsIcon, DollarSign, Store, Bell, Shield, RefreshCw } from 'lucide-react';
import { adminAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';

const SECTION = ({ icon: Icon, title, description, children }) => (
  <div className="bg-white rounded-xl border overflow-hidden">
    <div className="px-5 py-4 border-b bg-gray-50 flex items-center gap-3">
      <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
        <Icon size={16} className="text-primary-700" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
    </div>
    <div className="p-5 space-y-4">{children}</div>
  </div>
);

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
    {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
  </div>
);

export default function Settings() {
  const [settings, setSettings] = useState({
    platform_name:          'Bago Shop Express',
    platform_email:         '',
    platform_contact:       '',
    commission_rate:        2,
    min_order_amount:       0,
    max_order_amount:       0,
    shipping_base_fee:      50,
    shipping_per_km:        10,
    free_shipping_threshold:0,
    maintenance_mode:       false,
    allow_new_sellers:      true,
    allow_new_buyers:       true,
    order_auto_cancel_days: 3,
    payout_min_amount:      500,
  });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await adminAPI.getSettings();
        if (res.data.settings) setSettings(s => ({ ...s, ...res.data.settings }));
      } catch { /* use defaults */ }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminAPI.saveSettings(settings);
      showToast('Settings saved successfully.', 'success');
    } catch {
      showToast('Failed to save settings.', 'error');
    }
    setSaving(false);
  };

  const set = (key, val) => setSettings(s => ({ ...s, [key]: val }));

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <RefreshCw size={20} className="animate-spin mr-2" /> Loading settings…
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Platform Settings</h2>
          <p className="text-sm text-gray-500 mt-0.5">Configure global platform behavior and fees</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary-800 text-white text-sm font-medium rounded-lg hover:bg-primary-900 disabled:opacity-50 transition-colors">
          <Save size={15} /> {saving ? 'Saving…' : 'Save All Settings'}
        </button>
      </div>

      {/* Platform Info */}
      <SECTION icon={Store} title="Platform Information" description="Basic platform identity settings">
        <Field label="Platform Name">
          <input type="text" value={settings.platform_name}
            onChange={e => set('platform_name', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Support Email">
            <input type="email" value={settings.platform_email}
              onChange={e => set('platform_email', e.target.value)}
              placeholder="support@example.com"
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
          </Field>
          <Field label="Contact Number">
            <input type="text" value={settings.platform_contact}
              onChange={e => set('platform_contact', e.target.value)}
              placeholder="+63 9XX XXX XXXX"
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
          </Field>
        </div>
      </SECTION>

      {/* Commission & Fees */}
      <SECTION icon={DollarSign} title="Commission & Fees" description="Financial rates applied to marketplace transactions">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Platform Commission Rate (%)"
            hint="Percentage deducted from each delivered order (currently hardcoded as 2% in order logic)">
            <div className="relative">
              <input type="number" value={settings.commission_rate}
                onChange={e => set('commission_rate', parseFloat(e.target.value) || 0)}
                min={0} max={100} step={0.1}
                className="w-full px-3 py-2 pr-8 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
            </div>
          </Field>
          <Field label="Min Payout Amount (₱)"
            hint="Minimum seller balance before a payout can be created">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₱</span>
              <input type="number" value={settings.payout_min_amount}
                onChange={e => set('payout_min_amount', parseFloat(e.target.value) || 0)}
                min={0}
                className="w-full pl-7 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Base Shipping Fee (₱)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₱</span>
              <input type="number" value={settings.shipping_base_fee}
                onChange={e => set('shipping_base_fee', parseFloat(e.target.value) || 0)}
                min={0}
                className="w-full pl-7 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
            </div>
          </Field>
          <Field label="Fee Per Km (₱)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₱</span>
              <input type="number" value={settings.shipping_per_km}
                onChange={e => set('shipping_per_km', parseFloat(e.target.value) || 0)}
                min={0}
                className="w-full pl-7 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
            </div>
          </Field>
          <Field label="Free Shipping Threshold (₱)"
            hint="0 = disabled">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₱</span>
              <input type="number" value={settings.free_shipping_threshold}
                onChange={e => set('free_shipping_threshold', parseFloat(e.target.value) || 0)}
                min={0}
                className="w-full pl-7 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Min Order Amount (₱)" hint="0 = no minimum">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₱</span>
              <input type="number" value={settings.min_order_amount}
                onChange={e => set('min_order_amount', parseFloat(e.target.value) || 0)}
                min={0}
                className="w-full pl-7 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
            </div>
          </Field>
          <Field label="Auto-Cancel Orders After (days)"
            hint="Unconfirmed orders cancelled after this many days. 0 = disabled.">
            <input type="number" value={settings.order_auto_cancel_days}
              onChange={e => set('order_auto_cancel_days', parseInt(e.target.value) || 0)}
              min={0}
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
          </Field>
        </div>
      </SECTION>

      {/* Access Control */}
      <SECTION icon={Shield} title="Access & Registration" description="Control who can register and use the platform">
        {[
          { key: 'allow_new_sellers', label: 'Allow new seller registrations', hint: 'When off, seller registration form is disabled.' },
          { key: 'allow_new_buyers',  label: 'Allow new buyer registrations',  hint: 'When off, buyer sign-up is disabled.' },
        ].map(({ key, label, hint }) => (
          <label key={key} className="flex items-start gap-3 cursor-pointer select-none p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="relative mt-0.5">
              <input type="checkbox" checked={!!settings[key]}
                onChange={e => set(key, e.target.checked)} className="sr-only" />
              <div className={`w-9 h-5 rounded-full transition-colors ${settings[key] ? 'bg-primary-800' : 'bg-gray-300'}`} />
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings[key] ? 'translate-x-4' : ''}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{label}</p>
              <p className="text-xs text-gray-400">{hint}</p>
            </div>
          </label>
        ))}
      </SECTION>

      {/* Maintenance */}
      <SECTION icon={SettingsIcon} title="Maintenance Mode" description="Take the platform offline for maintenance">
        <label className="flex items-start gap-3 cursor-pointer select-none p-3 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors">
          <div className="relative mt-0.5">
            <input type="checkbox" checked={!!settings.maintenance_mode}
              onChange={e => set('maintenance_mode', e.target.checked)} className="sr-only" />
            <div className={`w-9 h-5 rounded-full transition-colors ${settings.maintenance_mode ? 'bg-orange-500' : 'bg-gray-300'}`} />
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.maintenance_mode ? 'translate-x-4' : ''}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-orange-900">Enable Maintenance Mode</p>
            <p className="text-xs text-orange-700">
              When enabled, all non-admin users see a maintenance screen. Admins can still log in.
            </p>
          </div>
        </label>
      </SECTION>

      {/* Save button (bottom) */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary-800 text-white text-sm font-medium rounded-lg hover:bg-primary-900 disabled:opacity-50 transition-colors">
          <Save size={15} /> {saving ? 'Saving…' : 'Save All Settings'}
        </button>
      </div>
    </div>
  );
}
