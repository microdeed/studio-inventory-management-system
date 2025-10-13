import React from 'react';
import { BarChart3, FileText, Download } from 'lucide-react';

export const Reports: React.FC = () => {
  const reports = [
    {
      name: 'Equipment Utilization',
      description: 'View which equipment is used most frequently',
      icon: BarChart3,
      action: 'Generate Report'
    },
    {
      name: 'Overdue Equipment',
      description: 'List of all overdue equipment and responsible users',
      icon: FileText,
      action: 'View Report'
    },
    {
      name: 'User Activity',
      description: 'Checkout/checkin activity by user',
      icon: FileText,
      action: 'Generate Report'
    },
    {
      name: 'Equipment by Category',
      description: 'Breakdown of equipment inventory by category',
      icon: BarChart3,
      action: 'View Report'
    }
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <BarChart3 size={28} />
          Reports & Analytics
        </h1>
        <p className="text-gray-600">Generate reports and view analytics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((report, index) => {
          const Icon = report.icon;
          return (
            <div key={index} className="ledger-card">
              <div className="ledger-card-content p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Icon size={24} className="text-brown-600" />
                    <div>
                      <h3 className="font-medium text-gray-900">{report.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm">
                    <Download size={14} />
                    {report.action}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};