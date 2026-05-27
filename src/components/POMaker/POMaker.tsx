import React, { useState, useEffect, useRef } from 'react';
import POForm from './POForm';
import POPreview from './POPreview';
import { PurchaseOrder, CompanySettings, TermsTemplate, VendorMaster } from '../../types';
import { Save, ArrowLeft, ShieldCheck, Loader2 } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApiCache } from '../../context/ApiCacheContext';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';

const POMaker: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const editId = queryParams.get('edit');
  const previewRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const { token, user, logout } = useAuth();
  const {
    fetchCompanySettings: getCompanySettingsFromCache,
    fetchTermsTemplates: getTermsTemplatesFromCache,
    fetchVendors: getVendorsFromCache,
    fetchComparisons: getComparisonsFromCache,
    invalidatePOs
  } = useApiCache();
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
  }, [po.version, po.po_no, canAccess, editId]);

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
    try {
      const data = await getCompanySettingsFromCache();
      setSettings(data);
    } catch (e) {
      console.error("Error fetching settings", e);
    }
  };

  const fetchTemplates = async () => {
    try {
      const data = await getTermsTemplatesFromCache();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error fetching templates", e);
      setTemplates([]);
    }
  };

  const fetchVendors = async () => {
    try {
      const data = await getVendorsFromCache();
      setVendors(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error fetching vendors", e);
    }
  };

  const fetchComparisons = async () => {
    try {
      const data = await getComparisonsFromCache();
      setComparisons(data);
    } catch (e) {
      console.error("Error fetching comparisons", e);
    }
  };

  const generatePDFBase64 = async (): Promise<string | null> => {
    if (!previewRef.current || !po) {
      console.error("[generatePDFBase64] Missing ref or PO data");
      return null;
    }
    try {
      // 1. Switch to Paged Mode for capture
      setIsExporting(true);
      // Wait for React to render the paged view
      await new Promise(resolve => setTimeout(resolve, 800));

      const pagedContainer = previewRef.current.querySelector('.pdf-paged-view');
      if (!pagedContainer) {
        console.error("[generatePDFBase64] Paged container not found");
        setIsExporting(false);
        return null;
      }

      const pages = pagedContainer.querySelectorAll('.pdf-page');
      if (pages.length === 0) {
        console.error("[generatePDFBase64] No pages found to capture");
        setIsExporting(false);
        return null;
      }

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();
        
        const pageEl = pages[i] as HTMLElement;
        const canvas = await htmlToImage.toPng(pageEl, { 
          pixelRatio: 2, 
          backgroundColor: '#ffffff',
          style: { margin: '0', padding: '0' }
        });

        pdf.addImage(canvas, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      }

      const pdfOutput = pdf.output('datauristring');
      setIsExporting(false);
      return pdfOutput.split(',')[1];
    } catch (e) {
      console.error("[generatePDFBase64] Paged Error:", e);
      setIsExporting(false);
      return null;
    }
  };

  const handleSave = async () => {
    if (!po.po_no || !po.vendor_name) {
      alert('Please enter PO No and Vendor Name');
      return;
    }

    try {
      setIsGenerating(true);
      const pdf_base64 = await generatePDFBase64();
      
      const method = editId ? 'PUT' : 'POST';
      const url = editId ? `/api/po/${editId}` : '/api/po';

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...po, pdf_base64 })
      });
      
      if (res.status === 401 || res.status === 403) {
        logout();
        return;
      }

      if (res.ok) {
        invalidatePOs();
        alert(`PO ${editId ? 'updated' : 'saved'} successfully with generated PDF snapshot!`);
        if (!editId) {
          localStorage.removeItem('po_maker_draft');
        }
      }
      else alert(`Failed to ${editId ? 'update' : 'save'} PO`);
    } catch (err) {
      console.error("Save error", err);
      alert("Error generating PDF or saving PO");
    } finally {
      setIsGenerating(false);
    }
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
    <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-50 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="ambient-glow ambient-indigo -top-40 -right-40" />
      <div className="ambient-glow ambient-blue -bottom-40 -left-40" />

      <div className="glass-navbar px-6 py-3 flex items-center justify-between shrink-0 relative z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-xl transition border border-slate-200/60 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-bold text-slate-900 font-sans tracking-tight">Purchase Order Maker</h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleClearDraft}
            className="text-xs font-bold text-slate-500 hover:text-rose-600 px-3 py-2 rounded-xl hover:bg-slate-100 transition-all"
          >
            RESET DRAFT
          </button>
          <select 
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
            value={po.version}
            onChange={e => setPo({...po, version: e.target.value as any})}
            disabled={po.status === 'APPROVED'}
          >
            <option value="hemraj_rice">Hemraj Rice Mill</option>
            <option value="hemraj_ind">Hemraj Industries</option>
            <option value="radhashyam">Radhashyam Industries</option>
          </select>

          {po.status !== 'APPROVED' ? (
            <button 
              onClick={handleSave}
              disabled={isGenerating}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition font-semibold text-xs shadow-sm disabled:opacity-50 hover:-translate-y-0.5 transform transition-all duration-200 cursor-pointer"
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isGenerating ? 'Saving...' : 'Save to Database'}
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-200/60 font-bold text-[10px] uppercase tracking-widest">
              <ShieldCheck className="w-3.5 h-3.5" /> Locked (Approved)
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Left Pane - Form */}
        <div className="w-1/2 overflow-y-auto p-6 bg-slate-50 border-r border-slate-200/80 custom-scrollbar">
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
        <div className="w-1/2 overflow-auto p-8 bg-slate-100/40 custom-scrollbar" ref={previewRef}>
          <div className={`mx-auto w-full max-w-3xl transition-all duration-300 ${
            isExporting ? '' : 'bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-6'
          }`}>
            <POPreview po={po} setPo={setPo} settings={settings} isPDF={isExporting} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default POMaker;
