import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users as UsersIcon, Plus, Mail, Building, Lock } from 'lucide-react';
import { AddUserModal } from '../components/AddUserModal.tsx';
import { sessionManager } from '../utils/sessionManager.ts';

interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: string;
  department: string;
  phone?: string;
  total_checkouts: number;
  active_checkouts: number;
  created_at: string;
}

export const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editedUser, setEditedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // Access control: Only admins can manage users
  const isAdmin = currentUserRole === 'admin';

  useEffect(() => {
    fetchUsers();

    // Get current user's role from session
    const session = sessionManager.getSession();
    if (session) {
      console.log('[Users] Session found:', session);
      console.log('[Users] User role:', session.role);
      setCurrentUserRole(session.role);
    } else {
      console.log('[Users] No session found');
    }
  }, []);

  // Log access control state whenever role changes
  useEffect(() => {
    console.log('[Users] Current user role:', currentUserRole);
    console.log('[Users] Is admin:', isAdmin);
  }, [currentUserRole, isAdmin]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      setUsers(data || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditedUser({...user});
    setShowEditModal(true);
  };

  const handleSaveUser = async () => {
    if (!editedUser) return;

    // Validate required fields
    if (!editedUser.full_name || editedUser.full_name.trim() === '') {
      alert('Full name is required');
      return;
    }

    if (editedUser.full_name.trim().length < 2) {
      alert('Full name must be at least 2 characters long');
      return;
    }

    if (!editedUser.username || editedUser.username.trim() === '') {
      alert('Username is required');
      return;
    }

    if (editedUser.username.trim().length < 3) {
      alert('Username must be at least 3 characters long');
      return;
    }

    if (!editedUser.email || editedUser.email.trim() === '') {
      alert('Email is required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editedUser.email)) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      setIsSaving(true);

      // Get current user ID for authentication
      const session = sessionManager.getSession();
      if (!session) {
        alert('Session expired. Please reload the page.');
        return;
      }

      // Only send editable fields
      const updateData = {
        username: editedUser.username.trim(),
        email: editedUser.email.trim(),
        full_name: editedUser.full_name.trim(),
        role: editedUser.role,
        phone: editedUser.phone?.trim() || null,
        department: editedUser.department?.trim() || null,
        checked_by: session.userId // For authentication
      };

      const response = await fetch(`/api/users/${editedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        setShowEditModal(false);
        fetchUsers();
        alert('✓ User updated successfully!');
      } else {
        const error = await response.json();

        // Handle validation errors
        if (error.errors && Array.isArray(error.errors)) {
          const errorMessages = error.errors.map((e: any) => e.msg).join('\n');
          alert('Validation errors:\n\n' + errorMessages);
        } else if (error.error?.includes('already exists')) {
          alert('Failed to update user:\n\nUsername or email already exists.\nPlease choose different values.');
        } else {
          alert(`Failed to update user:\n\n${error.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Failed to update user:', error);
      alert('Network error while updating user.\n\nPlease check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = (field: keyof User, value: any) => {
    if (editedUser) {
      setEditedUser({ ...editedUser, [field]: value });
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      setIsDeleting(true);

      // Get current user ID for authentication
      const session = sessionManager.getSession();
      if (!session) {
        alert('Session expired. Please reload the page.');
        return;
      }

      const response = await fetch(`/api/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checked_by: session.userId // For authentication
        })
      });

      if (response.ok) {
        setShowDeleteConfirm(false);
        setUserToDelete(null);
        fetchUsers();
        alert('✓ User deleted successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to delete user:\n\n${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Network error while deleting user.\n\nPlease check your connection and try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <UsersIcon size={28} />
          Users Directory
        </h1>
        {isAdmin ? (
          <button
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={18} />
            Add User
          </button>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
            <Lock size={16} />
            <span>Admin access required to manage users</span>
          </div>
        )}
      </div>

      <div className="ledger-card">
        <div className="ledger-card-header">
          <h2 className="ledger-card-title">
            Registered Users
            <span className="text-sm font-normal text-gray-500">({users.length} users)</span>
          </h2>
        </div>

        <div className="ledger-card-content">
          {loading ? (
            <div className="text-center py-12">
              <div className="loading-spinner mx-auto"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="equipment-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Contact</th>
                    <th>Department</th>
                    <th>Role</th>
                    <th>Equipment Usage</th>
                    {isAdmin && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div>
                          <div className="font-medium text-gray-900">{user.full_name}</div>
                          <div className="text-sm text-gray-500">@{user.username}</div>
                        </div>
                      </td>
                      <td>
                        <div className="text-sm">
                          <div className="flex items-center gap-1">
                            <Mail size={14} />
                            {user.email}
                          </div>
                          {user.phone && (
                            <div className="text-gray-500 mt-1">{user.phone}</div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Building size={14} />
                          {user.department || 'N/A'}
                        </div>
                      </td>
                      <td>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          user.role === 'admin' 
                            ? 'bg-red-100 text-red-800'
                            : user.role === 'manager'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <div className="text-sm">
                          <div>Total: {user.total_checkouts}</div>
                          <div className="text-orange-600">Active: {user.active_checkouts}</div>
                        </div>
                      </td>
                      {isAdmin && (
                        <td>
                          <div className="flex gap-1">
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => handleEditUser(user)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => {
                                setUserToDelete(user);
                                setShowDeleteConfirm(true);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      <AddUserModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          fetchUsers();
          alert('✓ User created successfully!');
        }}
      />

      {/* Edit User Modal */}
      {showEditModal && selectedUser && editedUser && createPortal(
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
          onClick={() => setShowEditModal(false)}
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
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Edit User</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>

              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div className="form-group">
                    <label className="form-label">Full Name <span className="text-red-600">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={editedUser.full_name}
                      onChange={(e) => handleFieldChange('full_name', e.target.value)}
                      required
                      minLength={2}
                    />
                    <small className="text-gray-500">Required (min 2 characters)</small>
                  </div>

                  {/* Username */}
                  <div className="form-group">
                    <label className="form-label">Username <span className="text-red-600">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={editedUser.username}
                      onChange={(e) => handleFieldChange('username', e.target.value)}
                      required
                      minLength={3}
                    />
                    <small className="text-gray-500">Required (min 3 characters)</small>
                  </div>

                  {/* Email */}
                  <div className="form-group">
                    <label className="form-label">Email <span className="text-red-600">*</span></label>
                    <input
                      type="email"
                      className="form-control"
                      value={editedUser.email}
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                      required
                    />
                    <small className="text-gray-500">Required (valid email)</small>
                  </div>

                  {/* Phone */}
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editedUser.phone || ''}
                      onChange={(e) => handleFieldChange('phone', e.target.value)}
                    />
                  </div>

                  {/* Department */}
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editedUser.department || ''}
                      onChange={(e) => handleFieldChange('department', e.target.value)}
                    />
                  </div>

                  {/* Role */}
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select
                      className="form-control"
                      value={editedUser.role}
                      onChange={(e) => handleFieldChange('role', e.target.value)}
                    >
                      <option value="user">User</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                {/* User Stats (Read-only) */}
                <div className="p-4 bg-gray-50 rounded border">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Total Checkouts:</strong> {selectedUser.total_checkouts}
                    </div>
                    <div>
                      <strong>Active Checkouts:</strong> {selectedUser.active_checkouts}
                    </div>
                    <div className="col-span-2">
                      <strong>Member Since:</strong> {new Date(selectedUser.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowEditModal(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSaveUser}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && userToDelete && createPortal(
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
          onClick={() => setShowDeleteConfirm(false)}
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
          >
            <h2 className="text-xl font-bold mb-4 text-red-600">Delete User</h2>
            <p className="mb-4">
              Are you sure you want to delete <strong>{userToDelete.full_name}</strong> (@{userToDelete.username})?
            </p>
            <p className="text-sm text-gray-600 mb-6">
              This will mark the user as inactive. The user will no longer be able to log in or check out equipment.
              {userToDelete.active_checkouts > 0 && (
                <span className="block mt-2 text-red-600 font-medium">
                  ⚠️ Warning: This user has {userToDelete.active_checkouts} active checkout{userToDelete.active_checkouts > 1 ? 's' : ''}.
                  They must return all equipment before deletion.
                </span>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setUserToDelete(null);
                }}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteUser}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};