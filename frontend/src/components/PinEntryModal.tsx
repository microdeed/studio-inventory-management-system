import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Lock, AlertCircle } from 'lucide-react';

interface PinEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userId: number, userRole: string) => void;
  title?: string;
  message?: string;
}

export const PinEntryModal: React.FC<PinEntryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'Authentication Required',
  message = 'Please enter your PIN to continue'
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      // Focus input when modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Only digits
    if (value.length <= 6) {
      setPin(value);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess(data.user_id, data.role);
        onClose();
      } else {
        setError(data.error || 'Invalid PIN');
        setPin('');
        inputRef.current?.focus();
      }
    } catch (error) {
      console.error('PIN verification error:', error);
      setError('Network error. Please try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
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
      onClick={onClose}
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
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-brown-100 rounded-full flex items-center justify-center">
            <Lock size={24} className="text-brown-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-600">{message}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* PIN Input */}
          <div className="form-group">
            <label className="form-label">Enter PIN</label>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              className="form-control text-center text-2xl tracking-widest"
              value={pin}
              onChange={handlePinChange}
              placeholder="••••••"
              maxLength={6}
              autoFocus
              disabled={loading}
            />
            <small className="text-gray-500 block text-center mt-1">
              4-6 digit PIN
            </small>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-800 rounded border border-red-200">
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* PIN Dots Display */}
          <div className="flex justify-center gap-2 py-2">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all ${
                  i < pin.length
                    ? 'bg-brown-600'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              className="btn btn-secondary flex-1"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={loading || pin.length < 4}
            >
              {loading ? (
                <div className="loading-spinner w-4 h-4" />
              ) : (
                'Verify'
              )}
            </button>
          </div>
        </form>

        {/* Help Text */}
        <div className="mt-4 pt-4 border-t text-center">
          <p className="text-xs text-gray-500">
            Contact your administrator if you've forgotten your PIN
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
