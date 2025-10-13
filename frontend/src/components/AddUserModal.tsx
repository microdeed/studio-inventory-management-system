import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { UserPlus, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react';
import { sessionManager } from '../utils/sessionManager.ts';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    role: 'user',
    department: '',
    phone: '',
    pin: '',
    confirm_pin: ''
  });
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateForm = () => {
    if (!formData.full_name.trim()) {
      setError('Full name is required');
      return false;
    }
    if (formData.full_name.trim().length < 2) {
      setError('Full name must be at least 2 characters');
      return false;
    }
    if (!formData.username.trim()) {
      setError('Username is required');
      return false;
    }
    if (formData.username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!formData.pin) {
      setError('PIN is required');
      return false;
    }
    if (formData.pin.length < 4 || formData.pin.length > 6) {
      setError('PIN must be 4-6 digits');
      return false;
    }
    if (!/^\d+$/.test(formData.pin)) {
      setError('PIN must contain only numbers');
      return false;
    }
    if (formData.pin !== formData.confirm_pin) {
      setError('PINs do not match');
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

      // First, create the user
      const createResponse = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username.trim(),
          email: formData.email.trim(),
          full_name: formData.full_name.trim(),
          role: formData.role,
          department: formData.department.trim() || null,
          phone: formData.phone.trim() || null,
          checked_by: session.userId // For authentication
        })
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || 'Failed to create user');
      }

      const newUser = await createResponse.json();

      // Then, set the PIN
      const pinResponse = await fetch('/api/auth/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: newUser.id,
          pin: formData.pin,
          confirm_pin: formData.confirm_pin
        })
      });

      if (!pinResponse.ok) {
        const errorData = await pinResponse.json();
        throw new Error(errorData.error || 'Failed to set PIN');
      }

      // Success!
      onSuccess();
      handleClose();

    } catch (error: any) {
      console.error('Add user error:', error);
      setError(error.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      username: '',
      email: '',
      full_name: '',
      role: 'user',
      department: '',
      phone: '',
      pin: '',
      confirm_pin: ''
    });
    setError('');
    setShowPin(false);
    setShowConfirmPin(false);
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
          maxWidth: '42rem',
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
              <UserPlus size={24} className="text-brown-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Add New User</h2>
              <p className="text-sm text-gray-600">Create a new user account with PIN</p>
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

            <div className="grid grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="form-group">
                <label className="form-label">
                  Full Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.full_name}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>

              {/* Username */}
              <div className="form-group">
                <label className="form-label">
                  Username <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                  placeholder="johndoe"
                  required
                />
              </div>

              {/* Email */}
              <div className="form-group">
                <label className="form-label">
                  Email <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  className="form-control"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="john@example.com"
                  required
                />
              </div>

              {/* Phone */}
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  className="form-control"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>

              {/* Department */}
              <div className="form-group">
                <label className="form-label">Department</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.department}
                  onChange={(e) => handleChange('department', e.target.value)}
                  placeholder="Production, Post, etc."
                />
              </div>

              {/* Role */}
              <div className="form-group">
                <label className="form-label">
                  Role <span className="text-red-600">*</span>
                </label>
                <select
                  className="form-control"
                  value={formData.role}
                  onChange={(e) => handleChange('role', e.target.value)}
                >
                  <option value="user">User</option>
                  <option value="manager">Studio Manager</option>
                  <option value="admin">Admin</option>
                </select>
                <small className="text-gray-500 block mt-1">
                  Only admins can make edits
                </small>
              </div>
            </div>

            {/* PIN Section */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Lock size={16} className="text-gray-600" />
                <h3 className="font-medium text-gray-900">Set PIN Code</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* PIN */}
                <div className="form-group">
                  <label className="form-label">
                    PIN (4-6 digits) <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="form-control"
                      value={formData.pin}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 6) {
                          handleChange('pin', value);
                        }
                      }}
                      placeholder="••••••"
                      maxLength={6}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPin(!showPin)}
                    >
                      {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm PIN */}
                <div className="form-group">
                  <label className="form-label">
                    Confirm PIN <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPin ? 'text' : 'password'}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="form-control"
                      value={formData.confirm_pin}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 6) {
                          handleChange('confirm_pin', value);
                        }
                      }}
                      placeholder="••••••"
                      maxLength={6}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowConfirmPin(!showConfirmPin)}
                    >
                      {showConfirmPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                The user will use this PIN to authenticate when checking equipment in/out
              </p>
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
                    <UserPlus size={18} />
                    Create User
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
