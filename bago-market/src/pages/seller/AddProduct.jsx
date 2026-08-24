import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, GripVertical, Loader2 } from 'lucide-react';
import { productsAPI, categoriesAPI, barangaysAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { PRODUCT_CONDITIONS } from '../../constants';

export default function AddProduct() {
  const { user } = useAuth();
  const sellerBarangayId = user?.profile?.barangay_id || '';

  const [form, setForm] = useState({
    name: '', description: '', category_id: '', price: '', stock: '',
    condition: 'new', brand: '', sku: '', barangay_id: '', is_available: true
  });
  const [images, setImages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  // Prefill barangay with seller's store location
  useEffect(() => {
    if (sellerBarangayId && !form.barangay_id) {
      setForm(prev => ({ ...prev, barangay_id: String(sellerBarangayId) }));
    }
  }, [sellerBarangayId]);

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

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) handleImageUpload(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.category_id) {
      showToast('Please fill in required fields.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price),
        stock: parseInt(form.stock) || 0,
        images: images.map(img => ({ url: img.url }))
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
            onDragOver={handleDragOver}
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (₱) *</label>
              <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-800 outline-none" placeholder="0.00" />
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
