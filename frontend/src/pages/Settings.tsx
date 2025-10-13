import React, { useState } from 'react';
import { Settings as SettingsIcon, Upload, Download, Database } from 'lucide-react';

export const Settings: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('csvFile', selectedFile);

    try {
      setImporting(true);
      const response = await fetch('/api/import/equipment', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (response.ok) {
        alert(`Successfully imported ${result.imported} items. ${result.errors} errors.`);
        setSelectedFile(null);
      } else {
        alert(`Import failed: ${result.error}`);
      }
    } catch (error) {
      alert('Import failed: Network error');
    } finally {
      setImporting(false);
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