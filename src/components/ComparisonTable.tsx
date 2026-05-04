import React from 'react';
import { ComparisonData, HeaderInfo, Item, VendorQuote } from '../types';
import { Trash2, PlusCircle } from 'lucide-react';

interface ComparisonTableProps {
  data: ComparisonData;
  setData: React.Dispatch<React.SetStateAction<ComparisonData>>;
  header: HeaderInfo;
  setHeader?: React.Dispatch<React.SetStateAction<HeaderInfo>>;
  tableRef: React.RefObject<HTMLDivElement | null>;
  readOnly?: boolean;
}

export const ComparisonTable: React.FC<ComparisonTableProps> = ({ data, setData, header, setHeader, tableRef, readOnly = false }) => {
  const vendors = data?.vendors || [];
  const items = data?.items || [];
  const vendorCols = 5; // MAKE, MRP, DIS, NET RATE, TOTAL AMOUNT
  const hasWeight = items.some(item => item.weight !== undefined && item.weight !== null && item.weight !== '');

  const calculateVendorTotal = (vendorName: string) => {
    return items.reduce((sum, item) => {
      const quote = item.vendorQuotes?.find(q => q.vendorName === vendorName);
      return sum + (Number(quote?.totalAmount) || 0);
    }, 0);
  };

  const updateItem = (itemIndex: number, field: keyof Item, value: any) => {
    if (readOnly) return;
    setData((prev: any) => {
      const newItems = [...prev.items];
      const item = { ...newItems[itemIndex], [field]: value };
      
      // If quantity or weight changes, update all vendor total amounts
      if (field === 'qty' || field === 'weight') {
        const newQty = parseFloat(item.qty) || 0;
        const newWeight = parseFloat(item.weight) || 0;
        const multiplier = newWeight > 0 ? newWeight : newQty;

        if (item.vendorQuotes) {
          item.vendorQuotes = item.vendorQuotes.map((q: any) => ({
            ...q,
            totalAmount: (parseFloat(q.netRate) || 0) * multiplier
          }));
        }
      }
      
      newItems[itemIndex] = item;
      return { ...prev, items: newItems };
    });
  };

  const updateHeader = (field: keyof HeaderInfo, value: string) => {
    if (readOnly || !setHeader) return;
    setHeader(prev => ({ ...prev, [field]: value }));
  };

  const updatePreviousPrice = (itemIndex: number, field: 'rate' | 'date', value: any) => {
    if (readOnly) return;
    setData((prev: any) => {
      const newItems = [...prev.items];
      newItems[itemIndex] = {
        ...newItems[itemIndex],
        previousPrice: { ...(newItems[itemIndex].previousPrice || {}), [field]: value }
      };
      return { ...prev, items: newItems };
    });
  };

  const updateQuote = (itemIndex: number, vendorName: string, field: keyof VendorQuote, value: any) => {
    if (readOnly) return;
    setData((prev: any) => {
      const newItems = [...prev.items];
      const item = newItems[itemIndex];
      const quotes = [...(item.vendorQuotes || [])];
      const qIndex = quotes.findIndex((q: any) => q.vendorName === vendorName);
      
      let currentQuote = qIndex >= 0 ? { ...quotes[qIndex] } : {
        vendorName, make: '', mrp: 0, discount: 0, netRate: 0, totalAmount: 0,
        deliveryPeriod: '', readyStock: '', packingAndForwarding: '', freight: '', gstStatus: 'Exclusive', extra: ''
      } as any;

      currentQuote[field] = value;

      // Logic: If discount is not mentioned (0 or empty), netRate = MRP
      const disc = parseFloat(currentQuote.discount) || 0;
      const qty = parseFloat(item.qty) || 0;

      if (field === 'mrp') {
        const mrpVal = parseFloat(value) || 0;
        if (disc === 0) {
          currentQuote.netRate = mrpVal;
        } else {
          currentQuote.netRate = mrpVal * (1 - disc / 100);
        }
      } else if (field === 'discount') {
        const mrpVal = parseFloat(currentQuote.mrp) || 0;
        const discVal = parseFloat(value) || 0;
        currentQuote.netRate = mrpVal * (1 - discVal / 100);
      } else if (field === 'netRate') {
        const nrVal = parseFloat(value) || 0;
        if (disc === 0) {
          currentQuote.mrp = nrVal;
        }
      }

      // Always update totalAmount based on netRate and qty/weight
      const weightVal = parseFloat(item.weight) || 0;
      const multiplier = weightVal > 0 ? weightVal : qty;
      currentQuote.totalAmount = (parseFloat(currentQuote.netRate) || 0) * multiplier;

      if (qIndex >= 0) {
        quotes[qIndex] = currentQuote;
      } else {
        quotes.push(currentQuote);
      }
      
      newItems[itemIndex] = { ...newItems[itemIndex], vendorQuotes: quotes };
      return { ...prev, items: newItems };
    });
  };

  const removeItem = (itemIndex: number) => {
    if (readOnly) return;
    setData((prev: any) => {
      const newItems = [...prev.items];
      newItems.splice(itemIndex, 1);
      return { ...prev, items: newItems };
    });
  };

  const removeVendor = (vendorName: string) => {
    if (readOnly) return;
    if (!window.confirm(`Are you sure you want to remove vendor "${vendorName}" and all their quotes?`)) return;
    
    setData((prev: any) => {
      const newVendors = prev.vendors.filter((v: string) => v !== vendorName);
      const newItems = prev.items.map((item: any) => ({
        ...item,
        vendorQuotes: (item.vendorQuotes || []).filter((q: any) => q.vendorName !== vendorName)
      }));
      return { ...prev, vendors: newVendors, items: newItems };
    });
  };

  const addItem = () => {
    if (readOnly) return;
    setData((prev: any) => {
      const newItems = [...prev.items];
      newItems.push({
        indentNo: '', 
        siNo: '', 
        description: '', uom: '', qty: '',
        previousPrice: { rate: '', date: '' },
        vendorQuotes: prev.vendors.map((v: string) => ({
          vendorName: v, make: '', mrp: '', discount: '', netRate: '', totalAmount: '', deliveryPeriod: '', readyStock: '', packingAndForwarding: '', freight: '', gstStatus: 'Exclusive', extra: ''
        }))
      });
      return { ...prev, items: newItems };
    });
  };

  const addVendor = () => {
    if (readOnly) return;
    const vendorName = window.prompt("Enter new vendor name:");
    if (!vendorName) return;
    if (vendors.includes(vendorName)) {
      alert("Vendor already exists");
      return;
    }

    setData((prev: any) => ({
      ...prev,
      vendors: [...prev.vendors, vendorName],
      items: prev.items.map((item: any) => ({
        ...item,
        vendorQuotes: [
          ...(item.vendorQuotes || []),
          {
            vendorName,
            make: '',
            mrp: '',
            discount: '',
            netRate: '',
            totalAmount: '',
            deliveryPeriod: '',
            readyStock: '',
            packingAndForwarding: '',
            freight: '',
            gstStatus: 'Exclusive',
            extra: ''
          }
        ]
      }))
    }));
  };

  if (!items.length) {
    return (
      <div className="p-8 text-center text-[#000000] bg-[#ffffff] rounded-lg border-2 border-dashed">
        No data extracted yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-[#ffffff] shadow-xl rounded-lg">
      <div ref={tableRef} className="bg-[#ffffff] p-2">
        <table className="w-full border-collapse text-[10px] min-w-[1200px] text-[#000000]">
          <thead>
            {/* Header Info Rows */}
          <tr>
            <th colSpan={8 + vendors.length * vendorCols} className="text-left p-0 border border-[#000000] font-bold uppercase">
              <div className="flex items-center">
                <span className="pl-1 whitespace-nowrap">DOC NO. -</span>
                <input type="text" value={header.docNo} onChange={e => updateHeader('docNo', e.target.value)} className="w-full p-1 bg-transparent focus:outline-none font-bold uppercase" readOnly={readOnly} />
              </div>
            </th>
          </tr>
          <tr>
            <th colSpan={8 + vendors.length * vendorCols} className="text-left p-0 border border-[#000000] font-bold uppercase">
              <div className="flex items-center">
                <span className="pl-1 whitespace-nowrap">PREPARED BY -</span>
                <input type="text" value={header.preparedBy} onChange={e => updateHeader('preparedBy', e.target.value)} className="w-full p-1 bg-transparent focus:outline-none font-bold uppercase" readOnly={readOnly} />
              </div>
            </th>
          </tr>
          <tr>
            <th colSpan={8 + vendors.length * vendorCols} className="text-left p-0 border border-[#000000] font-bold uppercase">
              <div className="flex items-center">
                <span className="pl-1 whitespace-nowrap">DATE -</span>
                <input type="text" value={header.date} onChange={e => updateHeader('date', e.target.value)} className="w-full p-1 bg-transparent focus:outline-none font-bold uppercase" readOnly={readOnly} />
              </div>
            </th>
          </tr>
          <tr>
            <th colSpan={8 + vendors.length * vendorCols} className="text-left p-0 border border-[#000000] font-bold uppercase">
              <div className="flex items-center">
                <span className="pl-1 whitespace-nowrap">INDENT DATE -</span>
                <input type="text" value={header.indentDate} onChange={e => updateHeader('indentDate', e.target.value)} className="w-full p-1 bg-transparent focus:outline-none font-bold uppercase" readOnly={readOnly} />
              </div>
            </th>
          </tr>
          <tr>
            <th colSpan={hasWeight ? 8 : 7} className="text-left p-0 border border-[#000000] font-bold uppercase">
              <div className="flex items-center">
                <span className="pl-1 whitespace-nowrap">PLANT NAME -</span>
                <input type="text" value={header.plantName} onChange={e => updateHeader('plantName', e.target.value)} className="w-full p-1 bg-transparent focus:outline-none font-bold uppercase" readOnly={readOnly} />
              </div>
            </th>
            {vendors.map((v, i) => (
               <th key={i} colSpan={vendorCols} className="text-center p-1 border border-[#000000] bg-[#ffffff] font-bold uppercase">
                 BY {v}
               </th>
            ))}
            <th className="print-hidden w-10 border-[#000000] border bg-[#ffffff]">
              {!readOnly && (
                <button onClick={addVendor} className="p-1 hover:text-indigo-600 text-[#000000] cursor-pointer" title="Add Vendor">
                  <PlusCircle className="w-4 h-4 mx-auto" />
                </button>
              )}
            </th>
          </tr>
          
          {/* Main Table Headers */}
          <tr className="bg-[#ffffff] border-y border-[#ffffff]">
            <th rowSpan={2} className="border border-[#000000] p-1 font-bold whitespace-nowrap">
              <div style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}>INDENT NO.</div>
            </th>
            <th rowSpan={2} className="border border-[#000000] p-1 font-bold whitespace-nowrap">
              <div style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}>SI NO.</div>
            </th>
            <th rowSpan={2} className="border border-[#000000] p-1 w-80 text-left font-bold">ITEM DESCRIPTION</th>
            <th rowSpan={2} className="border border-[#000000] p-1 whitespace-nowrap">UOM</th>
            <th rowSpan={2} className="border border-[#000000] p-1 whitespace-nowrap">QTY</th>
            {hasWeight && <th rowSpan={2} className="border border-[#000000] p-1 whitespace-nowrap">WT</th>}
            <th colSpan={2} className="border border-[#000000] p-1 whitespace-nowrap">PREVIOUS PRICE</th>
            {vendors.map((v, i) => (
              <th key={i} colSpan={vendorCols} className="border border-[#000000] p-1 text-base font-black uppercase tracking-widest bg-[#ffffff] whitespace-nowrap">
                <div className="flex items-center justify-center gap-2">
                  {v}
                  {!readOnly && (
                    <button onClick={() => removeVendor(v)} className="print-hidden p-1 hover:text-red-600 text-[#000000] cursor-pointer" title={`Remove ${v}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </th>
            ))}
            <th className="print-hidden border border-[#000000] p-1 uppercase text-[10px] w-10 whitespace-nowrap">Act</th>
          </tr>
          <tr className="bg-[#ffffff]">
            <th className="border border-[#000000] p-1 whitespace-nowrap">RATE</th>
            <th className="border border-[#000000] p-1 whitespace-nowrap">DATE</th>
            {vendors.map((_, i) => (
              <React.Fragment key={i}>
                <th className="border border-[#000000] p-1 whitespace-nowrap">MAKE</th>
                <th className="border border-[#000000] p-1 whitespace-nowrap">MRP</th>
                <th className="border border-[#000000] p-1 whitespace-nowrap">DIS</th>
                <th className="border border-[#000000] p-1 whitespace-nowrap">NET RATE</th>
                <th className="border border-[#000000] p-1 whitespace-nowrap">TOTAL AMOUNT</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, idx: number) => (
            <tr key={idx} className="hover:bg-[#ffffff]" style={{ height: '30px' }}>
              <td className="border border-[#000000] p-0 bg-[#ffffff] whitespace-nowrap"><input type="text" value={item.indentNo || ''} onChange={e => updateItem(idx, 'indentNo', e.target.value)} className="w-full text-center p-1 font-bold bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
              <td className="border border-[#000000] p-0 bg-[#ffffff] whitespace-nowrap"><input type="text" value={item.siNo || ''} onChange={e => updateItem(idx, 'siNo', e.target.value)} className="w-full text-center p-1 bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
              <td className="border border-[#000000] p-0 bg-[#ffffff]"><input type="text" value={item.description || ''} onChange={e => updateItem(idx, 'description', e.target.value)} className="w-full text-left p-1 font-medium bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
              <td className="border border-[#000000] p-0 bg-[#ffffff] whitespace-nowrap"><input type="text" value={item.uom || ''} onChange={e => updateItem(idx, 'uom', e.target.value)} className="w-full text-center p-1 uppercase bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
              <td className="border border-[#000000] p-0 bg-[#ffffff] whitespace-nowrap"><input type="text" value={item.qty || ''} onChange={e => updateItem(idx, 'qty', e.target.value)} className="w-full text-center p-1 font-bold bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
              {hasWeight && <td className="border border-[#000000] p-0 bg-[#ffffff] whitespace-nowrap"><input type="text" value={item.weight || ''} onChange={e => updateItem(idx, 'weight', e.target.value)} className="w-full text-center p-1 font-bold bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>}
              <td className="border border-[#000000] p-0 bg-[#ffffff] whitespace-nowrap"><input type="text" value={item.previousPrice?.rate || ''} onChange={e => updatePreviousPrice(idx, 'rate', e.target.value)} className="w-full text-center p-1 bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
              <td className="border border-[#000000] p-0 bg-[#ffffff] whitespace-nowrap"><input type="text" value={item.previousPrice?.date || ''} onChange={e => updatePreviousPrice(idx, 'date', e.target.value)} className="w-full text-center p-1 text-[8px] bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
              {vendors.map((v: string, vIdx: number) => {
                const quote = item.vendorQuotes?.find((q: any) => q.vendorName === v);
                return (
                  <React.Fragment key={vIdx}>
                    <td className="border border-[#000000] p-0 bg-[#ffffff] whitespace-nowrap"><input type="text" value={quote?.make || ''} onChange={e => updateQuote(idx, v, 'make', e.target.value)} className="w-full text-center p-1 italic text-[9px] bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
                    <td className="border border-[#000000] p-0 bg-[#ffffff] whitespace-nowrap"><input type="text" value={quote?.mrp || ''} onChange={e => updateQuote(idx, v, 'mrp', e.target.value)} className="w-full text-center p-1 font-bold bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
                    <td className="border border-[#000000] p-0 bg-[#ffffff] whitespace-nowrap"><input type="text" value={quote?.discount || ''} onChange={e => updateQuote(idx, v, 'discount', e.target.value)} className="w-full text-center p-1 bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
                    <td className="border border-[#000000] p-0 bg-[#ffffff] whitespace-nowrap"><input type="text" value={quote?.netRate || ''} onChange={e => updateQuote(idx, v, 'netRate', e.target.value)} className="w-full text-center p-1 font-bold bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
                    <td className="border border-[#000000] p-0 bg-[#ffffff] whitespace-nowrap"><input type="text" value={quote?.totalAmount || ''} onChange={e => updateQuote(idx, v, 'totalAmount', e.target.value)} className="w-full text-center p-1 font-bold bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
                  </React.Fragment>
                )
              })}
              <td className="print-hidden border border-[#000000] p-0 text-center">
                {!readOnly && (
                  <button onClick={() => removeItem(idx)} className="p-1 hover:text-[#000000] text-[#000000] cursor-pointer" title="Remove Row">
                    <Trash2 className="w-4 h-4 mx-auto" />
                  </button>
                )}
              </td>
            </tr>
          ))}

          {/* Add Row Button */}
          {!readOnly && (
            <tr className="bg-[#ffffff] hover:bg-[#ffffff] transition-colors print-hidden">
              <td colSpan={8 + vendors.length * vendorCols} className="border border-[#000000] p-0 text-center">
                <button onClick={addItem} className="w-full h-full py-2 flex items-center justify-center gap-2 text-[#000000] hover:text-[#000000] font-bold text-xs uppercase cursor-pointer">
                  <PlusCircle className="w-4 h-4" /> Add Row
                </button>
              </td>
            </tr>
          )}

          {/* Totals */}
          <tr className="bg-[#ffffff]">
             <td colSpan={hasWeight ? 8 : 7} className="border border-[#000000]"></td>
             {vendors.map((v, i) => (
               <React.Fragment key={i}>
                 <td colSpan={4} className="border border-[#000000] text-right p-1 font-bold uppercase tracking-tighter">TOTAL</td>
                 <td className="border border-[#000000] text-center p-1 font-black bg-[#ffffff]">{calculateVendorTotal(v).toFixed(2)}</td>
               </React.Fragment>
             ))}
             <td className="print-hidden border-[#000000] border"></td>
          </tr>
          
          {/* GST */}
          <tr>
             <td colSpan={hasWeight ? 8 : 7} className="border border-[#000000]"></td>
             {vendors.map((v, i) => {
               const total = calculateVendorTotal(v);
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               const isInclusive = firstQuote?.gstStatus?.toLowerCase() === 'inclusive';
               const gst = isInclusive ? 0 : total * 0.18;
               return (
                <React.Fragment key={i}>
                  <td colSpan={4} className="border border-[#000000] text-right p-1 font-bold uppercase tracking-tighter">
                    {isInclusive ? 'GST STATUS' : 'GST 18% EXTRA'}
                  </td>
                  <td className="border border-[#000000] text-center p-1 font-black bg-slate-50">
                    {isInclusive ? 'INCLUSIVE' : gst.toFixed(2)}
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-[#000000] border"></td>
          </tr>

          {/* Grand Total */}
          <tr className="bg-[#ffffff]">
             <td colSpan={hasWeight ? 8 : 7} className="border border-[#000000]"></td>
             {vendors.map((v, i) => {
               const total = calculateVendorTotal(v);
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               const isInclusive = firstQuote?.gstStatus?.toLowerCase() === 'inclusive';
               const grandTotal = isInclusive ? total : total * 1.18;
               return (
                <React.Fragment key={i}>
                  <td colSpan={4} className="border border-[#000000] text-right p-1 font-black uppercase tracking-tighter">GRAND TOTAL</td>
                  <td className="border border-[#000000] text-center p-1 font-black bg-[#ffffff]">{grandTotal.toFixed(2)}</td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-[#000000] border"></td>
          </tr>

          {/* Terms and Conditions */}
          <tr className="bg-[#ffffff]">
             <td colSpan={hasWeight ? 8 : 7} className="border border-[#000000]"></td>
             {vendors.map((v, i) => (
                <td key={i} colSpan={vendorCols} className="border border-[#000000] text-center p-1 font-black uppercase bg-slate-50">TERMS & CONDITION</td>
             ))}
             <td className="print-hidden border-[#000000] border"></td>
          </tr>
          
          {/* Detailed Terms */}
          <tr>
             <td colSpan={hasWeight ? 8 : 7} className="border border-[#000000]"></td>
             {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={2} className="border border-[#000000] p-1 italic text-center font-bold uppercase text-[8px]">DELIVERY PERIOD</td>
                  <td colSpan={3} className="border border-[#000000] p-0">
                    <input type="text" value={firstQuote?.deliveryPeriod || ''} onChange={e => updateQuote(0, v, 'deliveryPeriod', e.target.value)} className="w-full text-center p-1 font-bold uppercase bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" placeholder="E.G. 2 WEEKS" readOnly={readOnly}/>
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-[#000000] border"></td>
          </tr>
          <tr>
             <td colSpan={hasWeight ? 8 : 7} className="border border-[#000000]"></td>
             {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={2} className="border border-[#000000] p-1 italic text-center font-bold uppercase text-[8px]">FREIGHT</td>
                  <td colSpan={3} className="border border-[#000000] p-0">
                    <input type="text" value={firstQuote?.freight || ''} onChange={e => updateQuote(0, v, 'freight', e.target.value)} className="w-full text-center p-1 font-bold uppercase bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" placeholder="E.G. AT ACTUALS" readOnly={readOnly}/>
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-[#000000] border"></td>
          </tr>
          <tr>
             <td colSpan={hasWeight ? 8 : 7} className="border border-[#000000]"></td>
             {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={2} className="border border-[#000000] p-1 italic text-center font-bold uppercase text-[8px]">PACKING & FORWARDING</td>
                  <td colSpan={3} className="border border-[#000000] p-0">
                    <input type="text" value={firstQuote?.packingAndForwarding || ''} onChange={e => updateQuote(0, v, 'packingAndForwarding', e.target.value)} className="w-full text-center p-1 font-bold uppercase bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" placeholder="INCLUDED/EXTRA" readOnly={readOnly}/>
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-[#000000] border"></td>
          </tr>
          <tr>
             <td colSpan={hasWeight ? 8 : 7} className="border border-[#000000]"></td>
             {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={2} className="border border-[#000000] p-1 italic text-center font-bold uppercase text-[8px]">READY STOCK</td>
                  <td colSpan={3} className="border border-[#000000] p-0">
                    <input type="text" value={firstQuote?.readyStock || ''} onChange={e => updateQuote(0, v, 'readyStock', e.target.value)} className="w-full text-center p-1 font-bold uppercase bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" placeholder="YES/NO" readOnly={readOnly}/>
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-[#000000] border"></td>
          </tr>
          <tr>
             <td colSpan={hasWeight ? 8 : 7} className="border border-[#000000]"></td>
             {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={2} className="border border-[#000000] p-1 italic text-center font-bold uppercase text-[8px]">GST STATUS</td>
                  <td colSpan={3} className="border border-[#000000] p-0">
                    <select 
                      value={firstQuote?.gstStatus || 'Exclusive'} 
                      onChange={e => updateQuote(0, v, 'gstStatus', e.target.value)} 
                      className="w-full text-center p-1 font-bold uppercase bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none appearance-none cursor-pointer"
                      disabled={readOnly}
                    >
                      <option value="Exclusive">Exclusive</option>
                      <option value="Inclusive">Inclusive</option>
                    </select>
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-[#000000] border"></td>
          </tr>
          <tr>
             <td colSpan={hasWeight ? 8 : 7} className="border border-[#000000]"></td>
             {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={2} className="border border-[#000000] p-1 italic text-center font-bold uppercase text-[8px]">OTHER EXTRA</td>
                  <td colSpan={3} className="border border-[#000000] p-0">
                    <input type="text" value={firstQuote?.extra || ''} onChange={e => updateQuote(0, v, 'extra', e.target.value)} className="w-full text-center p-1 font-bold uppercase bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" placeholder="N/A" readOnly={readOnly}/>
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-[#000000] border"></td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  );
};
