import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/dateFormat';
import { Plus, UserCog, Key, Trash2, CreditCard as Edit } from 'lucide-react';
import Pagination from '../components/Pagination';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'doctor' | 'lab_tech';
  created_at: string;
}

async function getValidSession() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    const { data: refreshData } = await supabase.auth.refreshSession();
    if (!refreshData.session) {
      throw new Error('Session expired. Please log in again.');
    }
    return refreshData.session;
  }

  return session;
}

export default function Users() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'doctor' as 'admin' | 'doctor' | 'lab_tech',
    password: '',
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    role: 'doctor' as 'admin' | 'doctor' | 'lab_tech',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    try {
      const session = await getValidSession();

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-user-management/create`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Server response:', result);
        throw new Error(result.error || `Failed to create user (${response.status})`);
      }

      alert('User created successfully!');
      setFormData({ name: '', email: '', role: 'doctor', password: '' });
      setShowDialog(false);
      loadUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      alert(error.message || 'Failed to create user');
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();

    if (!selectedUser) return;

    try {
      const session = await getValidSession();

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-user-management/update-password`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          newPassword: passwordData.newPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reset password');
      }

      alert('Password reset successfully!');
      setPasswordData({ newPassword: '' });
      setShowPasswordDialog(false);
      setSelectedUser(null);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      alert(error.message || 'Failed to reset password');
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`Delete user "${user.name}"? This action cannot be undone.`)) return;

    try {
      const session = await getValidSession();

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-user-management/delete`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user');
      }

      alert('User deleted successfully!');
      loadUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert(error.message || 'Failed to delete user');
    }
  }

  function openPasswordDialog(user: User) {
    setSelectedUser(user);
    setPasswordData({ newPassword: '' });
    setShowPasswordDialog(true);
  }

  function openEditDialog(user: User) {
    setSelectedUser(user);
    setEditFormData({
      name: user.name,
      email: user.email,
      role: user.role,
    });
    setShowEditDialog(true);
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();

    if (!selectedUser) return;

    try {
      const session = await getValidSession();

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-user-management/update`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          name: editFormData.name,
          email: editFormData.email,
          role: editFormData.role,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update user');
      }

      alert('User updated successfully!');
      setShowEditDialog(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      alert(error.message || 'Failed to update user');
    }
  }

  const totalItems = users.length;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = users.slice(startIndex, endIndex);

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        {profile?.role === 'admin' && (
          <button
            onClick={() => setShowDialog(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            <span>Add User</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <UserCog className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="font-medium text-gray-900">{user.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">{user.email}</td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      user.role === 'admin'
                        ? 'bg-red-100 text-red-800'
                        : user.role === 'lab_tech'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {user.role === 'lab_tech' ? 'LAB TECHNICIAN' : user.role.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600 text-sm">
                  {formatDate(user.created_at)}
                </td>
                <td className="px-6 py-4">
                  {profile?.role === 'admin' ? (
                    <div className="flex space-x-3">
                      <button
                        onClick={() => openEditDialog(user)}
                        className="text-gray-600 hover:text-gray-800"
                        title="Edit User"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openPasswordDialog(user)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Reset Password"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">View only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="text-center py-12 text-gray-500">No users found</div>
        )}

        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {showDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Create New User</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as 'admin' | 'doctor' | 'lab_tech' })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="doctor">Doctor</option>
                  <option value="lab_tech">Lab Technician</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowDialog(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPasswordDialog && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Reset Password - {selectedUser.name}</h2>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ newPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordDialog(false);
                    setSelectedUser(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditDialog && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Edit User - {selectedUser.name}</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={editFormData.role}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, role: e.target.value as 'admin' | 'doctor' | 'lab_tech' })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="doctor">Doctor</option>
                  <option value="lab_tech">Lab Technician</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditDialog(false);
                    setSelectedUser(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Update User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
