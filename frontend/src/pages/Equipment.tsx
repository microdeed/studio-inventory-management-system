import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Filter,
  Plus,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle,
  Wrench,
  QrCode,
  Lock
} from 'lucide-react';
import { formatInCentral } from '../utils/dateUtils.ts';
import { AddEquipmentModal } from '../components/AddEquipmentModal.tsx';
import { sessionManager } from '../utils/sessionManager.ts';

interface Equipment {
  id: number;
  name: string;
  serial_number: string;
  barcode?: string;
  model: string;
  manufacturer: string;
  category_id?: number;
  category_name: string;
  category_color: string;
  condition: string;
  location: string;
  status: 'available' | 'checked_out' | 'maintenance' | 'unavailable' | 'out_for_maintenance' | 'needs_maintenance' | 'in_use' | 'reserved' | 'decommissioned';
  checked_out_by_name?: string;
  checkout_date?: string;
  expected_return_date?: string;
  days_out?: number;
  current_value?: number;
  purchase_price?: number;
  purchase_date?: string;
  description?: string;
  notes?: string;
  image_path?: string;
  qr_code: string;
  included_in_kit?: boolean;
}

interface Category {
  id: number;
  name: string;
  color: string;
  equipment_count: number;
}

const statusConfig = {
  available: {
    icon: CheckCircle,
    label: 'Available',
    className: 'status-available'
  },
  checked_out: {
    icon: Clock,
    label: 'Checked Out',
    className: 'status-checked-out'
  },
  maintenance: {
    icon: Wrench,
    label: 'Maintenance',
    className: 'status-maintenance'
  },
  unavailable: {
    icon: AlertTriangle,
    label: 'Unavailable',
    className: 'status-unavailable'
  },
  out_for_maintenance: {
    icon: Wrench,
    label: 'Out for Maintenance',
    className: 'status-maintenance'
  },
  needs_maintenance: {
    icon: AlertTriangle,
    label: 'Needs Maintenance',
    className: 'status-needs-maintenance'
  },
  in_use: {
    icon: Clock,
    label: 'In Use',
    className: 'status-in-use'
  },
  reserved: {
    icon: Lock,
    label: 'Reserved',
    className: 'status-reserved'
  },
  decommissioned: {
    icon: AlertTriangle,
    label: 'Decommissioned',
    className: 'status-decommissioned'
  }
};

