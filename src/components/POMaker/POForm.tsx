import React, { useState, useEffect } from 'react';
import { PurchaseOrder, TermsTemplate, POItem, VendorMaster } from '../../types';
import { Plus, Trash2, ClipboardPaste, Loader2, RotateCcw } from 'lucide-react';

interface POFormProps {
  po: PurchaseOrder;
  setPo: React.Dispatch<React.SetStateAction<PurchaseOrder>>;
  templates: TermsTemplate[];
  vendors: VendorMaster[];
  comparisons: any[];
  onGeneratePONo: () => void;
}

const CONTACT_OPTIONS = [
  "+91 90462 40020 - soumen",
  "+91 90461 76169 - vivek",
  "+91 90461 76166 - amit",
  "+91 90461 76150 - sayanta da",
  "+91 62941 44047 - proloy da",
  "+91 90461 41874 - Arpita"
];

const POForm: React.FC<POFormProps> = ({ po, setPo, templates, vendors, comparisons, onGeneratePONo }) => {
  const [bulkText, setBulkText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [showIgst, setShowIgst] = useState(!!po.terms?.igst);

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
    setPo(prev => ({
      ...prev,
      vendor_details: { ...prev.vendor_details, [field]: value }
    }));
  };

  const handleVendorSelect = (vendorName: string) => {
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
        ...prev.vendor_details,
        address: vendor.address || '',
        gstin: vendor.gstin || '',
        state: vendor.state || '',
        ph: vendor.mobile_no || '',
        mail: vendor.email || '',
        cc: prev.vendor_details.cc || ''
      }
    }));
  };

  const addItem = () => {
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
    setPo(prev => {
      const newItems = prev.items.filter((_, i) => i !== index);
      // Re-calculate SNs
      const reindexed = newItems.map((item, i) => ({ ...item, sn: i + 1 }));
      const newTotal = reindexed.reduce((sum, item) => sum + (item.amount || 0), 0);
      return { ...prev, items: reindexed, total_amount: newTotal };
    });
  };

  const updateItem = (index: number, field: keyof POItem, value: any) => {
    setPo(prev => {
      const newItems = [...prev.items];
      const item = { ...newItems[index], [field]: value };
      
      const qty = parseFloat(item.qty as any) || 0;
      const rate = parseFloat(item.rate as any) || 0;
      const discount = parseFloat(item.discount as any) || 0;
      
      const discountedRate = rate * (1 - discount / 100);
      item.amount = parseFloat((qty * discountedRate).toFixed(2));
      
      newItems[index] = item;
      const newTotal = newItems.reduce((sum, item) => sum + (item.amount || 0), 0);
      return { ...prev, items: newItems, total_amount: newTotal };
    });
  };

  const updateFreightAmount = (val: number) => {
    setPo(prev => ({
      ...prev,
      terms: { ...prev.terms, freight_amount: val }
    }));
  };

  const updateFreightTax = (val: string) => {
    setPo(prev => ({
      ...prev,
      terms: { ...prev.terms, freight_tax: val }
    }));
  };

  const applyTemplate = (id: string) => {
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
    if (!bulkText.trim()) return;
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
          const newItems = data.items.map((item: any, idx: number) => ({
            sn: currentItems.length + idx + 1,
            itemName: item.itemName,
            make: item.make || '',
            qty: parseFloat(item.qty) || 0,
            uom: item.uom || 'NOS',
            rate: parseFloat(item.rate) || 0,
            discount: parseFloat(item.discount) || 0,
            tax: 'GST @18%',
            amount: (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0) * (1 - (parseFloat(item.discount) || 0) / 100)
          }));
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

  const loadFromComparison = async (comp: any) => {
    if (!comp?.id) return;
    try {
      const res = await apiFetch(`/api/comparisons/${comp.id}`);
      const data = await res.json();
      if (data?.data?.data?.items) {
        // Find selected vendor if possible or prompt? 
        // For now just take the first vendor or let user pick.
        const vendors = data.data.data.vendors || [];
        if (vendors.length === 0) return;
        
        let vendorName = vendors[0];
        if (vendors.length > 1) {
          const choice = window.prompt(`Select Vendor to load items from:\n${vendors.join(', ')}`, vendors[0]);
          if (choice && vendors.includes(choice)) vendorName = choice;
        }

        const compItems = data.data.data.items;
        const newPOItems: POItem[] = compItems.map((ci: any, idx: number) => {
          const quote = ci.vendorQuotes?.find((q: any) => q.vendorName === vendorName);
          const qty = parseFloat(ci.qty) || 0;
          const rate = parseFloat(quote?.mrp) || 0;
          const discount = parseFloat(quote?.discount) || 0;
          const netRate = parseFloat(quote?.netRate) || 0;
          
          return {
            sn: idx + 1,
            itemName: ci.description || '',
            make: quote?.make || '',
            qty,
            uom: ci.uom || 'NOS',
            rate,
            discount,
            tax: 'GST @18%',
            amount: parseFloat((qty * netRate).toFixed(2))
          };
        });

        // Also update vendor details if found in master
        const vMaster = vendors.find((v: any) => v.name === vendorName);
        if (vMaster) {
           handleVendorSelect(vendorName);
        } else {
           setPo(prev => ({ ...prev, vendor_name: vendorName }));
        }

        setPo(prev => ({
          ...prev,
          items: newPOItems,
          total_amount: newPOItems.reduce((sum, it) => sum + (it.amount || 0), 0)
        }));
      }
    } catch (e) {
      console.error(e);
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
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg transition-colors cursor-pointer"
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
              className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950"
              value={po.po_no || ''}
              onChange={e => setPo({...po, po_no: e.target.value})}
              placeholder="e.g. PO/24-25/001"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">PO Date</label>
            <input 
              type="date"
              className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950"
              value={po.date || ''}
              onChange={e => setPo({...po, date: e.target.value})}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">PO Classification</label>
            <select
              className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 cursor-pointer"
              value={po.terms?.po_type || 'Consumables'}
              onChange={e => setPo({
                ...po,
                terms: {
                  ...po.terms,
                  po_type: e.target.value as 'Capital' | 'Consumables'
                }
              })}
            >
              <option value="Consumables">Consumables</option>
              <option value="Capital">Capital</option>
            </select>
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800/80 pt-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Associated Quotation Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Quotation Ref Type</label>
              <select
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 cursor-pointer"
                value={po.quote_ref_type || 'MAIL'}
                onChange={e => setPo({...po, quote_ref_type: e.target.value})}
              >
                <option value="MAIL">MAIL</option>
                <option value="WHATSAPP">WHATSAPP</option>
                <option value="LETTER">LETTER</option>
                <option value="QUOTATION">QUOTATION</option>
                <option value="DISCUSSIONS">DISCUSSIONS</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Quotation Ref/Doc No.</label>
              <input 
                type="text"
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950"
                value={po.quote_doc_no || ''}
                onChange={e => setPo({...po, quote_doc_no: e.target.value})}
                placeholder="e.g. Q/24/123"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Quotation Date</label>
              <input 
                type="date"
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950"
                value={po.quote_date || ''}
                onChange={e => setPo({...po, quote_date: e.target.value})}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Vendor Details */}
      <section className="glass-card p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-sans tracking-wide uppercase">Vendor Details</h2>
          <div className="flex gap-2">
             <select 
               className="text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 outline-none text-slate-700 dark:text-slate-300 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
               onChange={e => handleVendorSelect(e.target.value)}
               defaultValue=""
             >
               <option value="" disabled>Select from Master</option>
               <option value="custom">-- CUSTOM / NEW --</option>
               {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
             </select>
             
             <select 
               className="text-xs bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl px-3 py-1.5 outline-none text-indigo-700 dark:text-indigo-400 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
               onChange={e => {
                 const comp = comparisons.find(c => String(c.id) === e.target.value);
                 if (comp) loadFromComparison(comp);
               }}
               defaultValue=""
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
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 font-black focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 uppercase"
                value={po.vendor_name || ''}
                onChange={e => setPo({...po, vendor_name: e.target.value})}
                placeholder="Full Company Name"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Address</label>
              <textarea 
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 h-24 resize-none"
                value={po.vendor_details.address || ''}
                onChange={e => updateVendorField('address', e.target.value)}
                placeholder="Street, City, PIN"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">GSTIN</label>
              <input 
                type="text"
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 uppercase"
                value={po.vendor_details.gstin || ''}
                onChange={e => updateVendorField('gstin', e.target.value)}
                placeholder="15-digit GSTIN"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">State</label>
              <input 
                type="text"
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 uppercase"
                value={po.vendor_details.state || ''}
                onChange={e => updateVendorField('state', e.target.value)}
                placeholder="State Name"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Contact No</label>
              <input 
                type="text"
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950"
                value={po.vendor_details.ph || ''}
                onChange={e => updateVendorField('ph', e.target.value)}
                placeholder="Mobile / Phone"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Email</label>
              <input 
                type="email"
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950"
                value={po.vendor_details.mail || ''}
                onChange={e => updateVendorField('mail', e.target.value)}
                placeholder="vendor@mail.com"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">CC Emails (Optional)</label>
              <input 
                type="text"
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950"
                value={po.vendor_details.cc || ''}
                onChange={e => updateVendorField('cc', e.target.value)}
                placeholder="email1@test.com, email2@test.com"
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
               className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-black dark:hover:bg-white transition shadow-md cursor-pointer"
            >
              <ClipboardPaste className="w-3.5 h-3.5" /> AI Bulk Paste
            </button>
            <button 
               onClick={addItem}
               className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 transition shadow-md cursor-pointer"
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
               className="w-full h-32 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 dark:text-slate-100 font-medium"
               placeholder="Example: 10 nos of 2.5sqmm copper cable, 5 pcs 16A MCB Legrand..."
               value={bulkText}
               onChange={e => setBulkText(e.target.value)}
             />
             <div className="flex justify-end mt-3">
                <button 
                  onClick={handleBulkExtract}
                  disabled={isExtracting || !bulkText.trim()}
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
                className="absolute -top-2.5 -right-2.5 bg-rose-600 text-white p-1.5 rounded-full opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition shadow-lg border border-white dark:border-slate-800 hover:bg-rose-700 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 md:col-span-6">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Item Name / Description</label>
                  <input 
                    type="text"
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950"
                    value={item.itemName || ''}
                    onChange={e => updateItem(index, 'itemName', e.target.value)}
                  />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Make</label>
                  <input 
                    type="text"
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950"
                    value={item.make || ''}
                    onChange={e => updateItem(index, 'make', e.target.value)}
                  />
                </div>
                <div className="col-span-3 md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Qty</label>
                  <input 
                    type="number"
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950"
                    value={item.qty || 0}
                    onChange={e => updateItem(index, 'qty', e.target.value)}
                  />
                </div>
                <div className="col-span-3 md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">UOM</label>
                  <select 
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                    value={item.uom || 'NOS'}
                    onChange={e => updateItem(index, 'uom', e.target.value)}
                  >
                    <option value="FT">FT</option>
                    <option value="KG">KG</option>
                    <option value="Mtr">Mtr</option>
                    <option value="PCS">PCS</option>
                    <option value="NOS">NOS</option>
                    <option value="PAIR">PAIR</option>
                  </select>
                </div>
                <div className="col-span-3 md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Rate</label>
                  <input 
                    type="number"
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950"
                    value={item.rate || 0}
                    onChange={e => updateItem(index, 'rate', e.target.value)}
                  />
                </div>
                <div className="col-span-3 md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Dis%</label>
                  <input 
                    type="number"
                    step="0.001"
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950"
                    value={item.discount || 0}
                    onChange={e => updateItem(index, 'discount', e.target.value)}
                  />
                </div>
                <div className="col-span-3 md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Tax</label>
                  <select 
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                    value={item.tax || 'GST @18%'}
                    onChange={e => updateItem(index, 'tax', e.target.value)}
                  >
                    <option value="GST @18%">18%</option>
                    <option value="GST @5%">5%</option>
                    <option value="Nil">Nil</option>
                  </select>
                </div>
                <div className="col-span-3 md:col-span-3">
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
               className="text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 outline-none text-slate-700 dark:text-slate-300 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
               onChange={e => applyTemplate(e.target.value)}
               defaultValue=""
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
                  className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors uppercase tracking-wider cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add IGST
                </button>
              )}
            </div>
            <select 
              className="mt-1 w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
              value={po.terms.tax || ''}
              onChange={e => setPo({...po, terms: { ...po.terms, tax: e.target.value }})}
            >
              <option value="">Select Tax</option>
              <option value="GST @18%">18%</option>
              <option value="GST @5%">5%</option>
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
                  className="flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors uppercase tracking-wider cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
              <select
                className="mt-1 w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                value={po.terms.igst || ''}
                onChange={e => setPo({
                  ...po,
                  terms: {
                    ...po.terms,
                    igst: e.target.value
                  }
                })}
              >
                <option value="">Select IGST</option>
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
                className="mt-1 w-1/3 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                onChange={e => {
                  if (e.target.value !== 'CUSTOM') {
                    setPo({...po, terms: { ...po.terms, packing: e.target.value }});
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>Select</option>
                <option value="Nil">Nil</option>
                <option value="Extra">Extra</option>
                <option value="CUSTOM">Custom...</option>
              </select>
              <input 
                type="text"
                className="mt-1 flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={po.terms.packing || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, packing: e.target.value }})}
                placeholder="e.g. Nil, Extra"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Forwarding</label>
            <div className="flex gap-2">
              <select 
                className="mt-1 w-1/3 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                onChange={e => {
                  if (e.target.value !== 'CUSTOM') {
                    setPo({...po, terms: { ...po.terms, notes: e.target.value || '' }});
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>Select</option>
                <option value="Nil">Nil</option>
                <option value="Extra">Extra</option>
                <option value="Free Upto Kolkata/Burdwan">Free Upto Kolkata</option>
                <option value="CUSTOM">Custom...</option>
              </select>
              <input 
                type="text"
                className="mt-1 flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={po.terms.notes || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, notes: e.target.value }})}
                placeholder="e.g. Free Upto Kolkata"
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
                className="text-[10px] font-semibold bg-indigo-600 text-white px-2.5 py-1.5 rounded-xl hover:bg-indigo-700 transition flex items-center gap-1 hover:-translate-y-0.5 shadow-sm transform cursor-pointer"
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
                        className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 pr-7 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950"
                        value={m.percentage || ''}
                        onChange={e => {
                          const newMilestones = [...(po.terms.payment_milestones || [])];
                          newMilestones[idx].percentage = parseFloat(e.target.value) || 0;
                          setPo({ ...po, terms: { ...po.terms, payment_milestones: newMilestones } });
                        }}
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                    </div>
                    <select 
                      className="w-1/3 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                      value={isCustom ? "CUSTOM" : (m.description || "")}
                      onChange={e => {
                        const newMilestones = [...(po.terms.payment_milestones || [])];
                        if (e.target.value !== "CUSTOM") {
                          newMilestones[idx].description = e.target.value;
                          setPo({ ...po, terms: { ...po.terms, payment_milestones: newMilestones } });
                        }
                      }}
                    >
                      <option value="" disabled>Select Stage</option>
                      {standardOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                      <option value="CUSTOM">CUSTOM...</option>
                    </select>
                    <input 
                      type="text"
                      className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={m.description || ''}
                      onChange={e => {
                        const newMilestones = [...(po.terms.payment_milestones || [])];
                        newMilestones[idx].description = e.target.value;
                        setPo({ ...po, terms: { ...po.terms, payment_milestones: newMilestones } });
                      }}
                      placeholder="e.g. Advance against PI"
                    />
                    <button 
                      onClick={() => {
                        const newMilestones = (po.terms.payment_milestones || []).filter((_, i) => i !== idx);
                        setPo({ ...po, terms: { ...po.terms, payment_milestones: newMilestones } });
                      }}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl border border-transparent hover:border-rose-100 dark:hover:border-rose-800 transition-colors cursor-pointer"
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
                    className="w-1/2 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                    onChange={e => {
                      if (e.target.value !== 'CUSTOM') {
                        setPo({...po, terms: { ...po.terms, payment: e.target.value }});
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Select Payment</option>
                    <option value="100% AGAINST PI">100% AGAINST PI</option>
                    <option value="AFTER DELIVERY OF MATERIALS">AFTER DELIVERY OF MATERIALS</option>
                    <option value="CUSTOM">Custom...</option>
                  </select>
                  <input 
                    type="text"
                    className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={po.terms.payment || ''}
                    onChange={e => setPo({...po, terms: { ...po.terms, payment: e.target.value }})}
                    placeholder="Simple payment term or use milestones"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Freight</label>
            <div className="flex gap-2">
              <select 
                className="mt-1 w-1/4 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                value={po.terms.freight || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, freight: e.target.value }})}
              >
                <option value="">Select</option>
                <option value="Extra">Extra</option>
                <option value="Including">Including</option>
                <option value="Nil">Nil</option>
              </select>
              <select 
                className="mt-1 w-1/4 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                value={po.terms.freight_tax || 'GST @18%'}
                onChange={e => updateFreightTax(e.target.value)}
              >
                <option value="GST @18%">18% GST</option>
                <option value="GST @5%">5% GST</option>
                <option value="Nil">Nil GST</option>
              </select>
              <input 
                type="number"
                className="mt-1 flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={po.terms.freight_amount || 0}
                onChange={e => updateFreightAmount(Number(e.target.value))}
                placeholder="Amount"
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
                      warranties: [...currentWarranties, { years: '', description: '' }]
                    }
                  });
                }}
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors uppercase tracking-wider cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Item Warranty
              </button>
            </div>
            
            {/* Primary/Default Warranty */}
            <div className="flex gap-2 items-center">
              <div className="relative w-32 shrink-0">
                <input 
                  type="number"
                  className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold"
                  value={po.terms.warranty || ''}
                  onChange={e => setPo({...po, terms: { ...po.terms, warranty: e.target.value }})}
                  placeholder="0"
                />
                <span className="absolute right-3 top-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Year(s)</span>
              </div>
              <input 
                type="text"
                className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                value={po.terms.warranty_description || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, warranty_description: e.target.value }})}
                placeholder="e.g. for Compressor / on all items (manual text)"
              />
            </div>

            {/* Additional Warranties */}
            {po.terms.warranties && po.terms.warranties.map((w, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <div className="relative w-32 shrink-0">
                  <input 
                    type="number"
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold"
                    value={w.years || ''}
                    onChange={e => {
                      const updated = [...(po.terms.warranties || [])];
                      updated[idx] = { ...updated[idx], years: e.target.value };
                      setPo({ ...po, terms: { ...po.terms, warranties: updated } });
                    }}
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Year(s)</span>
                </div>
                <input 
                  type="text"
                  className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  value={w.description || ''}
                  onChange={e => {
                    const updated = [...(po.terms.warranties || [])];
                    updated[idx] = { ...updated[idx], description: e.target.value };
                    setPo({ ...po, terms: { ...po.terms, warranties: updated } });
                  }}
                  placeholder="e.g. for Compressor / on all items (manual text)"
                />
                <button
                  type="button"
                  onClick={() => {
                    const updated = (po.terms.warranties || []).filter((_, i) => i !== idx);
                    setPo({ ...po, terms: { ...po.terms, warranties: updated } });
                  }}
                  className="p-2 text-rose-500 hover:text-rose-700 transition-colors cursor-pointer"
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
                className="mt-1 w-1/3 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                onChange={e => {
                  if (e.target.value !== 'CUSTOM') {
                    setPo({...po, terms: { ...po.terms, delivery: e.target.value }});
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>Select Delivery</option>
                <option value="Immediate">Immediate</option>
                <option value="CUSTOM">Custom Text...</option>
              </select>
              <input 
                type="text"
                className="mt-1 flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={po.terms.delivery || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, delivery: e.target.value }})}
                placeholder="Immediate or enter custom period"
              />
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Contact No</label>
            <div className="flex gap-2">
              <select 
                className="mt-1 w-1/3 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                onChange={e => {
                  if (e.target.value !== 'CUSTOM') {
                    const numberOnly = e.target.value.split(' - ')[0];
                    setPo({...po, terms: { ...po.terms, contact_no: numberOnly }});
                  }
                }}
                value={CONTACT_OPTIONS.some(opt => opt.startsWith(po.terms.contact_no || 'INVALID')) ? CONTACT_OPTIONS.find(opt => opt.startsWith(po.terms.contact_no || '')) : (po.terms.contact_no ? 'CUSTOM' : '')}
              >
                <option value="">Select Contact</option>
                {CONTACT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                <option value="CUSTOM">Custom...</option>
              </select>
              <input 
                type="text"
                className="mt-1 flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={po.terms.contact_no || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, contact_no: e.target.value }})}
                placeholder="e.g. +91 98765 43210"
              />
            </div>
          </div>
          <div className="col-span-2">
            <div className="flex justify-between items-center mb-3 border-t border-slate-100 dark:border-slate-800 pt-4">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Additional Notes</label>
              <button 
                onClick={() => setPo(prev => ({ ...prev, terms: { ...prev.terms, manual_notes: [...(prev.terms.manual_notes || []), ''] } }))}
                className="text-[10px] font-semibold bg-indigo-600 text-white px-2.5 py-1.5 rounded-xl hover:bg-indigo-700 transition flex items-center gap-1 hover:-translate-y-0.5 shadow-sm transform cursor-pointer"
              >
                <Plus className="w-3 h-3" /> ADD NOTE
              </button>
            </div>
            <div className="space-y-3">
              {(po.terms.manual_notes || []).map((note, idx) => (
                <div key={idx} className="flex gap-2 group">
                  <div className="w-16 shrink-0 pt-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Note {idx + 3} ::</div>
                  <textarea 
                    className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 text-xs min-h-[60px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-950 placeholder-slate-400"
                    value={note}
                    onChange={e => {
                      const newNotes = [...(po.terms.manual_notes || [])];
                      newNotes[idx] = e.target.value;
                      setPo({ ...po, terms: { ...po.terms, manual_notes: newNotes } });
                    }}
                    placeholder={`Enter custom note ${idx + 3}...`}
                  />
                  <button 
                    onClick={() => {
                      const newNotes = (po.terms.manual_notes || []).filter((_, i) => i !== idx);
                      setPo({ ...po, terms: { ...po.terms, manual_notes: newNotes } });
                    }}
                    className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl shrink-0 h-fit transition-colors border border-transparent hover:border-rose-100 dark:hover:border-rose-800 cursor-pointer"
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
    </div>
  );
};

export default POForm;
