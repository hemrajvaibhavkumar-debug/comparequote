import React, { useState, useEffect } from 'react';
import { User, Shield, Key, Trash2, Plus, X, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface UserData {
  id: number;
  username: string;
  role: string;
  permissions: string[];
  created_at: string;
}

const ALL_PERMISSIONS = [
  { key: "ACCESS_COMPARE", label: "Quotation Comparison", description: "Access the comparison & extraction tool" },
  { key: "VIEW_SAVED_TABLES", label: "View Saved Tables", description: "View and edit previously saved comparison tables" },
  { key: "ACCESS_PO_MAKER", label: "PO Maker", description: "Create and edit Purchase Orders" },
  { key: "VIEW_SAVED_POS", label: "View Saved POs", description: "Access the list of all created POs" },
  { key: "VIEW_APPROVAL_HUB", label: "View Approval  Hub", description: "View POs and approval status (Read-only)" },
  { key: "APPROVE_PO", label: "Approval Hub Actions", description: "Review, sign, and approve/reject POs" },
  { key: "MANAGE_SETTINGS", label: "Company Settings", description: "Manage company info, terms, and vendors" },
  { key: "MANAGE_USERS", label: "User Management", description: "Create and manage other user accounts" },
];

export default function UserManagement() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const { token, user: currentUser } = useAuth();
 
  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('USER');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error("Failed to fetch users", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (userToEdit: UserData | null = null) => {
    setEditingUser(userToEdit);
    if (userToEdit) {
      setUsername(userToEdit.username);
      setPassword('');
      setRole(userToEdit.role);
      setPermissions(userToEdit.permissions || []);
    } else {
      setUsername('');
      setPassword('');
      setRole('USER');
      setPermissions([]);
    }
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
    const method = editingUser ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username,
          password: password || undefined,
          role,
          permissions
        })
      });

      if (res.ok) {
        setShowModal(false);
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save user');
      }
    } catch (e) {
      setError('Connection error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchUsers();
      else {
        const data = await res.json();
        alert(data.error || 'Failed to delete user');
      }
    } catch (e) {
      alert('Error deleting user');
    }
  };

  const togglePermission = (key: string) => {
    setPermissions(prev => 
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  if (loading && users.length === 0) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-black flex items-center gap-2 uppercase tracking-tight">
            <User className="w-5 h-5" /> User Accounts
          </h3>
          <p className="text-sm text-gray-500">Manage team access and permissions</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-black/90 transition-all shadow-md"
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="bg-white border border-black rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-black">
              <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-600">User</th>
              <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-600">Role</th>
              <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-600">Permissions</th>
              <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center font-bold text-black uppercase">
                      {u.username.charAt(0)}
                    </div>
                    <span className="font-bold text-sm">{u.username}</span>
                    {u.username === currentUser?.username && (
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold uppercase">You</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                    u.role === 'SUPERADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {u.role === 'SUPERADMIN' ? (
                      <span className="text-[10px] text-gray-400 font-bold uppercase italic">All Permissions Granted</span>
                    ) : (
                      (u.permissions || []).map(p => (
                        <span key={p} className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 font-bold uppercase">
                          {p.replace(/_/g, ' ')}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => handleOpenModal(u)}
                      className="p-1.5 text-gray-400 hover:text-black hover:bg-black/5 rounded transition-all"
                      title="Edit User"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                    {u.role !== 'SUPERADMIN' && (
                      <button 
                        onClick={() => handleDelete(u.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-black shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <h4 className="text-lg font-bold flex items-center gap-2 uppercase tracking-tight">
                {editingUser ? <Shield className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {editingUser ? 'Edit User Permissions' : 'Create New User Account'}
              </h4>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-600">Username</label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    disabled={!!editingUser}
                    className="w-full px-4 py-2 border border-black rounded-lg focus:ring-1 focus:ring-black outline-none disabled:bg-gray-50"
                    placeholder="e.g., purchase_head_01"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-600">
                    {editingUser ? 'New Password (Optional)' : 'Password'}
                  </label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-black rounded-lg focus:ring-1 focus:ring-black outline-none"
                    placeholder="••••••••"
                    required={!editingUser}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-gray-600">System Role</label>
                <div className="flex gap-2">
                  {['USER', 'PURCHASE_HEAD', 'SUPERADMIN'].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`flex-1 py-2 px-3 border rounded-lg text-xs font-bold transition-all ${
                        role === r ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200 hover:border-black'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {role !== 'SUPERADMIN' && (
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-600 block">Granular Permissions</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ALL_PERMISSIONS.map(p => (
                      <label 
                        key={p.key}
                        className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${
                          permissions.includes(p.key) ? 'border-black bg-black/5 shadow-sm' : 'border-gray-100 hover:border-black'
                        }`}
                      >
                        <div className="pt-0.5">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                            permissions.includes(p.key) ? 'bg-black border-black text-white' : 'bg-white border-gray-300'
                          }`}>
                            {permissions.includes(p.key) && <Check className="w-3 h-3" />}
                          </div>
                          <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={permissions.includes(p.key)}
                            onChange={() => togglePermission(p.key)}
                          />
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-black uppercase tracking-tight">{p.label}</div>
                          <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{p.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-100 p-3 rounded-lg flex items-center gap-2 text-red-800 text-xs font-bold">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-8 py-2 bg-black text-white text-xs font-black uppercase tracking-widest rounded-lg hover:bg-black/90 transition-all shadow-lg"
                >
                  {editingUser ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
