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

const POForm: React.FC<POFormProps> = ({ po, setPo, templates, vendors, comparisons, onGeneratePONo }) => {
  const [bulkText, setBulkText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [showBulkPaste, setShowBulkPaste] = useState(false);

  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
      }
    });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('admin_token');
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
        vendor_details: { address: '', gstin: '', mail: '', ph: '', state: '' }
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
        mail: vendor.email || ''
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
  const freightTaxAmount = freightAmount * (getFreightTaxPercent() / 100);
  const grandTotal = (po.total_amount || 0) + freightAmount + freightTaxAmount;

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
      <section className="bg-white p-6 rounded-xl shadow-sm border border-black space-y-4">
        <div className="flex items-center justify-between border-b border-black pb-2">
          <h2 className="text-lg font-bold">PO Information</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <div className="flex justify-between items-end">
              <label className="block text-xs font-bold text-black uppercase">PO Number</label>
              <button 
                onClick={onGeneratePONo}
                className="text-[10px] font-bold text-black hover:underline flex items-center gap-1 mb-0.5"
                title="Generate next sequential number"
              >
                <RotateCcw className="w-2.5 h-2.5" /> RESET
              </button>
            </div>
            <input 
              type="text"
              className="mt-1 w-full border border-black rounded-lg px-3 py-2 text-black"
              value={po.po_no || ''}
              onChange={e => setPo({...po, po_no: e.target.value})}
              placeholder="e.g. HRM/2026-27/01"
            />
          </div>
          <div className="grid grid-cols-2 gap-4 col-span-2">
            <div>
              <label className="block text-xs font-bold text-black uppercase">Quotation Ref Type</label>
              <select 
                className="mt-1 w-full border border-black rounded-lg px-3 py-2 text-black bg-white"
                value={po.quote_ref_type || 'MAIL'}
                onChange={e => setPo({...po, quote_ref_type: e.target.value})}
              >
                <option value="MAIL">MAIL</option>
                <option value="WHATSAPP">WHATSAPP</option>
                <option value="VERBAL">VERBAL</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-black uppercase">Ref Doc No (Comparison)</label>
              <div className="flex gap-2">
                <select 
                  className="mt-1 w-1/2 border border-black rounded-lg px-2 py-2 bg-white text-xs text-black"
                  onChange={e => {
                    if (e.target.value !== 'CUSTOM') {
                      setPo({...po, quote_doc_no: e.target.value});
                    }
                  }}
                  value={comparisons.some(c => c.doc_no === po.quote_doc_no) ? po.quote_doc_no : (po.quote_doc_no ? 'CUSTOM' : '')}
                >
                  <option value="">-- Select Doc No --</option>
                  {comparisons.map(c => <option key={c.id} value={c.doc_no}>{c.doc_no}</option>)}
                  <option value="CUSTOM">Custom...</option>
                </select>
                <input 
                  type="text"
                  className="mt-1 flex-1 border border-black rounded-lg px-3 py-2 text-black text-xs"
                  value={po.quote_doc_no || ''}
                  onChange={e => setPo({...po, quote_doc_no: e.target.value})}
                  placeholder="Ref Doc No"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-black uppercase">Quotation Date</label>
              <input 
                type="date"
                className="mt-1 w-full border border-black rounded-lg px-3 py-2 text-black"
                value={po.quote_date || ''}
                onChange={e => setPo({...po, quote_date: e.target.value})}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Vendor Details */}
      <section className="bg-white p-6 rounded-xl shadow-sm border border-black space-y-4">
        <h2 className="text-lg font-bold border-b border-black pb-2">Vendor Details</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-black uppercase">Select Vendor</label>
              <select 
                className="mt-1 w-full border border-black rounded-lg px-3 py-2 text-black bg-white"
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
              <label className="block text-xs font-bold text-black uppercase">Vendor Name</label>
              <input 
                type="text"
                className="mt-1 w-full border border-black rounded-lg px-3 py-2 text-black"
                value={po.vendor_name || ''}
                onChange={e => setPo({...po, vendor_name: e.target.value})}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="col-span-2">
                <label className="block text-xs font-bold text-black uppercase">Address</label>
                <textarea 
                  className="mt-1 w-full border border-black rounded-lg px-3 py-2 text-black"
                  rows={2}
                  value={po.vendor_details.address || ''}
                  onChange={e => updateVendorField('address', e.target.value)}
                />
             </div>
             <div>
                <label className="block text-xs font-bold text-black uppercase">GSTIN</label>
                <input 
                  type="text"
                  className="mt-1 w-full border border-black rounded-lg px-3 py-2 text-black"
                  value={po.vendor_details.gstin || ''}
                  onChange={e => updateVendorField('gstin', e.target.value)}
                />
             </div>
             <div>
                <label className="block text-xs font-bold text-black uppercase">State</label>
                <input 
                  type="text"
                  className="mt-1 w-full border border-black rounded-lg px-3 py-2 text-black"
                  value={po.vendor_details.state || ''}
                  onChange={e => updateVendorField('state', e.target.value)}
                />
             </div>
             <div>
                <label className="block text-xs font-bold text-black uppercase">Mail ID</label>
                <input 
                  type="email"
                  className="mt-1 w-full border border-black rounded-lg px-3 py-2 text-black"
                  value={po.vendor_details.mail || ''}
                  onChange={e => updateVendorField('mail', e.target.value)}
                />
             </div>
             <div>
                <label className="block text-xs font-bold text-black uppercase">Ph</label>
                <input 
                  type="text"
                  className="mt-1 w-full border border-black rounded-lg px-3 py-2 text-black"
                  value={po.vendor_details.ph || ''}
                  onChange={e => updateVendorField('ph', e.target.value)}
                />
             </div>
          </div>
        </div>
      </section>

      {/* Items */}
      <section className="bg-white p-6 rounded-xl shadow-sm border border-black space-y-4">
        <div className="flex items-center justify-between border-b border-black pb-2">
          <h2 className="text-lg font-bold">Items</h2>
          <div className="flex gap-2">
             <button 
               onClick={() => setShowBulkPaste(!showBulkPaste)}
               className="flex items-center gap-1 text-sm border border-black text-black px-3 py-1 rounded-lg hover:bg-black/5"
             >
               <ClipboardPaste className="w-4 h-4" /> Bulk Paste
             </button>
             <button 
               onClick={addItem}
               className="flex items-center gap-1 text-sm bg-black text-white px-3 py-1 rounded-lg hover:bg-black/90"
             >
               <Plus className="w-4 h-4" /> Add Item
             </button>
          </div>
        </div>

        {showBulkPaste && (
          <div className="p-4 bg-gray-50 border border-black rounded-lg space-y-3">
             <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase">Paste Spreadsheet Data</h3>
                <p className="text-[10px] text-gray-500 italic">Example: "Item Description, Brand, 10 PCS, 500.00"</p>
             </div>
             <textarea 
               className="w-full border border-black rounded-lg px-3 py-2 text-sm bg-white"
               rows={4}
               placeholder="Paste items from Excel or Sheets here..."
               value={bulkText}
               onChange={e => setBulkText(e.target.value)}
             />
             <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setShowBulkPaste(false)}
                  className="text-xs font-bold px-3 py-1"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleBulkExtract}
                  disabled={isExtracting || !bulkText.trim()}
                  className="flex items-center gap-2 bg-black text-white text-xs font-bold px-4 py-1.5 rounded-lg disabled:opacity-50"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing with Groq...
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
            <div key={index} className="p-4 bg-white rounded-lg border border-black relative group">
              <button 
                onClick={() => removeItem(index)}
                className="absolute -top-2 -right-2 bg-black text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg border border-white"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6">
                  <label className="block text-[10px] font-bold text-black uppercase">Item Name / Description</label>
                  <input 
                    type="text"
                    className="w-full border border-black rounded px-2 py-1 text-sm text-black"
                    value={item.itemName || ''}
                    onChange={e => updateItem(index, 'itemName', e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-black uppercase">Make</label>
                  <input 
                    type="text"
                    className="w-full border border-black rounded px-2 py-1 text-sm text-black"
                    value={item.make || ''}
                    onChange={e => updateItem(index, 'make', e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-black uppercase">Qty</label>
                  <input 
                    type="number"
                    className="w-full border border-black rounded px-2 py-1 text-sm text-black"
                    value={item.qty || 0}
                    onChange={e => updateItem(index, 'qty', e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-black uppercase">UOM</label>
                  <select 
                    className="w-full border border-black rounded px-1 py-1 text-sm bg-white text-black"
                    value={item.uom || 'NOS'}
                    onChange={e => updateItem(index, 'uom', e.target.value)}
                  >
                    <option value="FT">FT</option>
                    <option value="KG">KG</option>
                    <option value="Mtr">Mtr</option>
                    <option value="PCS">PCS</option>
                    <option value="NOS">NOS</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-black uppercase">Rate</label>
                  <input 
                    type="number"
                    className="w-full border border-black rounded px-2 py-1 text-sm text-black"
                    value={item.rate || 0}
                    onChange={e => updateItem(index, 'rate', e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-black uppercase">Dis%</label>
                  <input 
                    type="number"
                    step="0.001"
                    className="w-full border border-black rounded px-2 py-1 text-sm text-black"
                    value={item.discount || 0}
                    onChange={e => updateItem(index, 'discount', e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-black uppercase">Tax</label>
                  <select 
                    className="w-full border border-black rounded px-1 py-1 text-sm bg-white text-black"
                    value={item.tax || 'GST @18%'}
                    onChange={e => updateItem(index, 'tax', e.target.value)}
                  >
                    <option value="GST @18%">18%</option>
                    <option value="GST @5%">5%</option>
                    <option value="Nil">Nil</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-black uppercase">Amount</label>
                  <input 
                    type="number"
                    className="w-full border border-black rounded px-2 py-1 text-sm text-black font-bold"
                    value={item.amount || 0}
                    readOnly
                  />
                </div>
              </div>
            </div>
          ))}
          {po.items.length === 0 && !showBulkPaste && <div className="text-center py-4 text-black text-sm">No items added.</div>}
          {po.items.length > 0 && (
            <div className="flex justify-end pt-2">
               <div className="text-right">
                  <p className="text-xs font-bold text-black uppercase">Total Item Amount</p>
                  <p className="text-lg font-black text-black">₹{po.total_amount.toLocaleString()}</p>
               </div>
            </div>
          )}
        </div>
      </section>

      {/* Commercial Terms */}
      <section className="bg-white p-6 rounded-xl shadow-sm border border-black space-y-4">
        <div className="flex items-center justify-between border-b border-black pb-2">
          <h2 className="text-lg font-bold">Commercial Terms</h2>
          <div className="relative">
             <select 
               className="text-sm bg-white border border-black rounded-lg px-3 py-1 outline-none text-black"
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
            <label className="block text-xs font-bold text-black uppercase">Tax (Summary)</label>
            <select 
              className="mt-1 w-full border border-black rounded-lg px-3 py-2 bg-white text-black"
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
            <label className="block text-xs font-bold text-black uppercase">Packing</label>
            <div className="flex gap-2">
              <select 
                className="mt-1 w-1/3 border border-black rounded-lg px-2 py-2 bg-white text-xs text-black"
                onChange={e => {
                  if (e.target.value !== 'CUSTOM') {
                    setPo({...po, terms: { ...po.terms, packing: e.target.value }});
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>Select Option</option>
                <option value="Nil">Nil</option>
                <option value="Extra">Extra</option>
                <option value="CUSTOM">Custom...</option>
              </select>
              <input 
                type="text"
                className="mt-1 flex-1 border border-black rounded-lg px-3 py-2 text-black text-sm"
                value={po.terms.packing || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, packing: e.target.value }})}
                placeholder="e.g. Nil, Extra"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-black uppercase">Forwarding</label>
            <div className="flex gap-2">
              <select 
                className="mt-1 w-1/3 border border-black rounded-lg px-2 py-2 bg-white text-xs text-black"
                onChange={e => {
                  if (e.target.value !== 'CUSTOM') {
                    setPo({...po, terms: { ...po.terms, notes: e.target.value || '' }});
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>Select Option</option>
                <option value="Nil">Nil</option>
                <option value="Extra">Extra</option>
                <option value="Free Upto Kolkata/Burdwan">Free Upto Kolkata/Burdwan</option>
                <option value="CUSTOM">Custom...</option>
              </select>
              <input 
                type="text"
                className="mt-1 flex-1 border border-black rounded-lg px-3 py-2 text-black text-sm"
                value={po.terms.notes || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, notes: e.target.value }})}
                placeholder="e.g. Free Upto Kolkata"
              />
            </div>
          </div>
          <div className="col-span-2">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-black uppercase">Payment Terms</label>
              <button 
                onClick={() => setPo(prev => ({ 
                  ...prev, 
                  terms: { ...prev.terms, payment_milestones: [...(prev.terms.payment_milestones || []), { percentage: 0, description: '' }] } 
                }))}
                className="text-[10px] font-bold bg-black text-white px-2 py-1 rounded hover:bg-black/80 flex items-center gap-1"
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
                  "AFTER SUCCESSFULLY COMMISSIONING",
                  "BEFORE SUCCESSFULLY COMMISSIONING"
                ];
                const isCustom = m.description && !standardOptions.includes(m.description);

                return (
                  <div key={idx} className="flex gap-2 items-center">
                    <div className="relative w-20">
                      <input 
                        type="number"
                        className="w-full border border-black rounded-lg px-2 py-1.5 text-sm text-black pr-6"
                        value={m.percentage || ''}
                        onChange={e => {
                          const newMilestones = [...(po.terms.payment_milestones || [])];
                          newMilestones[idx].percentage = parseFloat(e.target.value) || 0;
                          setPo({ ...po, terms: { ...po.terms, payment_milestones: newMilestones } });
                        }}
                        placeholder="0"
                      />
                      <span className="absolute right-2 top-2 text-xs font-bold">%</span>
                    </div>
                    <select 
                      className="w-1/3 border border-black rounded-lg px-2 py-1.5 bg-white text-xs text-black"
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
                      className="flex-1 border border-black rounded-lg px-3 py-1.5 text-sm text-black"
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
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded border border-transparent hover:border-red-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
              
              {po.terms.payment_milestones && po.terms.payment_milestones.length > 0 && (
                <div className="flex justify-end pr-10">
                  <div className={`text-[10px] font-black px-2 py-0.5 rounded ${
                    (po.terms.payment_milestones.reduce((sum, m) => sum + m.percentage, 0)) === 100 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                  }`}>
                    TOTAL: {po.terms.payment_milestones.reduce((sum, m) => sum + m.percentage, 0)}%
                  </div>
                </div>
              )}

              {(!po.terms.payment_milestones || po.terms.payment_milestones.length === 0) && (
                <div className="flex gap-2">
                  <select 
                    className="w-1/2 border border-black rounded-lg px-2 py-2 bg-white text-xs text-black"
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
                    className="flex-1 border border-black rounded-lg px-3 py-2 text-xs text-black"
                    value={po.terms.payment || ''}
                    onChange={e => setPo({...po, terms: { ...po.terms, payment: e.target.value }})}
                    placeholder="Simple payment term or use milestones"
                  />
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-black uppercase">Freight</label>
            <div className="flex gap-2">
              <select 
                className="mt-1 w-1/4 border border-black rounded-lg px-2 py-2 bg-white text-xs text-black"
                value={po.terms.freight || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, freight: e.target.value }})}
              >
                <option value="">Select</option>
                <option value="Extra">Extra</option>
                <option value="Including">Including</option>
                <option value="Nil">Nil</option>
              </select>
              <select 
                className="mt-1 w-1/4 border border-black rounded-lg px-2 py-2 bg-white text-xs text-black"
                value={po.terms.freight_tax || 'GST @18%'}
                onChange={e => updateFreightTax(e.target.value)}
              >
                <option value="GST @18%">18% GST</option>
                <option value="GST @5%">5% GST</option>
                <option value="Nil">Nil GST</option>
              </select>
              <input 
                type="number"
                className="mt-1 flex-1 border border-black rounded-lg px-3 py-2 text-black text-sm"
                value={po.terms.freight_amount || 0}
                onChange={e => updateFreightAmount(Number(e.target.value))}
                placeholder="Amount"
              />
            </div>
          </div>
          <div className="col-span-2">
            <div className="bg-black text-white p-4 rounded-lg flex justify-between items-center">
               <span className="font-bold uppercase text-sm">Grand Total Amount</span>
               <span className="text-2xl font-black">₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-black uppercase">Delivery Period</label>
            <div className="flex gap-2">
              <select 
                className="mt-1 w-1/3 border border-black rounded-lg px-3 py-2 bg-white text-black"
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
                className="mt-1 flex-1 border border-black rounded-lg px-3 py-2 text-black"
                value={po.terms.delivery || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, delivery: e.target.value }})}
                placeholder="Immediate or enter custom period"
              />
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-black uppercase">Contact No</label>
            <input 
              type="text"
              className="mt-1 w-full border border-black rounded-lg px-3 py-2 text-black"
              value={po.terms.contact_no || ''}
              onChange={e => setPo({...po, terms: { ...po.terms, contact_no: e.target.value }})}
              placeholder="e.g. +91 98765 43210"
            />
          </div>
          <div className="col-span-2">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-black uppercase underline decoration-2 underline-offset-4">Additional Notes</label>
              <button 
                onClick={() => setPo(prev => ({ ...prev, terms: { ...prev.terms, manual_notes: [...(prev.terms.manual_notes || []), ''] } }))}
                className="text-[10px] font-bold bg-black text-white px-2 py-1 rounded-md hover:bg-black/80 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> ADD NOTE
              </button>
            </div>
            <div className="space-y-3">
              {(po.terms.manual_notes || []).map((note, idx) => (
                <div key={idx} className="flex gap-2 group">
                  <div className="w-16 shrink-0 pt-2.5 text-[10px] font-black text-black opacity-40 uppercase">Note {idx + 3} ::</div>
                  <textarea 
                    className="flex-1 border border-black rounded-lg px-3 py-2 text-black text-sm min-h-[60px]"
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
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0 h-fit self-start"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {(!po.terms.manual_notes || po.terms.manual_notes.length === 0) && (
                <div className="text-[10px] text-gray-400 italic text-center py-2 border-2 border-dashed border-gray-200 rounded-lg">
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
