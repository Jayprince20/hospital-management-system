'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, InventoryItem, Supplier } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/components/toast';
import { PermissionGate } from '@/components/permission-gate';

interface ItemFormData {
  name: string;
  sku: string;
  category: string;
  description: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  reorderLevel: number;
  location: string;
  supplierId: string;
  expiryDate: string;
}

interface SupplierFormData {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  isActive: boolean;
}

const initialItemForm: ItemFormData = {
  name: '',
  sku: '',
  category: '',
  description: '',
  unit: '',
  unitPrice: 0,
  quantity: 0,
  reorderLevel: 10,
  location: '',
  supplierId: '',
  expiryDate: '',
};

const initialSupplierForm: SupplierFormData = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
  isActive: true,
};

const units = ['pcs', 'box', 'pack', 'bottle', 'roll', 'bag', 'kit', 'set', 'pair', 'vial', 'tube', 'carton'];

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'items' | 'suppliers'>('items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [category, setCategory] = useState('');

  const toast = useToast();
  const [categories, setCategories] = useState<string[]>([]);
  const [showLowStock, setShowLowStock] = useState(false);
  const [stats, setStats] = useState({ totalItems: 0, totalStock: 0, totalValue: 0, lowStockCount: 0, expiringCount: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states for Items
  const [showItemCreateModal, setShowItemCreateModal] = useState(false);
  const [showItemEditModal, setShowItemEditModal] = useState(false);
  const [showItemDeleteModal, setShowItemDeleteModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [itemFormData, setItemFormData] = useState<ItemFormData>(initialItemForm);
  const [stockAdjustment, setStockAdjustment] = useState({ quantity: 0, reason: '' });

  // Modal states for Suppliers
  const [showSupplierCreateModal, setShowSupplierCreateModal] = useState(false);
  const [showSupplierEditModal, setShowSupplierEditModal] = useState(false);
  const [showSupplierDeleteModal, setShowSupplierDeleteModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierFormData, setSupplierFormData] = useState<SupplierFormData>(initialSupplierForm);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const response = await api.getInventory({
        search: debouncedSearch || undefined,
        category,
        lowStock: showLowStock,
        page,
        limit: 10,
      });
      setItems(response.items);
      setCategories(response.categories);
      setStats(response.stats);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      setFetchError(error instanceof Error ? error.message : 'Failed to fetch inventory');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, category, showLowStock, page]);

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const response = await api.getSuppliers({ search: debouncedSearch || undefined, page, limit: 10 });
      setSuppliers(response.suppliers);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setFetchError(error instanceof Error ? error.message : 'Failed to fetch suppliers');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  const fetchAllSuppliers = useCallback(async () => {
    try {
      const response = await api.getSuppliers({ limit: 100 });
      setAllSuppliers(response.suppliers);
    } catch (error) {
      console.error('Error fetching all suppliers:', error);
    }
  }, []);

  useEffect(() => {
    fetchAllSuppliers();
  }, [fetchAllSuppliers]);

  useEffect(() => {
    if (activeTab === 'items') {
      fetchItems();
    } else {
      fetchSuppliers();
    }
  }, [activeTab, fetchItems, fetchSuppliers]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const formatCurrency = (amount: number) => {
    // Format as Cameroon CFA Franc (XAF)
    const formattedAmount = Math.round(amount)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${formattedAmount} FCFA`;
  };

  // Item handlers
  const openItemCreateModal = () => {
    setItemFormData(initialItemForm);
    setError('');
    setShowItemCreateModal(true);
  };

  const openItemEditModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setItemFormData({
      name: item.name,
      sku: item.sku,
      category: item.category,
      description: item.description || '',
      unit: item.unit,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      reorderLevel: item.reorderLevel,
      location: item.location || '',
      supplierId: item.supplier?.id || '',
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : '',
    });
    setError('');
    setShowItemEditModal(true);
  };

  const openItemDeleteModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setShowItemDeleteModal(true);
  };

  const openStockModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setStockAdjustment({ quantity: 0, reason: '' });
    setError('');
    setShowStockModal(true);
  };

  const handleItemCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemFormData.name.trim() || !itemFormData.sku.trim()) {
      setError('Name and SKU are required');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await api.createInventoryItem({
        name: itemFormData.name.trim(),
        sku: itemFormData.sku.trim(),
        category: itemFormData.category.trim(),
        description: itemFormData.description.trim() || undefined,
        unit: itemFormData.unit,
        unitPrice: itemFormData.unitPrice,
        quantity: itemFormData.quantity,
        reorderLevel: itemFormData.reorderLevel,
        location: itemFormData.location.trim() || undefined,
        supplierId: itemFormData.supplierId || undefined,
        expiryDate: itemFormData.expiryDate || undefined,
      });
      setShowItemCreateModal(false);
      setItemFormData(initialItemForm);
      toast.success('Item created', `${itemFormData.name} has been added to inventory.`);
      fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create item');
    } finally {
      setSaving(false);
    }
  };

  const handleItemUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !itemFormData.name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await api.updateInventoryItem(selectedItem.id, {
        name: itemFormData.name.trim(),
        category: itemFormData.category.trim(),
        description: itemFormData.description.trim() || '',
        unit: itemFormData.unit,
        unitPrice: itemFormData.unitPrice,
        reorderLevel: itemFormData.reorderLevel,
        location: itemFormData.location.trim() || '',
        supplierId: itemFormData.supplierId || null,
        expiryDate: itemFormData.expiryDate || null,
      });
      setShowItemEditModal(false);
      setSelectedItem(null);
      setItemFormData(initialItemForm);
      toast.success('Item updated', `${itemFormData.name} has been updated successfully.`);
      fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const handleItemDelete = async () => {
    if (!selectedItem) return;

    try {
      setSaving(true);
      const itemName = selectedItem.name;
      await api.deleteInventoryItem(selectedItem.id);
      setShowItemDeleteModal(false);
      setSelectedItem(null);
      toast.success('Item deleted', `${itemName} has been removed.`);
      fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
      toast.error('Delete failed', err instanceof Error ? err.message : 'Failed to delete item');
    } finally {
      setSaving(false);
    }
  };

  const handleStockUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      setSaving(true);
      setError('');
      const newQuantity = selectedItem.quantity + stockAdjustment.quantity;
      if (newQuantity < 0) {
        setError('Stock cannot be negative');
        setSaving(false);
        return;
      }
      await api.updateInventoryStock(selectedItem.id, {
        quantity: stockAdjustment.quantity,
        reason: stockAdjustment.reason,
      });
      setShowStockModal(false);
      setSelectedItem(null);
      setStockAdjustment({ quantity: 0, reason: '' });
      toast.success('Stock updated', `${selectedItem.name} stock adjusted by ${stockAdjustment.quantity > 0 ? '+' : ''}${stockAdjustment.quantity}.`);
      fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update stock');
    } finally {
      setSaving(false);
    }
  };

  // Supplier handlers
  const openSupplierCreateModal = () => {
    setSupplierFormData(initialSupplierForm);
    setError('');
    setShowSupplierCreateModal(true);
  };

  const openSupplierEditModal = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setSupplierFormData({
      name: supplier.name,
      contactName: supplier.contactName || '',
      email: supplier.email || '',
      phone: supplier.phone,
      address: supplier.address || '',
      isActive: supplier.isActive,
    });
    setError('');
    setShowSupplierEditModal(true);
  };

  const openSupplierDeleteModal = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowSupplierDeleteModal(true);
  };

  const handleSupplierCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierFormData.name.trim() || !supplierFormData.phone.trim()) {
      setError('Name and Phone are required');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await api.createSupplier({
        name: supplierFormData.name.trim(),
        contactName: supplierFormData.contactName.trim() || undefined,
        email: supplierFormData.email.trim() || undefined,
        phone: supplierFormData.phone.trim(),
        address: supplierFormData.address.trim() || undefined,
      });
      setShowSupplierCreateModal(false);
      setSupplierFormData(initialSupplierForm);
      toast.success('Supplier created', `${supplierFormData.name} has been added.`);
      fetchSuppliers();
      fetchAllSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create supplier');
    } finally {
      setSaving(false);
    }
  };

  const handleSupplierUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !supplierFormData.name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await api.updateSupplier(selectedSupplier.id, {
        name: supplierFormData.name.trim(),
        contactName: supplierFormData.contactName.trim() || null,
        email: supplierFormData.email.trim() || null,
        phone: supplierFormData.phone.trim(),
        address: supplierFormData.address.trim() || null,
        isActive: supplierFormData.isActive,
      });
      setShowSupplierEditModal(false);
      setSelectedSupplier(null);
      setSupplierFormData(initialSupplierForm);
      toast.success('Supplier updated', `${supplierFormData.name} has been updated successfully.`);
      fetchSuppliers();
      fetchAllSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update supplier');
    } finally {
      setSaving(false);
    }
  };

  const handleSupplierDelete = async () => {
    if (!selectedSupplier) return;

    try {
      setSaving(true);
      const supplierName = selectedSupplier.name;
      await api.deleteSupplier(selectedSupplier.id);
      setShowSupplierDeleteModal(false);
      setSelectedSupplier(null);
      toast.success('Supplier deleted', `${supplierName} has been removed.`);
      fetchSuppliers();
      fetchAllSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete supplier');
      toast.error('Delete failed', err instanceof Error ? err.message : 'Failed to delete supplier');
    } finally {
      setSaving(false);
    }
  };

  const closeModals = () => {
    setShowItemCreateModal(false);
    setShowItemEditModal(false);
    setShowItemDeleteModal(false);
    setShowStockModal(false);
    setShowSupplierCreateModal(false);
    setShowSupplierEditModal(false);
    setShowSupplierDeleteModal(false);
    setSelectedItem(null);
    setSelectedSupplier(null);
    setItemFormData(initialItemForm);
    setSupplierFormData(initialSupplierForm);
    setStockAdjustment({ quantity: 0, reason: '' });
    setError('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage medical supplies and equipment</p>
        </div>
        <div className="flex gap-2">
          <PermissionGate permission="inventory:manage">
            <button
              onClick={openItemCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Item
            </button>
          </PermissionGate>
          <PermissionGate permission="inventory:manage_suppliers">
            <button
              onClick={openSupplierCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Add Supplier
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl font-bold text-lime-600">{stats.totalItems}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Items</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl font-bold text-blue-600">{stats.totalStock.toLocaleString()}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Stock</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl font-bold text-green-600">{formatCurrency(stats.totalValue)}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Value</p>
        </div>
        <div
          className={`bg-white dark:bg-gray-800 rounded-xl p-4 border cursor-pointer transition-colors ${
            showLowStock ? 'border-orange-500 ring-2 ring-orange-200 dark:ring-orange-800' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300'
          }`}
          onClick={() => { setShowLowStock(!showLowStock); setPage(1); setActiveTab('items'); }}
        >
          <p className="text-3xl font-bold text-orange-600">{stats.lowStockCount}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Low Stock</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl font-bold text-red-600">{stats.expiringCount}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Expiring Soon</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => { setActiveTab('items'); setPage(1); setShowLowStock(false); }}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'items'
                  ? 'border-lime-600 text-lime-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              Items
            </button>
            <button
              onClick={() => { setActiveTab('suppliers'); setPage(1); }}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'suppliers'
                  ? 'border-lime-600 text-lime-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              Suppliers
            </button>
          </nav>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={activeTab === 'items' ? 'Search items...' : 'Search suppliers...'}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
              />
            </div>
            {activeTab === 'items' && (
              <>
                <select
                  value={category}
                  onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showLowStock}
                    onChange={(e) => { setShowLowStock(e.target.checked); setPage(1); }}
                    className="w-4 h-4 text-lime-600 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Low Stock Only</span>
                </label>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {fetchError ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-red-600 dark:text-red-400 mb-2">{fetchError}</p>
              <button
                onClick={activeTab === 'items' ? fetchItems : fetchSuppliers}
                className="text-lime-600 dark:text-lime-400 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading...</span>
            </div>
          ) : activeTab === 'items' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Unit Price</th>
                    <th className="px-4 py-3">Total Value</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                          {item.supplier && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">{item.supplier.name}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-gray-600 dark:text-gray-400">{item.sku}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{item.category}</td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${item.isLowStock ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                          {item.quantity} {item.unit}
                        </span>
                        {item.isLowStock && (
                          <span className="ml-2 text-xs text-red-600">(Low)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {formatCurrency(item.totalValue)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {item.isLowStock && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-400 rounded text-xs">Low</span>
                          )}
                          {item.isExpiringSoon && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400 rounded text-xs">Expiring</span>
                          )}
                          {!item.isLowStock && !item.isExpiringSoon && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400 rounded text-xs">OK</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <PermissionGate permission="inventory:manage">
                            <button
                              onClick={() => openStockModal(item)}
                              className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/50 rounded-lg transition-colors"
                              title="Adjust stock"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                            </button>
                          </PermissionGate>
                          <PermissionGate permission="inventory:manage">
                            <button
                              onClick={() => openItemEditModal(item)}
                              className="p-1.5 text-lime-600 hover:bg-lime-50 dark:hover:bg-lime-900/50 rounded-lg transition-colors"
                              title="Edit item"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </PermissionGate>
                          <PermissionGate permission="inventory:manage">
                            <button
                              onClick={() => openItemDeleteModal(item)}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                              title="Delete item"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {items.length === 0 && (
                <p className="text-center py-8 text-gray-500 dark:text-gray-400">No inventory items found</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suppliers.length === 0 ? (
                <p className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">No suppliers found</p>
              ) : (
                suppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    className="p-4 border border-gray-100 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{supplier.name}</p>
                        {supplier.contactName && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">{supplier.contactName}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          supplier.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {supplier.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <PermissionGate permission="inventory:manage_suppliers">
                          <button
                            onClick={() => openSupplierEditModal(supplier)}
                            className="p-1.5 text-lime-600 hover:bg-lime-50 dark:hover:bg-lime-900/50 rounded-lg transition-colors"
                            title="Edit supplier"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </PermissionGate>
                        <PermissionGate permission="inventory:manage_suppliers">
                          <button
                            onClick={() => openSupplierDeleteModal(supplier)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                            title="Delete supplier"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </PermissionGate>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <p className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {supplier.phone}
                      </p>
                      {supplier.email && (
                        <p className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {supplier.email}
                        </p>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex gap-4 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">{supplier.itemCount} items</span>
                        <span className="text-gray-500 dark:text-gray-400">{supplier.orderCount} orders</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Item Create Modal */}
      {showItemCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeModals}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl transform transition-all sm:max-w-2xl sm:w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Inventory Item</h3>
                <button onClick={closeModals} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleItemCreate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                    <input
                      type="text"
                      value={itemFormData.name}
                      onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SKU *</label>
                    <input
                      type="text"
                      value={itemFormData.sku}
                      onChange={(e) => setItemFormData({ ...itemFormData, sku: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category *</label>
                    <input
                      type="text"
                      value={itemFormData.category}
                      onChange={(e) => setItemFormData({ ...itemFormData, category: e.target.value })}
                      placeholder="e.g., Medical Supplies, Equipment"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit *</label>
                    <select
                      value={itemFormData.unit}
                      onChange={(e) => setItemFormData({ ...itemFormData, unit: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    >
                      <option value="">Select unit</option>
                      {units.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit Price ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={itemFormData.unitPrice}
                      onChange={(e) => setItemFormData({ ...itemFormData, unitPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Initial Quantity</label>
                    <input
                      type="number"
                      min="0"
                      value={itemFormData.quantity}
                      onChange={(e) => setItemFormData({ ...itemFormData, quantity: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reorder Level</label>
                    <input
                      type="number"
                      min="0"
                      value={itemFormData.reorderLevel}
                      onChange={(e) => setItemFormData({ ...itemFormData, reorderLevel: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                    <input
                      type="text"
                      value={itemFormData.location}
                      onChange={(e) => setItemFormData({ ...itemFormData, location: e.target.value })}
                      placeholder="e.g., Warehouse A, Shelf B3"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supplier</label>
                    <select
                      value={itemFormData.supplierId}
                      onChange={(e) => setItemFormData({ ...itemFormData, supplierId: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    >
                      <option value="">No supplier</option>
                      {allSuppliers.filter(s => s.isActive).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={itemFormData.expiryDate}
                      onChange={(e) => setItemFormData({ ...itemFormData, expiryDate: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea
                    value={itemFormData.description}
                    onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button type="button" onClick={closeModals} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50 transition-colors">
                    {saving ? 'Creating...' : 'Create Item'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Item Edit Modal */}
      {showItemEditModal && selectedItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeModals}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl transform transition-all sm:max-w-2xl sm:w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Item</h3>
                <button onClick={closeModals} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleItemUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                    <input
                      type="text"
                      value={itemFormData.name}
                      onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SKU</label>
                    <input
                      type="text"
                      value={itemFormData.sku}
                      disabled
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category *</label>
                    <input
                      type="text"
                      value={itemFormData.category}
                      onChange={(e) => setItemFormData({ ...itemFormData, category: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit *</label>
                    <select
                      value={itemFormData.unit}
                      onChange={(e) => setItemFormData({ ...itemFormData, unit: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    >
                      {units.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit Price ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={itemFormData.unitPrice}
                      onChange={(e) => setItemFormData({ ...itemFormData, unitPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reorder Level</label>
                    <input
                      type="number"
                      min="0"
                      value={itemFormData.reorderLevel}
                      onChange={(e) => setItemFormData({ ...itemFormData, reorderLevel: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                    <input
                      type="text"
                      value={itemFormData.location}
                      onChange={(e) => setItemFormData({ ...itemFormData, location: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supplier</label>
                    <select
                      value={itemFormData.supplierId}
                      onChange={(e) => setItemFormData({ ...itemFormData, supplierId: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    >
                      <option value="">No supplier</option>
                      {allSuppliers.filter(s => s.isActive).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={itemFormData.expiryDate}
                      onChange={(e) => setItemFormData({ ...itemFormData, expiryDate: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea
                    value={itemFormData.description}
                    onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button type="button" onClick={closeModals} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50 transition-colors">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showStockModal && selectedItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeModals}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl transform transition-all sm:max-w-md sm:w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Adjust Stock</h3>
                <button onClick={closeModals} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white">{selectedItem.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Current Stock: {selectedItem.quantity} {selectedItem.unit}</p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleStockUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Adjustment (use negative for reduction)
                  </label>
                  <input
                    type="number"
                    value={stockAdjustment.quantity}
                    onChange={(e) => setStockAdjustment({ ...stockAdjustment, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    New stock: {selectedItem.quantity + stockAdjustment.quantity} {selectedItem.unit}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                  <input
                    type="text"
                    value={stockAdjustment.reason}
                    onChange={(e) => setStockAdjustment({ ...stockAdjustment, reason: e.target.value })}
                    placeholder="e.g., New shipment, Damaged items"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button type="button" onClick={closeModals} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving || stockAdjustment.quantity === 0} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
                    {saving ? 'Updating...' : 'Update Stock'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Item Delete Modal */}
      {showItemDeleteModal && selectedItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeModals}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl transform transition-all sm:max-w-md sm:w-full p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/50 rounded-full mb-4">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Item</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete <strong>{selectedItem.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={closeModals} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  Cancel
                </button>
                <button onClick={handleItemDelete} disabled={saving} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                  {saving ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Create Modal */}
      {showSupplierCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeModals}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl transform transition-all sm:max-w-lg sm:w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Supplier</h3>
                <button onClick={closeModals} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSupplierCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supplier Name *</label>
                  <input
                    type="text"
                    value={supplierFormData.name}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={supplierFormData.contactName}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, contactName: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={supplierFormData.phone}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={supplierFormData.email}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                  <textarea
                    value={supplierFormData.address}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button type="button" onClick={closeModals} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50 transition-colors">
                    {saving ? 'Creating...' : 'Create Supplier'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Edit Modal */}
      {showSupplierEditModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeModals}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl transform transition-all sm:max-w-lg sm:w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Supplier</h3>
                <button onClick={closeModals} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSupplierUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supplier Name *</label>
                  <input
                    type="text"
                    value={supplierFormData.name}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={supplierFormData.contactName}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, contactName: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={supplierFormData.phone}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={supplierFormData.email}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                  <textarea
                    value={supplierFormData.address}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="supplierIsActive"
                    checked={supplierFormData.isActive}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, isActive: e.target.checked })}
                    className="w-4 h-4 text-lime-600 rounded"
                  />
                  <label htmlFor="supplierIsActive" className="text-sm text-gray-700 dark:text-gray-300">
                    Active
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button type="button" onClick={closeModals} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50 transition-colors">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Delete Modal */}
      {showSupplierDeleteModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeModals}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl transform transition-all sm:max-w-md sm:w-full p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/50 rounded-full mb-4">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Supplier</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete <strong>{selectedSupplier.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={closeModals} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  Cancel
                </button>
                <button onClick={handleSupplierDelete} disabled={saving} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                  {saving ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
