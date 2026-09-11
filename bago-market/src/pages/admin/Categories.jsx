import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, GripVertical, Tag, Search, X } from 'lucide-react';
import { adminAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/common/Modal';

const EMPTY_FORM = { name: '', description: '', icon: '', sort_order: 0, is_active: true };

function CategoryRow({ cat, onEdit, onDelete, onToggle }) {
  return (
    <tr className="hover:bg-gray-50/60 group">
      <td className="px-4 py-3 w-8 text-gray-300">
        <GripVertical size={16} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {cat.icon ? (
            <span className="text-xl w-8 text-center">{cat.icon}</span>
          ) : (
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
              <Tag size={14} className="text-gray-400" />
            </div>
          )}
          <div>
            <p className="font-medium text-gray-900 text-sm">{cat.name}</p>
            {cat.description && <p className="text-xs text-gray-400 truncate max-w-48">{cat.description}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-sm font-medium text-gray-700">{Number(cat.product_count || 0).toLocaleString()}</span>
      </td>
      <td className="px-4 py-3 text-center text-sm text-gray-500">{cat.sort_order ?? 0}</td>
      <td className="px-4 py-3 text-center">
        <button onClick={() => onToggle(cat)} title={cat.is_active ? 'Deactivate' : 'Activate'}>
          {cat.is_active
            ? <ToggleRight size={22} className="text-green-500" />
            : <ToggleLeft  size={22} className="text-gray-300" />}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(cat)}
            className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="Edit">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(cat)}
            className="p-1.5 hover:bg-red-50 rounded text-red-600" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [formModal,  setFormModal]  = useState({ open: false, cat: null });
  const [deleteConf, setDeleteConf] = useState({ open: false, cat: null });
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const { showToast } = useToast();

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.categories();
      setCategories(res.data.categories || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, sort_order: categories.length + 1 });
    setFormModal({ open: true, cat: null });
  };
  const openEdit = (cat) => {
    setForm({ name: cat.name, description: cat.description || '', icon: cat.icon || '', sort_order: cat.sort_order ?? 0, is_active: !!cat.is_active });
    setFormModal({ open: true, cat });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Category name is required.', 'error'); return; }
    setSaving(true);
    try {
      if (formModal.cat) {
        await adminAPI.updateCategory({ ...form, id: formModal.cat.id });
        showToast('Category updated.', 'success');
      } else {
        await adminAPI.createCategory(form);
        showToast('Category created.', 'success');
      }
      setFormModal({ open: false, cat: null });
      fetchCategories();
    } catch {
      showToast('Failed to save category.', 'error');
    }
    setSaving(false);
  };

  const handleToggle = async (cat) => {
    try {
      await adminAPI.updateCategory({ id: cat.id, is_active: !cat.is_active });
      showToast(`Category ${cat.is_active ? 'deactivated' : 'activated'}.`, 'success');
      fetchCategories();
    } catch { showToast('Failed to update category.', 'error'); }
  };

  const handleDelete = async () => {
    if (!deleteConf.cat) return;
    try {
      await adminAPI.deleteCategory(deleteConf.cat.id);
      showToast('Category deleted.', 'success');
      setDeleteConf({ open: false, cat: null });
      fetchCategories();
    } catch {
      showToast('Failed to delete category.', 'error');
    }
  };

  const displayed = categories.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
          <p className="text-sm text-gray-500 mt-0.5">{categories.length} categories configured</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-800 text-white text-sm font-medium rounded-lg hover:bg-primary-900 transition-colors">
          <Plus size={15} /> Add Category
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search categories…"
          className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading categories…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-8 px-4 py-3" />
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Products</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Sort</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Active</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayed.length === 0 ? (
                  <tr><td colSpan={6} className="py-14 text-center">
                    <Tag size={32} className="mx-auto text-gray-200 mb-2" />
                    <p className="text-gray-400">No categories found.</p>
                    <button onClick={openCreate} className="mt-3 text-primary-700 text-sm hover:underline">Add the first category</button>
                  </td></tr>
                ) : displayed.map(cat => (
                  <CategoryRow key={cat.id} cat={cat} onEdit={openEdit} onDelete={c => setDeleteConf({ open: true, cat: c })} onToggle={handleToggle} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={formModal.open} onClose={() => setFormModal({ open: false, cat: null })}
        title={formModal.cat ? 'Edit Category' : 'Add Category'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Electronics"
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="Optional description…"
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Icon (emoji)</label>
              <input type="text" value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                placeholder="e.g. 📱"
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                min={0}
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-800" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="w-4 h-4 rounded accent-primary-800" />
            <span className="text-sm text-gray-700">Active (visible to buyers)</span>
          </label>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setFormModal({ open: false, cat: null })}
              className="flex-1 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 bg-primary-800 text-white rounded-lg text-sm font-medium hover:bg-primary-900 disabled:opacity-50">
              {saving ? 'Saving…' : formModal.cat ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={deleteConf.open} onClose={() => setDeleteConf({ open: false, cat: null })}
        title="Delete Category" size="sm">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
            Are you sure you want to delete <strong>{deleteConf.cat?.name}</strong>?
            {Number(deleteConf.cat?.product_count) > 0 && (
              <p className="mt-1 font-medium">⚠️ This category has {deleteConf.cat.product_count} products. They will become uncategorised.</p>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setDeleteConf({ open: false, cat: null })}
              className="flex-1 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={handleDelete}
              className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Delete</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
