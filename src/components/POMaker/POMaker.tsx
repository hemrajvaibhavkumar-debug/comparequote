import React, { useState, useEffect } from 'react';
import POForm from './POForm';
import POPreview from './POPreview';
import { PurchaseOrder, CompanySettings, TermsTemplate, VendorMaster } from '../../types';
import { Save, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const POMaker: React.FC = () => {
  const navigate = useNavigate();
  const [po, setPo] = useState<PurchaseOrder>({
    po_no: '',
    date: new Date().toISOString().split('T')[0],
    vendor_name: '',
    version: 'hemraj_ind',
    vendor_details: { address: '', gstin: '', mail: '', ph: '', state: '' },
    items: [{ sn: 1, itemName: '', qty: 0, uom: 'NOS', rate: 0, discount: 0, tax: 'GST @18%' }],
    terms: { tax: '', packing: '', payment: '', freight: '', delivery: '', contact_no: '', notes: '' },
    total_amount: 0
  });

  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [templates, setTemplates] = useState<TermsTemplate[]>([]);
  const [vendors, setVendors] = useState<VendorMaster[]>([]);

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
  };

  const fetchTemplates = async () => {
    const res = await fetch('/api/settings/terms', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
    });
    if (res.ok) {
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } else {
      setTemplates([]);
    }
  };

  const fetchVendors = async () => {
    const res = await fetch('/api/settings/vendors', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
    });
    if (res.ok) {
      const data = await res.json();
      setVendors(Array.isArray(data) ? data : []);
    }
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
    <div className="h-[calc(100vh-64px)] flex flex-col bg-white">
      <div className="bg-white border-b border-black px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-black/10 rounded-full transition border border-black">
            <ArrowLeft className="w-5 h-5 text-black" />
          </button>
          <h1 className="text-xl font-bold text-black">Purchase Order Maker</h1>
        </div>
        <div className="flex items-center gap-3">
          <select 
            className="bg-white border border-black rounded-lg px-3 py-2 text-sm font-bold"
            value={po.version}
            onChange={e => setPo({...po, version: e.target.value as any})}
          >
            <option value="hemraj_ind">Hemraj Industries</option>
            <option value="hemraj_rice">Hemraj Rice Mill</option>
            <option value="radhashyam">Radhashyam Industries</option>
          </select>
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-black/90 transition font-medium"
          >
            <Save className="w-4 h-4" /> Save to Database
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane - Form */}
        <div className="w-1/2 overflow-y-auto p-6 bg-white border-r border-black">
          <POForm po={po} setPo={setPo} templates={templates} vendors={vendors} />
        </div>

        {/* Right Pane - Preview */}
        <div className="w-1/2 overflow-y-auto p-8 bg-white border-black flex justify-center">
          <POPreview po={po} setPo={setPo} settings={settings} />
        </div>
      </div>
    </div>
  );
};

export default POMaker;
