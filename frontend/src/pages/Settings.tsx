import React, { useState } from 'react';
import { Settings as SettingsIcon, Upload, Download, Database, CheckCircle, XCircle, AlertCircle, Undo } from 'lucide-react';

interface ImportResult {
  imported: number;
  errors: number;
  errorList: string[];
  equipmentIds: number[];
}

export const Settings: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem('lastImportResult');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportResult(null); // Clear previous results
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('csvFile', selectedFile);

    try {
      setImporting(true);
      setImportResult(null);

      const response = await fetch('/api/import/equipment', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        // Extract equipment IDs from successful imports
        const equipmentIds = result.results
          .filter((r: any) => r.status === 'success')
          .map((r: any) => r.id);

        const importData = {
          imported: result.imported,
          errors: result.errors.length,
          errorList: result.errors,
          equipmentIds
        };

        setImportResult(importData);

        // Save to localStorage for persistence
        localStorage.setItem('lastImportResult', JSON.stringify(importData));

        setSelectedFile(null);

        // Clear file input
        const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        setImportResult({
          imported: 0,
          errors: 1,
          errorList: [result.error || 'Import failed'],
          equipmentIds: []
        });
      }
    } catch (error) {
      setImportResult({
        imported: 0,
        errors: 1,
        errorList: ['Network error: Could not connect to server'],
        equipmentIds: []
      });
    } finally {
      setImporting(false);
    }
  };

  const handleUndo = async () => {
    if (!importResult || importResult.equipmentIds.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete the ${importResult.imported} items you just imported? This cannot be undone.`)) {
      return;
    }

    try {
      setUndoing(true);

      const response = await fetch('/api/import/undo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          equipmentIds: importResult.equipmentIds
        })
      });

      const result = await response.json();

      if (response.ok) {
        alert(`Successfully deleted ${result.deleted} items`);
        setImportResult(null);

        // Clear from localStorage
        localStorage.removeItem('lastImportResult');
      } else {
        alert(`Undo failed: ${result.error}`);
      }
    } catch (error) {
      alert('Undo failed: Network error');
    } finally {
      setUndoing(false);
    }
  };

  const downloadTemplate = () => {
    window.open('/api/import/template', '_blank');
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <SettingsIcon size={28} />
          Settings
        </h1>
        <p className="text-gray-600">Configure system settings and import data</p>
      </div>

      <div className="space-y-6">
        {/* Data Import Section */}
        <div className="ledger-card">
          <div className="ledger-card-header">
            <h2 className="ledger-card-title">
              <Database size={20} />
              Data Import
            </h2>
          </div>
          
          <div className="ledger-card-content p-6">
            <div className="mb-4">
              <h3 className="font-medium text-gray-900 mb-2">Import Equipment from Spreadsheet</h3>
              <p className="text-sm text-gray-600 mb-4">
                Upload a CSV file to import your existing equipment data. Download the template below to see the required format.
              </p>
              
              <button onClick={downloadTemplate} className="btn btn-secondary mb-4">
                <Download size={16} />
                Download CSV Template
              </button>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <div className="text-center">
                <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                <div className="mb-4">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="btn btn-primary cursor-pointer">
                    Select CSV File
                  </label>
                </div>
                
                {selectedFile && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">
                      Selected: <span className="font-medium">{selectedFile.name}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      Size: {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                )}
                
                <button
                  onClick={handleImport}
                  disabled={!selectedFile || importing}
                  className="btn btn-success"
                >
                  {importing ? (
                    <>
                      <div className="loading-spinner w-4 h-4"></div>
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Import Equipment
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Import Results */}
            {importResult && (
              <div className="mt-6">
                {importResult.imported > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
                        <div>
                          <h4 className="font-semibold text-green-900">Import Successful</h4>
                          <p className="text-sm text-green-700">
                            Successfully imported {importResult.imported} equipment item{importResult.imported !== 1 ? 's' : ''}.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleUndo}
                        disabled={undoing}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap text-sm font-medium transition-colors"
                      >
                        {undoing ? (
                          <>
                            <div className="loading-spinner w-4 h-4"></div>
                            Undoing...
                          </>
                        ) : (
                          <>
                            <Undo size={16} />
                            Undo Import
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {importResult.errors > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="text-red-600 flex-shrink-0" size={20} />
                      <div className="flex-1">
                        <h4 className="font-semibold text-red-900 mb-2">
                          {importResult.errors} Error{importResult.errors !== 1 ? 's' : ''}
                        </h4>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {importResult.errorList.map((error, index) => (
                            <p key={index} className="text-sm text-red-700 flex items-start gap-2">
                              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                              <span>{error}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* System Information */}
        <div className="ledger-card">
          <div className="ledger-card-header">
            <h2 className="ledger-card-title">System Information</h2>
          </div>
          
          <div className="ledger-card-content p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Application</h3>
                <p className="text-sm text-gray-600">Studio Inventory v1.0.0</p>
                <a  href="/release-notes"
                              className="block mt-1 opacity-50 hover:opacity-100 hover:underline transition-opacity"
                              style={{ color: 'inherit', textDecoration: 'none' }}>
                              Release Notes (latest)
                            </a>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Database</h3>
                <p className="text-sm text-gray-600">SQLite</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};