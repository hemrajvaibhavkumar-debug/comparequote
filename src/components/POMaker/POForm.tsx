import React, { useState, useEffect } from 'react';
import { PurchaseOrder, TermsTemplate, POItem, VendorMaster } from '../../types';
import { Plus, Trash2, ClipboardPaste, Loader2, RotateCcw, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface POFormProps {
  po: PurchaseOrder;
  setPo: React.Dispatch<React.SetStateAction<PurchaseOrder>>;
  templates: TermsTemplate[];
  vendors: VendorMaster[];
  comparisons: any[];
  onGeneratePONo: () => void;
  onRefreshVendors?: () => Promise<void>;
}

const CONTACT_OPTIONS = [
  "+91 90462 40020 - soumen karmakar",
  "+91 90461 76169 - vivek",
  "+91 90461 76166 - amit",
  "+91 90461 76150 - sayanta da",
  "+91 62941 44047 - proloy da",
  "+91 90461 41874 - Arpita"
];

const POForm: React.FC<POFormProps> = ({ po, setPo, templates, vendors, comparisons, onGeneratePONo, onRefreshVendors }) => {
  const { user } = useAuth();
  const canEditApproved = user?.role === 'SUPERADMIN' || user?.permissions.includes('EDIT_APPROVED_PO');
  const isReadOnly = 
    po.status === 'APPROVED' || 
    (po.status === 'REVISION_REQUIRED' && po.unapproved_by && (
      !canEditApproved || 
      !(po.unapproved_by.toLowerCase() === 'rohit' || po.unapproved_by.toLowerCase() === 'rohit aggarwal')
    ));

  const [bulkText, setBulkText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [showIgst, setShowIgst] = useState(!!po.terms?.igst);
  const [importModal, setImportModal] = useState<{ isOpen: boolean; vendors: string[]; compData: any } | null>(null);

  // Searchable Vendor Master states
  const [vendorSearchTerm, setVendorSearchTerm] = useState('');
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);

  // Add Vendor Modal states
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [isSavingVendor, setIsSavingVendor] = useState(false);
  const [newVendorData, setNewVendorData] = useState({
    name: '',
    address: '',
    state: '',
    gstin: '',
    mobile_no: '',
    email: ''
  });

  // UOM Options list
  const [uomOptions, setUomOptions] = useState<string[]>(() => {
    const saved = localStorage.getItem('po_uom_options');
    return saved ? JSON.parse(saved) : ['FT', 'KG', 'Mtr', 'PCS', 'NOS', 'PAIR'];
  });

  // Close search dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.vendor-search-container')) {
        setShowVendorDropdown(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(vendorSearchTerm.toLowerCase())
  );

  const handleAddVendorSubmit = async () => {
    if (!newVendorData.name.trim()) return;
    setIsSavingVendor(true);
    try {
      const res = await apiFetch('/api/settings/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVendorData.name.trim(),
          address: newVendorData.address.trim(),
          state: newVendorData.state.trim().toUpperCase(),
          gstin: newVendorData.gstin.trim().toUpperCase(),
          mobile_no: newVendorData.mobile_no.trim(),
          email: newVendorData.email.trim()
        })
      });

      if (res.ok) {
        if (onRefreshVendors) {
          await onRefreshVendors();
        }
        handleVendorSelect(newVendorData.name.trim());
        setVendorSearchTerm(newVendorData.name.trim());
        setIsAddVendorOpen(false);
        setNewVendorData({ name: '', address: '', state: '', gstin: '', mobile_no: '', email: '' });
      } else {
        const err = await res.json();
        alert(err.error || "Failed to add vendor");
      }
    } catch (e: any) {
      console.error(e);
      alert("Error adding vendor: " + e.message);
    } finally {
      setIsSavingVendor(false);
    }
  };

  useEffect(() => {
    if (po.terms?.igst) {
      setShowIgst(true);
    }
  }, [po.terms?.igst]);

  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error("Session expired");
    }
    return res;
  };

  const updateVendorField = (field: keyof PurchaseOrder['vendor_details'], value: string) => {
    if (isReadOnly) return;
    setPo(prev => ({
      ...prev,
      vendor_details: { ...(prev.vendor_details || {}), [field]: value } as any
    }));
  };

  const handleVendorSelect = (vendorName: string) => {
    if (isReadOnly) return;
    if (vendorName === 'custom') {
      setPo(prev => ({
        ...prev,
        vendor_name: '',
        vendor_details: { address: '', gstin: '', mail: '', ph: '', state: '', cc: '' }
      }));
      return;
    }

    const vendor = vendors.find(v => v.name === vendorName);
    if (!vendor) return;

    setPo(prev => ({
      ...prev,
      vendor_name: vendor.name,
      vendor_details: {
        ...(prev.vendor_details || {}),
        address: vendor.address || '',
        gstin: vendor.gstin || '',
        state: vendor.state || '',
        ph: vendor.mobile_no || '',
        mail: vendor.email || '',
        cc: prev.vendor_details?.cc || ''
      } as any
    }));
  };

  const addItem = () => {
    if (isReadOnly) return;
    setPo(prev => {
      const newItems = [...prev.items];
      const nextSn = newItems.length + 1;
      const newItem: POItem = {
        sn: nextSn,
        make: '',
        itemName: '',
        qty: 0,
        uom: 'NOS',
        rate: 0,
        discount: 0,
        tax: 'GST @18%',
        amount: 0
      };
      return { ...prev, items: [...newItems, newItem] };
    });
  };

  const removeItem = (index: number) => {
    if (isReadOnly) return;
    if (!window.confirm("Are you sure you want to remove this item?")) return;
    setPo(prev => {
      const newItems = prev.items.filter((_, i) => i !== index);
      // Re-calculate SNs
      const reindexed = newItems.map((item, i) => ({ ...item, sn: i + 1 }));
      const newTotal = reindexed.reduce((sum, item) => sum + (item.amount || 0), 0);
      return { ...prev, items: reindexed, total_amount: newTotal };
    });
  };

  const updateItem = (index: number, field: keyof POItem, value: any) => {
    if (isReadOnly) return;
    setPo(prev => {
      const newItems = [...prev.items];
      const item = { ...newItems[index], [field]: value };
      
      const qty = parseFloat(item.qty as any) || 0;
      const rate = parseFloat(item.rate as any) || 0;
      const discount = parseFloat(item.discount as any) || 0;
      
      const discountedRate = rate * (1 - discount / 100);
      const taxableAmount = qty * discountedRate;

      // Calculate tax
      let taxPercent = 0;
      const taxStr = String(item.tax || '');
      if (taxStr.includes('@')) {
        const match = taxStr.match(/@(\d+(\.\d+)?)%/);
        if (match) taxPercent = parseFloat(match[1]);
      } else if (taxStr.includes('%')) {
        const match = taxStr.match(/(\d+(\.\d+)?)%/);
        if (match) taxPercent = parseFloat(match[1]);
      }
      
      const taxAmount = taxableAmount * (taxPercent / 100);
      item.amount = parseFloat((taxableAmount + taxAmount).toFixed(2));
      
      newItems[index] = item;
      const newTotal = newItems.reduce((sum, item) => sum + (item.amount || 0), 0);
      return { ...prev, items: newItems, total_amount: newTotal };
    });
  };

  const updateFreightAmount = (val: number) => {
    if (isReadOnly) return;
    setPo(prev => ({
      ...prev,
      terms: { ...prev.terms, freight_amount: val }
    }));
  };

  const updateFreightTax = (val: string) => {
    if (isReadOnly) return;
    setPo(prev => ({
      ...prev,
      terms: { ...prev.terms, freight_tax: val }
    }));
  };

  const applyTemplate = (id: string) => {
    if (isReadOnly) return;
    const template = templates.find(t => String(t.id) === id);
    if (!template) return;
    setPo(prev => ({
      ...prev,
      terms: {
        ...prev.terms,
        tax: template.tax || prev.terms.tax,
        packing: template.packing || prev.terms.packing,
        notes: template.notes || prev.terms.notes,
        payment: template.payment || prev.terms.payment,
        freight: template.freight || prev.terms.freight,
        delivery: template.delivery || prev.terms.delivery,
        warranty: template.warranty || prev.terms.warranty,
        manual_notes: template.manual_notes ? [...template.manual_notes] : prev.terms.manual_notes,
        payment_milestones: template.payment_milestones ? [...template.payment_milestones] : prev.terms.payment_milestones
      }
    }));
  };

  const handleBulkExtract = async () => {
    if (!bulkText.trim() || isReadOnly) return;
    setIsExtracting(true);
    try {
      const res = await apiFetch('/api/ai/extract-po-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: bulkText })
      });
      const data = await res.json();
      if (data.items && Array.isArray(data.items)) {
        setPo(prev => {
          const currentItems = [...prev.items];
          const newItems = data.items.map((item: any, idx: number) => {
            const qty = parseFloat(item.qty) || 0;
            const rate = parseFloat(item.rate) || 0;
            const discount = parseFloat(item.discount) || 0;
            const taxableAmount = qty * rate * (1 - discount / 100);
            const taxPercent = 18; // Default for AI extraction
            const taxAmount = taxableAmount * (taxPercent / 100);

            return {
              sn: currentItems.length + idx + 1,
              itemName: item.itemName,
              make: item.make || '',
              qty,
              uom: item.uom || 'NOS',
              rate,
              discount,
              tax: `GST @${taxPercent}%`,
              amount: parseFloat((taxableAmount + taxAmount).toFixed(2))
            };
          });
          const combined = [...currentItems, ...newItems];
          return {
            ...prev,
            items: combined,
            total_amount: combined.reduce((sum, it) => sum + (it.amount || 0), 0)
          };
        });
        setBulkText('');
        setShowBulkPaste(false);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to extract items.");
    } finally {
      setIsExtracting(false);
    }
  };

  const processComparisonImport = (data: any, vendorName: string) => {
    if (!data?.items || isReadOnly) return;

    const compItems = data.items;
    const newPOItems: POItem[] = compItems.map((ci: any, idx: number) => {
      const quote = ci.vendorQuotes?.find((q: any) => q.vendorName === vendorName);
      const qty = parseFloat(ci.qty) || 0;
      const rate = parseFloat(quote?.mrp) || 0;
      const discount = parseFloat(quote?.discount) || 0;
      const netRate = parseFloat(quote?.netRate) || 0;
      
      const gstStatus = quote?.gstStatus || '18% Extra';
      const isInclusive = gstStatus.toLowerCase() === 'inclusive';
      
      let taxPercent = 0;
      if (!isInclusive) {
        if (gstStatus.includes('5%')) taxPercent = 5;
        else if (gstStatus.includes('18%') || gstStatus.toLowerCase() === 'exclusive') taxPercent = 18;
      }

      const taxableAmount = qty * netRate;
      const taxAmount = isInclusive ? 0 : taxableAmount * (taxPercent / 100);
      
      return {
        sn: idx + 1,
        itemName: ci.description || '',
        make: quote?.make || '',
        qty,
        uom: ci.uom || 'NOS',
        rate,
        discount,
        tax: isInclusive ? 'Inclusive' : `GST @${taxPercent}%`,
        amount: parseFloat((taxableAmount + taxAmount).toFixed(2))
      };
    });

    // Also update vendor details if found in master
    const matchedVendor = vendors.find((v: any) => v.name === vendorName);
    if (matchedVendor) {
      handleVendorSelect(vendorName);
    } else {
      setPo(prev => ({ ...prev, vendor_name: vendorName }));
    }

    setPo(prev => ({
      ...prev,
      items: newPOItems,
      total_amount: newPOItems.reduce((sum, it) => sum + (it.amount || 0), 0)
    }));
  };

  const loadFromComparison = async (comp: any) => {
    if (!comp?.id || isReadOnly) return;
    try {
      const res = await apiFetch(`/api/comparisons/${comp.id}`);
      const data = await res.json();
      const compData = data?.data?.data;
      if (compData?.items) {
        const compVendors = compData.vendors || [];
        if (compVendors.length === 0) return;
        
        if (compVendors.length > 1) {
          setImportModal({ isOpen: true, vendors: compVendors, compData });
        } else {
          processComparisonImport(compData, compVendors[0]);
        }
      }
    } catch (e) {
      console.error(e);
      alert("Failed to load comparison data.");
    }
  };

  const grandTotal = po.total_amount + (po.terms.freight_amount || 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Basic Info */}
      <section className="glass-card p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-sans tracking-wide uppercase">General Information</h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Auto-Generation</span>
            <button 
              onClick={onGeneratePONo}
              disabled={isReadOnly}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              title="Regenerate PO Number"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Purchase Order No.</label>
            <input 
              type="text"
              className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 disabled:opacity-50"
              value={po.po_no || ''}
              onChange={e => setPo({...po, po_no: e.target.value})}
              placeholder="e.g. PO/24-25/001"
              disabled={isReadOnly}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">PO Date</label>
            <input 
              type="date"
              className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 disabled:opacity-50"
              value={po.date || ''}
              onChange={e => setPo({...po, date: e.target.value})}
              disabled={isReadOnly}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">PO Classification</label>
            <select
              className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 cursor-pointer disabled:opacity-50"
              value={po.terms?.po_type || 'Consumables'}
              onChange={e => setPo({
                ...po,
                terms: {
                  ...po.terms,
                  po_type: e.target.value
                }
              })}
              disabled={isReadOnly}
            >
              <option value="Consumables">Consumables</option>
              <option value="Capital">Capital</option>
              <option value="packing item">Packing Item</option>
              <option value="production item">Production Item</option>
              <option value="export item">Export Item</option>
            </select>
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800/80 pt-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Associated Quotation Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Quotation Ref Type</label>
              <div className="flex gap-2">
                <select
                  className="mt-1 w-1/3 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2.5 text-xs text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 cursor-pointer disabled:opacity-50"
                  value={['MAIL', 'WHATSAPP', 'LETTER', 'QUOTATION', 'DISCUSSIONS'].includes(po.quote_ref_type || '') ? po.quote_ref_type : (po.quote_ref_type ? 'CUSTOM' : 'MAIL')}
                  onChange={e => {
                    if (e.target.value !== 'CUSTOM') {
                      setPo({...po, quote_ref_type: e.target.value});
                    }
                  }}
                  disabled={isReadOnly}
                >
                  <option value="MAIL">MAIL</option>
                  <option value="WHATSAPP">WHATSAPP</option>
                  <option value="LETTER">LETTER</option>
                  <option value="QUOTATION">QUOTATION</option>
                  <option value="DISCUSSIONS">DISCUSSIONS</option>
                  <option value="CUSTOM">CUSTOM...</option>
                </select>
                <input 
                  type="text"
                  className="mt-1 flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 disabled:opacity-50"
                  value={po.quote_ref_type || ''}
                  onChange={e => setPo({...po, quote_ref_type: e.target.value})}
                  placeholder="e.g. EMAIL, CALL"
                  disabled={isReadOnly}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Quotation Ref/Doc No.</label>
              <select 
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 cursor-pointer disabled:opacity-50"
                value={po.quote_doc_no || ''}
                onChange={e => {
                  const val = e.target.value;
                  setPo({...po, quote_doc_no: val});

                  // Optional: Auto-load date if found
                  const comp = comparisons.find(c => c.doc_no === val);
                  if (comp && comp.created_at) {
                    const date = new Date(comp.created_at).toISOString().split('T')[0];
                    setPo(prev => ({ ...prev, quote_doc_no: val, quote_date: date }));
                  }
                }}
                disabled={isReadOnly}
              >
                <option value="">-- Select Doc No --</option>
                {comparisons.map(c => (
                  <option key={c.id} value={c.doc_no}>{c.doc_no}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Quotation Date</label>
              <input 
                type="date"
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 disabled:opacity-50"
                value={po.quote_date || ''}
                onChange={e => setPo({...po, quote_date: e.target.value})}
                disabled={isReadOnly}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Vendor Details */}
      <section className="glass-card p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-sans tracking-wide uppercase">Vendor Details</h2>
          <div className="flex flex-wrap gap-2 items-center">
             {/* Searchable Vendor Master Dropdown */}
             <div className="relative flex-1 sm:flex-none vendor-search-container z-50">
               <input
                 type="text"
                 placeholder="Search Master Vendor..."
                 disabled={isReadOnly}
                 className="w-full sm:w-60 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 pl-8 outline-none text-slate-700 dark:text-slate-300 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50 shadow-xs"
                 value={vendorSearchTerm}
                 onChange={e => {
                   setVendorSearchTerm(e.target.value);
                   setShowVendorDropdown(true);
                 }}
                 onFocus={() => setShowVendorDropdown(true)}
               />
               <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
               {showVendorDropdown && (
                 <div className="absolute left-0 sm:right-0 mt-1 w-full sm:w-72 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-[100] custom-scrollbar">
                   <div 
                     className="px-3 py-2 text-xs text-rose-500 hover:bg-slate-55 dark:hover:bg-slate-800 font-bold cursor-pointer border-b border-slate-100 dark:border-slate-800"
                     onClick={() => {
                       handleVendorSelect('custom');
                       setVendorSearchTerm('');
                       setShowVendorDropdown(false);
                     }}
                   >
                     -- CUSTOM / NEW --
                   </div>
                   {filteredVendors.map(v => (
                     <div
                       key={v.name}
                       className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-indigo-600 hover:text-white cursor-pointer font-bold transition-colors"
                       onClick={() => {
                         handleVendorSelect(v.name);
                         setVendorSearchTerm(v.name);
                         setShowVendorDropdown(false);
                       }}
                     >
                       {v.name}
                     </div>
                   ))}
                   {filteredVendors.length === 0 && (
                     <div className="px-3 py-2 text-xs text-slate-400 italic">No vendors found</div>
                   )}
                 </div>
               )}
             </div>

             {/* Add New Vendor Button */}
             <button
               type="button"
               disabled={isReadOnly}
               onClick={() => setIsAddVendorOpen(true)}
               className="p-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 rounded-xl border border-indigo-200/60 dark:border-indigo-800/40 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
               title="Add New Vendor to Database"
             >
               <Plus className="w-3.5 h-3.5" /> Vendor
             </button>

             <select 
               className="flex-1 sm:flex-none text-xs bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl px-3 py-2 outline-none text-indigo-700 dark:text-indigo-400 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer disabled:opacity-50"
               onChange={e => {
                 const comp = comparisons.find(c => String(c.id) === e.target.value);
                 if (comp) loadFromComparison(comp);
               }}
               defaultValue=""
               disabled={isReadOnly}
             >
               <option value="" disabled>Import from Comparison</option>
               {comparisons.map(c => <option key={c.id} value={c.id}>{c.doc_no} ({new Date(c.created_at).toLocaleDateString()})</option>)}
             </select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Vendor Name</label>
              <input 
                type="text"
                list="vendor-list"
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 uppercase disabled:opacity-50"
                value={po.vendor_name || ''}
                onChange={e => {
                  const val = e.target.value;
                  setPo({...po, vendor_name: val});

                  // Auto-populate if it matches a master vendor
                  const matchedVendor = vendors.find(v => v.name.toLowerCase() === val.toLowerCase());
                  if (matchedVendor) {
                    handleVendorSelect(matchedVendor.name);
                  }
                }}
                placeholder="Full Company Name"
                disabled={isReadOnly}
              />
              <datalist id="vendor-list">
                {vendors.map(v => <option key={v.name} value={v.name} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Address</label>
              <textarea 
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 h-24 resize-none disabled:opacity-50"
                value={po.vendor_details?.address || ''}
                onChange={e => updateVendorField('address', e.target.value)}
                placeholder="Street, City, PIN"
                disabled={isReadOnly}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">GSTIN</label>
              <input 
                type="text"
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 uppercase disabled:opacity-50"
                value={po.vendor_details?.gstin || ''}
                onChange={e => updateVendorField('gstin', e.target.value)}
                placeholder="15-digit GSTIN"
                disabled={isReadOnly}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">State</label>
              <input 
                type="text"
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 uppercase disabled:opacity-50"
                value={po.vendor_details?.state || ''}
                onChange={e => updateVendorField('state', e.target.value)}
                placeholder="State Name"
                disabled={isReadOnly}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Contact No</label>
              <input 
                type="text"
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 disabled:opacity-50"
                value={po.vendor_details?.ph || ''}
                onChange={e => updateVendorField('ph', e.target.value)}
                placeholder="Mobile / Phone"
                disabled={isReadOnly}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Email</label>
              <input 
                type="email"
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 disabled:opacity-50"
                value={po.vendor_details?.mail || ''}
                onChange={e => updateVendorField('mail', e.target.value)}
                placeholder="vendor@mail.com"
                disabled={isReadOnly}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">CC Emails (Optional)</label>
              <input 
                type="text"
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 disabled:opacity-50"
                value={po.vendor_details?.cc || ''}
                onChange={e => updateVendorField('cc', e.target.value)}
                placeholder="email1@test.com, email2@test.com"
                disabled={isReadOnly}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Items Section */}
      <section className="glass-card p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-sans tracking-wide uppercase">Order Items</h2>
          <div className="flex gap-2">
            <button 
               onClick={() => setShowBulkPaste(!showBulkPaste)}
               disabled={isReadOnly}
               className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-black dark:hover:bg-white transition shadow-md cursor-pointer disabled:opacity-50"
            >
              <ClipboardPaste className="w-3.5 h-3.5" /> AI Bulk Paste
            </button>
            <button 
               onClick={addItem}
               disabled={isReadOnly}
               className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 transition shadow-md cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" /> Add New Item
            </button>
          </div>
        </div>

        {showBulkPaste && (
          <div className="p-4 bg-slate-900/5 dark:bg-slate-100/5 rounded-2xl border border-slate-200 dark:border-slate-800 animate-in slide-in-from-top duration-300">
             <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paste quotation text here (AI will extract items)</p>
                <button onClick={() => setShowBulkPaste(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"><Plus className="w-4 h-4 rotate-45" /></button>
             </div>
             <textarea 
               className="w-full h-32 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 dark:text-slate-100 font-medium disabled:opacity-50"
               placeholder="Example: 10 nos of 2.5sqmm copper cable, 5 pcs 16A MCB Legrand..."
               value={bulkText}
               onChange={e => setBulkText(e.target.value)}
               disabled={isReadOnly}
             />
             <div className="flex justify-end mt-3">
                <button 
                  onClick={handleBulkExtract}
                  disabled={isExtracting || !bulkText.trim() || isReadOnly}
                  className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-black dark:hover:bg-white disabled:opacity-50 transition shadow-lg cursor-pointer"
                >
                  {isExtracting ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Extracting...</>
                  ) : (
                    <><Plus className="w-3 h-3" /> Process Quotation</>
                  )}
                </button>
             </div>
          </div>
        )}

        <div className="space-y-4">
          {po.items.map((item, index) => (
            <div key={index} className="p-5 bg-slate-50/50 dark:bg-slate-950/50 hover:bg-white dark:hover:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 relative group hover:shadow-md transition-all duration-200">
              <button 
                onClick={() => removeItem(index)}
                disabled={isReadOnly}
                className="absolute -top-2.5 -right-2.5 bg-rose-600 text-white p-1.5 rounded-full opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition shadow-lg border border-white dark:border-slate-800 hover:bg-rose-700 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 md:col-span-6">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Item Name / Description</label>
                  <input 
                    type="text"
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 disabled:opacity-50"
                    value={item.itemName || ''}
                    onChange={e => updateItem(index, 'itemName', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Make</label>
                  <input 
                    type="text"
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 disabled:opacity-50"
                    value={item.make || ''}
                    onChange={e => updateItem(index, 'make', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Qty</label>
                  <input 
                    type="number"
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 disabled:opacity-50"
                    value={item.qty || 0}
                    onChange={e => updateItem(index, 'qty', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">UOM</label>
                  <select 
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-50"
                    value={item.uom || 'NOS'}
                    onChange={e => {
                      if (e.target.value === 'ADD_NEW_UOM') {
                        const newUom = prompt("Enter new Unit of Measure (e.g. SETS, LTR, BOX):");
                        if (newUom && newUom.trim()) {
                          const formatted = newUom.trim().toUpperCase();
                          if (!uomOptions.includes(formatted)) {
                            const updated = [...uomOptions, formatted];
                            setUomOptions(updated);
                            localStorage.setItem('po_uom_options', JSON.stringify(updated));
                          }
                          updateItem(index, 'uom', formatted);
                        }
                      } else {
                        updateItem(index, 'uom', e.target.value);
                      }
                    }}
                    disabled={isReadOnly}
                  >
                    {uomOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    <option value="ADD_NEW_UOM">+ Add Custom UOM...</option>
                  </select>
                </div>
                <div className="col-span-6 md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Rate</label>
                  <input 
                    type="number"
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 disabled:opacity-50"
                    value={item.rate || 0}
                    onChange={e => updateItem(index, 'rate', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="col-span-6 md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Dis%</label>
                  <input 
                    type="number"
                    step="0.001"
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 disabled:opacity-50"
                    value={item.discount || 0}
                    onChange={e => updateItem(index, 'discount', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="col-span-6 md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Tax</label>
                  <select 
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-50"
                    value={item.tax || 'GST @18%'}
                    onChange={e => updateItem(index, 'tax', e.target.value)}
                    disabled={isReadOnly}
                  >
                    <option value="GST @18%">18%</option>
                    <option value="GST @5%">5%</option>
                    <option value="GST @0.1%">0.1%</option>
                    <option value="Nil">Nil</option>
                  </select>
                </div>
                <div className="col-span-6 md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Amount</label>
                  <input 
                    type="number"
                    className="w-full border border-slate-200/80 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 font-bold outline-none cursor-not-allowed shadow-inner"
                    value={item.amount || 0}
                    readOnly
                  />
                </div>
              </div>
            </div>
          ))}
          {po.items.length === 0 && !showBulkPaste && <div className="text-center py-6 text-slate-400 italic text-sm">No items added yet.</div>}
          {po.items.length > 0 && (
            <div className="flex justify-end pt-3">
               <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Item Amount</p>
                  <p className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">₹{po.total_amount.toLocaleString()}</p>
               </div>
            </div>
          )}
        </div>
      </section>

      {/* Commercial Terms */}
      <section className="glass-card p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-sans tracking-wide uppercase">Commercial Terms</h2>
          <div className="relative">
             <select 
               className="text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 outline-none text-slate-700 dark:text-slate-300 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer disabled:opacity-50"
               onChange={e => applyTemplate(e.target.value)}
               defaultValue=""
               disabled={isReadOnly}
             >
               <option value="" disabled>Apply Template</option>
               {Array.isArray(templates) && templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
             </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tax (Summary)</label>
              {!showIgst && (
                <button
                  type="button"
                  onClick={() => setShowIgst(true)}
                  disabled={isReadOnly}
                  className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors uppercase tracking-wider cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3 h-3" /> Add IGST
                </button>
              )}
            </div>
            <select 
              className="mt-1 w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-50"
              value={po.terms.tax || ''}
              onChange={e => setPo({...po, terms: { ...po.terms, tax: e.target.value }})}
              disabled={isReadOnly}
            >
              <option value="">Select Tax</option>
              <option value="GST @18%">18%</option>
              <option value="GST @5%">5%</option>
              <option value="GST @0.1%">0.1%</option>
              <option value="Extra">Extra</option>
              <option value="Inclusive">Inclusive</option>
            </select>
          </div>
          {showIgst && (
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">IGST</label>
                <button
                  type="button"
                  onClick={() => {
                    setShowIgst(false);
                    setPo(prev => ({
                      ...prev,
                      terms: {
                        ...prev.terms,
                        igst: undefined
                      }
                    }));
                  }}
                  disabled={isReadOnly}
                  className="flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors uppercase tracking-wider cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
              <select
                className="mt-1 w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-50"
                value={po.terms.igst || ''}
                onChange={e => setPo({
                  ...po,
                  terms: {
                    ...po.terms,
                    igst: e.target.value
                  }
                })}
                disabled={isReadOnly}
              >
                <option value="">Select IGST</option>
                <option value="0.1%">0.1%</option>
                <option value="5%">5%</option>
                <option value="18%">18%</option>
                <option value="LUT">LUT</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Packing</label>
            <div className="flex gap-2">
              <select 
                className="mt-1 w-1/3 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-50"
                onChange={e => {
                  if (e.target.value !== 'CUSTOM') {
                    setPo({...po, terms: { ...po.terms, packing: e.target.value }});
                  }
                }}
                defaultValue=""
                disabled={isReadOnly}
              >
                <option value="" disabled>Select</option>
                <option value="Nil">Nil</option>
                <option value="Extra">Extra</option>
                <option value="CUSTOM">Custom...</option>
              </select>
              <input 
                type="text"
                className="mt-1 flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50"
                value={po.terms.packing || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, packing: e.target.value }})}
                placeholder="e.g. Nil, Extra"
                disabled={isReadOnly}
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Forwarding</label>
            <div className="flex gap-2">
              <select 
                className="mt-1 w-1/3 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-50"
                onChange={e => {
                  if (e.target.value !== 'CUSTOM') {
                    setPo({...po, terms: { ...po.terms, notes: e.target.value || '' }});
                  }
                }}
                defaultValue=""
                disabled={isReadOnly}
              >
                <option value="" disabled>Select</option>
                <option value="Nil">Nil</option>
                <option value="Extra">Extra</option>
                <option value="Free Upto Kolkata/Burdwan">Free Upto Kolkata</option>
                <option value="CUSTOM">Custom...</option>
              </select>
              <input 
                type="text"
                className="mt-1 flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50"
                value={po.terms.notes || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, notes: e.target.value }})}
                placeholder="e.g. Free Upto Kolkata"
                disabled={isReadOnly}
              />
            </div>
          </div>
          <div className="col-span-2">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Payment Terms</label>
              <button 
                onClick={() => setPo(prev => ({ 
                  ...prev, 
                  terms: { ...prev.terms, payment_milestones: [...(prev.terms.payment_milestones || []), { percentage: 0, description: '' }] } 
                }))}
                disabled={isReadOnly}
                className="text-[10px] font-semibold bg-indigo-600 text-white px-2.5 py-1.5 rounded-xl hover:bg-indigo-700 transition flex items-center gap-1 hover:-translate-y-0.5 shadow-sm transform cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3 h-3" /> ADD MILESTONE
              </button>
            </div>
            
            <div className="space-y-2">
              {(po.terms.payment_milestones || []).map((m, idx) => {
                const standardOptions = [
                  "ADVANCE",
                  "AFTER DRAWING",
                  "BEFORE DRAWING",
                  "BEFORE DISPATCH",
                  "AFTER DISPATCH",
                  "LOADING",
                  "AFTER SUCCESSFULLY COMMISSIONING",
                  "BEFORE SUCCESSFULLY COMMISSIONING"
                ];
                const isCustom = m.description && !standardOptions.includes(m.description);

                return (
                  <div key={idx} className="flex gap-2 items-center">
                    <div className="relative w-24 shrink-0">
                      <input 
                        type="number"
                        className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 pr-7 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 disabled:opacity-50"
                        value={m.percentage || ''}
                        onChange={e => {
                          const newMilestones = [...(po.terms.payment_milestones || [])];
                          newMilestones[idx].percentage = parseFloat(e.target.value) || 0;
                          setPo({ ...po, terms: { ...po.terms, payment_milestones: newMilestones } });
                        }}
                        placeholder="0"
                        disabled={isReadOnly}
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                    </div>
                    <select 
                      className="w-1/3 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-50"
                      value={isCustom ? "CUSTOM" : (m.description || "")}
                      onChange={e => {
                        const newMilestones = [...(po.terms.payment_milestones || [])];
                        if (e.target.value !== "CUSTOM") {
                          newMilestones[idx].description = e.target.value;
                          setPo({ ...po, terms: { ...po.terms, payment_milestones: newMilestones } });
                        }
                      }}
                      disabled={isReadOnly}
                    >
                      <option value="" disabled>Select Stage</option>
                      {standardOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                      <option value="CUSTOM">CUSTOM...</option>
                    </select>
                    <input 
                      type="text"
                      className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50"
                      value={m.description || ''}
                      onChange={e => {
                        const newMilestones = [...(po.terms.payment_milestones || [])];
                        newMilestones[idx].description = e.target.value;
                        setPo({ ...po, terms: { ...po.terms, payment_milestones: newMilestones } });
                      }}
                      placeholder="e.g. Advance against PI"
                      disabled={isReadOnly}
                    />
                    <button 
                      onClick={() => {
                        const newMilestones = (po.terms.payment_milestones || []).filter((_, i) => i !== idx);
                        setPo({ ...po, terms: { ...po.terms, payment_milestones: newMilestones } });
                      }}
                      disabled={isReadOnly}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl border border-transparent hover:border-rose-100 dark:hover:border-rose-800 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
              
              {po.terms.payment_milestones && po.terms.payment_milestones.length > 0 && (
                <div className="flex justify-end pr-10">
                  <div className={`text-[10px] font-bold px-2.5 py-1 rounded-xl shadow-inner ${
                    (po.terms.payment_milestones.reduce((sum, m) => sum + m.percentage, 0)) === 100 
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-800/50' 
                    : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-100/50 dark:border-rose-800/50'
                  }`}>
                    TOTAL: {po.terms.payment_milestones.reduce((sum, m) => sum + m.percentage, 0)}%
                  </div>
                </div>
              )}

              {(!po.terms.payment_milestones || po.terms.payment_milestones.length === 0) && (
                <div className="flex gap-2">
                  <select 
                    className="w-1/2 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-50"
                    onChange={e => {
                      if (e.target.value !== 'CUSTOM') {
                        setPo({...po, terms: { ...po.terms, payment: e.target.value }});
                      }
                    }}
                    defaultValue=""
                    disabled={isReadOnly}
                  >
                    <option value="" disabled>Select Payment</option>
                    <option value="100% AGAINST PI">100% AGAINST PI</option>
                    <option value="AFTER DELIVERY OF MATERIALS">AFTER DELIVERY OF MATERIALS</option>
                    <option value="CUSTOM">Custom...</option>
                  </select>
                  <input 
                    type="text"
                    className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50"
                    value={po.terms.payment || ''}
                    onChange={e => setPo({...po, terms: { ...po.terms, payment: e.target.value }})}
                    placeholder="Simple payment term or use milestones"
                    disabled={isReadOnly}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Freight</label>
            <div className="flex gap-2">
              <select 
                className="mt-1 w-1/4 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-50"
                value={po.terms.freight || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, freight: e.target.value }})}
                disabled={isReadOnly}
              >
                <option value="">Select</option>
                <option value="Extra">Extra</option>
                <option value="Including">Including</option>
                <option value="Nil">Nil</option>
                <option value="CUSTOM">Custom...</option>
              </select>
              <input 
                type="text"
                className="mt-1 flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50"
                value={po.terms.freight || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, freight: e.target.value }})}
                placeholder="e.g. Extra, Nil"
                disabled={isReadOnly}
              />
              <select 
                className="mt-1 w-1/4 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-50"
                value={po.terms.freight_tax || 'GST @18%'}
                onChange={e => updateFreightTax(e.target.value)}
                disabled={isReadOnly}
              >
                <option value="GST @18%">18% GST</option>
                <option value="GST @5%">5% GST</option>
                <option value="GST @0.1%">0.1% GST</option>
                <option value="Nil">Nil GST</option>
              </select>
              <input 
                type="number"
                className="mt-1 flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50"
                value={po.terms.freight_amount || 0}
                onChange={e => updateFreightAmount(Number(e.target.value))}
                placeholder="Amount"
                disabled={isReadOnly}
              />
            </div>
          </div>
          <div className="col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Warranty</label>
              <button
                type="button"
                onClick={() => {
                  const currentWarranties = po.terms.warranties || [];
                  setPo({
                    ...po,
                    terms: {
                      ...po.terms,
                      warranties: [...currentWarranties, { years: '', unit: 'years', description: '' }]
                    }
                  });
                }}
                disabled={isReadOnly}
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors uppercase tracking-wider cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3 h-3" /> Add Item Warranty
              </button>
            </div>
            
            {/* Primary/Default Warranty */}
            <div className="flex gap-2 items-center">
              <div className="relative flex-1 md:flex-none md:w-44 flex gap-1">
                <input 
                  type={po.terms.warranty_unit === 'custom' ? 'text' : 'number'}
                  className="w-2/3 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold disabled:opacity-50"
                  value={po.terms.warranty || ''}
                  onChange={e => setPo({...po, terms: { ...po.terms, warranty: e.target.value }})}
                  placeholder={po.terms.warranty_unit === 'custom' ? 'e.g. 18 Months' : '0'}
                  disabled={isReadOnly}
                />
                <select
                  className="w-1/3 border border-slate-200 dark:border-slate-800 rounded-xl px-1 py-2 text-[10px] bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-50"
                  value={po.terms.warranty_unit || 'years'}
                  onChange={e => setPo({...po, terms: { ...po.terms, warranty_unit: e.target.value as any }})}
                  disabled={isReadOnly}
                >
                  <option value="years">Years</option>
                  <option value="months">Months</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <input 
                type="text"
                className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium disabled:opacity-50"
                value={po.terms.warranty_description || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, warranty_description: e.target.value }})}
                placeholder="e.g. for Compressor / on all items (manual text)"
                disabled={isReadOnly}
              />
            </div>

            {/* Additional Warranties */}
            {po.terms.warranties && po.terms.warranties.map((w, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <div className="relative flex-1 md:flex-none md:w-44 flex gap-1">
                  <input 
                    type={w.unit === 'custom' ? 'text' : 'number'}
                    className="w-2/3 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold disabled:opacity-50"
                    value={w.years || ''}
                    onChange={e => {
                      const updated = [...(po.terms.warranties || [])];
                      updated[idx] = { ...updated[idx], years: e.target.value };
                      setPo({ ...po, terms: { ...po.terms, warranties: updated } });
                    }}
                    placeholder={w.unit === 'custom' ? 'e.g. 18 Months' : '0'}
                    disabled={isReadOnly}
                  />
                  <select
                    className="w-1/3 border border-slate-200 dark:border-slate-800 rounded-xl px-1 py-2 text-[10px] bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-50"
                    value={w.unit || 'years'}
                    onChange={e => {
                      const updated = [...(po.terms.warranties || [])];
                      updated[idx] = { ...updated[idx], unit: e.target.value };
                      setPo({ ...po, terms: { ...po.terms, warranties: updated } });
                    }}
                    disabled={isReadOnly}
                  >
                    <option value="years">Years</option>
                    <option value="months">Months</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <input 
                  type="text"
                  className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium disabled:opacity-50"
                  value={w.description || ''}
                  onChange={e => {
                    const updated = [...(po.terms.warranties || [])];
                    updated[idx] = { ...updated[idx], description: e.target.value };
                    setPo({ ...po, terms: { ...po.terms, warranties: updated } });
                  }}
                  placeholder="e.g. for Compressor / on all items (manual text)"
                  disabled={isReadOnly}
                />
                <button
                  type="button"
                  onClick={() => {
                    const updated = (po.terms.warranties || []).filter((_, i) => i !== idx);
                    setPo({ ...po, terms: { ...po.terms, warranties: updated } });
                  }}
                  disabled={isReadOnly}
                  className="p-2 text-rose-500 hover:text-rose-700 transition-colors cursor-pointer disabled:opacity-50"
                  title="Remove warranty"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="col-span-2">
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl flex justify-between items-center border border-indigo-950/60 shadow-lg dark:shadow-none">
               <span className="font-bold uppercase text-[10px] tracking-widest text-indigo-200/90">Grand Total Amount</span>
               <span className="text-2xl font-black font-sans tracking-tight text-white">₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Delivery Period</label>
            <div className="flex gap-2">
              <select 
                className="mt-1 w-1/3 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-50"
                onChange={e => {
                  if (e.target.value !== 'CUSTOM') {
                    setPo({...po, terms: { ...po.terms, delivery: e.target.value }});
                  }
                }}
                defaultValue=""
                disabled={isReadOnly}
              >
                <option value="" disabled>Select Delivery</option>
                <option value="Immediate">Immediate</option>
                <option value="CUSTOM">Custom Text...</option>
              </select>
              <input 
                type="text"
                className="mt-1 flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50"
                value={po.terms.delivery || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, delivery: e.target.value }})}
                placeholder="Immediate or enter custom period"
                disabled={isReadOnly}
              />
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Contact No</label>
            <div className="flex gap-2">
              <select 
                className="mt-1 w-1/3 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-50"
                onChange={e => {
                  if (e.target.value !== 'CUSTOM') {
                    const numberOnly = e.target.value.split(' - ')[0];
                    setPo({...po, terms: { ...po.terms, contact_no: numberOnly }});
                  }
                }}
                value={CONTACT_OPTIONS.some(opt => opt.startsWith(po.terms.contact_no || 'INVALID')) ? CONTACT_OPTIONS.find(opt => opt.startsWith(po.terms.contact_no || '')) : (po.terms.contact_no ? 'CUSTOM' : '')}
                disabled={isReadOnly}
              >
                <option value="">Select Contact</option>
                {CONTACT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                <option value="CUSTOM">Custom...</option>
              </select>
              <input 
                type="text"
                className="mt-1 flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50"
                value={po.terms.contact_no || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, contact_no: e.target.value }})}
                placeholder="e.g. +91 98765 43210"
                disabled={isReadOnly}
              />
            </div>
          </div>
          <div className="col-span-2">
            <div className="flex justify-between items-center mb-3 border-t border-slate-100 dark:border-slate-800 pt-4">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Additional Notes</label>
              <button 
                onClick={() => setPo(prev => ({ ...prev, terms: { ...prev.terms, manual_notes: [...(prev.terms.manual_notes || []), ''] } }))}
                disabled={isReadOnly}
                className="text-[10px] font-semibold bg-indigo-600 text-white px-2.5 py-1.5 rounded-xl hover:bg-indigo-700 transition flex items-center gap-1 hover:-translate-y-0.5 shadow-sm transform cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3 h-3" /> ADD NOTE
              </button>
            </div>
            <div className="space-y-3">
              {(po.terms.manual_notes || []).map((note, idx) => (
                <div key={idx} className="flex gap-2 group">
                  <div className="w-16 shrink-0 pt-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Note {idx + 3} ::</div>
                  <textarea 
                    className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 text-xs min-h-[60px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 placeholder-slate-400 disabled:opacity-50"
                    value={note}
                    onChange={e => {
                      const newNotes = [...(po.terms.manual_notes || [])];
                      newNotes[idx] = e.target.value;
                      setPo({ ...po, terms: { ...po.terms, manual_notes: newNotes } });
                    }}
                    placeholder={`Enter custom note ${idx + 3}...`}
                    disabled={isReadOnly}
                  />
                  <button 
                    onClick={() => {
                      const newNotes = (po.terms.manual_notes || []).filter((_, i) => i !== idx);
                      setPo({ ...po, terms: { ...po.terms, manual_notes: newNotes } });
                    }}
                    disabled={isReadOnly}
                    className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl shrink-0 h-fit transition-colors border border-transparent hover:border-rose-100 dark:hover:border-rose-800 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {(!po.terms.manual_notes || po.terms.manual_notes.length === 0) && (
                <div className="text-[10px] text-slate-400 dark:text-slate-500 italic text-center py-4 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/20 dark:bg-slate-950/20">
                  No additional notes added yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Import Modal */}
      {importModal?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Select Vendor</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">This comparison has multiple quotes. Which vendor's data should be imported?</p>
            </div>
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {importModal.vendors.map((vName, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    processComparisonImport(importModal.compData, vName);
                    setImportModal(null);
                  }}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 rounded-2xl transition-all group cursor-pointer"
                >
                  <span className="font-bold text-sm uppercase tracking-wide">{vName}</span>
                  <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/30 flex justify-end">
              <button 
                onClick={() => setImportModal(null)}
                className="px-6 py-2 text-xs font-black text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 uppercase tracking-widest cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Vendor Modal */}
      {isAddVendorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Add New Vendor</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Register a new vendor in the Master list.</p>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Vendor Name *</label>
                <input 
                  type="text"
                  required
                  value={newVendorData.name}
                  onChange={e => setNewVendorData({...newVendorData, name: e.target.value})}
                  placeholder="e.g. R.K. TRADERS"
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Address</label>
                <textarea 
                  value={newVendorData.address}
                  onChange={e => setNewVendorData({...newVendorData, address: e.target.value})}
                  placeholder="Full Address"
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">GSTIN</label>
                  <input 
                    type="text"
                    value={newVendorData.gstin}
                    onChange={e => setNewVendorData({...newVendorData, gstin: e.target.value})}
                    placeholder="15-digit GSTIN"
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">State</label>
                  <input 
                    type="text"
                    value={newVendorData.state}
                    onChange={e => setNewVendorData({...newVendorData, state: e.target.value})}
                    placeholder="West Bengal"
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Phone</label>
                  <input 
                    type="text"
                    value={newVendorData.mobile_no}
                    onChange={e => setNewVendorData({...newVendorData, mobile_no: e.target.value})}
                    placeholder="9876543210"
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Email</label>
                  <input 
                    type="email"
                    value={newVendorData.email}
                    onChange={e => setNewVendorData({...newVendorData, email: e.target.value})}
                    placeholder="vendor@mail.com"
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/30 flex justify-end gap-2">
              <button 
                type="button"
                onClick={() => setIsAddVendorOpen(false)}
                className="px-4 py-2 text-xs font-black text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 uppercase tracking-widest cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleAddVendorSubmit}
                disabled={isSavingVendor || !newVendorData.name.trim()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isSavingVendor ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Save Vendor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POForm;
