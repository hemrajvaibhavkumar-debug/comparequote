import React, { useEffect, useRef } from 'react';
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

const AutoExpandingTextarea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  className?: string;
  readOnly?: boolean;
  rows?: number;
  placeholder?: string;
}> = ({ value, onChange, className, readOnly, rows = 1, placeholder }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${className} overflow-hidden resize-none`}
      readOnly={readOnly}
      rows={rows}
      placeholder={placeholder}
    />
  );
};

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

  const updateVendorName = (oldName: string, newName: string) => {
    if (readOnly || !newName || oldName === newName) return;
    setData((prev: any) => {
      const newVendors = prev.vendors.map((v: string) => v === oldName ? newName : v);
      const newItems = prev.items.map((item: any) => ({
        ...item,
        vendorQuotes: (item.vendorQuotes || []).map((q: any) => 
          q.vendorName === oldName ? { ...q, vendorName: newName } : q
        )
      }));
      return { ...prev, vendors: newVendors, items: newItems };
    });
  };

  const updateQuoteDate = (vendorName: string, newDate: string) => {
    if (readOnly) return;
    setData((prev: ComparisonData) => {
      const newItems = prev.items.map(item => ({
        ...item,
        vendorQuotes: item.vendorQuotes.map(q => 
          q.vendorName === vendorName ? { ...q, quoteDate: newDate } : q
        )
      }));
      return { ...prev, items: newItems };
    });
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
            totalAmount: ((parseFloat(q.netRate) || 0) * multiplier).toFixed(2)
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

  const updatePreviousPrice = (itemIndex: number, field: 'rate' | 'date' | 'vendor', value: any) => {
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
        vendorName, make: '', mrp: '', discount: '', netRate: '', totalAmount: '',
        deliveryPeriod: '', readyStock: '', packingAndForwarding: 'NILL', freight: 'NILL', gstStatus: '18% Extra', extra: ''
      } as any;

      currentQuote[field] = value;

      const disc = parseFloat(currentQuote.discount) || 0;
      const qty = parseFloat(item.qty) || 0;

      if (field === 'mrp') {
        const mrpVal = parseFloat(value) || 0;
        if (disc === 0) {
          currentQuote.netRate = value;
        } else {
          currentQuote.netRate = (mrpVal * (1 - disc / 100)).toFixed(2);
        }
      } else if (field === 'discount') {
        const mrpVal = parseFloat(currentQuote.mrp) || 0;
        const discVal = parseFloat(value) || 0;
        currentQuote.netRate = (mrpVal * (1 - discVal / 100)).toFixed(2);
      } else if (field === 'netRate') {
        const nrVal = parseFloat(value) || 0;
        if (disc === 0) {
          currentQuote.mrp = value;
        }
      }

      const weightVal = parseFloat(item.weight) || 0;
      const multiplier = weightVal > 0 ? weightVal : qty;
      currentQuote.totalAmount = ((parseFloat(currentQuote.netRate) || 0) * multiplier).toFixed(2);

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
        previousPrice: { vendor: '', rate: '', date: '' },
        vendorQuotes: prev.vendors.map((v: string) => ({
          vendorName: v, make: '', mrp: '', discount: '', netRate: '', totalAmount: '', deliveryPeriod: '', readyStock: '', packingAndForwarding: 'NILL', freight: 'NILL', gstStatus: '18% Extra', extra: '',
          quoteDate: new Date().toLocaleDateString('en-GB')
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
            packingAndForwarding: 'NILL',
            freight: 'NILL',
            gstStatus: '18% Extra',
            extra: '',
            quoteDate: new Date().toLocaleDateString('en-GB')
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

  const totalCols = (hasWeight ? 10 : 9) + vendors.length * vendorCols;

  return (
    <div className="overflow-x-auto bg-[#ffffff]">
      <div ref={tableRef} className="bg-[#ffffff] p-2">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;700&display=swap');
          
          .comp-table {
            font-family: 'Roboto Condensed', 'Arial Narrow', sans-serif !important;
            color: #000000 !important;
          }
          
          .vertical-text {
            writing-mode: vertical-lr;
            transform: rotate(180deg);
            white-space: nowrap;
            font-size: 9px;
            padding: 4px 0;
            line-height: 1;
            font-weight: 700;
          }

          @media print {
            .print-hidden { display: none !important; }
            body { 
              background: white !important; 
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .overflow-x-auto { overflow: visible !important; display: block !important; }
            table { 
              border-collapse: collapse !important; 
              width: 100% !important; 
              table-layout: auto !important;
              border: 1.5pt solid #000000 !important;
            }
            th, td { 
              border: 0.5pt solid #000000 !important; 
              padding: 1px !important;
            }
            textarea, input, select { 
              border: none !important;
              background: transparent !important;
              font-size: inherit !important;
              color: #000 !important;
              appearance: none !important;
            }
            .resize-x { resize: none !important; overflow: visible !important; }
            .resize-x::-webkit-resizer { display: none !important; visibility: hidden !important; }
            @page { 
              margin: 5mm; 
              size: landscape; 
            }
          }
        `}</style>
        <table className="comp-table w-full border-collapse text-[9px] min-w-[1000px] text-[#000000] table-auto border-2 border-[#000000]">
          <thead>
          <tr>
            <th colSpan={totalCols} className="text-left p-0 border border-[#000000] font-bold uppercase whitespace-nowrap bg-white">
              <div className="flex items-center">
                <span className="pl-1 flex-shrink-0">DOC NO. -</span>
                <input type="text" value={header.docNo} onChange={e => updateHeader('docNo', e.target.value)} className="w-full p-1 bg-transparent focus:outline-none font-bold uppercase" readOnly={readOnly} />
              </div>
            </th>
          </tr>
          <tr>
            <th colSpan={totalCols} className="text-left p-0 border border-[#000000] font-bold uppercase whitespace-nowrap bg-white">
              <div className="flex items-center">
                <span className="pl-1 flex-shrink-0">PREPARED BY -</span>
                <input type="text" value={header.preparedBy} onChange={e => updateHeader('preparedBy', e.target.value)} className="w-full p-1 bg-transparent focus:outline-none font-bold uppercase" readOnly={readOnly} />
              </div>
            </th>
          </tr>
          <tr>
            <th colSpan={totalCols} className="text-left p-0 border border-[#000000] font-bold uppercase whitespace-nowrap bg-white">
              <div className="flex items-center">
                <span className="pl-1 flex-shrink-0">DATE -</span>
                <input type="text" value={header.date} onChange={e => updateHeader('date', e.target.value)} className="w-full p-1 bg-transparent focus:outline-none font-bold uppercase" readOnly={readOnly} />
              </div>
            </th>
          </tr>
          <tr>
            <th colSpan={totalCols} className="text-left p-0 border border-[#000000] font-bold uppercase whitespace-nowrap bg-white">
              <div className="flex items-center">
                <span className="pl-1 flex-shrink-0">INDENT DATE -</span>
                <input type="text" value={header.indentDate} onChange={e => updateHeader('indentDate', e.target.value)} className="w-full p-1 bg-transparent focus:outline-none font-bold uppercase" readOnly={readOnly} />
              </div>
            </th>
          </tr>
          <tr>
            <th colSpan={hasWeight ? 9 : 8} className="text-left p-0 border border-[#000000] font-bold uppercase whitespace-nowrap bg-white">
              <div className="flex items-center">
                <span className="pl-1 flex-shrink-0">PLANT NAME -</span>
                <input type="text" value={header.plantName} onChange={e => updateHeader('plantName', e.target.value)} className="w-full p-1 bg-transparent focus:outline-none font-bold uppercase" readOnly={readOnly} />
              </div>
            </th>
            {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               const quoteDate = firstQuote?.quoteDate || new Date().toLocaleDateString('en-GB');
               return (
                <th key={i} colSpan={vendorCols} className="text-center p-0 border border-[#000000] bg-white font-bold uppercase">
                  <div className="flex items-center justify-center">
                     <span className="pl-1">BY</span>
                     <input 
                       type="text" 
                       value={quoteDate} 
                       onChange={e => updateQuoteDate(v, e.target.value)} 
                       className="w-full p-1 text-center bg-transparent focus:outline-none font-bold uppercase" 
                       readOnly={readOnly} 
                     />
                  </div>
                </th>
               );
            })}
            <th className="print-hidden w-8 border-[#000000] border bg-white">
              {!readOnly && (
                <button onClick={addVendor} className="p-1 hover:text-indigo-600 text-[#000000] cursor-pointer" title="Add Vendor">
                  <PlusCircle className="w-4 h-4 mx-auto" />
                </button>
              )}
            </th>
          </tr>
          
          <tr className="bg-white">
            <th rowSpan={2} className="border border-[#000000] p-1 font-bold min-w-[30px]"><div className="vertical-text">INDENT NO.</div></th>
            <th rowSpan={2} className="border border-[#000000] p-1 font-bold min-w-[30px]"><div className="vertical-text">SI NO.</div></th>
            <th rowSpan={2} className="border border-[#000000] p-0 text-left font-bold">
              <div className="p-1 min-w-[150px] w-64 resize-x overflow-hidden whitespace-nowrap">ITEM DESCRIPTION</div>
            </th>
            <th rowSpan={2} className="border border-[#000000] p-1 min-w-[30px]"><div className="vertical-text">UOM</div></th>
            <th rowSpan={2} className="border border-[#000000] p-1 min-w-[30px]"><div className="vertical-text">QTY</div></th>
            {hasWeight && <th rowSpan={2} className="border border-[#000000] p-1 min-w-[30px]"><div className="vertical-text">WT</div></th>}
            <th colSpan={3} className="border border-[#000000] p-1 bg-white">PREVIOUS PRICE</th>
            {vendors.map((v, i) => (
              <th key={i} colSpan={vendorCols} className="border border-[#000000] p-0 bg-white">
                <div className="flex items-center justify-center gap-1 group px-1 min-h-[30px] resize-x overflow-hidden">
                  <AutoExpandingTextarea 
                    value={v} 
                    onChange={val => updateVendorName(v, val)} 
                    className="w-full p-1 text-center bg-transparent focus:outline-none font-black uppercase leading-none" 
                    readOnly={readOnly} 
                    rows={2}
                  />
                  {!readOnly && (
                    <button onClick={() => removeVendor(v)} className="print-hidden p-0.5 opacity-0 group-hover:opacity-100 hover:text-red-600 text-[#000000] cursor-pointer transition-opacity flex-shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </th>
            ))}
            <th rowSpan={2} className="print-hidden border border-[#000000] p-1 uppercase text-[8px] w-8">Act</th>
          </tr>
          <tr className="bg-white">
            <th className="border border-[#000000] p-0">
              <div className="p-1 whitespace-nowrap min-w-[80px] resize-x overflow-hidden">VENDOR</div>
            </th>
            <th className="border border-[#000000] p-0">
              <div className="p-1 font-bold uppercase min-w-[38px] resize-x overflow-hidden"><div className="vertical-text">RATE</div></div>
            </th>
            <th className="border border-[#000000] p-0">
              <div className="p-1 font-bold uppercase min-w-[38px] resize-x overflow-hidden"><div className="vertical-text">DATE</div></div>
            </th>
            {vendors.map((_, i) => (
              <React.Fragment key={i}>
                <th className="border border-[#000000] p-1 font-bold uppercase min-w-[50px]">MAKE</th>
                <th className="border border-[#000000] p-1 font-bold uppercase min-w-[38px]"><div className="vertical-text">MRP</div></th>
                <th className="border border-[#000000] p-1 font-bold uppercase min-w-[32px]"><div className="vertical-text">DIS</div></th>
                <th className="border border-[#000000] p-1 font-bold uppercase min-w-[42px]"><div className="vertical-text">NET RATE</div></th>
                <th className="border border-[#000000] p-1 font-bold uppercase min-w-[50px]"><div className="vertical-text">TOTAL</div></th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, idx: number) => (
            <tr key={idx} className="hover:bg-[#ffffff]">
              <td className="border border-[#000000] p-0 bg-[#ffffff]"><input type="text" value={item.indentNo || ''} onChange={e => updateItem(idx, 'indentNo', e.target.value)} className="w-full text-center p-1 font-bold bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
              <td className="border border-[#000000] p-0 bg-[#ffffff]"><input type="text" value={item.siNo || ''} onChange={e => updateItem(idx, 'siNo', e.target.value)} className="w-full text-center p-1 bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
              <td className="border border-[#000000] p-0 bg-[#ffffff]">
                <AutoExpandingTextarea 
                  value={item.description || ''} 
                  onChange={val => updateItem(idx, 'description', val)} 
                  className="w-full text-left p-1 font-medium bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" 
                  readOnly={readOnly} 
                  rows={1} 
                />
              </td>
              <td className="border border-[#000000] p-0 bg-[#ffffff]"><input type="text" value={item.uom || ''} onChange={e => updateItem(idx, 'uom', e.target.value)} className="w-full text-center p-1 uppercase bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
              <td className="border border-[#000000] p-0 bg-[#ffffff]"><input type="text" value={item.qty || ''} onChange={e => updateItem(idx, 'qty', e.target.value)} className="w-full text-center p-1 font-bold bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
              {hasWeight && <td className="border border-[#000000] p-0 bg-[#ffffff]"><input type="text" value={item.weight || ''} onChange={e => updateItem(idx, 'weight', e.target.value)} className="w-full text-center p-1 font-bold bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>}
              <td className="border border-[#000000] p-0 bg-[#ffffff] whitespace-nowrap">
                <input 
                  type="text" 
                  value={item.previousPrice?.vendor || ''} 
                  onChange={e => updatePreviousPrice(idx, 'vendor', e.target.value)} 
                  style={{ width: `${Math.max((item.previousPrice?.vendor?.length || 0), 10)}ch` }}
                  className="text-center p-1 bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none min-w-full" 
                  readOnly={readOnly} 
                />
              </td>
              <td className="border border-[#000000] p-0 bg-[#ffffff]"><input type="text" value={item.previousPrice?.rate || ''} onChange={e => updatePreviousPrice(idx, 'rate', e.target.value)} className="w-full text-center p-1 bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
              <td className="border border-[#000000] p-0 bg-[#ffffff]"><input type="text" value={item.previousPrice?.date || ''} onChange={e => updatePreviousPrice(idx, 'date', e.target.value)} className="w-full text-center p-1 bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
              {vendors.map((v: string, vIdx: number) => {
                const quote = item.vendorQuotes?.find((q: any) => q.vendorName === v);
                return (
                  <React.Fragment key={vIdx}>
                    <td className="border border-[#000000] p-0 bg-[#ffffff]">
                      <AutoExpandingTextarea 
                        value={quote?.make || ''} 
                        onChange={val => updateQuote(idx, v, 'make', val)} 
                        className="w-full text-center p-1 italic bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" 
                        readOnly={readOnly} 
                        rows={1}
                      />
                    </td>
                    <td className="border border-[#000000] p-0 bg-[#ffffff]"><input type="text" value={quote?.mrp ?? ''} onChange={e => updateQuote(idx, v, 'mrp', e.target.value)} className="w-full text-center p-1 font-bold bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
                    <td className="border border-[#000000] p-0 bg-[#ffffff]"><input type="text" value={quote?.discount ?? ''} onChange={e => updateQuote(idx, v, 'discount', e.target.value)} className="w-full text-center p-1 bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
                    <td className="border border-[#000000] p-0 bg-[#ffffff]"><input type="text" value={quote?.netRate ?? ''} onChange={e => updateQuote(idx, v, 'netRate', e.target.value)} className="w-full text-center p-1 font-bold bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
                    <td className="border border-[#000000] p-0 bg-[#ffffff]"><input type="text" value={quote?.totalAmount ?? ''} onChange={e => updateQuote(idx, v, 'totalAmount', e.target.value)} className="w-full text-center p-1 font-bold bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none" readOnly={readOnly} /></td>
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

          {!readOnly && (
            <tr className="bg-[#ffffff] hover:bg-[#ffffff] transition-colors print-hidden">
              <td colSpan={totalCols} className="border border-[#000000] p-0 text-center">
                <button onClick={addItem} className="w-full h-full py-2 flex items-center justify-center gap-2 text-[#000000] hover:text-[#000000] font-bold text-xs uppercase cursor-pointer">
                  <PlusCircle className="w-4 h-4" /> Add Row
                </button>
              </td>
            </tr>
          )}

          <tr className="bg-[#ffffff]">
             <td colSpan={hasWeight ? 9 : 8} className="border border-[#000000]"></td>
             {vendors.map((v, i) => (
               <React.Fragment key={i}>
                 <td colSpan={4} className="border border-[#000000] text-right p-1 font-bold uppercase tracking-tighter">TOTAL</td>
                 <td className="border border-[#000000] text-center p-1 font-black bg-[#ffffff]">{calculateVendorTotal(v).toFixed(2)}</td>
               </React.Fragment>
             ))}
             <td className="print-hidden border-[#000000] border"></td>
          </tr>
          
          <tr>
             <td colSpan={hasWeight ? 9 : 8} className="border border-[#000000]"></td>
             {vendors.map((v, i) => {
               const total = calculateVendorTotal(v);
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               const status = firstQuote?.gstStatus || '18% Extra';
               const isInclusive = status.toLowerCase() === 'inclusive';
               let rate = 0;
               if (!isInclusive) {
                 if (status.includes('5%')) rate = 0.05;
                 else rate = 0.18;
               }
               const gst = total * rate;
               return (
                <React.Fragment key={i}>
                  <td colSpan={4} className="border border-[#000000] text-right p-1 font-bold uppercase tracking-tighter">
                    {isInclusive ? 'GST STATUS' : `GST ${Math.round(rate * 100)}% EXTRA`}
                  </td>
                  <td className="border border-[#000000] text-center p-1 font-black bg-slate-50">
                    {isInclusive ? 'INCLUSIVE' : gst.toFixed(2)}
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-[#000000] border"></td>
          </tr>

          <tr className="bg-[#ffffff]">
             <td colSpan={hasWeight ? 9 : 8} className="border border-[#000000]"></td>
             {vendors.map((v, i) => {
               const total = calculateVendorTotal(v);
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               const status = firstQuote?.gstStatus || '18% Extra';
               const isInclusive = status.toLowerCase() === 'inclusive';
               let rate = 0;
               if (!isInclusive) {
                 if (status.includes('5%')) rate = 0.05;
                 else rate = 0.18;
               }
               const grandTotal = total * (1 + rate);
               return (
                <React.Fragment key={i}>
                  <td colSpan={4} className="border border-[#000000] text-right p-1 font-black uppercase tracking-tighter">GRAND TOTAL</td>
                  <td className="border border-[#000000] text-center p-1 font-black bg-[#ffffff]">{grandTotal.toFixed(2)}</td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-[#000000] border"></td>
          </tr>

          <tr className="bg-[#ffffff]">
             <td colSpan={hasWeight ? 9 : 8} className="border border-[#000000]"></td>
             {vendors.map((v, i) => (
                <td key={i} colSpan={vendorCols} className="border border-[#000000] text-center p-1 font-black uppercase bg-slate-50">TERMS & CONDITION</td>
             ))}
             <td className="print-hidden border-[#000000] border"></td>
          </tr>
          
          <tr>
             <td colSpan={hasWeight ? 9 : 8} className="border border-[#000000]"></td>
             {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={2} className="border border-[#000000] p-1 italic text-center font-bold uppercase">DELIVERY PERIOD</td>
                  <td colSpan={3} className="border border-[#000000] p-0">
                    <AutoExpandingTextarea value={firstQuote?.deliveryPeriod || ''} onChange={val => updateQuote(0, v, 'deliveryPeriod', val)} className="w-full text-center p-1 font-bold bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none uppercase" readOnly={readOnly} rows={1}/>
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-[#000000] border"></td>
          </tr>
          <tr>
             <td colSpan={hasWeight ? 9 : 8} className="border border-[#000000]"></td>
             {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={2} className="border border-[#000000] p-1 italic text-center font-bold uppercase">FREIGHT</td>
                  <td colSpan={3} className="border border-[#000000] p-0">
                    <select 
                      value={firstQuote?.freight || 'NILL'} 
                      onChange={e => updateQuote(0, v, 'freight', e.target.value)} 
                      className="w-full text-center p-1 font-bold uppercase bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none appearance-none cursor-pointer"
                      disabled={readOnly}
                    >
                      <option value="NILL">NILL</option>
                      <option value="Extra">Extra</option>
                    </select>
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-[#000000] border"></td>
          </tr>
          <tr>
             <td colSpan={hasWeight ? 9 : 8} className="border border-[#000000]"></td>
             {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={2} className="border border-[#000000] p-1 italic text-center font-bold uppercase">PACKING & FORWARDING</td>
                  <td colSpan={3} className="border border-[#000000] p-0">
                    <select 
                      value={firstQuote?.packingAndForwarding || 'NILL'} 
                      onChange={e => updateQuote(0, v, 'packingAndForwarding', e.target.value)} 
                      className="w-full text-center p-1 font-bold uppercase bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none appearance-none cursor-pointer"
                      disabled={readOnly}
                    >
                      <option value="NILL">NILL</option>
                      <option value="Extra">Extra</option>
                    </select>
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-[#000000] border"></td>
          </tr>
          <tr>
             <td colSpan={hasWeight ? 9 : 8} className="border border-[#000000]"></td>
             {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={2} className="border border-[#000000] p-1 italic text-center font-bold uppercase">READY STOCK</td>
                  <td colSpan={3} className="border border-[#000000] p-0">
                    <AutoExpandingTextarea value={firstQuote?.readyStock || ''} onChange={val => updateQuote(0, v, 'readyStock', val)} className="w-full text-center p-1 font-bold bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none uppercase" readOnly={readOnly} rows={1}/>
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-[#000000] border"></td>
          </tr>
          <tr>
             <td colSpan={hasWeight ? 9 : 8} className="border border-[#000000]"></td>
             {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={2} className="border border-[#000000] p-1 italic text-center font-bold uppercase">GST STATUS</td>
                  <td colSpan={3} className="border border-[#000000] p-0">
                    <select 
                      value={firstQuote?.gstStatus || '18% Extra'} 
                      onChange={e => updateQuote(0, v, 'gstStatus', e.target.value)} 
                      className="w-full text-center p-1 font-bold uppercase bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none appearance-none cursor-pointer"
                      disabled={readOnly}
                    >
                      <option value="Exclusive">Exclusive (18%)</option>
                      <option value="18% Extra">18% Extra</option>
                      <option value="5% Extra">5% Extra</option>
                      <option value="Inclusive">Inclusive</option>
                    </select>
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-[#000000] border"></td>
          </tr>
          <tr>
             <td colSpan={hasWeight ? 9 : 8} className="border border-[#000000]"></td>
             {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={2} className="border border-[#000000] p-1 italic text-center font-bold uppercase">OTHER EXTRA</td>
                  <td colSpan={3} className="border border-[#000000] p-0">
                    <AutoExpandingTextarea value={firstQuote?.extra || ''} onChange={val => updateQuote(0, v, 'extra', val)} className="w-full text-center p-1 font-bold bg-[#ffffff] focus:bg-[#ffffff] focus:outline-none uppercase" readOnly={readOnly} rows={1}/>
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
