import React, { useState, useEffect } from 'react';
import {
  Package,
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
  Wrench,
  Activity,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  FileText,
  Edit,
  Upload,
  Trash2
} from 'lucide-react';
import { formatInCentral } from '../utils/dateUtils.ts';

interface DashboardData {
  summary: {
    total_equipment: number;
    available_equipment: number;
    checked_out_equipment: number;
    maintenance_equipment: number;
    overdue_equipment: number;
    total_users: number;
    total_categories: number;
  };
  recent_activity: ActivityLogEntry[];
}

interface ActivityLogEntry {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  changes: any;
  created_at: string;
  user_name: string;
  username: string;
}

interface BatchDetails {
  batch_id: string;
  transaction_type: string;
  transaction_count: number;
  user_name: string;
  created_at: string;
  purpose?: string;
  transactions: {
    id: number;
    equipment_name: string;
    serial_number: string;
    barcode: string;
    model: string;
    manufacturer: string;
    category_name: string;
  }[];
}

interface OverdueItem {
  id: number;
  equipment_name: string;
  serial_number: string;
  user_name: string;
  user_email: string;
  expected_return_date: string;
  days_overdue: number;
}

const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}> = ({ title, value, icon: Icon, color, bgColor }) => (
  <div className={`p-6 rounded-lg ${bgColor} border border-opacity-20`} style={{ borderColor: color }}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-3xl font-bold" style={{ color }}>{value}</p>
      </div>
      <Icon size={32} style={{ color }} className="opacity-80" />
    </div>
  </div>
);

