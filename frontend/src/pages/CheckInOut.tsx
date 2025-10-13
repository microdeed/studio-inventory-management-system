import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Search,
  Calendar,
  Package,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { format, addDays } from 'date-fns';
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
  status: 'available' | 'checked_out' | 'maintenance' | 'unavailable' | 'out_for_maintenance' | 'needs_maintenance' | 'in_use' | 'reserved' | 'decommissioned';
  checked_out_by_name?: string;
  checked_out_by_id?: number;
  checkout_date?: string;
  expected_return_date?: string;
}

interface Category {
  id: number;
  name: string;
  color: string;
  equipment_count: number;
}

interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  department: string;
}

// Transaction interface removed - not currently used

export const CheckInOut: React.FC = () => {
  const [actionSelected, setActionSelected] = useState(false);
  const [mode, setMode] = useState<'checkout' | 'checkin' | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<number[]>([]);
  const [expectedReturnDate, setExpectedReturnDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [returnLocation, setReturnLocation] = useState<'studio' | 'vault'>('studio');
  const [returnCondition, setReturnCondition] = useState<string>(''); // Empty string means "keep current"
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [authenticatedUserId, setAuthenticatedUserId] = useState<number | null>(null);
  const [authenticatedUserRole, setAuthenticatedUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchCategories();
    fetchEquipmentStats(); // Fetch stats for action selection screen

    // Get session (user is guaranteed to be authenticated by AuthWall)
    const session = sessionManager.getSession();
    if (session) {
      setAuthenticatedUserId(session.userId);
      setAuthenticatedUserRole(session.role);
    }
  }, []);

  const fetchEquipmentStats = async () => {
    try {
      // Fetch both available and checked out equipment for stats
      const [availableRes, checkedOutRes] = await Promise.all([
        fetch('/api/equipment?status=available&limit=1000'),
        fetch('/api/equipment?status=checked_out&limit=1000')
      ]);

      const availableData = await availableRes.json();
      const checkedOutData = await checkedOutRes.json();

      // Combine for stats display
      setEquipment([...(availableData.data || []), ...(checkedOutData.data || [])]);
    } catch (error) {
      console.error('Failed to fetch equipment stats:', error);
    }
  };

  useEffect(() => {
    if (mode === 'checkout') {
      fetchAvailableEquipment();
    } else if (mode === 'checkin') {
      fetchCheckedOutEquipment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, searchTerm, selectedCategory, authenticatedUserId, authenticatedUserRole]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      setCategories(data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchAvailableEquipment = async () => {
    try {
      setLoading(true);

      // Fetch both available and needs_maintenance equipment for checkout
      const [availableRes, needsMaintenanceRes] = await Promise.all([
        fetch(`/api/equipment?status=available&limit=1000${searchTerm ? `&search=${searchTerm}` : ''}${selectedCategory ? `&category=${selectedCategory}` : ''}`),
        fetch(`/api/equipment?status=needs_maintenance&limit=1000${searchTerm ? `&search=${searchTerm}` : ''}${selectedCategory ? `&category=${selectedCategory}` : ''}`)
      ]);

      const availableData = await availableRes.json();
      const needsMaintenanceData = await needsMaintenanceRes.json();

      // Combine both lists
      const combined = [...(availableData.data || []), ...(needsMaintenanceData.data || [])];
      setEquipment(combined);
    } catch (error) {
      console.error('Failed to fetch available equipment:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCheckedOutEquipment = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        status: 'checked_out',
        limit: '1000'
      });

      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory) params.append('category', selectedCategory);

      const response = await fetch(`/api/equipment?${params}`);
      const data = await response.json();

      // Filter equipment based on authenticated user
      // Only show equipment checked out by the authenticated user
      // (unless they're an admin/manager who can check in anyone's equipment)
      let filteredEquipment = data.data || [];
      if (authenticatedUserRole !== 'admin' && authenticatedUserRole !== 'manager') {
        filteredEquipment = filteredEquipment.filter(item => item.checked_out_by_id === authenticatedUserId);
      }

      setEquipment(filteredEquipment);
    } catch (error) {
      console.error('Failed to fetch checked out equipment:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      setUsers(data || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const toggleEquipmentSelection = (id: number) => {
    setSelectedEquipment(prev =>
      prev.includes(id)
        ? prev.filter(equipId => equipId !== id)
        : [...prev, id]
    );
  };

  // Get status badge styling
  const getStatusBadge = (status: string) => {
    const statusStyles: { [key: string]: { label: string; className: string } } = {
      'available': { label: 'Available', className: 'bg-green-100 text-green-800 border-green-300' },
      'needs_maintenance': { label: 'Needs Maintenance', className: 'bg-orange-100 text-orange-800 border-orange-300' },
      'unavailable': { label: 'Unavailable', className: 'bg-red-100 text-red-800 border-red-300' },
      'checked_out': { label: 'Checked Out', className: 'bg-orange-100 text-orange-800 border-orange-300' },
      'maintenance': { label: 'Maintenance', className: 'bg-blue-100 text-blue-800 border-blue-300' },
      'out_for_maintenance': { label: 'Out for Maintenance', className: 'bg-blue-100 text-blue-800 border-blue-300' },
      'in_use': { label: 'In Use', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
      'reserved': { label: 'Reserved', className: 'bg-purple-100 text-purple-800 border-purple-300' },
      'decommissioned': { label: 'Decommissioned', className: 'bg-gray-100 text-gray-800 border-gray-300' }
    };

    const config = statusStyles[status] || statusStyles['available'];
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded border ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const handleCheckout = async () => {
    if (selectedEquipment.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one equipment item.' });
      return;
    }

    if (!authenticatedUserId) {
      setMessage({ type: 'error', text: 'Session expired. Please reload the page.' });
      return;
    }

    // Get the authenticated user's info
    const authenticatedUser = users.find(u => u.id === authenticatedUserId);
    if (!authenticatedUser) {
      setMessage({ type: 'error', text: 'Authenticated user not found.' });
      return;
    }

    // Validate all selected equipment status before checkout
    const invalidItems: string[] = [];
    for (const equipmentId of selectedEquipment) {
      const item = equipment.find(e => e.id === equipmentId);
      if (item && item.status !== 'available' && item.status !== 'needs_maintenance') {
        invalidItems.push(`${item.name} (status: ${item.status})`);
      }
    }

    if (invalidItems.length > 0) {
      setMessage({
        type: 'error',
        text: `Cannot checkout the following items. Equipment must be 'available' or 'needs_maintenance' to checkout:\n\n${invalidItems.join('\n')}`
      });
      return;
    }

    try {
      setLoading(true);
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (const equipmentId of selectedEquipment) {
        try {
          const response = await fetch('/api/transactions/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              equipment_id: equipmentId,
              user_id: authenticatedUserId,
              expected_return_date: expectedReturnDate,
              location: 'user', // Equipment goes with the user
              notes: notes,
              created_by: authenticatedUserId
            })
          });

          if (response.ok) {
            successCount++;
          } else {
            const error = await response.json();
            failCount++;
            const item = equipment.find(e => e.id === equipmentId);
            errors.push(`${item?.name}: ${error.error}`);
          }
        } catch (error) {
          failCount++;
          const item = equipment.find(e => e.id === equipmentId);
          errors.push(`${item?.name}: Network error`);
        }
      }

      if (successCount > 0) {
        setMessage({
          type: 'success',
          text: `Successfully checked out ${successCount} item${successCount > 1 ? 's' : ''} to ${authenticatedUser.full_name}${failCount > 0 ? `. ${failCount} failed.` : ''}`
        });
      } else {
        setMessage({ type: 'error', text: `All checkouts failed: ${errors.join(', ')}` });
      }

      resetForm();
      fetchAvailableEquipment();
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error during checkout' });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async () => {
    if (selectedEquipment.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one equipment item to check in.' });
      return;
    }

    if (!authenticatedUserId) {
      setMessage({ type: 'error', text: 'Session expired. Please reload the page.' });
      return;
    }

    try {
      setLoading(true);
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (const equipmentId of selectedEquipment) {
        try {
          const payload: any = {
            equipment_id: equipmentId,
            notes: notes,
            checked_in_by: authenticatedUserId,
            return_location: returnLocation
          };

          // Only include condition if user selected one (not empty string)
          if (returnCondition) {
            payload.condition_on_return = returnCondition;
          }

          const response = await fetch('/api/transactions/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            successCount++;
          } else {
            const error = await response.json();
            failCount++;
            const item = equipment.find(e => e.id === equipmentId);
            errors.push(`${item?.name}: ${error.error}`);
          }
        } catch (error) {
          failCount++;
          const item = equipment.find(e => e.id === equipmentId);
          errors.push(`${item?.name}: Network error`);
        }
      }

      if (successCount > 0) {
        setMessage({
          type: 'success',
          text: `Successfully checked in ${successCount} item${successCount > 1 ? 's' : ''}${failCount > 0 ? `. ${failCount} failed.` : ''}`
        });
      } else {
        setMessage({ type: 'error', text: `All check-ins failed: ${errors.join(', ')}` });
      }

      resetForm();
      fetchCheckedOutEquipment();
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error during check-in' });
    } finally {
      setLoading(false);
    }
  };


  const resetForm = () => {
    setSelectedEquipment([]);
    setNotes('');
    setExpectedReturnDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
    setReturnLocation('studio');
    setReturnCondition(''); // Reset to "keep current"
    // Clear message after delay - longer for errors (15s) than success (5s)
    const timeout = message?.type === 'error' ? 15000 : 5000;
    setTimeout(() => setMessage(null), timeout);
  };

  const selectAction = (action: 'checkout' | 'checkin') => {
    setMode(action);
    setActionSelected(true);
    resetForm();
    setSearchTerm('');
    setSelectedCategory('');
    setMessage(null);
  };

  const goBackToSelection = () => {
    setActionSelected(false);
    setMode(null);
    resetForm();
    setSearchTerm('');
    setMessage(null);
  };

  const switchMode = (newMode: 'checkout' | 'checkin') => {
    setMode(newMode);
    setActionSelected(true);
    resetForm();
    setSearchTerm('');
  };

  return (
    <div>
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <RefreshCw size={28} />
          Check In/Out Equipment
        </h1>

        {actionSelected && (
          <div className="flex gap-2">
            <button
              className="btn btn-secondary"
              onClick={goBackToSelection}
            >
              <ArrowLeft size={18} />
              Back to Selection
            </button>
            <button
              className={`btn ${mode === 'checkout' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => switchMode('checkout')}
            >
              <ArrowRight size={18} />
              Check Out
            </button>
            <button
              className={`btn ${mode === 'checkin' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => switchMode('checkin')}
            >
              <ArrowLeft size={18} />
              Check In
            </button>
          </div>
        )}
      </div>

      {/* Message Alert */}
      {message && (
        <div className={`p-4 rounded-lg mb-6 flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border-2 border-green-200'
            : 'bg-red-50 text-red-800 border-2 border-red-300'
        }`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span className="flex-1">{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="text-gray-500 hover:text-gray-700 ml-2"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Action Selection Screen */}
      {!actionSelected ? (
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">What would you like to do?</h2>
            <p className="text-gray-600">Select an action to get started</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Check Out Action */}
            <button
              onClick={() => selectAction('checkout')}
              className="group relative overflow-hidden rounded-xl border-2 border-gray-200 bg-white p-8 text-left transition-all hover:border-green-500 hover:shadow-xl"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150"></div>

              <div className="relative">
                <div className="mb-4 inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full text-green-600 group-hover:bg-green-500 group-hover:text-white transition-colors">
                  <ArrowRight size={32} />
                </div>

                <h3 className="text-2xl font-bold text-gray-900 mb-2">Check Out Equipment</h3>
                <p className="text-gray-600 mb-4">
                  Take equipment for your project or shoot
                </p>

                <div className="flex items-center text-green-600 font-medium group-hover:text-green-700">
                  <span>Get Started</span>
                  <ArrowRight size={16} className="ml-2" />
                </div>
              </div>
            </button>

            {/* Check In Action */}
            <button
              onClick={() => selectAction('checkin')}
              className="group relative overflow-hidden rounded-xl border-2 border-gray-200 bg-white p-8 text-left transition-all hover:border-blue-500 hover:shadow-xl"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150"></div>

              <div className="relative">
                <div className="mb-4 inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                  <ArrowLeft size={32} />
                </div>

                <h3 className="text-2xl font-bold text-gray-900 mb-2">Check In Equipment</h3>
                <p className="text-gray-600 mb-4">
                  Return equipment you've finished using
                </p>

                <div className="flex items-center text-blue-600 font-medium group-hover:text-blue-700">
                  <span>Get Started</span>
                  <ArrowRight size={16} className="ml-2" />
                </div>
              </div>
            </button>
          </div>

          {/* Quick Stats or Info */}
          <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {equipment.filter(e => e.status === 'available').length}
                </div>
                <div className="text-sm text-gray-600">Available Equipment</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-orange-600 mb-1">
                  {authenticatedUserRole === 'admin' || authenticatedUserRole === 'manager'
                    ? equipment.filter(e => e.status === 'checked_out').length
                    : equipment.filter(e => e.status === 'checked_out' && e.checked_out_by_id === authenticatedUserId).length
                  }
                </div>
                <div className="text-sm text-gray-600">
                  {authenticatedUserRole === 'admin' || authenticatedUserRole === 'manager'
                    ? 'Total Checked Out'
                    : 'Your Checked Out Items'
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Equipment Selection */}
        <div className="ledger-card">
          <div className="ledger-card-header">
            <h2 className="ledger-card-title">
              <Package size={20} />
              Select Equipment
              <span className="text-sm font-normal text-gray-500">
                ({mode === 'checkout' ? 'Available & Needs Maintenance' : 'Checked Out'})
              </span>
            </h2>
          </div>

          <div className="ledger-card-content p-4">
            {/* Info message for checkout mode */}
            {mode === 'checkout' && (
              <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg border border-blue-200 text-sm">
                <strong>Note:</strong> Only equipment with status <span className="font-semibold">'Available'</span> or <span className="font-semibold">'Needs Maintenance'</span> can be checked out. All selected items must have valid status to proceed.
              </div>
            )}

            {/* Info message for check-in mode */}
            {mode === 'checkin' && (
              <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg border border-blue-200 text-sm">
                <strong>Note:</strong> You can only check in equipment that you checked out.
                {authenticatedUserRole === 'admin' || authenticatedUserRole === 'manager'
                  ? ' As an admin/manager, you can check in any equipment.'
                  : ' Showing only YOUR checked-out equipment.'}
              </div>
            )}

            {/* Search and Filter */}
            <div className="mb-4 space-y-3">
              <div className="relative">
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="Search equipment..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-2">
                <select
                  className="form-control flex-1"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {(searchTerm || selectedCategory) && (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedCategory('');
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Select All / Deselect All */}
            {equipment.length > 0 && (
              <div className="mb-3 flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  {selectedEquipment.length} of {equipment.length} selected
                </span>
                <button
                  type="button"
                  className="text-sm text-brown-600 hover:text-brown-700 font-medium"
                  onClick={() => {
                    if (selectedEquipment.length === equipment.length) {
                      setSelectedEquipment([]);
                    } else {
                      setSelectedEquipment(equipment.map(e => e.id));
                    }
                  }}
                >
                  {selectedEquipment.length === equipment.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            )}

            {/* Equipment List */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  <div className="loading-spinner mx-auto"></div>
                </div>
              ) : equipment.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No {mode === 'checkout' ? 'available or needs maintenance' : 'checked out'} equipment found.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {equipment.map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                        selectedEquipment.includes(item.id)
                          ? 'border-brown-500 bg-brown-50'
                          : 'border-gray-200 hover:border-brown-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 w-4 h-4 text-brown-600 rounded focus:ring-brown-500"
                        checked={selectedEquipment.includes(item.id)}
                        onChange={() => toggleEquipmentSelection(item.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-medium text-gray-900">{item.name}</div>
                          {getStatusBadge(item.status)}
                        </div>
                        <div className="text-sm text-gray-600">{item.manufacturer} - {item.model}</div>
                        <div className="text-xs text-gray-500 font-mono">
                          Barcode: {item.barcode || 'N/A'}
                          {item.serial_number && <span className="ml-2">S/N: {item.serial_number}</span>}
                        </div>
                        {mode === 'checkin' && item.checked_out_by_name && (
                          <div className="text-xs text-orange-600 mt-1">
                            Checked out by: {item.checked_out_by_name}
                            {item.checkout_date && (
                              <span className="ml-1">
                                ({format(new Date(item.checkout_date), 'MMM d')})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transaction Form */}
        <div className="ledger-card">
          <div className="ledger-card-header">
            <h2 className="ledger-card-title">
              {mode === 'checkout' ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
              {mode === 'checkout' ? 'Check Out Details' : 'Check In Details'}
            </h2>
          </div>
          
          <div className="ledger-card-content p-4">
            {/* Selected Equipment Summary - Vertical List */}
            {selectedEquipment.length > 0 && (
              <div className="mb-6">
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <h3 className="font-medium text-gray-900 mb-2">
                    Selected Equipment ({selectedEquipment.length})
                  </h3>
                  <div className="text-sm text-gray-700 space-y-1 overflow-y-auto overflow-x-hidden" style={{ maxHeight: '200px' }}>
                    {selectedEquipment.map((equipId) => {
                      const item = equipment.find(e => e.id === equipId);
                      if (!item) return null;

                      return (
                        <div key={item.id} className="flex items-center justify-between gap-2 py-1">
                          <span className="font-medium truncate">{item.name}</span>
                          <button
                            onClick={() => toggleEquipmentSelection(equipId)}
                            className="flex-shrink-0 text-red-500 hover:text-red-700 px-2"
                            title="Click to remove"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Click on an item to remove it</p>
                </div>
              </div>
            )}

            <form className="space-y-4">
              {/* Info message for checkout mode */}
              {mode === 'checkout' && (
                <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg border border-blue-200 text-sm">
                  <strong>Note:</strong> You will check out equipment to yourself.
                </div>
              )}

              {/* Expected Return Date (Checkout only) */}
              {mode === 'checkout' && (
                <div className="form-group">
                  <label className="form-label flex items-center gap-2">
                    <Calendar size={16} />
                    Expected Return Date
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={expectedReturnDate}
                    onChange={(e) => setExpectedReturnDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
              )}

              {/* Location Selection (Check-in only) */}
              {mode === 'checkin' && (
                <>
                  <div className="form-group">
                    <label className="form-label flex items-center gap-2">
                      <Package size={16} />
                      Return Location
                    </label>
                    <select
                      className="form-control"
                      value={returnLocation}
                      onChange={(e) => setReturnLocation(e.target.value as 'studio' | 'vault')}
                    >
                      <option value="studio">Studio</option>
                      <option value="vault">Vault</option>
                    </select>
                    <small className="text-gray-500">Where is the equipment being returned?</small>
                  </div>

                  <div className="form-group">
                    <label className="form-label flex items-center gap-2">
                      <AlertTriangle size={16} />
                      Update Condition (Optional)
                    </label>
                    <select
                      className="form-control"
                      value={returnCondition}
                      onChange={(e) => setReturnCondition(e.target.value)}
                    >
                      <option value="">Keep Current Condition</option>
                      <option value="brand_new">Brand New</option>
                      <option value="normal">Normal</option>
                      <option value="functional">Functional</option>
                      <option value="worn">Worn</option>
                      <option value="out_of_commission">Out of Commission</option>
                      <option value="broken">Broken</option>
                    </select>
                    <small className="text-gray-500">Leave as "Keep Current" to not change the equipment condition</small>
                  </div>
                </>
              )}

              {/* Notes */}
              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder={`Add any notes about this ${mode}...`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  className={`btn flex-1 ${mode === 'checkout' ? 'btn-success' : 'btn-primary'}`}
                  disabled={loading || selectedEquipment.length === 0}
                  onClick={mode === 'checkout' ? handleCheckout : handleCheckin}
                >
                  {loading ? (
                    <div className="loading-spinner w-4 h-4"></div>
                  ) : mode === 'checkout' ? (
                    <>
                      <ArrowRight size={18} />
                      Check Out {selectedEquipment.length > 0 ? `(${selectedEquipment.length})` : 'Equipment'}
                    </>
                  ) : (
                    <>
                      <ArrowLeft size={18} />
                      Check In {selectedEquipment.length > 0 ? `(${selectedEquipment.length})` : 'Equipment'}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetForm}
                  disabled={loading}
                >
                  Clear
                </button>
              </div>
            </form>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};