import React, { useState } from 'react';
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
      // Re-index serial numbers to keep them strictly sequential 1, 2, 3...
      const reindexedItems = newItems.map((item, i) => ({ ...item, sn: i + 1 }));
      const total = reindexedItems.reduce((acc, item) => acc + Number(item.amount), 0);
      return { ...prev, items: reindexedItems, total_amount: total };
    });
  };

  const calculateItemAmount = (item: Partial<POItem>) => {
    const qty = parseFloat(String(item.qty)) || 0;
    const rate = parseFloat(String(item.rate)) || 0;
    const discount = parseFloat(String(item.discount)) || 0;
    const taxStr = String(item.tax);
    const taxMatch = taxStr.match(/(\d+)%/);
    const taxPercent = taxMatch ? parseFloat(taxMatch[1]) : 0;

    const discountedRate = rate * (1 - discount / 100);
    const amountWithTax = (qty * discountedRate) * (1 + taxPercent / 100);
    return Number(amountWithTax.toFixed(2));
  };

  const updateItem = (index: number, field: keyof POItem, value: any) => {
    setPo(prev => {
      const newItems = [...prev.items];
      const item = { ...newItems[index], [field]: value };
      item.amount = calculateItemAmount(item);
      newItems[index] = item;
      
      const total = newItems.reduce((acc, it) => acc + Number(it.amount), 0);
      return { ...prev, items: newItems, total_amount: Number(total.toFixed(2)) };
    });
  };

  const handleBulkExtract = async () => {
    if (!bulkText.trim()) return;
    setIsExtracting(true);
    try {
      const res = await apiFetch('/api/extract-po-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: bulkText })
      });
      if (!res.ok) throw new Error("Extraction failed");
      const data = await res.json();
      
      if (data.items && Array.isArray(data.items)) {
        setPo(prev => {
          const currentItems = [...prev.items];
          const lastSn = currentItems.length > 0 ? Math.max(...currentItems.map(i => i.sn)) : 0;
          
          const newItems = data.items.map((item: any, idx: number) => {
            const processedItem = {
              ...item,
              sn: lastSn + idx + 1,
              qty: Number(item.qty) || 0,
              rate: Number(item.rate) || 0,
              discount: Number(item.discount) || 0,
              tax: item.tax || 'GST @18%'
            };
            processedItem.amount = calculateItemAmount(processedItem);
            return processedItem as POItem;
          });

          const updatedItems = [...currentItems, ...newItems];
          const total = updatedItems.reduce((acc, it) => acc + Number(it.amount), 0);
          return { ...prev, items: updatedItems, total_amount: Number(total.toFixed(2)) };
        });
        setBulkText('');
        setShowBulkPaste(false);
      }
    } catch (err: any) {
      if (err.message !== "Session expired") {
        alert("Failed to extract items. Please try again.");
      }
    } finally {
      setIsExtracting(false);
    }
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

  // Derived Totals
  const getFreightTaxPercent = () => {
    const taxStr = po.terms.freight_tax || 'GST @18%';
    const taxMatch = taxStr.match(/(\d+)%/);
    return taxMatch ? parseFloat(taxMatch[1]) : 0;
  };

  const freightAmount = Number(po.terms.freight_amount) || 0;
  const freightTaxAmount = Number((freightAmount * (getFreightTaxPercent() / 100)).toFixed(2));
  const grandTotal = Number(((po.total_amount || 0) + freightAmount + freightTaxAmount).toFixed(2));

  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === Number(templateId));
    if (!template) return;
    setPo(prev => ({
      ...prev,
      terms: {
        tax: template.tax || '',
        packing: template.packing || '',
        payment: template.payment || '',
        freight: template.freight || '',
        delivery: template.delivery || '',
        contact_no: template.contact_no || '',
        notes: template.notes || ''
      }
    }));
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header Info */}
      <section className="glass-card p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900 font-sans tracking-wide">PO Information</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <div className="flex justify-between items-end">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">PO Number</label>
              <button 
                onClick={onGeneratePONo}
                className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 mb-0.5 transition-colors duration-200"
                title="Generate next sequential number"
              >
                <RotateCcw className="w-2.5 h-2.5" /> RESET
              </button>
            </div>
            <input 
              type="text"
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
              value={po.po_no || ''}
              onChange={e => setPo({...po, po_no: e.target.value})}
              placeholder="e.g. HRM/2026-27/01"
            />
          </div>
          <div className="grid grid-cols-2 gap-4 col-span-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">PO Date</label>
              <input 
                type="date"
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={po.date || ''}
                onChange={e => setPo({...po, date: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quotation Ref Type</label>
              <select 
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                value={po.quote_ref_type || 'MAIL'}
                onChange={e => setPo({...po, quote_ref_type: e.target.value})}
              >
                <option value="MAIL">MAIL</option>
                <option value="WHATSAPP">WHATSAPP</option>
                <option value="VERBAL">VERBAL</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ref Doc No (Comparison)</label>
              <div className="flex gap-2">
                <select 
                  className="mt-1 w-1/2 border border-slate-200 rounded-xl px-2 py-2 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                  onChange={e => {
                    if (e.target.value !== 'CUSTOM') {
                      setPo({...po, quote_doc_no: e.target.value});
                    }
                  }}
                  value={comparisons.some(c => c.doc_no === po.quote_doc_no) ? po.quote_doc_no : (po.quote_doc_no ? 'CUSTOM' : '')}
                >
                  <option value="">-- Select Doc --</option>
                  {comparisons.map(c => <option key={c.id} value={c.doc_no}>{c.doc_no}</option>)}
                  <option value="CUSTOM">Custom...</option>
                </select>
                <input 
                  type="text"
                  className="mt-1 flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                  value={po.quote_doc_no || ''}
                  onChange={e => setPo({...po, quote_doc_no: e.target.value})}
                  placeholder="Ref Doc No"
                />
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quotation Date</label>
              <input 
                type="date"
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={po.quote_date || ''}
                onChange={e => setPo({...po, quote_date: e.target.value})}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Vendor Details */}
      <section className="glass-card p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-6">
        <h2 className="text-sm font-bold text-slate-900 font-sans tracking-wide border-b border-slate-100 pb-3">Vendor Details</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Vendor</label>
              <select 
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                onChange={e => handleVendorSelect(e.target.value)}
                value={po.vendor_name || ''}
              >
                <option value="">-- Select Vendor --</option>
                <option value="custom">Manual Entry</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.name}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vendor Name</label>
              <input 
                type="text"
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                value={po.vendor_name || ''}
                onChange={e => setPo({...po, vendor_name: e.target.value})}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Address</label>
                <textarea 
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                  rows={2}
                  value={po.vendor_details.address || ''}
                  onChange={e => updateVendorField('address', e.target.value)}
                />
             </div>
             <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">GSTIN</label>
                <input 
                  type="text"
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                  value={po.vendor_details.gstin || ''}
                  onChange={e => updateVendorField('gstin', e.target.value)}
                />
             </div>
             <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">State</label>
                <input 
                  type="text"
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                  value={po.vendor_details.state || ''}
                  onChange={e => updateVendorField('state', e.target.value)}
                />
             </div>
             <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mail ID</label>
                <input 
                  type="email"
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                  value={po.vendor_details.mail || ''}
                  onChange={e => updateVendorField('mail', e.target.value)}
                />
             </div>
             <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Phone</label>
                <input 
                  type="text"
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                  value={po.vendor_details.ph || ''}
                  onChange={e => updateVendorField('ph', e.target.value)}
                />
             </div>
             <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">CC Email IDs (Optional)</label>
                <input 
                  type="text"
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                  value={po.vendor_details.cc || ''}
                  onChange={e => updateVendorField('cc', e.target.value)}
                  placeholder="e.g. boss@hemrajgroup.co.in, team@hemrajgroup.co.in"
                />
             </div>
          </div>
        </div>
      </section>

      {/* Items */}
      <section className="glass-card p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900 font-sans tracking-wide">Items</h2>
          <div className="flex gap-2">
             <button 
               onClick={() => setShowBulkPaste(!showBulkPaste)}
               className="flex items-center gap-1.5 text-xs font-semibold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-xl transition duration-200 shadow-sm cursor-pointer"
             >
               <ClipboardPaste className="w-3.5 h-3.5" /> Bulk Paste
             </button>
             <button 
               onClick={addItem}
               className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl shadow-sm transition duration-200 hover:-translate-y-0.5 transform cursor-pointer"
             >
               <Plus className="w-3.5 h-3.5" /> Add Item
             </button>
          </div>
        </div>

        {showBulkPaste && (
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4 shadow-inner">
             <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Paste Spreadsheet Data</h3>
                <p className="text-[10px] text-slate-400 italic">Example: "Item Description, Brand, 10 PCS, 500.00"</p>
             </div>
             <textarea 
               className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[100px]"
               rows={4}
               placeholder="Paste items from Excel or Sheets here..."
               value={bulkText}
               onChange={e => setBulkText(e.target.value)}
             />
             <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setShowBulkPaste(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-3 py-2 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleBulkExtract}
                  disabled={isExtracting || !bulkText.trim()}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...
                    </>
                  ) : (
                    'Extract Items'
                  )}
                </button>
             </div>
          </div>
        )}

        <div className="space-y-4">
          {po.items.map((item, index) => (
            <div key={index} className="p-5 bg-slate-50/50 hover:bg-white rounded-2xl border border-slate-200/60 relative group hover:shadow-md transition-all duration-200">
              <button 
                onClick={() => removeItem(index)}
                className="absolute -top-2.5 -right-2.5 bg-rose-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg border border-white hover:bg-rose-700 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 md:col-span-6">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Item Name / Description</label>
                  <input 
                    type="text"
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                    value={item.itemName || ''}
                    onChange={e => updateItem(index, 'itemName', e.target.value)}
                  />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Make</label>
                  <input 
                    type="text"
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                    value={item.make || ''}
                    onChange={e => updateItem(index, 'make', e.target.value)}
                  />
                </div>
                <div className="col-span-3 md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Qty</label>
                  <input 
                    type="number"
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                    value={item.qty || 0}
                    onChange={e => updateItem(index, 'qty', e.target.value)}
                  />
                </div>
                <div className="col-span-3 md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">UOM</label>
                  <select 
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
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
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Rate</label>
                  <input 
                    type="number"
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                    value={item.rate || 0}
                    onChange={e => updateItem(index, 'rate', e.target.value)}
                  />
                </div>
                <div className="col-span-3 md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Dis%</label>
                  <input 
                    type="number"
                    step="0.001"
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                    value={item.discount || 0}
                    onChange={e => updateItem(index, 'discount', e.target.value)}
                  />
                </div>
                <div className="col-span-3 md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tax</label>
                  <select 
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                    value={item.tax || 'GST @18%'}
                    onChange={e => updateItem(index, 'tax', e.target.value)}
                  >
                    <option value="GST @18%">18%</option>
                    <option value="GST @5%">5%</option>
                    <option value="Nil">Nil</option>
                  </select>
                </div>
                <div className="col-span-3 md:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Amount</label>
                  <input 
                    type="number"
                    className="w-full border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 bg-slate-100/50 font-bold outline-none cursor-not-allowed shadow-inner"
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
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Item Amount</p>
                  <p className="text-lg font-black text-slate-900 mt-1">₹{po.total_amount.toLocaleString()}</p>
               </div>
            </div>
          )}
        </div>
      </section>

      {/* Commercial Terms */}
      <section className="glass-card p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900 font-sans tracking-wide">Commercial Terms</h2>
          <div className="relative">
             <select 
               className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-1.5 outline-none text-slate-700 font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
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
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tax (Summary)</label>
            <select 
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
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
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Packing</label>
            <div className="flex gap-2">
              <select 
                className="mt-1 w-1/3 border border-slate-200 rounded-xl px-2 py-2 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
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
                className="mt-1 flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={po.terms.packing || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, packing: e.target.value }})}
                placeholder="e.g. Nil, Extra"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Forwarding</label>
            <div className="flex gap-2">
              <select 
                className="mt-1 w-1/3 border border-slate-200 rounded-xl px-2 py-2 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
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
                className="mt-1 flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={po.terms.notes || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, notes: e.target.value }})}
                placeholder="e.g. Free Upto Kolkata"
              />
            </div>
          </div>
          <div className="col-span-2">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payment Terms</label>
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
                        className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 pr-7 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
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
                      className="w-1/3 border border-slate-200 rounded-xl px-2 py-1.5 bg-white text-xs text-slate-700 font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
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
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
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
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-100 transition-colors cursor-pointer"
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
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/50' 
                    : 'bg-rose-50 text-rose-700 border border-rose-100/50'
                  }`}>
                    TOTAL: {po.terms.payment_milestones.reduce((sum, m) => sum + m.percentage, 0)}%
                  </div>
                </div>
              )}

              {(!po.terms.payment_milestones || po.terms.payment_milestones.length === 0) && (
                <div className="flex gap-2">
                  <select 
                    className="w-1/2 border border-slate-200 rounded-xl px-2 py-2 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
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
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={po.terms.payment || ''}
                    onChange={e => setPo({...po, terms: { ...po.terms, payment: e.target.value }})}
                    placeholder="Simple payment term or use milestones"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Freight</label>
            <div className="flex gap-2">
              <select 
                className="mt-1 w-1/4 border border-slate-200 rounded-xl px-2 py-2 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                value={po.terms.freight || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, freight: e.target.value }})}
              >
                <option value="">Select</option>
                <option value="Extra">Extra</option>
                <option value="Including">Including</option>
                <option value="Nil">Nil</option>
              </select>
              <select 
                className="mt-1 w-1/4 border border-slate-200 rounded-xl px-2 py-2 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                value={po.terms.freight_tax || 'GST @18%'}
                onChange={e => updateFreightTax(e.target.value)}
              >
                <option value="GST @18%">18% GST</option>
                <option value="GST @5%">5% GST</option>
                <option value="Nil">Nil GST</option>
              </select>
              <input 
                type="number"
                className="mt-1 flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={po.terms.freight_amount || 0}
                onChange={e => updateFreightAmount(Number(e.target.value))}
                placeholder="Amount"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Warranty</label>
            <div className="relative">
              <input 
                type="number"
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={po.terms.warranty || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, warranty: e.target.value }})}
                placeholder="0"
              />
              <span className="absolute right-3 top-3 text-[10px] font-bold text-slate-400 uppercase">Year(s)</span>
            </div>
          </div>
          <div className="col-span-2">
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl flex justify-between items-center border border-indigo-950/60 shadow-lg">
               <span className="font-semibold uppercase text-xs tracking-wider text-indigo-200/90">Grand Total Amount</span>
               <span className="text-2xl font-black font-sans tracking-tight text-white">₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Delivery Period</label>
            <div className="flex gap-2">
              <select 
                className="mt-1 w-1/3 border border-slate-200 rounded-xl px-3 py-2 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
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
                className="mt-1 flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={po.terms.delivery || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, delivery: e.target.value }})}
                placeholder="Immediate or enter custom period"
              />
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contact No</label>
            <div className="flex gap-2">
              <select 
                className="mt-1 w-1/3 border border-slate-200 rounded-xl px-3 py-2 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
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
                className="mt-1 flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={po.terms.contact_no || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, contact_no: e.target.value }})}
                placeholder="e.g. +91 98765 43210"
              />
            </div>
          </div>
          <div className="col-span-2">
            <div className="flex justify-between items-center mb-3 border-t border-slate-100 pt-4">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Additional Notes</label>
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
                  <div className="w-16 shrink-0 pt-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Note {idx + 3} ::</div>
                  <textarea 
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs min-h-[60px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white placeholder-slate-400"
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
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl shrink-0 h-fit transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {(!po.terms.manual_notes || po.terms.manual_notes.length === 0) && (
                <div className="text-[10px] text-slate-400 italic text-center py-4 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/20">
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