export const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [overdueEquipment, setOverdueEquipment] = useState<OverdueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedActivities, setExpandedActivities] = useState<Set<number>>(new Set());
  const [batchDetails, setBatchDetails] = useState<Map<string, BatchDetails>>(new Map());
  const [loadingBatches, setLoadingBatches] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchDashboardData();
    fetchOverdueEquipment();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/reports/dashboard');
      const data = await response.json();
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  const fetchOverdueEquipment = async () => {
    try {
      const response = await fetch('/api/transactions/overdue');
      const data = await response.json();
      setOverdueEquipment(data || []);
    } catch (error) {
      console.error('Failed to fetch overdue equipment:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActivityExpansion = async (activityId: number, batchId?: string) => {
    const newExpanded = new Set(expandedActivities);

    if (newExpanded.has(activityId)) {
      newExpanded.delete(activityId);
    } else {
      newExpanded.add(activityId);

      // Fetch batch details if not already loaded
      if (batchId && !batchDetails.has(batchId)) {
        await fetchBatchDetails(batchId);
      }
    }

    setExpandedActivities(newExpanded);
  };

  const fetchBatchDetails = async (batchId: string) => {
    if (loadingBatches.has(batchId)) return;

    setLoadingBatches(prev => new Set(prev).add(batchId));

    try {
      const response = await fetch(`/api/activity/batch/${batchId}`);
      const data = await response.json();
      setBatchDetails(prev => new Map(prev).set(batchId, data));
    } catch (error) {
      console.error('Failed to fetch batch details:', error);
    } finally {
      setLoadingBatches(prev => {
        const newSet = new Set(prev);
        newSet.delete(batchId);
        return newSet;
      });
    }
  };

  // Format field names for display
  const formatFieldName = (field: string): string => {
    return field
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Format field value for display
  const formatFieldValue = (value: any): string => {
    if (value === null || value === undefined || value === '') return 'Empty';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  const summary = dashboardData?.summary;

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Activity size={28} />
          Studio Inventory Dashboard
        </h1>
        <p className="text-gray-600">Equipment management overview</p>
      </div>

      {/* Statistics Grid */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Equipment"
            value={summary.total_equipment}
            icon={Package}
            color="#8b4513"
            bgColor="bg-amber-50"
          />
          <StatCard
            title="Available"
            value={summary.available_equipment}
            icon={CheckCircle}
            color="#228b22"
            bgColor="bg-green-50"
          />
          <StatCard
            title="Checked Out"
            value={summary.checked_out_equipment}
            icon={Clock}
            color="#ff8c00"
            bgColor="bg-orange-50"
          />
          <StatCard
            title="Overdue"
            value={summary.overdue_equipment}
            icon={AlertTriangle}
            color="#dc143c"
            bgColor="bg-red-50"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="ledger-card">
          <div className="ledger-card-header">
            <h2 className="ledger-card-title">
              <TrendingUp size={20} />
              Recent Activity
            </h2>
          </div>

          <div className="ledger-card-content p-0">
            {dashboardData?.recent_activity && Array.isArray(dashboardData.recent_activity) && dashboardData.recent_activity.length > 0 ? (
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {dashboardData.recent_activity.map((activity) => {
                  const isExpanded = expandedActivities.has(activity.id);
                  const batchId = activity.changes?.batch_id;
                  const isTransaction = activity.action === 'checkout' || activity.action === 'checkin';
                  const isUpdate = activity.action === 'update' && activity.entity_type === 'equipment';
                  const isExpandable = isTransaction || isUpdate;
                  const batchData = batchId ? batchDetails.get(batchId) : null;

                  return (
                    <div key={activity.id} className="p-4">
                      <div
                        className={`flex items-center justify-between ${isExpandable ? 'cursor-pointer hover:bg-gray-50 -m-4 p-4 rounded' : ''}`}
                        onClick={() => isExpandable && toggleActivityExpansion(activity.id, batchId)}
                      >
                        <div className="flex-1">
                          {/* Checkout/Checkin Activities */}
                          {activity.action === 'checkout' && (
                            <>
                              <div className="flex items-center gap-2 font-medium text-gray-900">
                                <Package size={16} className="text-green-600" />
                                Checked out {activity.changes?.count || 1} item{(activity.changes?.count || 1) > 1 ? 's' : ''}
                                {isTransaction && (
                                  <span className="text-gray-400">
                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 ml-6">
                                by {activity.user_name}
                                {activity.changes?.purpose && (
                                  <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                                    {activity.changes.purpose.charAt(0).toUpperCase() + activity.changes.purpose.slice(1)}
                                  </span>
                                )}
                              </div>
                            </>
                          )}

                          {activity.action === 'checkin' && (
                            <>
                              <div className="flex items-center gap-2 font-medium text-gray-900">
                                <CheckCircle size={16} className="text-blue-600" />
                                Checked in {activity.changes?.count || 1} item{(activity.changes?.count || 1) > 1 ? 's' : ''}
                                {isTransaction && (
                                  <span className="text-gray-400">
                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 ml-6">
                                by {activity.user_name}
                              </div>
                            </>
                          )}

                          {/* Equipment Update */}
                          {activity.action === 'update' && activity.entity_type === 'equipment' && (
                            <>
                              <div className="flex items-center gap-2 font-medium text-gray-900">
                                <Edit size={16} className="text-orange-600" />
                                Equipment Updated
                                {isUpdate && (
                                  <span className="text-gray-400">
                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 ml-6">
                                by {activity.user_name || 'System'}
                                {activity.changes && Object.keys(activity.changes).length > 0 && (
                                  <span className="ml-2 text-xs text-gray-500">
                                    ({Object.keys(activity.changes).length} field{Object.keys(activity.changes).length > 1 ? 's' : ''} changed)
                                  </span>
                                )}
                              </div>
                            </>
                          )}

                          {/* Import */}
                          {activity.action === 'import' && (
                            <>
                              <div className="flex items-center gap-2 font-medium text-gray-900">
                                <Upload size={16} className="text-purple-600" />
                                Imported {activity.changes?.imported || 0} item{(activity.changes?.imported || 0) !== 1 ? 's' : ''}
                              </div>
                              <div className="text-sm text-gray-600 ml-6">
                                {activity.changes?.filename || 'CSV file'}
                                {activity.changes?.errors > 0 && (
                                  <span className="ml-2 text-red-600">
                                    ({activity.changes.errors} error{activity.changes.errors !== 1 ? 's' : ''})
                                  </span>
                                )}
                              </div>
                            </>
                          )}

                          {/* Undo Import */}
                          {activity.action === 'undo_import' && (
                            <>
                              <div className="flex items-center gap-2 font-medium text-gray-900">
                                <Trash2 size={16} className="text-red-600" />
                                Undid import ({activity.changes?.deleted || 0} item{(activity.changes?.deleted || 0) !== 1 ? 's' : ''} deleted)
                              </div>
                              <div className="text-sm text-gray-600 ml-6">
                                by {activity.user_name || 'System'}
                              </div>
                            </>
                          )}
                        </div>

                        <div className="text-xs text-gray-500">
                          {formatInCentral(activity.created_at, 'MMM d, HH:mm')}
                        </div>
                      </div>

                      {/* Expanded Details for Transactions */}
                      {isExpanded && isTransaction && (
                        <div className="mt-3 ml-6 pl-4 border-l-2 border-gray-200">
                          <div className="text-sm font-medium text-gray-700 mb-2">
                            Equipment Details:
                          </div>
                          <div className="space-y-2">
                            {/* Show from batch details if available */}
                            {batchData && batchData.transactions && Array.isArray(batchData.transactions) && batchData.transactions.length > 0 ? (
                              batchData.transactions.map((item) => (
                                <div key={item.id} className="text-sm text-gray-600 flex items-center gap-2">
                                  <CheckCircle size={12} className="text-green-500" />
                                  <span className="font-medium">{item.equipment_name}</span>
                                  {item.category_name && (
                                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                                      {item.category_name}
                                    </span>
                                  )}
                                  {item.barcode && (
                                    <span className="text-xs text-gray-400 font-mono">
                                      {item.barcode}
                                    </span>
                                  )}
                                </div>
                              ))
                            ) : activity.changes?.equipment && Array.isArray(activity.changes.equipment) && activity.changes.equipment.length > 0 ? (
                              /* Fallback: Show from activity.changes.equipment */
                              activity.changes.equipment.map((item: any, index: number) => (
                                <div key={index} className="text-sm text-gray-600 flex items-center gap-2">
                                  <CheckCircle size={12} className="text-green-500" />
                                  <span className="font-medium">{item.name}</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-gray-500 italic">
                                No equipment details available
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Expanded Details for Equipment Updates */}
                      {isExpanded && isUpdate && activity.changes && Object.keys(activity.changes).length > 0 && (
                        <div className="mt-3 ml-6 pl-4 border-l-2 border-orange-200">
                          <div className="text-sm font-medium text-gray-700 mb-2">
                            Changed Fields:
                          </div>
                          <div className="space-y-2">
                            {Object.entries(activity.changes)
                              .filter(([field, change]) => change && typeof change === 'object' && 'from' in change && 'to' in change)
                              .map(([field, change]: [string, any]) => (
                                <div key={field} className="text-sm">
                                  <div className="font-medium text-gray-700 mb-1">
                                    {formatFieldName(field)}:
                                  </div>
                                  <div className="flex items-center gap-2 ml-4 text-gray-600">
                                    <span className="px-2 py-1 bg-red-50 text-red-700 rounded border border-red-200">
                                      {formatFieldValue(change.from)}
                                    </span>
                                    <span className="text-gray-400">→</span>
                                    <span className="px-2 py-1 bg-green-50 text-green-700 rounded border border-green-200">
                                      {formatFieldValue(change.to)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {isExpanded && loadingBatches.has(batchId!) && (
                        <div className="mt-3 ml-6 text-sm text-gray-500">
                          Loading details...
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Activity size={48} className="mx-auto mb-4 opacity-50" />
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* Overdue Equipment */}
        <div className="ledger-card">
          <div className="ledger-card-header">
            <h2 className="ledger-card-title">
              <AlertTriangle size={20} />
              Overdue Equipment
              {overdueEquipment.length > 0 && (
                <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                  {overdueEquipment.length}
                </span>
              )}
            </h2>
          </div>
          
          <div className="ledger-card-content">
            {overdueEquipment.length > 0 ? (
              <div className="divide-y">
                {overdueEquipment.map((item) => (
                  <div key={item.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-900">{item.equipment_name}</div>
                        <div className="text-sm text-gray-600">{item.serial_number}</div>
                        <div className="text-sm text-gray-600">
                          Checked out by: {item.user_name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-red-600">
                          {Math.floor(item.days_overdue)} days overdue
                        </div>
                        <div className="text-xs text-gray-500">
                          Due: {formatInCentral(item.expected_return_date, 'MMM d, yyyy')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <CheckCircle size={48} className="mx-auto mb-4 opacity-50 text-green-400" />
                <p>No overdue equipment!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      {summary && (
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-2xl font-bold text-gray-800">{summary.total_users}</div>
            <div className="text-sm text-gray-600 flex items-center gap-1">
              <Users size={16} />
              Active Users
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-2xl font-bold text-gray-800">{summary.total_categories}</div>
            <div className="text-sm text-gray-600">Equipment Categories</div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-2xl font-bold text-gray-800">{summary.maintenance_equipment}</div>
            <div className="text-sm text-gray-600 flex items-center gap-1">
              <Wrench size={16} />
              In Maintenance
            </div>
          </div>
        </div>
      )}
    </div>
  );
};