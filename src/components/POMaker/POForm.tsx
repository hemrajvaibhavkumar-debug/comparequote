import React from 'react';
import { PurchaseOrder, TermsTemplate, POItem, VendorMaster } from '../../types';
import { Plus, Trash2 } from 'lucide-react';

interface POFormProps {
  po: PurchaseOrder;
  setPo: React.Dispatch<React.SetStateAction<PurchaseOrder>>;
  templates: TermsTemplate[];
  vendors: VendorMaster[];
}

const POForm: React.FC<POFormProps> = ({ po, setPo, templates, vendors }) => {
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
    const newItem: POItem = {
      sn: po.items.length + 1,
      make: '',
      itemName: '',
      qty: 0,
      uom: 'NOS',
      rate: 0,
      discount: 0,
      tax: 'GST @18%',
      amount: 0
    };
    setPo(prev => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const removeItem = (index: number) => {
    setPo(prev => {
      const newItems = prev.items.filter((_, i) => i !== index).map((item, i) => ({ ...item, sn: i + 1 }));
      const total = newItems.reduce((acc, item) => acc + Number(item.amount), 0);
      return { ...prev, items: newItems, total_amount: total };
    });
  };

  const updateItem = (index: number, field: keyof POItem, value: any) => {
    setPo(prev => {
      const newItems = [...prev.items];
      const item = { ...newItems[index], [field]: value };
      
      // Calculate item amount
      const qty = parseFloat(String(item.qty)) || 0;
      const rate = parseFloat(String(item.rate)) || 0;
      const discount = parseFloat(String(item.discount)) || 0;
      const taxStr = String(item.tax);
      
      // Robust tax parsing: extracts any number before %
      const taxMatch = taxStr.match(/(\d+)%/);
      const taxPercent = taxMatch ? parseFloat(taxMatch[1]) : 0;

      const discountedRate = rate * (1 - discount / 100);
      const amountWithTax = (qty * discountedRate) * (1 + taxPercent / 100);
      item.amount = Number(amountWithTax.toFixed(2));
      
      newItems[index] = item;
      
      // Calculate total amount
      const total = newItems.reduce((acc, item) => acc + Number(item.amount), 0);
      return { ...prev, items: newItems, total_amount: Number(total.toFixed(2)) };
    });
  };

  const updateFreightAmount = (val: number) => {
    setPo(prev => ({
      ...prev,
      terms: { ...prev.terms, freight_amount: val }
    }));
  };

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
          <div>
            <label className="block text-xs font-bold text-black uppercase">PO Number</label>
            <input 
              type="text"
              className="mt-1 w-full border border-black rounded-lg px-3 py-2 text-black"
              value={po.po_no || ''}
              onChange={e => setPo({...po, po_no: e.target.value})}
              placeholder="e.g. HRM/2026-27/01"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-black uppercase">Date</label>
            <input 
              type="date"
              className="mt-1 w-full border border-black rounded-lg px-3 py-2 text-black"
              value={po.date || ''}
              onChange={e => setPo({...po, date: e.target.value})}
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
          <button 
            onClick={addItem}
            className="flex items-center gap-1 text-sm bg-black text-white px-3 py-1 rounded-lg hover:bg-black/90"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
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
          {po.items.length === 0 && <div className="text-center py-4 text-black text-sm">No items added.</div>}
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
          <div>
            <label className="block text-xs font-bold text-black uppercase">Payment Terms</label>
            <div className="flex gap-2">
              <select 
                className="mt-1 w-1/2 border border-black rounded-lg px-2 py-2 bg-white text-xs text-black"
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
                className="mt-1 flex-1 border border-black rounded-lg px-3 py-2 text-xs text-black"
                value={po.terms.payment || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, payment: e.target.value }})}
                placeholder="100% Against PI or custom"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-black uppercase">Freight</label>
            <div className="flex gap-2">
              <select 
                className="mt-1 w-1/2 border border-black rounded-lg px-3 py-2 bg-white text-black"
                value={po.terms.freight || ''}
                onChange={e => setPo({...po, terms: { ...po.terms, freight: e.target.value }})}
              >
                <option value="">Select Freight</option>
                <option value="Extra">Extra</option>
                <option value="Including">Including</option>
                <option value="Nil">Nil</option>
              </select>
              <input 
                type="number"
                className="mt-1 flex-1 border border-black rounded-lg px-3 py-2 text-black"
                value={po.terms.freight_amount || 0}
                onChange={e => updateFreightAmount(Number(e.target.value))}
                placeholder="Freight Amount"
              />
            </div>
          </div>
          <div className="col-span-2">
            <div className="bg-black text-white p-4 rounded-lg flex justify-between items-center">
               <span className="font-bold uppercase text-sm">Grand Total Amount</span>
               <span className="text-2xl font-black">₹{(po.total_amount + (po.terms.freight_amount || 0)).toLocaleString()}</span>
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
        </div>
      </section>
    </div>
  );
};

export default POForm;
