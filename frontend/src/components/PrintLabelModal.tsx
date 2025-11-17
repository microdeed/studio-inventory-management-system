import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, FileImage, FileText, AlertCircle } from 'lucide-react';
import { sessionManager } from '../utils/sessionManager.ts';

interface Equipment {
  id: number;
  name: string;
  barcode: string;
  qr_code: string;
}

interface PrintLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: Equipment | null;
}

export const PrintLabelModal: React.FC<PrintLabelModalProps> = ({
  isOpen,
  onClose,
  equipment
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [checkingPrinter, setCheckingPrinter] = useState(true);
  const [useHalfSize, setUseHalfSize] = useState(false);

  // Fetch printer configuration when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchPrinterConfig();
    }
  }, [isOpen]);

  const fetchPrinterConfig = async () => {
    setCheckingPrinter(true);
    try {
      const session = sessionManager.getSession();
      if (!session) return;

      const response = await fetch('/api/print/printers', {
        headers: {
          'x-user-id': session.userId.toString()
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPrinterName(data.configured || null);
      }
    } catch (err) {
      console.error('Error fetching printer config:', err);
    } finally {
      setCheckingPrinter(false);
    }
  };

  const handlePrintAction = async (action: 'png' | 'pdf' | 'png-direct' | 'pdf-direct') => {
    if (!equipment) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const session = sessionManager.getSession();
      if (!session) {
        setError('Session expired. Please reload the page.');
        return;
      }

      let url = '';
      let method = 'GET';
      const sizeParam = useHalfSize ? '?size=half' : '';

      switch (action) {
        case 'png':
          url = `/api/print/${equipment.id}${sizeParam}`;
          break;
        case 'pdf':
          url = `/api/print/pdf/${equipment.id}${sizeParam}`;
          break;
        case 'png-direct':
          url = `/api/print/direct/${equipment.id}${sizeParam}`;
          method = 'POST';
          break;
        case 'pdf-direct':
          url = `/api/print/pdf-direct/${equipment.id}${sizeParam}`;
          method = 'POST';
          break;
      }

      const response = await fetch(url, {
        method: method,
        headers: {
          'x-user-id': session.userId.toString()
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Print operation failed');
      }

      // For preview actions (png/pdf), open in new tab
      if (action === 'png' || action === 'pdf') {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        setSuccess('Label opened in new tab');
      } else {
        // For direct print actions
        const result = await response.json();
        setSuccess(result.message || 'Label sent to printer successfully');
      }

    } catch (error: any) {
      console.error('Print error:', error);
      setError(error.message || 'Print operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setSuccess('');
    onClose();
  };

  if (!isOpen || !equipment) return null;

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
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '1.5rem' }}>
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Printer size={24} />
              Print Label
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700"
              disabled={loading}
            >
              ✕
            </button>
          </div>

          {/* Equipment Info */}
          <div className="bg-gray-50 p-4 rounded mb-4">
            <div className="mb-2">
              <span className="font-semibold">Equipment:</span> {equipment.name}
            </div>
            <div className="mb-2">
              <span className="font-semibold">Barcode:</span> {equipment.barcode}
            </div>
            <div>
              <span className="font-semibold">QR Code:</span> {equipment.qr_code}
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="alert alert-error mb-4">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="alert alert-success mb-4">
              <span>✓ {success}</span>
            </div>
          )}

          {/* Size Toggle */}
          <div className="mb-4 p-3 bg-gray-50 rounded">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useHalfSize}
                onChange={(e) => setUseHalfSize(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">
                Print at half size (QR only, no text)
              </span>
            </label>
          </div>

          {/* Print Options */}
          <div className="space-y-3 mb-4">
            <h3 className="font-semibold text-sm text-gray-600 mb-2">Preview Options:</h3>

            <button
              onClick={() => handlePrintAction('png')}
              disabled={loading}
              className="btn btn-secondary w-full flex items-center justify-center gap-2"
            >
              <FileImage size={18} />
              View PNG Label
            </button>

            <button
              onClick={() => handlePrintAction('pdf')}
              disabled={loading}
              className="btn btn-secondary w-full flex items-center justify-center gap-2"
            >
              <FileText size={18} />
              View PDF Label
            </button>

            <h3 className="font-semibold text-sm text-gray-600 mb-2 mt-4">Direct Print Options:</h3>

            <button
              onClick={() => handlePrintAction('png-direct')}
              disabled={loading}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              <Printer size={18} />
              {loading ? 'Printing...' : 'Print PNG to Printer'}
            </button>

            <button
              onClick={() => handlePrintAction('pdf-direct')}
              disabled={loading}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              <Printer size={18} />
              {loading ? 'Printing...' : 'Print PDF to Printer'}
            </button>
          </div>

          {/* Printer Status */}
          <div className={`text-xs p-3 rounded ${printerName ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'}`}>
            {checkingPrinter ? (
              <span>Checking printer...</span>
            ) : printerName ? (
              <>
                <strong>Printer Configured:</strong> {printerName}
                <div className="mt-1 text-xs opacity-80">
                  PNG format is portrait (12mm width), PDF format is horizontal (12mm height).
                </div>
              </>
            ) : (
              <>
                <strong>Printer not configured.</strong> Direct printing requires a configured printer.
                <div className="mt-1 text-xs opacity-80">
                  Edit backend/printer-config.json to configure your EPSON LABELWORKS printer.
                </div>
              </>
            )}
          </div>

          {/* Close Button */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              className="btn btn-secondary flex-1"
              onClick={handleClose}
              disabled={loading}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
