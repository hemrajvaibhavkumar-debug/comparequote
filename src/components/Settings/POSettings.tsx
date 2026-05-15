import React, { useState, useEffect } from 'react';
import { CompanySettings, TermsTemplate, VendorMaster } from '../../types';
import { Save, Plus, Trash2, Building2, Users } from 'lucide-react';

const POSettings: React.FC = () => {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [templates, setTemplates] = useState<TermsTemplate[]>([]);
  const [vendors, setVendors] = useState<VendorMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTemplate, setNewTemplate] = useState<Partial<TermsTemplate>>({});
  const [newVendor, setNewVendor] = useState<Partial<VendorMaster>>({});

  useEffect(() => {
    fetchSettings();
    fetchTemplates();
    fetchVendors();
  }, []);

  const fetchSettings = async () => {
    const res = await fetch('/api/settings/company', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
    });
    const data = await res.json();
    setSettings(data);
    setLoading(false);
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/settings/terms', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
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
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
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
    await fetch('/api/settings/company', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
      },
      body: JSON.stringify(settings)
    });
    alert('Settings saved successfully!');
  };

  const handleAddTemplate = async () => {
    if (!newTemplate.name) return;
    await fetch('/api/settings/terms', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
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
      headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
    });
    fetchTemplates();
  };

  const handleAddVendor = async () => {
    if (!newVendor.name) return;
    await fetch('/api/settings/vendors', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
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
      headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
    });
    fetchVendors();
  };

  if (loading) return <div className="p-8 text-center text-black">Loading settings...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 bg-white pb-20">
      <div className="flex items-center gap-3 border-b border-black pb-4">
        <Building2 className="w-8 h-8 text-black" />
        <h1 className="text-3xl font-bold text-black">PO Maker Settings</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Company Settings Form */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-black space-y-4 h-fit">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xl font-semibold text-black">Company Profile</h2>
          </div>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-black">Company Name</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-lg border border-black px-3 py-2 text-black"
                  value={settings?.name || ''}
                  onChange={e => setSettings(s => s ? {...s, name: e.target.value} : null)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black">CIN</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-lg border border-black px-3 py-2 text-black"
                  value={settings?.cin || ''}
                  onChange={e => setSettings(s => s ? {...s, cin: e.target.value} : null)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black">GSTIN</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-lg border border-black px-3 py-2 text-black"
                  value={settings?.gstin || ''}
                  onChange={e => setSettings(s => s ? {...s, gstin: e.target.value} : null)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black">PAN</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-lg border border-black px-3 py-2 text-black"
                  value={settings?.pan || ''}
                  onChange={e => setSettings(s => s ? {...s, pan: e.target.value} : null)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black">Email</label>
                <input 
                  type="email" 
                  className="mt-1 block w-full rounded-lg border border-black px-3 py-2 text-black"
                  value={settings?.email || ''}
                  onChange={e => setSettings(s => s ? {...s, email: e.target.value} : null)}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-black">Regd. Office Address</label>
                <textarea 
                  rows={2}
                  className="mt-1 block w-full rounded-lg border border-black px-3 py-2 text-black"
                  value={settings?.regd_office || ''}
                  onChange={e => setSettings(s => s ? {...s, regd_office: e.target.value} : null)}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-black">Factory Address</label>
                <textarea 
                  rows={2}
                  className="mt-1 block w-full rounded-lg border border-black px-3 py-2 text-black"
                  value={settings?.factory_address || ''}
                  onChange={e => setSettings(s => s ? {...s, factory_address: e.target.value} : null)}
                />
              </div>
            </div>
            <button 
              type="submit"
              className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-black/90 transition shadow-lg"
            >
              <Save className="w-4 h-4" /> Save Profile
            </button>
          </form>
        </div>

        {/* Terms Templates */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-black space-y-4 h-fit">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xl font-semibold text-black">Terms Templates</h2>
          </div>
          
          <div className="space-y-4 border-b border-black pb-4 mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-black">Template Name</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-lg border border-black px-3 py-2 text-black"
                  value={newTemplate.name || ''}
                  onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black">Tax</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-lg border border-black px-3 py-2 text-black"
                  value={newTemplate.tax || ''}
                  onChange={e => setNewTemplate({...newTemplate, tax: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black">Payment Terms</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-lg border border-black px-3 py-2 text-black"
                  value={newTemplate.payment || ''}
                  onChange={e => setNewTemplate({...newTemplate, payment: e.target.value})}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-black">Contact No</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-lg border border-black px-3 py-2 text-black"
                  value={newTemplate.contact_no || ''}
                  onChange={e => setNewTemplate({...newTemplate, contact_no: e.target.value})}
                />
              </div>
              <div className="col-span-2 text-right">
                <button 
                  onClick={handleAddTemplate}
                  className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-black/90 transition shadow-lg"
                >
                  <Plus className="w-4 h-4" /> Add Template
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium text-black">Saved Templates</h3>
            {templates.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-black">
                <div>
                  <div className="font-semibold text-black">{t.name}</div>
                  <div className="text-xs text-black/60">Tax: {t.tax} | Pay: {t.payment}</div>
                </div>
                <button 
                  onClick={() => handleDeleteTemplate(t.id)}
                  className="text-black hover:bg-black/10 p-2 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Vendor Master */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-black space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-6 h-6 text-black" />
            <h2 className="text-xl font-semibold text-black">Vendor Master</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Add Vendor Form */}
            <div className="md:col-span-1 space-y-4 border-r border-black pr-6">
              <h3 className="font-medium text-black">Add New Vendor</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-black uppercase">Vendor Name</label>
                  <input 
                    type="text" 
                    className="mt-1 block w-full rounded-lg border border-black px-3 py-2 text-sm text-black"
                    value={newVendor.name || ''}
                    onChange={e => setNewVendor({...newVendor, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black uppercase">GSTIN</label>
                  <input 
                    type="text" 
                    className="mt-1 block w-full rounded-lg border border-black px-3 py-2 text-sm text-black"
                    value={newVendor.gstin || ''}
                    onChange={e => setNewVendor({...newVendor, gstin: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black uppercase">Mobile No</label>
                  <input 
                    type="text" 
                    className="mt-1 block w-full rounded-lg border border-black px-3 py-2 text-sm text-black"
                    value={newVendor.mobile_no || ''}
                    onChange={e => setNewVendor({...newVendor, mobile_no: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black uppercase">State</label>
                  <input 
                    type="text" 
                    className="mt-1 block w-full rounded-lg border border-black px-3 py-2 text-sm text-black"
                    value={newVendor.state || ''}
                    onChange={e => setNewVendor({...newVendor, state: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black uppercase">Address</label>
                  <textarea 
                    rows={2}
                    className="mt-1 block w-full rounded-lg border border-black px-3 py-2 text-sm text-black"
                    value={newVendor.address || ''}
                    onChange={e => setNewVendor({...newVendor, address: e.target.value})}
                  />
                </div>
                <button 
                  onClick={handleAddVendor}
                  className="w-full flex items-center justify-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-black/90 transition shadow-lg font-medium"
                >
                  <Plus className="w-4 h-4" /> Add to Master
                </button>
              </div>
            </div>

            {/* Vendor List */}
            <div className="md:col-span-2">
              <h3 className="font-medium text-black mb-4">Saved Vendors</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
                {vendors.map(v => (
                  <div key={v.id} className="p-4 bg-white rounded-xl border border-black group relative hover:shadow-md transition">
                    <button 
                      onClick={() => handleDeleteVendor(v.id)}
                      className="absolute top-2 right-2 text-black hover:text-red-600 p-1 rounded-lg transition opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="font-bold text-black truncate pr-6">{v.name}</div>
                    <div className="text-[10px] text-black/60 mt-1 space-y-0.5">
                      <div className="truncate">GST: {v.gstin || 'N/A'}</div>
                      <div className="truncate">Mob: {v.mobile_no || 'N/A'}</div>
                      <div className="truncate">State: {v.state || 'N/A'}</div>
                      <div className="line-clamp-1">Add: {v.address || 'N/A'}</div>
                    </div>
                  </div>
                ))}
                {vendors.length === 0 && <div className="col-span-2 text-center py-8 text-black/40">No vendors added yet.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSettings;
