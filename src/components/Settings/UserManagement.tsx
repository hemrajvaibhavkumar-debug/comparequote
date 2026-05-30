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
  { key: "VIEW_APPROVAL_HUB", label: "View Approval Hub", description: "View POs and approval status (Read-only)" },
  { key: "APPROVE_PO", label: "Approval Hub Actions", description: "Review, sign, and approve/reject POs" },
  { key: "ADD_INTERNAL_COMMENTS", label: "Add Internal Notes", description: "Add point-by-point notes to POs and Tables" },
  { key: "MANAGE_SETTINGS", label: "Company Settings", description: "Manage company info, terms, and vendors" },
  { key: "MANAGE_USERS", label: "User Management", description: "Create and manage other user accounts" },
];

export default function UserManagement() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [roles, setRoles] = useState<{id: number, name: string}[]>([]);
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
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error("Failed to fetch users", e);
    }
  };

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/roles', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRoles(data);
      }
    } catch (e) {
      console.error("Failed to fetch roles", e);
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
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black dark:border-white"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wider font-sans">
            <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> User Accounts
          </h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Management of team access levels</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all duration-200 hover:-translate-y-0.5 transform shadow-md shadow-indigo-600/10 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-colors">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800">
              <th className="px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">User</th>
              <th className="px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Role</th>
              <th className="px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Permissions</th>
              <th className="px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/50 transition-colors duration-150">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center font-black text-indigo-600 dark:text-indigo-400 text-sm uppercase shadow-sm">
                      {u.username.charAt(0)}
                    </div>
                    <span className="font-black text-xs text-slate-800 dark:text-slate-200 uppercase tracking-tight">{u.username}</span>
                    {u.username === currentUser?.username && (
                      <span className="text-[8px] bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-lg font-black uppercase tracking-widest">You</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-xl shadow-inner tracking-widest ${
                    u.role === 'SUPERADMIN' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-100/50 dark:border-purple-800/50' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/30 dark:border-slate-700/50'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {u.role === 'SUPERADMIN' ? (
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase italic tracking-wide">All Permissions Granted</span>
                    ) : (
                      (u.permissions || []).map(p => (
                        <span key={p} className="text-[8px] bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-lg border border-slate-200/40 dark:border-slate-700/50 font-black uppercase tracking-wide">
                          {p.replace(/_/g, ' ')}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button 
                      onClick={() => handleOpenModal(u)}
                      className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                      title="Edit User"
                    >
                      <Key className="w-3.5 h-3.5" />
                    </button>
                    {u.role !== 'SUPERADMIN' && (
                      <button 
                        onClick={() => handleDelete(u.id)}
                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all cursor-pointer"
                        title="Delete User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative custom-scrollbar">
            <div className="sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10">
              <h4 className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-slate-800 dark:text-slate-100 font-sans">
                {editingUser ? <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-pulse" /> : <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                {editingUser ? 'Edit User Permissions' : 'Create New Account'}
              </h4>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer">
                <X className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Username</label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    disabled={!!editingUser}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed"
                    placeholder="e.g., debs_admin"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    {editingUser ? 'New Password (Optional)' : 'Password'}
                  </label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                    placeholder="••••••••"
                    required={!editingUser}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block">System Role</label>
                <div className="flex flex-wrap gap-2">
                  {roles.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRole(r.name)}
                      className={`py-2 px-4 border rounded-xl text-[10px] font-black transition-all uppercase tracking-wider cursor-pointer ${
                        role === r.name 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                          : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400'
                      }`}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>

              {role !== 'SUPERADMIN' && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block">Granular Permissions</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ALL_PERMISSIONS.map(p => (
                      <label 
                        key={p.key}
                        className={`flex items-start gap-3 p-3.5 border rounded-2xl cursor-pointer transition-all ${
                          permissions.includes(p.key) 
                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10 shadow-sm' 
                            : 'border-slate-100 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-700 bg-slate-50/20 dark:bg-slate-950/20'
                        }`}
                      >
                        <div className="pt-0.5">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                            permissions.includes(p.key) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700'
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
                          <div className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{p.label}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">{p.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 p-3 rounded-xl flex items-center gap-2 text-rose-800 dark:text-rose-400 text-xs font-bold shadow-inner">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-7 py-2 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/10 hover:-translate-y-0.5 transform cursor-pointer"
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
