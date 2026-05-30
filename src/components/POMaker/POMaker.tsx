import React, { useState, useEffect, useRef } from 'react';
import POForm from './POForm';
import POPreview from './POPreview';
import { PurchaseOrder, CompanySettings, TermsTemplate, VendorMaster } from '../../types';
import { Save, ArrowLeft, ShieldCheck, Loader2 } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApiCache } from '../../context/ApiCacheContext';

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
    invalidatePOs,
    invalidateVendors
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
      date: new Date().toISOString().split('T')[0],
      quote_date: new Date().toISOString().split('T')[0],
      quote_ref_type: 'MAIL',
      vendor_name: '',
      version: 'hemraj_rice',
      vendor_details: { address: '', gstin: '', mail: '', ph: '', state: '', cc: '' },
      items: [{ sn: 1, make: '', itemName: '', qty: 0, uom: 'NOS', rate: 0, discount: 0, tax: 'GST @18%', amount: 0 }],
      terms: { tax: '', packing: '', payment: '', payment_milestones: [], freight: '', freight_amount: 0, freight_tax: 'GST @18%', warranty_description: '', delivery: '', contact_no: '', notes: '', manual_notes: [], po_type: 'Consumables' },
      total_amount: 0
    };
  });

  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [templates, setTemplates] = useState<TermsTemplate[]>([]);
  const [vendors, setVendors] = useState<VendorMaster[]>([]);
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

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
        // Handle both old '/' and new '_' formats
        const parts = latest.includes('_') ? latest.split('_') : latest.split('/');
        const lastPart = parts[parts.length - 1];
        const lastSerial = parseInt(lastPart);
        if (!isNaN(lastSerial)) {
          serial = lastSerial + 1;
        }
      }

      const formattedSerial = serial.toString().padStart(2, '0');
      const newPONo = `${prefix}_${yearRange}_${formattedSerial}`;
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
      const currentPrefix = po.po_no?.includes('_') ? po.po_no?.split('_')[0] : po.po_no?.split('/')[0];
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
      // Lazy load heavy libraries
      const htmlToImage = await import('html-to-image');
      const { default: jsPDF } = await import('jspdf');

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
      
      let targetId = editId;
      let isOverwrite = false;

      // Pre-save check for duplicate PO number if we're creating a new one 
      // or if we're editing but changed the number to something that might belong to another record
      const checkRes = await fetch(`/api/po/check/${encodeURIComponent(po.po_no)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const checkData = await checkRes.json();
      
      if (checkData.exists && checkData.po.id !== Number(editId)) {
        const existingPo = checkData.po;
        const msg = `PO Number "${po.po_no}" is already saved in the database${existingPo.created_by_name ? ` by ${existingPo.created_by_name}` : ''}.\n\nDo you want to OVERWRITE that existing entry? Click 'Cancel' to stop and change the number.`;
        
        if (window.confirm(msg)) {
          targetId = existingPo.id;
          isOverwrite = true;
        } else {
          setIsGenerating(false);
          return;
        }
      }

      const pdf_base64 = await generatePDFBase64();
      
      const method = targetId ? 'PUT' : 'POST';
      const url = targetId ? `/api/po/${targetId}` : '/api/po';

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

        // Auto-register vendor if new/custom
        const vendorExists = vendors.some(v => v.name.trim().toLowerCase() === po.vendor_name.trim().toLowerCase());
        if (!vendorExists && po.vendor_name.trim()) {
          try {
            const newVendorRes = await fetch('/api/settings/vendors', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                name: po.vendor_name.trim(),
                address: po.vendor_details.address || '',
                state: po.vendor_details.state || '',
                gstin: po.vendor_details.gstin || '',
                mobile_no: po.vendor_details.ph || '',
                email: po.vendor_details.mail || ''
              })
            });
            if (newVendorRes.ok) {
              console.log("Successfully auto-registered new vendor in Master list:", po.vendor_name);
              invalidateVendors();
            }
          } catch (err) {
            console.error("Failed to auto-register custom vendor in Master list", err);
          }
        }

        alert(`PO ${targetId ? (isOverwrite ? 'overwritten' : 'updated') : 'saved'} successfully with generated PDF snapshot!`);
        if (!editId) {
          localStorage.removeItem('po_maker_draft');
          // If we overwrote, maybe navigate to the list or clear the form?
          // For now just stay or let user decide.
        }
      }
      else {
        const errData = await res.json();
        if (errData.error === "Duplicate PO Number") {
          if (window.confirm(`${errData.details}\n\nWould you like to re-generate the PO number and try again?`)) {
            await generatePONo(po.version || 'hemraj_rice');
            setIsGenerating(false);
            return;
          }
        }
        alert(`Failed to ${targetId ? 'update' : 'save'} PO: ${errData.error || 'Unknown error'}`);
      }
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
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 text-center bg-white dark:bg-slate-900 m-8 rounded-2xl border border-black dark:border-slate-800 shadow-sm">
        <ShieldCheck className="w-16 h-16 text-gray-400 dark:text-slate-600 mb-4" />
        <h2 className="text-2xl font-bold text-black dark:text-slate-100 uppercase tracking-tight">Access Restricted</h2>
        <p className="text-gray-500 dark:text-slate-400 mt-2 max-w-md">You do not have the 'ACCESS_PO_MAKER' permission required to create purchase orders.</p>
        <Link to="/" className="mt-8 px-6 py-2 bg-black dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg font-bold text-xs uppercase tracking-widest">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-50 dark:bg-slate-950 relative overflow-hidden transition-colors duration-300">
      {/* Ambient background glows */}
      <div className="ambient-glow ambient-indigo -top-40 -right-40" />
      <div className="ambient-glow ambient-blue -bottom-40 -left-40" />

      <div className="glass-navbar px-4 sm:px-6 py-3 flex flex-col md:flex-row gap-3 md:items-center md:justify-between shrink-0 relative z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition border border-slate-200/60 dark:border-slate-800 shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 font-sans tracking-tight">Purchase Order Maker</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-start md:justify-end">
          <button 
            onClick={handleClearDraft}
            className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            RESET DRAFT
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Created By:</span>
            <select 
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
              value={po.created_by_name || ''}
              onChange={e => setPo({...po, created_by_name: e.target.value})}
              disabled={po.status === 'APPROVED'}
            >
              <option value="">-- Employee --</option>
              <option value="Debasish Samanta">Debasish Samanta</option>
              <option value="Rakesh Pal">Rakesh Pal</option>
              <option value="Souritra Ghoshal">Souritra Ghoshal</option>
              <option value="Rupak Mukherjee">Rupak Mukherjee</option>
              <option value="Soumen">Soumen</option>
            </select>
          </div>
          <select 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
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
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 font-bold text-[10px] uppercase tracking-widest">
              <ShieldCheck className="w-3.5 h-3.5" /> Locked (Approved)
            </div>
          )}
        </div>
      </div>

      {/* Mobile Tab Toggle */}
      <div className="lg:hidden flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-2 shrink-0 relative z-20">
        <button
          onClick={() => setActiveTab('edit')}
          className={`flex-1 py-2.5 text-center text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
            activeTab === 'edit'
              ? 'bg-slate-950 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Edit Form
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex-1 py-2.5 text-center text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
            activeTab === 'preview'
              ? 'bg-slate-950 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Preview PO
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative z-10">
        {/* Left Pane - Form */}
        <div className={`w-full lg:w-1/2 overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 border-r border-slate-200/80 dark:border-slate-800 custom-scrollbar ${activeTab === 'edit' ? 'block' : 'hidden lg:block'}`}>
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
        <div className={`w-full lg:w-1/2 overflow-auto p-4 sm:p-8 bg-slate-100/40 dark:bg-slate-900/20 custom-scrollbar ${activeTab === 'preview' ? 'block' : 'hidden lg:block'}`} ref={previewRef}>
          <div className={`mx-auto w-full max-w-3xl transition-all duration-300 ${
            isExporting ? '' : 'bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-none overflow-hidden p-4 sm:p-6'
          }`}>
            <POPreview po={po} setPo={setPo} settings={settings} isPDF={isExporting} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default POMaker;
