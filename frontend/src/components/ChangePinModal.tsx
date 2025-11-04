import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lock, AlertCircle, Eye, EyeOff, Shield } from 'lucide-react';
import { sessionManager } from '../utils/sessionManager.ts';

interface ChangePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: number;
  targetUserName: string;
  isAdminReset: boolean; // true = admin resetting another user's PIN, false = user changing own PIN
}

export const ChangePinModal: React.FC<ChangePinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userId,
  targetUserName,
  isAdminReset
}) => {
  const [formData, setFormData] = useState({
    currentPin: '',
    newPin: '',
    confirmPin: ''
  });
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setFormData({
        currentPin: '',
        newPin: '',
        confirmPin: ''
      });
      setShowCurrentPin(false);
      setShowNewPin(false);
      setShowConfirmPin(false);
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(''); // Clear error when user types
  };

  const validateForm = (): boolean => {
    // Validate current PIN (only for self-service)
    if (!isAdminReset) {
      if (!formData.currentPin) {
        setError('Current PIN is required');
        return false;
      }
      if (formData.currentPin.length < 4 || formData.currentPin.length > 6) {
        setError('Current PIN must be 4-6 digits');
        return false;
      }
      if (!/^\d+$/.test(formData.currentPin)) {
        setError('Current PIN must contain only numbers');
        return false;
      }
    }

    // Validate new PIN
    if (!formData.newPin) {
      setError('New PIN is required');
      return false;
    }
    if (formData.newPin.length < 4 || formData.newPin.length > 6) {
      setError('New PIN must be 4-6 digits');
      return false;
    }
    if (!/^\d+$/.test(formData.newPin)) {
      setError('New PIN must contain only numbers');
      return false;
    }

    // Validate confirm PIN
    if (formData.newPin !== formData.confirmPin) {
      setError('New PINs do not match');
      return false;
    }

    // Check that new PIN is different from current (for self-service)
    if (!isAdminReset && formData.currentPin === formData.newPin) {
      setError('New PIN must be different from current PIN');
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
      const session = sessionManager.getSession();
      if (!session) {
        setError('Session expired. Please reload the page.');
        setLoading(false);
        return;
      }

      // Step 1: Verify current PIN (only for self-service)
      if (!isAdminReset) {
        const verifyResponse = await fetch('/api/auth/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            pin: formData.currentPin
          })
        });

        const verifyData = await verifyResponse.json();

        if (!verifyResponse.ok || !verifyData.success) {
          setError('Current PIN is incorrect');
          setLoading(false);
          return;
        }
      }

      // Step 2: Set new PIN
      const setPinResponse = await fetch('/api/auth/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          pin: formData.newPin,
          confirm_pin: formData.confirmPin
        })
      });

      if (!setPinResponse.ok) {
        const errorData = await setPinResponse.json();
        throw new Error(errorData.error || 'Failed to update PIN');
      }

      // Success!
      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
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
          maxWidth: '28rem',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              {isAdminReset ? (
                <Shield size={24} className="text-blue-600" />
              ) : (
                <Lock size={24} className="text-blue-600" />
              )}
              <h2 className="text-xl font-bold text-gray-900">
                {isAdminReset ? 'Reset User PIN' : 'Change Your PIN'}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
              disabled={loading}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="space-y-4">
          {/* User Info */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-700">
              {isAdminReset ? (
                <>
                  <span className="font-medium">Resetting PIN for:</span> {targetUserName}
                  <br />
                  <span className="text-xs text-gray-600 mt-1 block">
                    As an admin, you can set a new PIN without the current PIN.
                  </span>
                </>
              ) : (
                <>
                  <span className="font-medium">User:</span> {targetUserName}
                  <br />
                  <span className="text-xs text-gray-600 mt-1 block">
                    You must verify your current PIN before setting a new one.
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-red-800">{error}</span>
            </div>
          )}

          {/* PIN Fields */}
          <div className="space-y-4">
            {/* Current PIN (only for self-service) */}
            {!isAdminReset && (
              <div className="form-group">
                <label className="form-label">
                  Current PIN <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="form-control"
                    value={formData.currentPin}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      if (value.length <= 6) {
                        handleChange('currentPin', value);
                      }
                    }}
                    placeholder="••••••"
                    maxLength={6}
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowCurrentPin(!showCurrentPin)}
                    disabled={loading}
                  >
                    {showCurrentPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* New PIN */}
            <div className="form-group">
              <label className="form-label">
                New PIN (4-6 digits) <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNewPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="form-control"
                  value={formData.newPin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 6) {
                      handleChange('newPin', value);
                    }
                  }}
                  placeholder="••••••"
                  maxLength={6}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowNewPin(!showNewPin)}
                  disabled={loading}
                >
                  {showNewPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm New PIN */}
            <div className="form-group">
              <label className="form-label">
                Confirm New PIN <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="form-control"
                  value={formData.confirmPin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 6) {
                      handleChange('confirmPin', value);
                    }
                  }}
                  placeholder="••••••"
                  maxLength={6}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowConfirmPin(!showConfirmPin)}
                  disabled={loading}
                >
                  {showConfirmPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-secondary flex-1"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={loading}
            >
              {loading ? 'Updating...' : isAdminReset ? 'Reset PIN' : 'Change PIN'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
