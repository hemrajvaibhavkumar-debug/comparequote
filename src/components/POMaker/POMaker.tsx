import React, { useState, useEffect } from 'react';
import POForm from './POForm';
import POPreview from './POPreview';
import { PurchaseOrder, CompanySettings, TermsTemplate } from '../../types';
import { Save, Download, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const POMaker: React.FC = () => {
  const navigate = useNavigate();
  const [po, setPo] = useState<PurchaseOrder>({
    po_no: '',
    date: new Date().toISOString().split('T')[0],
    vendor_name: '',
    vendor_details: { address: '', gstin: '', mail: '', ph: '', state: '' },
    items: [],
    terms: { tax: '', packing: '', payment: '', freight: '', delivery: '', notes: '' },
    total_amount: 0
  });

  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [templates, setTemplates] = useState<TermsTemplate[]>([]);

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
  };

  const fetchTemplates = async () => {
    const res = await fetch('/api/settings/terms', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
    });
    const data = await res.json();
    setTemplates(data);
  };

  const handleSave = async () => {
    if (!po.po_no || !po.vendor_name) {
      alert('Please enter PO No and Vendor Name');
      return;
    }
    const res = await fetch('/api/po', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
      },
      body: JSON.stringify(po)
    });
    if (res.ok) alert('PO saved successfully!');
    else alert('Failed to save PO');
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-800">Purchase Order Maker</h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition font-medium"
          >
            <Save className="w-4 h-4" /> Save to Database
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane - Form */}
        <div className="w-1/2 overflow-y-auto p-6 bg-slate-50 border-r">
          <POForm po={po} setPo={setPo} templates={templates} />
        </div>

        {/* Right Pane - Preview */}
        <div className="w-1/2 overflow-y-auto p-8 bg-gray-200 flex justify-center">
          <POPreview po={po} settings={settings} />
        </div>
      </div>
    </div>
  );
};

export default POMaker;
