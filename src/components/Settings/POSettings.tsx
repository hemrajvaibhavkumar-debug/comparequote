import React, { useState, useEffect } from 'react';
import { CompanySettings, TermsTemplate, VendorMaster } from '../../types';
import { Save, Plus, Trash2, Building2, Users, ShieldCheck, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApiCache } from '../../context/ApiCacheContext';
import UserManagement from './UserManagement';

const CONTACT_OPTIONS = [
  "+91 90462 40020 - soumen karmakar",
  "+91 90461 76169 - vivek",
  "+91 90461 76166 - amit",
  "+91 90461 76150 - sayanta da",
  "+91 62941 44047 - proloy da",
  "+91 90461 41874 - Arpita"
];

const POSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'terms' | 'vendors' | 'users' | 'roles'>('profile');
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [templates, setTemplates] = useState<TermsTemplate[]>([]);
  const [vendors, setVendors] = useState<VendorMaster[]>([]);
  const [roles, setRoles] = useState<{id: number, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTemplate, setNewTemplate] = useState<Partial<TermsTemplate>>({});
  const [newVendor, setNewVendor] = useState<Partial<VendorMaster>>({});
  const [newRole, setNewRole] = useState('');
  const [editingRole, setEditingRole] = useState<{id: number, name: string} | null>(null);
  
  const { token, user, logout } = useAuth();
  const {
    fetchCompanySettings: getCompanySettingsFromCache,
    fetchTermsTemplates: getTermsTemplatesFromCache,
    fetchVendors: getVendorsFromCache,
    fetchRoles: getRolesFromCache,
    invalidateCompanySettings,
    invalidateTermsTemplates,
    invalidateVendors,
    invalidateRoles
  } = useApiCache();
  const isSuperAdmin = user?.role === 'SUPERADMIN';

  useEffect(() => {
    fetchSettings();
    fetchTemplates();
    fetchVendors();
    fetchRoles();
  }, []);

  const fetchSettings = async (forceRefresh = false) => {
    try {
      const data = await getCompanySettingsFromCache(forceRefresh);
      setSettings(data);
      setLoading(false);
    } catch (e) {
      console.error("Failed to fetch settings:", e);
      setLoading(false);
    }
  };

  const fetchTemplates = async (forceRefresh = false) => {
    try {
      const data = await getTermsTemplatesFromCache(forceRefresh);
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      setTemplates([]);
    }
  };

  const fetchVendors = async (forceRefresh = false) => {
    try {
      const data = await getVendorsFromCache(forceRefresh);
      setVendors(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch vendors:", error);
    }
  };

  const fetchRoles = async (forceRefresh = false) => {
    try {
      const data = await getRolesFromCache(forceRefresh);
      setRoles(data);
    } catch (error) {
      console.error("Failed to fetch roles:", error);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    const res = await fetch('/api/settings/company', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(settings)
    });

    if (res.status === 401 || res.status === 403) {
      logout();
      return;
    }

    if (res.ok) {
      invalidateCompanySettings();
      fetchSettings(true);
      alert('Settings saved successfully!');
    }
    else alert('Failed to save settings');
  };

  const handleAddTemplate = async () => {
    if (!newTemplate.name) return;
    const res = await fetch('/api/settings/terms', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newTemplate)
    });
    if (res.status === 401 || res.status === 403) {
      logout();
      return;
    }
    setNewTemplate({});
    invalidateTermsTemplates();
    fetchTemplates(true);
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    const res = await fetch(`/api/settings/terms/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401 || res.status === 403) {
      logout();
      return;
    }
    invalidateTermsTemplates();
    fetchTemplates(true);
  };

  const handleAddVendor = async () => {
    if (!newVendor.name) return;
    const res = await fetch('/api/settings/vendors', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newVendor)
    });
    if (res.status === 401 || res.status === 403) {
      logout();
      return;
    }
    setNewVendor({});
    invalidateVendors();
    fetchVendors(true);
  };

  const handleDeleteVendor = async (name: string) => {
    if (!confirm('Are you sure you want to delete this vendor?')) return;
    const res = await fetch(`/api/settings/vendors/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401 || res.status === 403) {
      logout();
      return;
    }
    invalidateVendors();
    fetchVendors(true);
  };

  const handleAddRole = async () => {
    if (!newRole) return;
    
    let res;
    if (editingRole) {
      res = await fetch(`/api/roles/${editingRole.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newRole })
      });
      setEditingRole(null);
    } else {
      res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newRole })
      });
    }

    if (res.status === 401 || res.status === 403) {
      logout();
      return;
    }

    setNewRole('');
    invalidateRoles();
    fetchRoles(true);
  };

  const handleDeleteRole = async (id: number) => {
    const role = roles.find(r => r.id === id);
    if (['SUPERADMIN', 'PURCHASE_HEAD', 'USER'].includes(role?.name || '')) {
      alert("Cannot delete core system roles");
      return;
    }
    if (!confirm('Are you sure you want to delete this role?')) return;
    const res = await fetch(`/api/roles/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401 || res.status === 403) {
      logout();
      return;
    }
    invalidateRoles();
    fetchRoles(true);
  };

  if (loading) return <div className="p-8 text-center text-slate-800 dark:text-slate-100 min-h-screen bg-slate-50 dark:bg-slate-950">Loading settings...</div>;

  const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-[0.1em] transition-all rounded-xl cursor-pointer ${
        activeTab === id 
          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 transition-colors duration-300 pb-20 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="ambient-glow ambient-indigo -top-40 -right-40" />
      <div className="ambient-glow ambient-blue -bottom-40 -left-40" />

      {/* Header */}
      <div className="glass-navbar sticky top-16 z-40 print-hidden relative z-10">
        <div className="max-w-6xl mx-auto px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-xl shadow-md shadow-indigo-600/10">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-black text-slate-900 dark:text-slate-100 font-sans tracking-tight uppercase">System Settings</h1>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Global Configuration & Controls</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-slate-100 dark:bg-slate-900/50 p-1 rounded-2xl border border-slate-200/40 dark:border-slate-800">
              <TabButton id="profile" label="Profile" icon={Building2} />
              <TabButton id="terms" label="Terms" icon={FileText} />
              <TabButton id="vendors" label="Vendors" icon={Users} />
              {isSuperAdmin && (
                <>
                  <TabButton id="roles" label="Roles" icon={ShieldCheck} />
                  <TabButton id="users" label="Users" icon={Users} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8 relative z-10">
        {activeTab === 'profile' && (
          <div className="glass-card p-8 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 max-w-3xl">
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-6 uppercase tracking-wider">Company Metadata</h2>
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-full space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Company Name</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                    value={settings?.name || ''}
                    onChange={e => setSettings(s => s ? {...s, name: e.target.value} : null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">CIN</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                    value={settings?.cin || ''}
                    onChange={e => setSettings(s => s ? {...s, cin: e.target.value} : null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">GSTIN</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                    value={settings?.gstin || ''}
                    onChange={e => setSettings(s => s ? {...s, gstin: e.target.value} : null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">PAN</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                    value={settings?.pan || ''}
                    onChange={e => setSettings(s => s ? {...s, pan: e.target.value} : null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Email</label>
                  <input 
                    type="email" 
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                    value={settings?.email || ''}
                    onChange={e => setSettings(s => s ? {...s, email: e.target.value} : null)}
                  />
                </div>
                <div className="col-span-full space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Regd. Office Address</label>
                  <textarea 
                    rows={2}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                    value={settings?.regd_office || ''}
                    onChange={e => setSettings(s => s ? {...s, regd_office: e.target.value} : null)}
                  />
                </div>
                <div className="col-span-full space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Factory Address</label>
                  <textarea 
                    rows={2}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                    value={settings?.factory_address || ''}
                    onChange={e => setSettings(s => s ? {...s, factory_address: e.target.value} : null)}
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition hover:-translate-y-0.5 shadow-md shadow-indigo-600/10 cursor-pointer"
              >
                <Save className="w-4 h-4" /> Save Company Profile
              </button>
            </form>
          </div>
        )}

        {activeTab === 'terms' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="glass-card p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm h-fit">
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-6 uppercase tracking-wider">Create New Template</h2>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Template Name</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                    value={newTemplate.name || ''}
                    onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Tax Status</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 18% Extra"
                      className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                      value={newTemplate.tax || ''}
                      onChange={e => setNewTemplate({...newTemplate, tax: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Payment Terms</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 30 Days Credit"
                      className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                      value={newTemplate.payment || ''}
                      onChange={e => setNewTemplate({...newTemplate, payment: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Contact No</label>
                  <div className="flex gap-2">
                    <select 
                      className="w-1/3 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                      onChange={e => {
                        if (e.target.value !== 'CUSTOM') {
                          const numberOnly = e.target.value.split(' - ')[0];
                          setNewTemplate({...newTemplate, contact_no: numberOnly});
                        }
                      }}
                      value={CONTACT_OPTIONS.some(opt => opt.startsWith(newTemplate.contact_no || 'INVALID')) ? CONTACT_OPTIONS.find(opt => opt.startsWith(newTemplate.contact_no || '')) : (newTemplate.contact_no ? 'CUSTOM' : '')}
                    >
                      <option value="">Select Contact</option>
                      {CONTACT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      <option value="CUSTOM">Custom...</option>
                    </select>
                    <input 
                      type="text" 
                      className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                      value={newTemplate.contact_no || ''}
                      onChange={e => setNewTemplate({...newTemplate, contact_no: e.target.value})}
                      placeholder="+91..."
                    />
                  </div>
                </div>
                <button 
                  onClick={handleAddTemplate}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition hover:-translate-y-0.5 shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Template
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Saved Templates</h3>
              {templates.map(t => (
                <div key={t.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm group hover:border-slate-300 dark:hover:border-slate-700 transition duration-200">
                  <div>
                    <div className="font-black text-slate-800 dark:text-slate-100 text-xs uppercase tracking-tight">{t.name}</div>
                    <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-1">Tax: {t.tax || 'N/A'} | Pay: {t.payment || 'N/A'}</div>
                  </div>
                  <button 
                    onClick={() => handleDeleteTemplate(t.id)}
                    className="text-slate-400 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/30 transition duration-200 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {templates.length === 0 && <div className="text-center py-12 text-slate-400 italic text-xs uppercase tracking-widest font-bold">No templates created.</div>}
            </div>
          </div>
        )}

        {activeTab === 'vendors' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 glass-card p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm h-fit">
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-6 uppercase tracking-wider">Add Vendor</h2>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Vendor Name</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                    value={newVendor.name || ''}
                    onChange={e => setNewVendor({...newVendor, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">GSTIN</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                    value={newVendor.gstin || ''}
                    onChange={e => setNewVendor({...newVendor, gstin: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Mobile No</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                      value={newVendor.mobile_no || ''}
                      onChange={e => setNewVendor({...newVendor, mobile_no: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Email</label>
                    <input 
                      type="email" 
                      className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                      value={newVendor.email || ''}
                      onChange={e => setNewVendor({...newVendor, email: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">State</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                    value={newVendor.state || ''}
                    onChange={e => setNewVendor({...newVendor, state: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Address</label>
                  <textarea 
                    rows={2}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                    value={newVendor.address || ''}
                    onChange={e => setNewVendor({...newVendor, address: e.target.value})}
                  />
                </div>
                <button 
                  onClick={handleAddVendor}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition hover:-translate-y-0.5 shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add to Master
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Vendor Database</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {vendors.map(v => (
                  <div key={v.name} className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800 group relative hover:shadow-md transition-all duration-200">
                    <button 
                      onClick={() => handleDeleteVendor(v.name)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-rose-600 p-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors duration-200 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="font-black text-slate-800 dark:text-slate-100 text-xs uppercase tracking-tight truncate pr-8">{v.name}</div>
                    <div className="mt-3 space-y-1">
                      <div className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 flex justify-between">
                        <span>GSTIN</span>
                        <span className="text-slate-700 dark:text-slate-300">{v.gstin || 'N/A'}</span>
                      </div>
                      <div className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 flex justify-between">
                        <span>Phone</span>
                        <span className="text-slate-700 dark:text-slate-300">{v.mobile_no || 'N/A'}</span>
                      </div>
                      <div className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 flex justify-between">
                        <span>Email</span>
                        <span className="text-slate-700 dark:text-slate-300 truncate ml-4">{v.email || 'N/A'}</span>
                      </div>
                      <div className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 flex justify-between">
                        <span>State</span>
                        <span className="text-slate-700 dark:text-slate-300">{v.state || 'N/A'}</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 font-bold italic line-clamp-1 uppercase">
                        {v.address || 'No address provided.'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {vendors.length === 0 && <div className="text-center py-20 text-slate-400 italic text-xs uppercase tracking-widest font-bold">No vendors in master list.</div>}
            </div>
          </div>
        )}

        {activeTab === 'users' && isSuperAdmin && (
          <UserManagement />
        )}

        {activeTab === 'roles' && isSuperAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="glass-card p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm h-fit">
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-6 uppercase tracking-wider">
                {editingRole ? 'Rename Role' : 'Add System Role'}
              </h2>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Role Name</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                    placeholder="e.g. SR. EXECUTIVE"
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleAddRole}
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition hover:-translate-y-0.5 shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    {editingRole ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingRole ? 'Update Role' : 'Create Role'}
                  </button>
                  {editingRole && (
                    <button 
                      onClick={() => { setEditingRole(null); setNewRole(''); }}
                      className="px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Active Roles</h3>
              {roles.map(r => (
                <div key={r.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm group hover:border-slate-300 dark:hover:border-slate-700 transition duration-200">
                  <div className="font-black text-slate-800 dark:text-slate-100 text-xs uppercase tracking-tight">{r.name}</div>
                  <div className="flex gap-2">
                    {!['SUPERADMIN', 'PURCHASE_HEAD', 'USER'].includes(r.name) && (
                      <>
                        <button 
                          onClick={() => { setEditingRole(r); setNewRole(r.name); }}
                          className="text-slate-400 hover:text-indigo-600 p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition duration-200 cursor-pointer"
                        >
                          <Building2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteRole(r.id)}
                          className="text-slate-400 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/30 transition duration-200 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default POSettings;
