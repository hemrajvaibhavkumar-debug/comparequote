import React, { useState, useEffect } from 'react';
import { CompanySettings, TermsTemplate } from '../../types';
import { Save, Plus, Trash2, Building2, ClipboardList } from 'lucide-react';

const POSettings: React.FC = () => {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [templates, setTemplates] = useState<TermsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTemplate, setNewTemplate] = useState<Partial<TermsTemplate>>({});

  useEffect(() => {
    fetchSettings();
    fetchTemplates();
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
    const res = await fetch('/api/settings/terms', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
    });
    const data = await res.json();
    setTemplates(data);
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

  if (loading) return <div className="p-8 text-center text-gray-500">Loading settings...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3 border-b pb-4">
        <Building2 className="w-8 h-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-gray-900">PO Maker Settings</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Company Settings Form */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xl font-semibold">Company Profile</h2>
          </div>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Company Name</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={settings?.name || ''}
                  onChange={e => setSettings(s => s ? {...s, name: e.target.value} : null)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">CIN</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={settings?.cin || ''}
                  onChange={e => setSettings(s => s ? {...s, cin: e.target.value} : null)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">GSTIN</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={settings?.gstin || ''}
                  onChange={e => setSettings(s => s ? {...s, gstin: e.target.value} : null)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">PAN</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={settings?.pan || ''}
                  onChange={e => setSettings(s => s ? {...s, pan: e.target.value} : null)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input 
                  type="email" 
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={settings?.email || ''}
                  onChange={e => setSettings(s => s ? {...s, email: e.target.value} : null)}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Regd. Office Address</label>
                <textarea 
                  rows={2}
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={settings?.regd_office || ''}
                  onChange={e => setSettings(s => s ? {...s, regd_office: e.target.value} : null)}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Factory Address</label>
                <textarea 
                  rows={2}
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={settings?.factory_address || ''}
                  onChange={e => setSettings(s => s ? {...s, factory_address: e.target.value} : null)}
                />
              </div>
            </div>
            <button 
              type="submit"
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <Save className="w-4 h-4" /> Save Profile
            </button>
          </form>
        </div>

        {/* Terms Templates */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xl font-semibold">Commercial Terms Templates</h2>
          </div>
          
          <div className="space-y-4 border-b pb-4 mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Template Name (e.g. Standard, Urgent)</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm"
                  value={newTemplate.name || ''}
                  onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tax</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm"
                  value={newTemplate.tax || ''}
                  onChange={e => setNewTemplate({...newTemplate, tax: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Payment Terms</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm"
                  value={newTemplate.payment || ''}
                  onChange={e => setNewTemplate({...newTemplate, payment: e.target.value})}
                />
              </div>
              <div className="col-span-2 text-right">
                <button 
                  onClick={handleAddTemplate}
                  className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                >
                  <Plus className="w-4 h-4" /> Add Template
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium text-gray-900">Saved Templates</h3>
            {templates.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <div className="font-semibold text-gray-900">{t.name}</div>
                  <div className="text-xs text-gray-500">Tax: {t.tax} | Pay: {t.payment}</div>
                </div>
                <button 
                  onClick={() => handleDeleteTemplate(t.id)}
                  className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {templates.length === 0 && <div className="text-center py-4 text-gray-400">No templates added yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSettings;
