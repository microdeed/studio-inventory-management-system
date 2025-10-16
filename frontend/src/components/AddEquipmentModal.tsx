import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Package, AlertCircle } from 'lucide-react';
import { sessionManager } from '../utils/sessionManager.ts';

interface Category {
  id: number;
  name: string;
  color: string;
}

interface AddEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
}

export const AddEquipmentModal: React.FC<AddEquipmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  categories
}) => {
  const [formData, setFormData] = useState({
    name: '',
    serial_number: '',
    serial_numbers: '', // For multiple items - one per line
    model: '',
    manufacturer: '',
    category_id: '',
    condition: 'normal',
    status: 'available',
    location: 'studio',
    included_in_kit: false,
    kit_contents: '',
    purchase_date: '',
    purchase_price: '',
    current_value: '',
    description: '',
    notes: '',
    quantity: 1
  });
  const [generatedBarcode, setGeneratedBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && formData.category_id && formData.purchase_date) {
      generateBarcode();
    }
  }, [formData.category_id, formData.purchase_date, formData.quantity, formData.serial_numbers, isOpen]);

  // Log when formData state changes
  useEffect(() => {
    console.log('[AddEquipmentModal] formData state updated:', {
      condition: formData.condition,
      status: formData.status
    });
  }, [formData.condition, formData.status]);

  const generateBarcode = async () => {
    try {
      if (!formData.category_id) {
        setGeneratedBarcode('Select category to generate barcode');
        return;
      }

      const category = categories.find(c => c.id === parseInt(formData.category_id));
      const categoryName = category ? category.name : 'Misc';
      const purchaseDate = formData.purchase_date || new Date().toISOString().split('T')[0];

      // Format: XX-CCYY-NNNNN (with optional -SSSS for multiples)
      const typeCode = getCategoryCode(categoryName);
      const year = purchaseDate ? purchaseDate.split('-')[0].slice(-2) : new Date().getFullYear().toString().slice(-2);

      if (formData.quantity === 1) {
        // Single item - show preview with count 00
        const barcode = `${typeCode}-00${year}-XXXXX`;
        setGeneratedBarcode(barcode);
      } else {
        // Multiple items - show range with count
        const barcode = `${typeCode}-(01..${formData.quantity.toString().padStart(2, '0')})${year}-XXXXX`;

        // Check if we have serial numbers entered
        const serials = formData.serial_numbers.trim().split('\n').filter(s => s.trim());
        if (serials.length > 0) {
          setGeneratedBarcode(barcode + '-[serial]');
        } else {
          setGeneratedBarcode(barcode);
        }
      }
    } catch (error) {
      console.error('Failed to generate barcode:', error);
      setGeneratedBarcode('AUTO-GENERATED');
    }
  };

  const getCategoryCode = (categoryName: string): string => {
    const codes: { [key: string]: string } = {
      'camera': 'CA', 'cameras': 'CA',
      'lens': 'LN', 'lenses': 'LN',
      'audio': 'MI', 'microphone': 'MI',
      'lighting': 'LG', 'light': 'LG',
      'video': 'CA',
      'computing': 'MS',
      'cables': 'MS',
      'accessories': 'MS',
      'furniture': 'MS'
    };

    const normalized = categoryName.toLowerCase().trim();
    return codes[normalized] || 'MS';
  };

  // Auto-map condition to appropriate status
  const getAutoStatusForCondition = (condition: string): string => {
    const conditionStatusMap: { [key: string]: string } = {
      'out_of_commission': 'unavailable',
      'broken': 'unavailable',
      'brand_new': 'available',
      'functional': 'available',
      'normal': 'available',
      'worn': 'needs_maintenance'
    };
    return conditionStatusMap[condition] || 'available';
  };

  const handleChange = (field: string, value: any) => {
    console.log('[AddEquipmentModal] handleChange:', field, '=', value);
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      // Auto-update status when condition changes
      if (field === 'condition') {
        const autoStatus = getAutoStatusForCondition(value);
        console.log('[AddEquipmentModal] Condition changed to:', value, '→ Auto-setting status to:', autoStatus);
        newData.status = autoStatus;
      }
      console.log('[AddEquipmentModal] New formData:', newData);
      return newData;
    });
    setError('');
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Equipment name is required');
      return false;
    }
    if (formData.name.trim().length < 2) {
      setError('Equipment name must be at least 2 characters');
      return false;
    }
    if (formData.quantity < 1 || formData.quantity > 99) {
      setError('Quantity must be between 1 and 99');
      return false;
    }

    // Validate serial numbers for multiples
    if (formData.quantity > 1 && formData.serial_numbers.trim()) {
      const serials = formData.serial_numbers.trim().split('\n').filter(s => s.trim());
      if (serials.length > 0 && serials.length !== formData.quantity) {
        setError(`You entered ${serials.length} serial number(s), but quantity is ${formData.quantity}. Either provide ${formData.quantity} serial numbers (one per line) or leave blank.`);
        return false;
      }
    }

    if (formData.purchase_price && parseFloat(formData.purchase_price) < 0) {
      setError('Purchase price cannot be negative');
      return false;
    }
    if (formData.current_value && parseFloat(formData.current_value) < 0) {
      setError('Current value cannot be negative');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get current user ID for authentication
      const session = sessionManager.getSession();
      if (!session) {
        setError('Session expired. Please reload the page.');
        setLoading(false);
        return;
      }

      // Parse serial numbers if multiple items
      let serialNumbersArray = null;
      if (formData.quantity > 1 && formData.serial_numbers.trim()) {
        serialNumbersArray = formData.serial_numbers.trim().split('\n')
          .map(s => s.trim())
          .filter(s => s.length > 0);
      }

      const payload = {
        name: formData.name.trim(),
        serial_number: formData.quantity === 1 ? (formData.serial_number.trim() || null) : null,
        serial_numbers: serialNumbersArray, // Array for multiples
        // barcode will be auto-generated on backend
        model: formData.model.trim() || null,
        manufacturer: formData.manufacturer.trim() || null,
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        condition: formData.condition,
        status: formData.status,
        location: formData.location,
        included_in_kit: formData.included_in_kit,
        kit_contents: formData.included_in_kit ? (formData.kit_contents.trim() || null) : null,
        purchase_date: formData.purchase_date || null,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        current_value: formData.current_value ? parseFloat(formData.current_value) : null,
        description: formData.description.trim() || null,
        notes: formData.notes.trim() || null,
        quantity: formData.quantity || 1,
        created_by: session.userId // For authentication
      };

      const response = await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create entry');
      }

      onSuccess();
      handleClose();

    } catch (error: any) {
      console.error('Add equipment error:', error);
      setError(error.message || 'Failed to create entry');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      serial_number: '',
      serial_numbers: '',
      model: '',
      manufacturer: '',
      category_id: '',
      condition: 'normal',
      status: 'available',
      location: 'studio',
      included_in_kit: false,
      kit_contents: '',
      purchase_date: '',
      purchase_price: '',
      current_value: '',
      description: '',
      notes: '',
      quantity: 1
    });
    setGeneratedBarcode('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
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
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          maxWidth: '56rem',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-brown-100 rounded-full flex items-center justify-center">
              <Package size={24} className="text-brown-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Add New Equipment</h2>
              <p className="text-sm text-gray-600">Create a new equipment entry with auto-generated barcode</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-800 rounded border border-red-200">
                <AlertCircle size={16} />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Auto-Generated Barcode Preview */}
            {generatedBarcode && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <strong className="text-blue-900">Auto-Generated Barcode{formData.quantity > 1 ? 's' : ''}:</strong>
                    <p className="text-xl font-mono text-blue-700 mt-1">{generatedBarcode}</p>
                    {formData.quantity > 1 && (
                      <p className="text-sm text-blue-600 mt-1">
                        Creating {formData.quantity} items • Barcodes: {generatedBarcode}
                      </p>
                    )}
                  </div>
                  <Package size={32} className="text-blue-400" />
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  {formData.quantity > 1
                    ? `${formData.quantity} equipment items will be created with sequential database IDs`
                    : 'Sequential number (XXXXX) will be assigned from database count'}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Name */}
              <div className="form-group col-span-2">
                <label className="form-label">
                  Equipment Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Sony A7S III Camera Body"
                  required
                />
              </div>

              {/* Category */}
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-control"
                  value={formData.category_id}
                  onChange={(e) => handleChange('category_id', e.target.value)}
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <small className="text-gray-500">Affects barcode generation</small>
              </div>

              {/* Manufacturer */}
              <div className="form-group">
                <label className="form-label">Manufacturer</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.manufacturer}
                  onChange={(e) => handleChange('manufacturer', e.target.value)}
                  placeholder="Sony"
                />
              </div>

              {/* Model */}
              <div className="form-group">
                <label className="form-label">Model</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.model}
                  onChange={(e) => handleChange('model', e.target.value)}
                  placeholder="A7S III"
                />
              </div>

              {/* Quantity */}
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  className="form-control"
                  value={formData.quantity}
                  onChange={(e) => handleChange('quantity', parseInt(e.target.value) || 1)}
                  placeholder="1"
                />
                <small className="text-gray-500">Create multiple identical items (1-99)</small>
              </div>

              {/* Serial Number - Single Item */}
              {formData.quantity === 1 && (
                <div className="form-group">
                  <label className="form-label">Serial Number</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.serial_number}
                    onChange={(e) => handleChange('serial_number', e.target.value)}
                    placeholder="Optional"
                  />
                  <small className="text-gray-500">Equipment serial number (optional)</small>
                </div>
              )}

              {/* Serial Numbers - Multiple Items */}
              {formData.quantity > 1 && (
                <div className="form-group col-span-2">
                  <label className="form-label">Serial Numbers (Optional)</label>
                  <textarea
                    className="form-control"
                    rows={Math.min(formData.quantity, 5)}
                    value={formData.serial_numbers}
                    onChange={(e) => handleChange('serial_numbers', e.target.value)}
                    placeholder={`Enter serial numbers - one per line (${formData.quantity} total).\nLeave blank if items don't have serial numbers.\n\nExample:\nSN123456\nSN789012\nSN345678`}
                  />
                  <small className="text-gray-500">
                    Enter {formData.quantity} serial numbers (one per line) or leave blank.
                    Last 4 digits will be added to barcodes.
                  </small>
                </div>
              )}

              {/* Condition */}
              <div className="form-group">
                <label className="form-label">Condition</label>
                <select
                  className="form-control"
                  value={formData.condition}
                  onChange={(e) => handleChange('condition', e.target.value)}
                >
                  <option value="brand_new">Brand New</option>
                  <option value="normal">Normal</option>
                  <option value="functional">Functional</option>
                  <option value="worn">Worn</option>
                  <option value="out_of_commission">Out of Commission</option>
                  <option value="broken">Broken</option>
                </select>
              </div>

              {/* Status */}
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-control"
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                >
                  <option value="available">Available</option>
                  <option value="in_use">In Use</option>
                  <option value="unavailable">Unavailable</option>
                  <option value="out_for_maintenance">Out for Maintenance</option>
                  <option value="needs_maintenance">Needs Maintenance</option>
                  <option value="reserved">Reserved</option>
                  <option value="decommissioned">Decommissioned</option>
                </select>
                <small className="text-gray-500">Auto-set based on condition</small>
              </div>

              {/* Location */}
              <div className="form-group">
                <label className="form-label">Location</label>
                <select
                  className="form-control"
                  value={formData.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                >
                  <option value="studio">Studio</option>
                  <option value="vault">Vault</option>
                  <option value="user">With User</option>
                </select>
              </div>

              {/* Purchase Date */}
              <div className="form-group">
                <label className="form-label">Purchase Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.purchase_date}
                  onChange={(e) => handleChange('purchase_date', e.target.value)}
                />
                <small className="text-gray-500">Affects barcode generation</small>
              </div>

              {/* Purchase Price */}
              <div className="form-group">
                <label className="form-label">Purchase Price</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  value={formData.purchase_price}
                  onChange={(e) => handleChange('purchase_price', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              {/* Current Value */}
              <div className="form-group">
                <label className="form-label">Current Value</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  value={formData.current_value}
                  onChange={(e) => handleChange('current_value', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              {/* Included in Kit Checkbox */}
              <div className="form-group col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-brown-600 rounded focus:ring-brown-500"
                    checked={formData.included_in_kit}
                    onChange={(e) => handleChange('included_in_kit', e.target.checked)}
                  />
                  <span className="form-label mb-0">This item is a kit (contains multiple items)</span>
                </label>
                <small className="text-gray-500 ml-6">Check this if this equipment is a kit containing multiple items</small>
              </div>

              {/* Kit Contents - Show when included_in_kit is checked */}
              {formData.included_in_kit && (
                <div className="form-group col-span-2">
                  <label className="form-label">Kit Contents</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={formData.kit_contents}
                    onChange={(e) => handleChange('kit_contents', e.target.value)}
                    placeholder="List the items included in this kit (one per line)&#10;Example:&#10;- Sony A7S III Camera Body&#10;- 24-70mm Lens&#10;- 2x Batteries&#10;- Charger&#10;- Camera Bag"
                  />
                  <small className="text-gray-500">Describe what items are included in this kit</small>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-control"
                rows={3}
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Optional equipment description..."
              />
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-control"
                rows={2}
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Optional notes..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <button
                type="button"
                className="btn btn-secondary flex-1"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary flex-1"
                disabled={loading}
              >
                {loading ? (
                  <div className="loading-spinner w-4 h-4" />
                ) : (
                  <>
                    <Package size={18} />
                    Create Entry
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
