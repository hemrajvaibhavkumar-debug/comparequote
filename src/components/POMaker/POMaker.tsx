import React, { useState, useEffect } from 'react';
import POForm from './POForm';
import POPreview from './POPreview';
import { PurchaseOrder, CompanySettings, TermsTemplate, VendorMaster } from '../../types';
import { Save, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const POMaker: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const editId = queryParams.get('edit');
  
  const { token, user, logout } = useAuth();
  const canAccess = user?.role === 'SUPERADMIN' || user?.permissions.includes('ACCESS_PO_MAKER');

  const [po, setPo] = useState<PurchaseOrder>(() => {
    const saved = localStorage.getItem('po_maker_draft');
    if (saved && !editId) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved PO draft", e);
      }
    }
    return {
      po_no: '',
      date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      quote_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      quote_ref_type: 'MAIL',
      vendor_name: '',
      version: 'hemraj_rice',
      vendor_details: { address: '', gstin: '', mail: '', ph: '', state: '' },
      items: [{ sn: 1, make: '', itemName: '', qty: 0, uom: 'NOS', rate: 0, discount: 0, tax: 'GST @18%', amount: 0 }],
      terms: { tax: '', packing: '', payment: '', payment_milestones: [], freight: '', freight_amount: 0, freight_tax: 'GST @18%', delivery: '', contact_no: '', notes: '', manual_notes: [] },
      total_amount: 0
    };
  });

  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [templates, setTemplates] = useState<TermsTemplate[]>([]);
  const [vendors, setVendors] = useState<VendorMaster[]>([]);
  const [comparisons, setComparisons] = useState<any[]>([]);

  const generatePONo = async (version: string) => {
    try {
      const res = await fetch(`/api/po/latest?version=${version}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.status === 401 || res.status === 403) {
        logout();
        return;
      }

      const { latest } = await res.json();
      
      const prefix = version === 'hemraj_rice' ? 'HRM' : version === 'hemraj_ind' ? 'HI' : 'RS';
      const now = new Date();
      const isBeforeApril = now.getMonth() < 3;
      const startYear = isBeforeApril ? now.getFullYear() - 1 : now.getFullYear();
      const endYearShort = (startYear + 1).toString().slice(-2);
      const yearRange = `${startYear}-${endYearShort}`;

      let serial = 1;
      if (latest) {
        const parts = latest.split('/');
        const lastPart = parts[parts.length - 1];
        const lastSerial = parseInt(lastPart);
        if (!isNaN(lastSerial)) {
          serial = lastSerial + 1;
        }
      }

      const formattedSerial = serial.toString().padStart(2, '0');
      const newPONo = `${prefix}/${yearRange}/${formattedSerial}`;
      setPo(prev => ({ ...prev, po_no: newPONo }));
    } catch (e) {
      console.error("Error generating PO No", e);
    }
  };

  useEffect(() => {
    if (canAccess) {
      fetchSettings();
      fetchTemplates();
      fetchVendors();
      fetchComparisons();
      if (editId) {
        fetchPO(editId);
      } else if (!po.po_no) {
        generatePONo(po.version || 'hemraj_rice');
      }
    }
  }, [editId, canAccess]);

  // Auto-save draft
  useEffect(() => {
    if (!editId) {
      localStorage.setItem('po_maker_draft', JSON.stringify(po));
    }
  }, [po, editId]);

  // Handle Automatic PO Number Prefix/Year Formatting on Version Change
  useEffect(() => {
    if (!editId && canAccess) {
      const prefix = po.version === 'hemraj_rice' ? 'HRM' : po.version === 'hemraj_ind' ? 'HI' : 'RS';
      const currentPrefix = po.po_no?.split('/')[0];
      const standardPrefixes = ['HRM', 'HI', 'RS'];
      
      if (!po.po_no || (standardPrefixes.includes(currentPrefix) && currentPrefix !== prefix)) {
        generatePONo(po.version || 'hemraj_rice');
      }
    }
  }, [po.version, canAccess]);

  const fetchPO = async (id: string) => {
    try {
      const res = await fetch(`/api/po/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        logout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setPo(data);
      }
    } catch (err) {
      console.error('Failed to fetch PO', err);
    }
  };

  const fetchSettings = async () => {
    const res = await fetch('/api/settings/company', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401 || res.status === 403) {
      logout();
      return;
    }
    const data = await res.json();
    setSettings(data);
  };

  const fetchTemplates = async () => {
    const res = await fetch('/api/settings/terms', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401 || res.status === 403) {
      logout();
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } else {
      setTemplates([]);
    }
  };

  const fetchVendors = async () => {
    const res = await fetch('/api/settings/vendors', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401 || res.status === 403) {
      logout();
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setVendors(Array.isArray(data) ? data : []);
    }
  };

  const fetchComparisons = async () => {
    try {
      const res = await fetch('/api/comparisons?limit=100', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        logout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setComparisons(data);
      }
    } catch (e) {
      console.error("Error fetching comparisons", e);
    }
  };

  const handleSave = async () => {
    if (!po.po_no || !po.vendor_name) {
      alert('Please enter PO No and Vendor Name');
      return;
    }
    const method = editId ? 'PUT' : 'POST';
    const url = editId ? `/api/po/${editId}` : '/api/po';

    const res = await fetch(url, {
      method,
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(po)
    });
    
    if (res.status === 401 || res.status === 403) {
      logout();
      return;
    }

    if (res.ok) {
      alert(`PO ${editId ? 'updated' : 'saved'} successfully!`);
      if (!editId) {
        localStorage.removeItem('po_maker_draft');
      }
    }
    else alert(`Failed to ${editId ? 'update' : 'save'} PO`);
  };

  const handleClearDraft = () => {
    if (window.confirm("Clear current draft?")) {
      localStorage.removeItem('po_maker_draft');
      window.location.reload();
    }
  };

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 text-center bg-white m-8 rounded-2xl border border-black shadow-sm">
        <ShieldCheck className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-black uppercase tracking-tight">Access Restricted</h2>
        <p className="text-gray-500 mt-2 max-w-md">You do not have the 'ACCESS_PO_MAKER' permission required to create purchase orders.</p>
        <Link to="/" className="mt-8 px-6 py-2 bg-black text-white rounded-lg font-bold text-xs uppercase tracking-widest">Back to Dashboard</Link>
      </div>
    );
  }

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
          <button 
            onClick={handleClearDraft}
            className="text-xs font-bold text-black hover:underline px-2"
          >
            RESET DRAFT
          </button>
          <select 
            className="bg-white border border-black rounded-lg px-3 py-2 text-sm font-bold"
            value={po.version}
            onChange={e => setPo({...po, version: e.target.value as any})}
          >
            <option value="hemraj_rice">Hemraj Rice Mill</option>
            <option value="hemraj_ind">Hemraj Industries</option>
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
          <POForm 
            po={po} 
            setPo={setPo} 
            templates={templates} 
            vendors={vendors} 
            comparisons={comparisons}
            onGeneratePONo={() => generatePONo(po.version || 'hemraj_rice')} 
          />
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
