import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Users, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Wrench,
  Activity,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';

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
  recent_activity: {
    transaction_type: string;
    created_at: string;
    equipment_name: string;
    user_name: string;
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
          
          <div className="ledger-card-content">
            {dashboardData?.recent_activity?.length ? (
              <div className="divide-y">
                {dashboardData.recent_activity.map((activity, index) => (
                  <div key={index} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        {activity.equipment_name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {activity.transaction_type === 'checkout' ? 'Checked out by' : 'Checked in by'}{' '}
                        {activity.user_name}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(activity.created_at), 'MMM d, HH:mm')}
                    </div>
                  </div>
                ))}
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
                          Due: {format(new Date(item.expected_return_date), 'MMM d, yyyy')}
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