import React, { useState, useEffect } from 'react';
import { CompanySettings, TermsTemplate, VendorMaster } from '../../types';
import { Save, Plus, Trash2, Building2, Users, ShieldCheck, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import UserManagement from './UserManagement';

const POSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'terms' | 'vendors' | 'users'>('profile');
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [templates, setTemplates] = useState<TermsTemplate[]>([]);
  const [vendors, setVendors] = useState<VendorMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTemplate, setNewTemplate] = useState<Partial<TermsTemplate>>({});
  const [newVendor, setNewVendor] = useState<Partial<VendorMaster>>({});
  
  const { token, user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPERADMIN';

  useEffect(() => {
    fetchSettings();
    fetchTemplates();
    fetchVendors();
  }, []);

  const fetchSettings = async () => {
    const res = await fetch('/api/settings/company', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setSettings(data);
    setLoading(false);
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/settings/terms', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(Array.isArray(data) ? data : []);
      } else {
        setTemplates([]);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      setTemplates([]);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch('/api/settings/vendors', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVendors(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to fetch vendors:", error);
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
    if (res.ok) alert('Settings saved successfully!');
    else alert('Failed to save settings');
  };

  const handleAddTemplate = async () => {
    if (!newTemplate.name) return;
    await fetch('/api/settings/terms', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newTemplate)
    });
    setNewTemplate({});
    fetchTemplates();
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    await fetch(`/api/settings/terms/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchTemplates();
  };

  const handleAddVendor = async () => {
    if (!newVendor.name) return;
    await fetch('/api/settings/vendors', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newVendor)
    });
    setNewVendor({});
    fetchVendors();
  };

  const handleDeleteVendor = async (id: number) => {
    if (!confirm('Are you sure you want to delete this vendor?')) return;
    await fetch(`/api/settings/vendors/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchVendors();
  };

  if (loading) return <div className="p-8 text-center text-black">Loading settings...</div>;

  const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
        activeTab === id 
          ? 'border-black text-black bg-black/5' 
          : 'border-transparent text-gray-400 hover:text-black hover:bg-black/5'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-black">
        <div className="max-w-6xl mx-auto px-8 pt-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-black rounded-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-black uppercase tracking-tight">System Settings</h1>
              <p className="text-sm text-gray-500">Configure company metadata and user access</p>
            </div>
          </div>
          
          <div className="flex overflow-x-auto no-scrollbar">
            <TabButton id="profile" label="Company Profile" icon={Building2} />
            <TabButton id="terms" label="Terms Templates" icon={FileText} />
            <TabButton id="vendors" label="Vendor Master" icon={Users} />
            {isSuperAdmin && (
              <TabButton id="users" label="User Management" icon={ShieldCheck} />
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8">
        {activeTab === 'profile' && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-black max-w-3xl">
            <h2 className="text-xl font-bold text-black mb-6 uppercase tracking-tight">Company Metadata</h2>
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-full space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-600">Company Name</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-black rounded-lg focus:ring-1 focus:ring-black outline-none"
                    value={settings?.name || ''}
                    onChange={e => setSettings(s => s ? {...s, name: e.target.value} : null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-600">CIN</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-black rounded-lg focus:ring-1 focus:ring-black outline-none"
                    value={settings?.cin || ''}
                    onChange={e => setSettings(s => s ? {...s, cin: e.target.value} : null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-600">GSTIN</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-black rounded-lg focus:ring-1 focus:ring-black outline-none"
                    value={settings?.gstin || ''}
                    onChange={e => setSettings(s => s ? {...s, gstin: e.target.value} : null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-600">PAN</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-black rounded-lg focus:ring-1 focus:ring-black outline-none"
                    value={settings?.pan || ''}
                    onChange={e => setSettings(s => s ? {...s, pan: e.target.value} : null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-600">Email</label>
                  <input 
                    type="email" 
                    className="w-full px-4 py-2 border border-black rounded-lg focus:ring-1 focus:ring-black outline-none"
                    value={settings?.email || ''}
                    onChange={e => setSettings(s => s ? {...s, email: e.target.value} : null)}
                  />
                </div>
                <div className="col-span-full space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-600">Regd. Office Address</label>
                  <textarea 
                    rows={2}
                    className="w-full px-4 py-2 border border-black rounded-lg focus:ring-1 focus:ring-black outline-none"
                    value={settings?.regd_office || ''}
                    onChange={e => setSettings(s => s ? {...s, regd_office: e.target.value} : null)}
                  />
                </div>
                <div className="col-span-full space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-600">Factory Address</label>
                  <textarea 
                    rows={2}
                    className="w-full px-4 py-2 border border-black rounded-lg focus:ring-1 focus:ring-black outline-none"
                    value={settings?.factory_address || ''}
                    onChange={e => setSettings(s => s ? {...s, factory_address: e.target.value} : null)}
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="flex items-center gap-2 bg-black text-white px-8 py-3 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-black/90 transition shadow-lg"
              >
                <Save className="w-4 h-4" /> Save Company Profile
              </button>
            </form>
          </div>
        )}

        {activeTab === 'terms' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-2xl border border-black shadow-sm h-fit">
              <h2 className="text-xl font-bold text-black mb-6 uppercase tracking-tight">Create New Template</h2>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-600">Template Name</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-black rounded-lg focus:ring-1 focus:ring-black outline-none"
                    value={newTemplate.name || ''}
                    onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-600">Tax Status</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 18% Extra"
                      className="w-full px-4 py-2 border border-black rounded-lg focus:ring-1 focus:ring-black outline-none"
                      value={newTemplate.tax || ''}
                      onChange={e => setNewTemplate({...newTemplate, tax: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-600">Payment Terms</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 30 Days Credit"
                      className="w-full px-4 py-2 border border-black rounded-lg focus:ring-1 focus:ring-black outline-none"
                      value={newTemplate.payment || ''}
                      onChange={e => setNewTemplate({...newTemplate, payment: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-600">Contact No</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-black rounded-lg focus:ring-1 focus:ring-black outline-none"
                    value={newTemplate.contact_no || ''}
                    onChange={e => setNewTemplate({...newTemplate, contact_no: e.target.value})}
                  />
                </div>
                <button 
                  onClick={handleAddTemplate}
                  className="w-full flex items-center justify-center gap-2 bg-black text-white px-4 py-3 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-black/90 transition shadow-lg"
                >
                  <Plus className="w-4 h-4" /> Add Template
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-500">Saved Templates</h3>
              {templates.map(t => (
                <div key={t.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-black group">
                  <div>
                    <div className="font-bold text-black uppercase tracking-tight">{t.name}</div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase mt-1">Tax: {t.tax} | Pay: {t.payment}</div>
                  </div>
                  <button 
                    onClick={() => handleDeleteTemplate(t.id)}
                    className="text-gray-400 hover:text-red-600 p-2 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {templates.length === 0 && <div className="text-center py-12 text-gray-400 italic">No templates created.</div>}
            </div>
          </div>
        )}

        {activeTab === 'vendors' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-white p-8 rounded-2xl border border-black shadow-sm h-fit">
              <h2 className="text-xl font-bold text-black mb-6 uppercase tracking-tight">Add Vendor</h2>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-600">Vendor Name</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-black rounded-lg focus:ring-1 focus:ring-black outline-none"
                    value={newVendor.name || ''}
                    onChange={e => setNewVendor({...newVendor, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-600">GSTIN</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-black rounded-lg focus:ring-1 focus:ring-black outline-none"
                    value={newVendor.gstin || ''}
                    onChange={e => setNewVendor({...newVendor, gstin: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-600">Mobile No</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 border border-black rounded-lg focus:ring-1 focus:ring-black outline-none"
                      value={newVendor.mobile_no || ''}
                      onChange={e => setNewVendor({...newVendor, mobile_no: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-600">State</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 border border-black rounded-lg focus:ring-1 focus:ring-black outline-none"
                      value={newVendor.state || ''}
                      onChange={e => setNewVendor({...newVendor, state: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-600">Address</label>
                  <textarea 
                    rows={2}
                    className="w-full px-4 py-2 border border-black rounded-lg focus:ring-1 focus:ring-black outline-none"
                    value={newVendor.address || ''}
                    onChange={e => setNewVendor({...newVendor, address: e.target.value})}
                  />
                </div>
                <button 
                  onClick={handleAddVendor}
                  className="w-full flex items-center justify-center gap-2 bg-black text-white px-4 py-3 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-black/90 transition shadow-lg"
                >
                  <Plus className="w-4 h-4" /> Add to Master
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-500">Vendor Database</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {vendors.map(v => (
                  <div key={v.id} className="p-5 bg-white rounded-2xl border border-black group relative hover:shadow-md transition-all">
                    <button 
                      onClick={() => handleDeleteVendor(v.id)}
                      className="absolute top-4 right-4 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="font-bold text-black uppercase tracking-tight truncate pr-8">{v.name}</div>
                    <div className="mt-3 space-y-1">
                      <div className="text-[10px] font-black uppercase text-gray-400 flex justify-between">
                        <span>GSTIN</span>
                        <span className="text-black">{v.gstin || 'N/A'}</span>
                      </div>
                      <div className="text-[10px] font-black uppercase text-gray-400 flex justify-between">
                        <span>Phone</span>
                        <span className="text-black">{v.mobile_no || 'N/A'}</span>
                      </div>
                      <div className="text-[10px] font-black uppercase text-gray-400 flex justify-between">
                        <span>State</span>
                        <span className="text-black">{v.state || 'N/A'}</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-gray-100 text-[10px] text-gray-500 italic line-clamp-1">
                        {v.address || 'No address provided.'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {vendors.length === 0 && <div className="text-center py-20 text-gray-400 italic">No vendors in master list.</div>}
            </div>
          </div>
        )}

        {activeTab === 'users' && isSuperAdmin && (
          <UserManagement />
        )}
      </div>
    </div>
  );
};

export default POSettings;
