import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Loader2, Palette, Plus } from 'lucide-react';
import { productsAPI, categoriesAPI, barangaysAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { PRODUCT_CONDITIONS } from '../../constants';

// Categories that support color variants
const COLOR_VARIANT_CATEGORIES = [
  'clothing',
  'accessories',
  'beauty-personal-care',
  'home-living',
  'handmade-products',
  'school-supplies',
  'others',
];

// Preset colors for quick selection
const PRESET_COLORS = [
  { label: 'Red',        hex: '#EF4444' },
  { label: 'Orange',     hex: '#F97316' },
  { label: 'Yellow',     hex: '#EAB308' },
  { label: 'Green',      hex: '#22C55E' },
  { label: 'Blue',       hex: '#3B82F6' },
  { label: 'Indigo',     hex: '#6366F1' },
  { label: 'Violet',     hex: '#8B5CF6' },
  { label: 'Pink',       hex: '#EC4899' },
  { label: 'White',      hex: '#FFFFFF' },
  { label: 'Black',      hex: '#111827' },
  { label: 'Gray',       hex: '#6B7280' },
  { label: 'Brown',      hex: '#92400E' },
  { label: 'Navy',       hex: '#1E3A5F' },
  { label: 'Beige',      hex: '#D4B896' },
  { label: 'Maroon',     hex: '#7F1D1D' },
  { label: 'Teal',       hex: '#0D9488' },
];

function ColorVariantRow({ variant, idx, onUpdate, onRemove, onUploadImage, uploadingIdx }) {
  const fileRef = useRef(null);

  return (
    <div className="border rounded-xl p-4 space-y-3 bg-gray-50">
      {/* Row 1: Color picker + preset chips + remove */}
      <div className="flex items-center gap-3">
        {/* Color circle / native picker */}
        <div className="relative flex-shrink-0">
          <div
            className="w-9 h-9 rounded-full border-2 border-gray-300 cursor-pointer shadow-sm"
            style={{ backgroundColor: variant.hex || '#CCCCCC' }}
            onClick={() => document.getElementById(`color-input-${idx}`)?.click()}
            title="Pick color"
          />
          <input
            id={`color-input-${idx}`}
            type="color"
            value={variant.hex || '#CCCCCC'}
            onChange={(e) => onUpdate(idx, 'hex', e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            style={{ position: 'absolute', top: 0, left: 0 }}
          />
        </div>

        {/* Preset chips */}
        <div className="flex flex-wrap gap-1.5 flex-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.label}
              onClick={() => { onUpdate(idx, 'hex', c.hex); onUpdate(idx, 'value', c.label); }}
              className={`w-5 h-5 rounded-full border-2 transition-all ${variant.hex === c.hex ? 'border-primary-800 scale-110' : 'border-gray-300 hover:scale-110'}`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>

        <button type="button" onClick={() => onRemove(idx)}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Row 2: Color name + image upload side by side */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Color Name *</label>
          <input
            type="text"
            value={variant.value}
            onChange={(e) => onUpdate(idx, 'value', e.target.value)}
            placeholder="e.g. Sky Blue"
            className="w-full px-2.5 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none"
          />
        </div>

        {/* Color image upload */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Color Image</label>
          {variant.imagePreview || variant.image_url ? (
            <div className="relative group w-[4.5rem]">
              <img
                src={variant.imagePreview || variant.image_url}
                alt="color variant"
                className="w-[4.5rem] h-[4.5rem] object-cover rounded-lg border cursor-pointer"
                onClick={() => fileRef.current?.click()}
              />
              <button
                type="button"
                onClick={() => { onUpdate(idx, 'imagePreview', null); onUpdate(idx, 'image_url', null); }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={9} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingIdx === idx}
              className="w-[4.5rem] h-[4.5rem] flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-primary-400 hover:text-primary-600 transition-colors disabled:opacity-50"
            >
              {uploadingIdx === idx
                ? <Loader2 size={16} className="animate-spin" />
                : <><Upload size={16} /><span className="text-[10px]">Upload</span></>}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { if (e.target.files[0]) onUploadImage(idx, e.target.files[0]); }}
          />
        </div>
      </div>
    </div>
  );
}

export default function AddProduct() {
  const { user } = useAuth();
  const sellerBarangayId = user?.profile?.barangay_id || '';

  const [form, setForm] = useState({
    name: '', description: '', category_id: '', price: '', stock: '',
    condition: 'new', brand: '', sku: '', barangay_id: '', is_available: true
  });
  const [variations, setVariations] = useState([]);
  const [colorVariants, setColorVariants] = useState([]);
  const [images, setImages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingColorIdx, setUploadingColorIdx] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    Promise.all([categoriesAPI.list(), barangaysAPI.list()]).then(([catRes, brgRes]) => {
      setCategories(catRes.data.categories);
      setBarangays(brgRes.data.barangays);
    });
  }, []);

  useEffect(() => {
    if (sellerBarangayId && !form.barangay_id) {
      setForm(prev => ({ ...prev, barangay_id: String(sellerBarangayId) }));
    }
  }, [sellerBarangayId]);

  // Derive whether the selected category supports color variants
  const selectedCategory = categories.find(c => String(c.id) === String(form.category_id));
  const supportsColorVariants = selectedCategory
    ? COLOR_VARIANT_CATEGORIES.includes(selectedCategory.slug)
    : false;

  // Reset color variants when category changes to a non-color one
  useEffect(() => {
    if (!supportsColorVariants && colorVariants.length > 0) {
      setColorVariants([]);
    }
  }, [supportsColorVariants]);

  const handleImageUpload = async (files) => {
    if (images.length + files.length > 8) {
      showToast('Maximum 8 images allowed.', 'warning');
      return;
    }
    setUploading(true);
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('image', file);
        const res = await productsAPI.upload(formData);
        setImages(prev => [...prev, { url: res.data.url, preview: URL.createObjectURL(file) }]);
      } catch {
        showToast('Failed to upload image.', 'error');
      }
    }
    setUploading(false);
  };

  const handleColorImageUpload = async (idx, file) => {
    setUploadingColorIdx(idx);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await productsAPI.upload(formData);
      setColorVariants(prev => prev.map((v, i) => i === idx
        ? { ...v, image_url: res.data.url, imagePreview: URL.createObjectURL(file) }
        : v
      ));
    } catch {
      showToast('Failed to upload color image.', 'error');
    } finally {
      setUploadingColorIdx(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) handleImageUpload(files);
  };

  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const addColorVariant = () => {
    setColorVariants(prev => [...prev, {
      hex: '#3B82F6',
      value: '',
      image_url: null,
      imagePreview: null,
    }]);
  };

  const updateColorVariant = (idx, field, value) => {
    setColorVariants(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));
  };

  const removeColorVariant = (idx) => {
    setColorVariants(prev => prev.filter((_, i) => i !== idx));
  };

  const addVariation = () => {
    setVariations(prev => [...prev, { name: '', value: '', price: '', stock: '' }]);
  };

  const removeVariation = (idx) => {
    setVariations(prev => prev.filter((_, i) => i !== idx));
  };

  const updateVariation = (idx, field, value) => {
    setVariations(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));
  };

  // Color variants carry no price/stock of their own.
  // Price comes from plain variants (or base price field).
  // Stock for each color = sum of plain variant stocks (or base stock field).
  const plainVariantStock = variations.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
  const colorStock = variations.length > 0 ? plainVariantStock : (parseInt(form.stock) || 0);

  const hasVariants = colorVariants.length > 0 || variations.length > 0;
  const variantPrices = variations.map(v => parseFloat(v.price)).filter(p => p > 0);
  const minVariantPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : null;
  const maxVariantPrice = variantPrices.length > 0 ? Math.max(...variantPrices) : null;
  const totalVariantStock = variations.length > 0 ? plainVariantStock : (parseInt(form.stock) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.category_id) {
      showToast('Please fill in required fields.', 'warning');
      return;
    }
    if (hasVariants === false && !form.price) {
      showToast('Please enter a price.', 'warning');
      return;
    }

    // Validate color variants — only name required (no price/stock)
    for (const v of colorVariants) {
      if (!v.value.trim()) {
        showToast('Each color variant must have a color name.', 'warning');
        return;
      }
    }

    // Validate plain variants
    for (const v of variations) {
      if (!v.name.trim() || !v.value.trim()) {
        showToast('Each variant must have a type and value.', 'warning');
        return;
      }
      if (!v.price || parseFloat(v.price) <= 0) {
        showToast('Each variant must have a valid price.', 'warning');
        return;
      }
    }

    setLoading(true);
    try {
      // Base price: lowest plain variant price, or base form price
      const basePrice = variations.length > 0
        ? Math.min(...variations.map(v => parseFloat(v.price) || 0))
        : parseFloat(form.price);

      // Base stock: sum of plain variant stocks, or base form stock
      const baseStock = variations.length > 0
        ? variations.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)
        : parseInt(form.stock) || 0;

      // Build the full variations list:
      // - Color variants: price_adjustment=0, stock=colorStock (synced from plain variants / base)
      // - Plain variants: price_adjustment relative to basePrice, their own stock
      const variationsPayload = [
        ...colorVariants.map(v => ({
          name: 'Color',
          value: v.value.trim(),
          price_adjustment: 0,
          stock: colorStock,
          image_url: v.image_url || null,
          hex: v.hex || null,
        })),
        ...variations.map(v => ({
          name: v.name.trim(),
          value: v.value.trim(),
          price_adjustment: parseFloat((parseFloat(v.price) - basePrice).toFixed(2)),
          stock: parseInt(v.stock) || 0,
          image_url: null,
          hex: null,
        })),
      ];

      const payload = {
        ...form,
        price: basePrice,
        stock: baseStock,
        images: images.map(img => ({ url: img.url })),
        variations: variationsPayload,
      };
      await productsAPI.create(payload);
      showToast('Product created successfully! Awaiting admin approval.', 'success');
      navigate('/seller/products');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create product.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Images */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Product Images</h3>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary-800 bg-primary-50' : 'border-gray-300 hover:border-gray-400'}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={32} className="mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">Drag & drop images here or click to upload</p>
            <p className="text-xs text-gray-400 mt-1">Max 8 images • JPG, PNG, WebP • Max 5MB each</p>
            <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={(e) => handleImageUpload(Array.from(e.target.files))} className="hidden" />
          </div>

          {uploading && <p className="text-sm text-primary-800 mt-2 animate-pulse">Uploading...</p>}

          {images.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-4">
              {images.map((img, idx) => (
                <div key={idx} className="relative group">
                  <img src={img.preview || img.url} alt="" className="w-20 h-20 object-cover rounded-lg border" />
                  {idx === 0 && <span className="absolute -top-1 -left-1 bg-primary-800 text-white text-[9px] px-1.5 py-0.5 rounded font-medium">Primary</span>}
                  <button type="button" onClick={() => removeImage(idx)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Basic Info */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Basic Information</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
              className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none" placeholder="Enter product name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4}
              className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none resize-none" placeholder="Describe your product..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none">
                <option value="">Select Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
              <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none">
                {PRODUCT_CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Pricing & Stock */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Pricing & Stock</h3>

          {variations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price Range</label>
                <div className="px-3 py-2.5 border rounded-lg bg-primary-50 border-primary-200 text-sm font-semibold text-primary-800">
                  {minVariantPrice !== null
                    ? minVariantPrice === maxVariantPrice
                      ? `₱${minVariantPrice.toFixed(2)}`
                      : `₱${minVariantPrice.toFixed(2)} – ₱${maxVariantPrice.toFixed(2)}`
                    : '—'}
                </div>
                <p className="text-xs text-gray-400 mt-1">Auto-computed from variants</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Stock</label>
                <div className="px-3 py-2.5 border rounded-lg bg-primary-50 border-primary-200 text-sm font-semibold text-primary-800">
                  {totalVariantStock}
                </div>
                <p className="text-xs text-gray-400 mt-1">Sum of all variant stocks</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none" placeholder="Optional" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Price (₱) *</label>
                <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none" placeholder="0.00" />
                {form.price > 0 && (
                  <p className="text-xs mt-1 text-gray-500">
                    Listed: <strong className="text-primary-800">₱{parseFloat(form.price).toFixed(2)}</strong>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
                <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none" placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none" placeholder="Optional" />
              </div>
            </div>
          )}
        </div>

        {/* ── Color Variants (shown only for color-eligible categories) ── */}
        {supportsColorVariants && (
          <div className="bg-white rounded-xl border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Palette size={16} className="text-primary-700" /> Color Variants
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {variations.length > 0
                    ? 'Color stock auto-syncs from the other variants above'
                    : 'Colors share the base price & stock set above'}
                </p>
              </div>
              <button type="button" onClick={addColorVariant}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-800 border border-primary-200 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors">
                <Plus size={14} /> Add Color
              </button>
            </div>

            {colorVariants.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4 border-2 border-dashed rounded-xl">
                No color variants yet. Click "Add Color" to define colors.
              </p>
            ) : (
              <div className="space-y-3">
                {colorVariants.map((v, idx) => (
                  <ColorVariantRow
                    key={idx}
                    variant={v}
                    idx={idx}
                    onUpdate={updateColorVariant}
                    onRemove={removeColorVariant}
                    onUploadImage={handleColorImageUpload}
                    uploadingIdx={uploadingColorIdx}
                  />
                ))}
                {/* Stock sync note */}
                <div className="px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 flex items-center gap-2">
                  <span className="font-semibold">Stock:</span>
                  {variations.length > 0
                    ? <span>Auto-synced from other variants — <strong>{colorStock}</strong> units per color</span>
                    : <span>Shared from base stock — <strong>{colorStock}</strong> units per color</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Plain Variants */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">
                {supportsColorVariants ? 'Other Variants' : 'Product Variants'}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {hasVariants
                  ? 'Price & stock are computed automatically from variants below'
                  : 'Optional — add sizes, units, or options with individual prices'}
              </p>
            </div>
            <button type="button" onClick={addVariation}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-800 border border-primary-200 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors">
              <span className="text-base leading-none">+</span> Add Variant
            </button>
          </div>

          {variations.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4 border-2 border-dashed rounded-xl">
              {supportsColorVariants
                ? 'No other variants. Add sizes or units here.'
                : 'No variants yet. Click "Add Variant" to define sizes, units, etc.'}
            </p>
          ) : (
            <div className="space-y-3">
              <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 px-1">
                <span className="col-span-3">Type (e.g. Size)</span>
                <span className="col-span-3">Value (e.g. Large)</span>
                <span className="col-span-3">Price (₱)</span>
                <span className="col-span-2">Stock</span>
                <span className="col-span-1"></span>
              </div>
              {variations.map((v, idx) => {
                const listedPrice = v.price && parseFloat(v.price) > 0
                  ? parseFloat(v.price).toFixed(2)
                  : null;
                return (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                    <input type="text" value={v.name} onChange={(e) => updateVariation(idx, 'name', e.target.value)}
                      placeholder="e.g. Size"
                      className="col-span-6 sm:col-span-3 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none" />
                    <input type="text" value={v.value} onChange={(e) => updateVariation(idx, 'value', e.target.value)}
                      placeholder="e.g. Large"
                      className="col-span-6 sm:col-span-3 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none" />
                    <div className="col-span-5 sm:col-span-3">
                      <input type="number" step="0.01" min="0" value={v.price} onChange={(e) => updateVariation(idx, 'price', e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none" />
                      {listedPrice && (
                        <p className="text-[10px] text-gray-400 mt-0.5 pl-0.5">Listed: <strong className="text-primary-800">₱{listedPrice}</strong></p>
                      )}
                    </div>
                    <input type="number" min="0" value={v.stock} onChange={(e) => updateVariation(idx, 'stock', e.target.value)}
                      placeholder="0"
                      className="col-span-5 sm:col-span-2 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none" />
                    <button type="button" onClick={() => removeVariation(idx)}
                      className="col-span-2 sm:col-span-1 flex items-center justify-center w-8 h-8 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-0.5">
                      <X size={15} />
                    </button>
                  </div>
                );
              })}
              {variations.length > 0 && variantPrices.length > 0 && (
                <div className="mt-2 px-3 py-2.5 bg-gray-50 rounded-xl border text-xs text-gray-600 flex flex-wrap gap-x-6 gap-y-1">
                  <span>Price range: <strong className="text-primary-800">
                    {minVariantPrice === maxVariantPrice
                      ? `₱${minVariantPrice.toFixed(2)}`
                      : `₱${minVariantPrice.toFixed(2)} – ₱${maxVariantPrice.toFixed(2)}`}
                  </strong></span>
                  <span>Total stock: <strong className="text-primary-800">{totalVariantStock}</strong></span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Additional */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Additional Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <input type="text" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Barangay (Product Location)</label>
              <select value={form.barangay_id} disabled
                className="w-full px-3 py-2.5 border rounded-lg text-sm bg-gray-100 text-gray-600 cursor-not-allowed outline-none">
                <option value="">Select Barangay</option>
                {barangays.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Based on your store location</p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/seller/products')} className="px-6 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="px-6 py-2.5 bg-primary-800 text-white rounded-lg text-sm font-medium hover:bg-primary-900 disabled:opacity-50 flex items-center gap-2">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : 'Create Product'}
          </button>
        </div>
      </form>
    </div>
  );
}