export const Equipment: React.FC = () => {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [editedEquipment, setEditedEquipment] = useState<Equipment | null>(null);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Access control rules for equipment operations
  const canAddEquipment = currentUserRole === 'admin' || currentUserRole === 'manager';
  const canEditEquipment = currentUserRole === 'admin' || currentUserRole === 'manager';
  const canDeleteEquipment = currentUserRole === 'admin' || currentUserRole === 'manager';

  useEffect(() => {
    fetchEquipment();
    fetchCategories();

    // Get current user's role from session
    const session = sessionManager.getSession();
    if (session) {
      console.log('[Equipment] Session found:', session);
      console.log('[Equipment] User role:', session.role);
      setCurrentUserRole(session.role);
    } else {
      console.log('[Equipment] No session found');
    }
  }, [searchTerm, selectedCategory, selectedStatus, currentPage]);

  // Log access control state whenever role changes
  useEffect(() => {
    console.log('[Equipment] Current user role:', currentUserRole);
    console.log('[Equipment] Can add equipment:', canAddEquipment);
    console.log('[Equipment] Can edit equipment:', canEditEquipment);
    console.log('[Equipment] Can delete equipment:', canDeleteEquipment);
  }, [currentUserRole, canAddEquipment, canEditEquipment, canDeleteEquipment]);

  // Log when editedEquipment state changes
  useEffect(() => {
    if (editedEquipment) {
      console.log('[Equipment] editedEquipment state updated:', {
        condition: editedEquipment.condition,
        status: editedEquipment.status
      });
    }
  }, [editedEquipment]);

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50'
      });

      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedStatus) params.append('status', selectedStatus);

      const response = await fetch(`/api/equipment?${params}`);
      const data = await response.json();

      // Normalize purchase dates for all equipment items
      const normalizedEquipment = (data.data || []).map((item: Equipment) => ({
        ...item,
        purchase_date: normalizeDateForInput(item.purchase_date)
      }));

      setEquipment(normalizedEquipment);
      setTotalPages(data.pagination?.pages || 1);
    } catch (error) {
      console.error('Failed to fetch equipment:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      setCategories(data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchEquipment();
  };

  const getStatusIcon = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.available;
    const Icon = config.icon;
    return <Icon size={14} />;
  };

  const getStatusClassName = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig]?.className || statusConfig.available.className;
  };

  const getStatusLabel = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig]?.label || statusConfig.available.label;
  };

  // Auto-map condition to appropriate status
  const getAutoStatusForCondition = (condition: string): string | null => {
    const conditionStatusMap: { [key: string]: string } = {
      'out_of_commission': 'unavailable',
      'broken': 'unavailable',
      'brand_new': 'available',
      'functional': 'available',
      'normal': 'available',
      'worn': 'needs_maintenance'
    };
    return conditionStatusMap[condition] || null;
  };

  // Map old condition values to new standardized values
  const migrateConditionValue = (oldCondition: string): string => {
    const conditionMigrationMap: { [key: string]: string } = {
      // Old values → New values
      'excellent': 'brand_new',
      'good': 'functional',
      'fair': 'normal',
      'poor': 'worn',
      'damaged': 'out_of_commission',
      'decommissioned': 'broken',
      // New values pass through unchanged
      'brand_new': 'brand_new',
      'functional': 'functional',
      'normal': 'normal',
      'worn': 'worn',
      'out_of_commission': 'out_of_commission',
      'broken': 'broken'
    };
    return conditionMigrationMap[oldCondition] || 'normal'; // Default to 'normal' if unknown
  };

  // Normalize date to YYYY-MM-DD format for HTML5 date input
  const normalizeDateForInput = (dateValue: string | null | undefined): string => {
    if (!dateValue) return '';

    // If already in YYYY-MM-DD format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }

    // Handle MM/DD/YYYY format
    const mmddyyyyMatch = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mmddyyyyMatch) {
      const [, month, day, year] = mmddyyyyMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Try parsing as Date object as fallback
    try {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn('Failed to parse date:', dateValue);
    }

    return '';
  };

  const handleViewEquipment = (item: Equipment) => {
    setSelectedEquipment(item);
    // Migrate old condition values to new standardized values and normalize dates
    const migratedItem = {
      ...item,
      condition: migrateConditionValue(item.condition),
      purchase_date: normalizeDateForInput(item.purchase_date)
    };
    setEditedEquipment(migratedItem);
    setIsEditing(false);
    setShowEquipmentModal(true);
  };

  const handleSaveEquipment = async () => {
    if (!editedEquipment) return;

    // Validate required fields
    if (!editedEquipment.name || editedEquipment.name.trim() === '') {
      alert('Equipment name is required');
      return;
    }

    if (editedEquipment.name.trim().length < 2) {
      alert('Equipment name must be at least 2 characters long');
      return;
    }

    // Validate numeric fields
    if (editedEquipment.purchase_price && editedEquipment.purchase_price < 0) {
      alert('Purchase price cannot be negative');
      return;
    }

    if (editedEquipment.current_value && editedEquipment.current_value < 0) {
      alert('Current value cannot be negative');
      return;
    }

    try {
      setIsSaving(true);

      // Get current user ID for authentication
      const session = sessionManager.getSession();
      if (!session) {
        alert('Session expired. Please reload the page.');
        return;
      }

      // Only send editable fields
      const updateData: any = {
        name: editedEquipment.name.trim(),
        serial_number: editedEquipment.serial_number?.trim() || null,
        barcode: editedEquipment.barcode?.trim() || null,
        model: editedEquipment.model?.trim() || null,
        manufacturer: editedEquipment.manufacturer?.trim() || null,
        category_id: editedEquipment.category_id || null,
        condition: editedEquipment.condition,
        location: editedEquipment.location?.trim() || null,
        purchase_date: editedEquipment.purchase_date || null,
        purchase_price: editedEquipment.purchase_price || null,
        current_value: editedEquipment.current_value || null,
        description: editedEquipment.description?.trim() || null,
        notes: editedEquipment.notes?.trim() || null,
        updated_by: session.userId // For authentication
      };

      // Only include status if equipment is not checked out
      if (selectedEquipment && selectedEquipment.status !== 'checked_out') {
        updateData.status = editedEquipment.status;
      }

      const response = await fetch(`/api/equipment/${editedEquipment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        setShowEquipmentModal(false);
        fetchEquipment();
        alert('✓ Equipment updated successfully!');
      } else {
        const error = await response.json();

        // Handle validation errors
        if (error.errors && Array.isArray(error.errors)) {
          const errorMessages = error.errors.map((e: any) => e.msg).join('\n');
          alert('Validation errors:\n\n' + errorMessages);
        } else {
          alert(`Failed to update equipment:\n\n${error.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Failed to update equipment:', error);
      alert('Network error while updating equipment.\n\nPlease check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = (field: keyof Equipment, value: any) => {
    console.log('[Equipment Edit] handleFieldChange:', field, '=', value);
    if (editedEquipment) {
      const updated = { ...editedEquipment, [field]: value };
      console.log('[Equipment Edit] Updated equipment:', updated);
      setEditedEquipment(updated);
    }
  };

  const handleGenerateQR = async (item: Equipment) => {
    try {
      const response = await fetch(`/api/equipment/${item.id}/qrcode`);
      const data = await response.json();
      
      // Create a popup window with the QR code
      const popup = window.open('', '_blank', 'width=400,height=400');
      if (popup) {
        popup.document.write(`
          <html>
            <head><title>QR Code - ${item.name}</title></head>
            <body style="display: flex; flex-direction: column; align-items: center; padding: 20px;">
              <h3>${item.name}</h3>
              <img src="${data.qr_image}" alt="QR Code" style="max-width: 300px;">
              <p>Code: ${data.qr_code}</p>
              <button onclick="window.print()">Print</button>
            </body>
          </html>
        `);
        popup.document.close();
      }
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      alert('Failed to generate QR code');
    }
  };

  const handleDeleteEquipment = async () => {
    if (!equipmentToDelete) return;

    try {
      setIsDeleting(true);

      // Get current user ID for authentication
      const session = sessionManager.getSession();
      if (!session) {
        alert('Session expired. Please reload the page.');
        return;
      }

      const response = await fetch(`/api/equipment/${equipmentToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deleted_by: session.userId // For authentication
        })
      });

      if (response.ok) {
        setShowDeleteConfirm(false);
        setEquipmentToDelete(null);
        setShowEquipmentModal(false);
        fetchEquipment();
        alert('✓ Equipment deleted successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to delete equipment:\n\n${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to delete equipment:', error);
      alert('Network error while deleting equipment.\n\nPlease check your connection and try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedStatus('');
    setCurrentPage(1);
    fetchEquipment();
  };

  return (
    <div>
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Package size={28} />
          Equipment Ledger
        </h1>
        {canAddEquipment ? (
          <button
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={18} />
            Add Equipment
          </button>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
            <Lock size={16} />
            <span>Manager/Admin access required</span>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="search-filters">
        <form onSubmit={handleSearch} className="search-row">
          <div className="search-input">
            <label className="form-label">Search Equipment</label>
            <div className="relative">
              <input
                type="text"
                className="form-control with-left-icon"
                placeholder="Search by name, serial, model, or manufacturer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <select 
              className="form-control"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name} ({category.equipment_count})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-control"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
              <option value="checked_out">Checked Out</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">&nbsp;</label>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary">
                <Filter size={16} />
                Filter
              </button>
              <button type="button" onClick={resetFilters} className="btn btn-secondary">
                Reset
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Equipment Table */}
      <div className="ledger-card">
        <div className="ledger-card-header">
          <h2 className="ledger-card-title">
            Equipment Registry
            <span className="text-sm font-normal text-gray-500">
              ({equipment.length} items)
            </span>
          </h2>
        </div>
        
        <div className="ledger-card-content">
          {loading ? (
            <div className="text-center py-12">
              <div className="loading-spinner mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading equipment...</p>
            </div>
          ) : equipment.length === 0 ? (
            <div className="text-center py-12">
              <Package size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No equipment found matching your criteria.</p>
              <button onClick={resetFilters} className="btn btn-primary mt-4">
                View All Equipment
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="equipment-table">
                <thead>
                  <tr>
                    <th>Items</th>
                    <th>Serial/Barcode</th>
                    <th>Category</th>
                    <th>Condition</th>
                    <th>Status</th>
                    <th>Checked Out By</th>
                    <th>Due Date</th>
                    <th>Location</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {equipment.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div>
                          <div className="font-medium text-gray-900">{item.name}</div>
                          <div className="text-sm text-gray-500">{item.manufacturer}</div>
                        </div>
                      </td>
                      <td>
                        <div>
                          <div className="font-mono text-sm">{item.serial_number || 'N/A'}</div>
                          <div className="text-xs text-gray-500 font-mono">{item.barcode || 'No barcode'}</div>
                        </div>
                      </td>
                      <td>
                        {item.category_name && (
                          <span
                            className="category-tag"
                            style={{ backgroundColor: item.category_color }}
                          >
                            {item.category_name}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="text-sm text-gray-700">
                          {item.condition ? item.condition.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusClassName(item.status)}`}>
                          {getStatusIcon(item.status)}
                          {getStatusLabel(item.status)}
                          {item.days_out && item.days_out > 0 && (
                            <span className="ml-1">({Math.floor(item.days_out)}d)</span>
                          )}
                        </span>
                      </td>
                      <td>
                        {item.checked_out_by_name ? (
                          <div>
                            <div className="text-sm font-medium">{item.checked_out_by_name}</div>
                            {item.checkout_date && (
                              <div className="text-xs text-gray-500">
                                Since {formatInCentral(item.checkout_date, 'MMM d, yyyy')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td>
                        {item.expected_return_date ? (
                          <div className="text-sm text-gray-700">
                            {formatInCentral(item.expected_return_date, 'MMM d, yyyy')}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td>
                        <span className="text-sm text-gray-600">{item.location || 'Unknown'}</span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button 
                            className="btn btn-sm btn-secondary" 
                            title="View Details"
                            onClick={() => handleViewEquipment(item)}
                          >
                            View
                          </button>
                          <button 
                            className="btn btn-sm btn-secondary" 
                            title="Generate QR Code"
                            onClick={() => handleGenerateQR(item)}
                          >
                            <QrCode size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button 
            className="btn btn-secondary btn-sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </button>
          
          <span className="px-3 py-1 text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          
          <button 
            className="btn btn-secondary btn-sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* Equipment Details Modal (Editable) */}
      {showEquipmentModal && selectedEquipment && editedEquipment && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif'
          }}
          onClick={() => setShowEquipmentModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              maxWidth: '48rem',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">
                  {isEditing ? 'Edit Equipment' : 'Equipment Details'}
                </h2>
                <button
                  onClick={() => {
                    setShowEquipmentModal(false);
                    setIsEditing(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>

              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="form-group">
                    <label className="form-label">Equipment Name <span className="text-red-600">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={editedEquipment.name}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      disabled={!isEditing}
                      required
                      minLength={2}
                    />
                    {isEditing && <small className="text-gray-500">Required (min 2 characters)</small>}
                  </div>

                  {/* Serial Number */}
                  <div className="form-group">
                    <label className="form-label">Serial Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editedEquipment.serial_number || ''}
                      onChange={(e) => handleFieldChange('serial_number', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>

                  {/* Barcode */}
                  <div className="form-group">
                    <label className="form-label">Barcode</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editedEquipment.barcode || ''}
                      onChange={(e) => handleFieldChange('barcode', e.target.value)}
                      disabled={true}
                    />
                    <small className="text-gray-500">Auto-generated, cannot be changed</small>
                  </div>

                  {/* Model */}
                  <div className="form-group">
                    <label className="form-label">Model</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editedEquipment.model || ''}
                      onChange={(e) => handleFieldChange('model', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>

                  {/* Manufacturer */}
                  <div className="form-group">
                    <label className="form-label">Manufacturer</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editedEquipment.manufacturer || ''}
                      onChange={(e) => handleFieldChange('manufacturer', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>

                  {/* Category */}
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-control"
                      value={editedEquipment.category_id || ''}
                      onChange={(e) => handleFieldChange('category_id', parseInt(e.target.value) || null)}
                      disabled={!isEditing}
                    >
                      <option value="">No Category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Condition */}
                  <div className="form-group">
                    <label className="form-label">Condition</label>
                    <select
                      className="form-control"
                      value={editedEquipment.condition}
                      onChange={(e) => {
                        const newCondition = e.target.value;
                        console.log('[Equipment Edit] Condition onChange:', newCondition);

                        // Auto-update status based on condition
                        const autoStatus = getAutoStatusForCondition(newCondition);
                        console.log('[Equipment Edit] Auto status for', newCondition, ':', autoStatus);

                        // Update both condition and status in a single state update
                        if (editedEquipment) {
                          const updated = {
                            ...editedEquipment,
                            condition: newCondition
                          };

                          // Only update status if not checked out
                          if (autoStatus && selectedEquipment.status !== 'checked_out') {
                            console.log('[Equipment Edit] Setting status to:', autoStatus);
                            updated.status = autoStatus;
                          } else {
                            console.log('[Equipment Edit] NOT setting status - checked out:', selectedEquipment.status === 'checked_out');
                          }

                          console.log('[Equipment Edit] Updated equipment:', updated);
                          setEditedEquipment(updated);
                        }
                      }}
                      disabled={!isEditing}
                    >
                      <option value="brand_new">Brand New</option>
                      <option value="normal">Normal</option>
                      <option value="functional">Functional</option>
                      <option value="worn">Worn</option>
                      <option value="out_of_commission">Out of Commission</option>
                      <option value="broken">Broken</option>
                    </select>
                    {isEditing && (
                      <small className="text-gray-500">
                        Status will auto-update based on condition
                      </small>
                    )}
                  </div>

                  {/* Equipment Status */}
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-control"
                      value={editedEquipment.status || 'available'}
                      onChange={(e) => handleFieldChange('status', e.target.value)}
                      disabled={!isEditing || selectedEquipment.status === 'checked_out'}
                    >
                      <option value="available">Available</option>
                      <option value="in_use">In Use</option>
                      <option value="unavailable">Unavailable</option>
                      <option value="out_for_maintenance">Out for Maintenance</option>
                      <option value="needs_maintenance">Needs Maintenance</option>
                      <option value="reserved">Reserved</option>
                      <option value="decommissioned">Decommissioned</option>
                    </select>
                    {selectedEquipment.status === 'checked_out' ? (
                      <small className="text-orange-600 font-medium">
                        ⚠️ Cannot change status while checked out
                      </small>
                    ) : isEditing && (
                      <small className="text-gray-500">
                        Auto-set by condition changes
                      </small>
                    )}
                  </div>

                  {/* Location */}
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <select
                      className="form-control"
                      value={editedEquipment.location || 'studio'}
                      onChange={(e) => handleFieldChange('location', e.target.value)}
                      disabled={!isEditing}
                    >
                      <option value="studio">Studio</option>
                      <option value="vault">Vault</option>
                      <option value="user">With User</option>
                    </select>
                  </div>

                  {/* Included in Kit */}
                  <div className="form-group">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-brown-600 rounded focus:ring-brown-500"
                        checked={editedEquipment.included_in_kit || false}
                        onChange={(e) => handleFieldChange('included_in_kit', e.target.checked)}
                        disabled={!isEditing}
                      />
                      <span className="form-label mb-0">Included in Kit</span>
                    </label>
                    <small className="text-gray-500 block mt-1">
                      Check if this item is part of a kit
                    </small>
                  </div>

                  {/* Purchase Date */}
                  <div className="form-group">
                    <label className="form-label">Purchase Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={editedEquipment.purchase_date || ''}
                      onChange={(e) => handleFieldChange('purchase_date', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>

                  {/* Purchase Price */}
                  <div className="form-group">
                    <label className="form-label">Purchase Price</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      value={editedEquipment.purchase_price || ''}
                      onChange={(e) => handleFieldChange('purchase_price', parseFloat(e.target.value) || null)}
                      disabled={!isEditing}
                    />
                    {isEditing && <small className="text-gray-500">Must be positive</small>}
                  </div>

                  {/* Current Value */}
                  <div className="form-group">
                    <label className="form-label">Current Value</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      value={editedEquipment.current_value || ''}
                      onChange={(e) => handleFieldChange('current_value', parseFloat(e.target.value) || null)}
                      disabled={!isEditing}
                    />
                    {isEditing && <small className="text-gray-500">Must be positive</small>}
                  </div>
                </div>

                {/* Description - Full Width */}
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={editedEquipment.description || ''}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>

                {/* Notes - Full Width */}
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={editedEquipment.notes || ''}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>

                {/* Status Info (Read-only) */}
                <div className="p-4 bg-gray-50 rounded border">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Status:</strong>
                      <span className={`status-badge ${getStatusClassName(selectedEquipment.status)} ml-2`}>
                        {getStatusLabel(selectedEquipment.status)}
                      </span>
                    </div>
                    <div>
                      <strong>QR Code:</strong> {selectedEquipment.qr_code}
                    </div>
                    <div>
                      <strong>Purchase Date:</strong> {selectedEquipment.purchase_date ? formatInCentral(selectedEquipment.purchase_date, 'MMM d, yyyy') : 'N/A'}
                    </div>
                    <div>
                      <strong>Condition:</strong> {selectedEquipment.condition ? selectedEquipment.condition.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown'}
                    </div>
                    {selectedEquipment.checked_out_by_name && (
                      <div className="col-span-2">
                        <strong>Checked Out By:</strong> {selectedEquipment.checked_out_by_name}
                        {selectedEquipment.checkout_date && (
                          <span className="text-gray-500 ml-2">
                            (since {formatInCentral(selectedEquipment.checkout_date, 'MMM d, yyyy')})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between gap-2 pt-4">
                  {!isEditing ? (
                    <>
                      <div className="flex gap-2">
                        {canDeleteEquipment && (
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => {
                              setEquipmentToDelete(selectedEquipment);
                              setShowDeleteConfirm(true);
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setShowEquipmentModal(false);
                            setIsEditing(false);
                          }}
                        >
                          Close
                        </button>
                        {canEditEquipment ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => setIsEditing(true)}
                          >
                            Edit
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded">
                            <Lock size={14} />
                            <span>Manager/Admin required to edit</span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div></div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setEditedEquipment({...selectedEquipment!});
                            setIsEditing(false);
                          }}
                          disabled={isSaving}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={handleSaveEquipment}
                          disabled={isSaving}
                        >
                          {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Equipment Modal */}
      <AddEquipmentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          fetchEquipment();
          alert('✓ Equipment created successfully!');
        }}
        categories={categories}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && equipmentToDelete && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif'
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              maxWidth: '28rem',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4 text-red-600">Delete Equipment</h2>
            <p className="mb-4">
              Are you sure you want to delete <strong>{equipmentToDelete.name}</strong>?
            </p>
              {equipmentToDelete.status === 'checked_out' && (
                <span className="block mt-2 text-red-600 font-medium">
                  ⚠️ Warning: This equipment is currently checked out. It must be checked in before deletion.
                </span>
              )}
            <div className="flex justify-end gap-2">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setEquipmentToDelete(null);
                }}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteEquipment}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Equipment'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};