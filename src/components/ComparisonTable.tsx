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
  fontSize?: number;
}

const AutoExpandingTextarea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  className?: string;
  readOnly?: boolean;
  rows?: number;
  placeholder?: string;
  style?: React.CSSProperties;
}> = ({ value, onChange, className, readOnly, rows = 1, placeholder, style }) => {
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
      style={style}
    />
  );
};

export const ComparisonTable = React.memo<ComparisonTableProps>(({ data, setData, header, setHeader, tableRef, readOnly = false, fontSize = 11 }) => {
  const vendors = data?.vendors || [];
  const items = data?.items || [];
  const vendorCols = 5; // MAKE, MRP, DIS, NET RATE, TOTAL AMOUNT
  const hasWeight = items.some(item => item.weight !== undefined && item.weight !== null && item.weight !== '');

  const activeMouseMove = useRef<((e: MouseEvent) => void) | null>(null);
  const activeMouseUp = useRef<(() => void) | null>(null);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    const th = (e.target as HTMLElement).parentElement as HTMLTableHeaderCellElement;
    if (!th) return;
    
    const startX = e.pageX;
    const startWidth = th.offsetWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(startWidth + (moveEvent.pageX - startX), 20); // Min 20px
      th.style.width = `${newWidth}px`;
      th.style.minWidth = `${newWidth}px`;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      activeMouseMove.current = null;
      activeMouseUp.current = null;
    };

    activeMouseMove.current = onMouseMove;
    activeMouseUp.current = onMouseUp;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const startResizingHeight = (e: React.MouseEvent) => {
    e.preventDefault();
    const td = (e.target as HTMLElement).parentElement as HTMLTableCellElement;
    if (!td) return;
    const tr = td.parentElement as HTMLTableRowElement;
    if (!tr) return;
    
    const startY = e.pageY;
    const startHeight = tr.offsetHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newHeight = Math.max(startHeight + (moveEvent.pageY - startY), 20); // Min 20px
      tr.style.height = `${newHeight}px`;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      activeMouseMove.current = null;
      activeMouseUp.current = null;
    };

    activeMouseMove.current = onMouseMove;
    activeMouseUp.current = onMouseUp;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Cleanup on unmount to prevent ghost listeners
  useEffect(() => {
    return () => {
      if (activeMouseMove.current) {
        document.removeEventListener('mousemove', activeMouseMove.current);
      }
      if (activeMouseUp.current) {
        document.removeEventListener('mouseup', activeMouseUp.current);
      }
    };
  }, []);

  const calculateVendorTotal = (vendorName: string) => {
    return items.reduce((sum, item) => {
      const quote = item.vendorQuotes?.find(q => q.vendorName === vendorName);
      return sum + (Number(quote?.totalAmount) || 0);
    }, 0);
  };

  const calculateVendorTax = (vendorName: string) => {
    const firstQuote = items[0]?.vendorQuotes?.find(q => q.vendorName === vendorName);
    const status = firstQuote?.gstStatus || '18% Extra';
    const isInclusive = status.toLowerCase() === 'inclusive';
    
    if (isInclusive) return 0;
    
    let taxRate = 0;
    if (status.includes('5%')) taxRate = 0.05;
    else if (status.includes('12%')) taxRate = 0.12;
    else if (status.includes('18%') || status.toLowerCase() === 'exclusive') taxRate = 0.18;
    else if (status.includes('28%')) taxRate = 0.28;

    return items.reduce((sum, item) => {
      const quote = item.vendorQuotes?.find(q => q.vendorName === vendorName);
      if (!quote) return sum;
      const amount = Number(quote.totalAmount) || 0;
      return sum + (amount * taxRate);
    }, 0);
  };

  const calculateVendorGrandTotal = (vendorName: string) => {
    const firstQuote = items[0]?.vendorQuotes?.find(q => q.vendorName === vendorName);
    const freightAmt = parseFloat(firstQuote?.freightAmount as any) || 0;
    return calculateVendorTotal(vendorName) + calculateVendorTax(vendorName) + freightAmt;
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
        const multiplier = (prev.multiplyByWeight && newWeight > 0) ? newWeight : newQty;

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
        deliveryPeriod: '', readyStock: '', packingAndForwarding: 'NILL', freight: 'NILL', freightAmount: '', gstStatus: '18% Extra', extra: ''
      } as any;

      currentQuote[field] = value;

      const discVal = parseFloat(currentQuote.discount) || 0;
      const mrpVal = parseFloat(currentQuote.mrp) || 0;
      const nrVal = parseFloat(currentQuote.netRate) || 0;
      const qty = parseFloat(item.qty) || 0;

      if (field === 'mrp') {
        const newVal = parseFloat(value) || 0;
        if (discVal === 0) {
          currentQuote.netRate = value;
        } else {
          currentQuote.netRate = (newVal * (1 - discVal / 100)).toFixed(2);
        }
      } else if (field === 'discount') {
        const newVal = parseFloat(value) || 0;
        currentQuote.netRate = (mrpVal * (1 - newVal / 100)).toFixed(2);
      } else if (field === 'netRate') {
        const newVal = parseFloat(value) || 0;
        if (discVal === 0) {
          currentQuote.mrp = value;
        } else {
          // Calculate MRP from Net Rate and Discount: NetRate = MRP * (1 - Disc/100) => MRP = NetRate / (1 - Disc/100)
          // Avoid division by zero if discount is 100%
          currentQuote.mrp = discVal === 100 ? value : (newVal / (1 - discVal / 100)).toFixed(2);
        }
      }

      const weightVal = parseFloat(item.weight) || 0;
      const multiplier = (prev.multiplyByWeight && weightVal > 0) ? weightVal : qty;
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

  // Effect to recalculate all totals when multiplyByWeight changes
  useEffect(() => {
    setData((prev: any) => {
      const newItems = prev.items.map((item: any) => {
        const qty = parseFloat(item.qty) || 0;
        const weight = parseFloat(item.weight) || 0;
        const multiplier = (prev.multiplyByWeight && weight > 0) ? weight : qty;
        
        return {
          ...item,
          vendorQuotes: (item.vendorQuotes || []).map((q: any) => ({
            ...q,
            totalAmount: ((parseFloat(q.netRate) || 0) * multiplier).toFixed(2)
          }))
        };
      });
      return { ...prev, items: newItems };
    });
  }, [data.multiplyByWeight]);

  const removeItem = (itemIndex: number) => {
    if (readOnly) return;
    if (!window.confirm("Are you sure you want to delete this item row?")) return;
    setData((prev: any) => {
      const newItems = [...prev.items];
      const deletedItem = newItems[itemIndex];
      newItems.splice(itemIndex, 1);
      
      // Preserve commercial terms if the first item was deleted and there are items remaining
      if (itemIndex === 0 && newItems.length > 0 && deletedItem?.vendorQuotes) {
        newItems[0] = {
          ...newItems[0],
          vendorQuotes: (newItems[0].vendorQuotes || []).map((q: any) => {
            const oldQuote = deletedItem.vendorQuotes.find((oq: any) => oq.vendorName === q.vendorName);
            if (oldQuote) {
              return {
                ...q,
                deliveryPeriod: oldQuote.deliveryPeriod,
                readyStock: oldQuote.readyStock,
                packingAndForwarding: oldQuote.packingAndForwarding,
                freight: oldQuote.freight,
                gstStatus: oldQuote.gstStatus,
                extra: oldQuote.extra,
                quoteDate: oldQuote.quoteDate
              };
            }
            return q;
          })
        };
      }
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
        vendorName: v, make: '', mrp: '', discount: '', netRate: '', totalAmount: '', deliveryPeriod: '', readyStock: '', packingAndForwarding: 'NILL', freight: 'NILL', freightAmount: '', gstStatus: '18% Extra', extra: '',
        quoteDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
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
            quoteDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
          }
        ]
      }))
    }));
  };

  if (!items.length) {
    return (
      <div className="p-8 text-center text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-800">
        No data extracted yet.
      </div>
    );
  }

  const totalCols = (hasWeight ? 10 : 9) + vendors.length * vendorCols;

  // Calculate dynamic scale for print to fit A4 Landscape
  // Base width for ~2 vendors is 1.0 scale. Scale down as vendors increase.
  const getPrintScale = () => {
    if (vendors.length <= 2) return 1.0;
    if (vendors.length === 3) return 0.85;
    if (vendors.length === 4) return 0.7;
    return 0.6; // 5+ vendors
  };

  const printScale = getPrintScale();

  return (
    <div className="w-full overflow-x-auto bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <div 
        ref={tableRef} 
        className="bg-white dark:bg-slate-950 p-1 comp-table-container"
        style={{ 
          minWidth: '100%',
          width: 'max-content'
        }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;700&display=swap');
          
          .comp-table {
            font-family: 'Roboto Condensed', 'Arial Narrow', sans-serif !important;
            color: #000000 !important;
            border-collapse: collapse;
            width: 100%;
            table-layout: auto;
            border: 1px solid var(--border-main) !important;
          }

          .dark .comp-table {
            color: #f8fafc !important;
          }

          .comp-table th, .comp-table td {
            border: 1.2px solid var(--border-main) !important;
            vertical-align: top;
          }

          .comp-table tr:hover td {
            background-color: var(--color-zinc-100) !important;
          }

          .dark .comp-table tr:hover td {
            background-color: var(--color-zinc-900) !important;
          }
          
          .vertical-text {
            writing-mode: vertical-lr;
            transform: rotate(180deg);
            white-space: nowrap;
            font-size: ${Math.max(fontSize - 1.5, 7.5)}px;
            padding: 4px 0;
            line-height: 1.1;
            font-weight: 800;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
            letter-spacing: 0.05em;
          }

          .comp-table input, .comp-table textarea, .comp-table select {
            font-family: inherit;
            font-size: inherit;
            color: inherit;
            background: transparent;
            border: none;
            width: 100%;
            padding: 4px 6px;
            outline: none;
            transition: all 0.15s ease-in-out;
            vertical-align: top;
          }

          .comp-table input:focus, .comp-table textarea:focus, .comp-table select:focus {
            background-color: rgba(14, 165, 233, 0.04) !important;
            outline: 1.5px solid #0ea5e9 !important;
            outline-offset: -1.5px;
          }

          .dark .comp-table input:focus, .dark .comp-table textarea:focus, .dark .comp-table select:focus {
            background-color: rgba(14, 165, 233, 0.08) !important;
            outline: 1.5px solid #38bdf8 !important;
            outline-offset: -1.5px;
          }

          .comp-table th {
            position: relative;
          }

          .resizer {
            position: absolute;
            right: 0;
            top: 0;
            bottom: 0;
            width: 4px;
            cursor: col-resize;
            z-index: 10;
            transition: background-color 0.2s;
          }

          .resizer:hover {
            background-color: #000000;
          }

          .dark .resizer:hover {
            background-color: #ffffff;
          }

          .resizer-h {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 4px;
            cursor: row-resize;
            z-index: 10;
            transition: background-color 0.2s;
          }

          .resizer-h:hover {
            background-color: #000000;
          }

          .dark .resizer-h:hover {
            background-color: #ffffff;
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

            .dark .comp-table {
              color: #000000 !important;
            }
            
            .overflow-x-auto { 
              overflow: visible !important; 
              display: block !important; 
            }

            .comp-table-container {
              transform: scale(${printScale});
              transform-origin: top left;
              width: ${100 / printScale}% !important;
              padding: 0 !important;
              background: white !important;
            }

            table { 
              border-collapse: collapse !important; 
              width: 100% !important; 
              border: 1pt solid #000000 !important;
            }
            th, td { 
              border: 0.4pt solid #000000 !important; 
              padding: 1px !important;
              font-size: ${fontSize - 1}px !important;
              background-color: white !important;
              color: black !important;
            }
            @page { 
              margin: 4mm; 
              size: A4 landscape; 
            }
          }
        `}</style>
        <table className="comp-table text-black dark:text-slate-100 border-2 border-black dark:border-slate-700" style={{ fontSize: `${fontSize}px` }}>
          <thead>
          <tr className="bg-white dark:bg-slate-900">
            <th colSpan={Math.floor(totalCols/2)} className="text-left px-2 py-1 border border-black dark:border-slate-700 font-bold uppercase whitespace-nowrap">
              <div className="flex items-center">
                <span className="flex-shrink-0 opacity-60">DOC NO. :</span>
                <input type="text" value={header.docNo} onChange={e => updateHeader('docNo', e.target.value)} className="font-bold uppercase ml-2" readOnly={readOnly} />
              </div>
            </th>
            <th colSpan={totalCols - Math.floor(totalCols/2)} className="text-left px-2 py-1 border border-black dark:border-slate-700 font-bold uppercase whitespace-nowrap">
              <div className="flex items-center">
                <span className="flex-shrink-0 opacity-60">APPLICATION AREA :</span>
                <input type="text" value={header.itemApplicationArea || ''} onChange={e => updateHeader('itemApplicationArea', e.target.value)} className="font-bold uppercase ml-2 flex-1" readOnly={readOnly} />
              </div>
            </th>
          </tr>
          <tr className="bg-white dark:bg-slate-900">
            <th colSpan={Math.floor(totalCols/2)} className="text-left px-2 py-1 border border-black dark:border-slate-700 font-bold uppercase whitespace-nowrap">
              <div className="flex items-center">
                <span className="flex-shrink-0 opacity-60">PREPARED BY :</span>
                <input type="text" value={header.preparedBy} onChange={e => updateHeader('preparedBy', e.target.value)} className="font-bold uppercase ml-2" readOnly={readOnly} />
              </div>
            </th>
            <th colSpan={totalCols - Math.floor(totalCols/2)} className="text-left px-2 py-1 border border-black dark:border-slate-700 font-bold uppercase whitespace-nowrap">
              <div className="flex items-center">
                <span className="flex-shrink-0 opacity-60">INSTALL TYPE :</span>
                <input type="text" value={header.installType || ''} onChange={e => updateHeader('installType', e.target.value)} className="font-bold uppercase ml-2" readOnly={readOnly} />
                {header.installType === 'Old Install' && (
                  <div className="flex items-center ml-4">
                    <span className="flex-shrink-0 opacity-60">REPAIRABLE :</span>
                    <input type="text" value={header.isRepairable || ''} onChange={e => updateHeader('isRepairable', e.target.value)} className="font-bold uppercase ml-2" readOnly={readOnly} />
                  </div>
                )}
              </div>
            </th>
          </tr>
          <tr className="bg-white dark:bg-slate-900">
            <th colSpan={Math.floor(totalCols/2)} className="text-left px-2 py-1 border border-black dark:border-slate-700 font-bold uppercase whitespace-nowrap">
              <div className="flex items-center">
                <span className="flex-shrink-0 opacity-60">DATE :</span>
                <input type="text" value={header.date} onChange={e => updateHeader('date', e.target.value)} className="font-bold uppercase ml-2" readOnly={readOnly} />
              </div>
            </th>
            <th colSpan={totalCols - Math.floor(totalCols/2)} className="text-left px-2 py-1 border border-black dark:border-slate-700 font-bold uppercase whitespace-nowrap">
              <div className="flex items-center">
                <span className="flex-shrink-0 opacity-60">TECH APPROVAL :</span>
                <input type="text" value={header.technicalApproval || ''} onChange={e => updateHeader('technicalApproval', e.target.value)} className="font-bold uppercase ml-2" readOnly={readOnly} />
              </div>
            </th>
          </tr>
          <tr className="bg-white dark:bg-slate-900">
            <th colSpan={Math.floor(totalCols/2)} className="text-left px-2 py-1 border border-black dark:border-slate-700 font-bold uppercase whitespace-nowrap">
              <div className="flex items-center">
                <span className="flex-shrink-0 opacity-60">INDENT DATE :</span>
                <input type="text" value={header.indentDate} onChange={e => updateHeader('indentDate', e.target.value)} className="font-bold uppercase ml-2" readOnly={readOnly} />
              </div>
            </th>
            <th colSpan={totalCols - Math.floor(totalCols/2)} className="text-left px-2 py-1 border border-black dark:border-slate-700 font-bold uppercase whitespace-nowrap">
              <div className="flex items-center">
                <span className="flex-shrink-0 opacity-60">INDENT APPROVED BY :</span>
                <input type="text" value={header.indentApprovedBy || ''} onChange={e => updateHeader('indentApprovedBy', e.target.value)} className="font-bold uppercase ml-2" readOnly={readOnly} />
              </div>
            </th>
          </tr>
          <tr className="bg-white dark:bg-slate-900">
            <th colSpan={Math.floor(totalCols/2)} className="text-left px-2 py-1 border border-black dark:border-slate-700 font-bold uppercase whitespace-nowrap">
              <div className="flex items-center">
                <span className="flex-shrink-0 opacity-60">PLANT NAME :</span>
                <input type="text" value={header.plantName} onChange={e => updateHeader('plantName', e.target.value)} className="font-bold uppercase ml-2" readOnly={readOnly} />
              </div>
            </th>
            <th colSpan={totalCols - Math.floor(totalCols/2)} className="text-left px-2 py-1 border border-black dark:border-slate-700 font-bold uppercase whitespace-nowrap">
              <div className="flex items-center">
                <span className="flex-shrink-0 opacity-60">PRIMARY NEGOTIATION :</span>
                <input type="text" value={header.primaryNegotiation || ''} onChange={e => updateHeader('primaryNegotiation', e.target.value)} className="font-bold uppercase ml-2" readOnly={readOnly} />
              </div>
            </th>
          </tr>
          <tr className="bg-white dark:bg-slate-900">
            <th colSpan={hasWeight ? 9 : 8} className="border-none"></th>
            {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               const quoteDate = firstQuote?.quoteDate || new Date().toLocaleDateString('en-GB');
               return (
                <th key={i} colSpan={vendorCols} className="text-center p-0 border border-black dark:border-slate-700 bg-white dark:bg-slate-900 font-bold uppercase">
                  <div className="flex items-center justify-center py-1">
                     <span className="opacity-50">BY</span>
                     <input 
                       type="text" 
                       value={quoteDate} 
                       onChange={e => updateQuoteDate(v, e.target.value)} 
                       className="text-center font-bold uppercase w-20" 
                       readOnly={readOnly} 
                     />
                  </div>
                </th>
               );
            })}
            <th className="print-hidden w-8 border-black border bg-white">
              {!readOnly && (
                <button onClick={addVendor} className="p-1 hover:text-black text-black cursor-pointer" title="Add Vendor">
                  <PlusCircle className="w-4 h-4 mx-auto" />
                </button>
              )}
            </th>
          </tr>
          
          <tr className="bg-white">
            <th rowSpan={2} className="relative border border-black p-1 font-bold w-8">
              <div className="vertical-text">INDENT NO.</div>
              <div className="resizer print-hidden" onMouseDown={startResizing} />
            </th>
            <th rowSpan={2} className="relative border border-black p-1 font-bold w-6">
              <div className="vertical-text">SI NO.</div>
              <div className="resizer print-hidden" onMouseDown={startResizing} />
            </th>
            <th rowSpan={2} className="relative border border-black p-2 text-left font-bold min-w-[200px]">
              ITEM DESCRIPTION
              <div className="resizer print-hidden" onMouseDown={startResizing} />
            </th>
            <th rowSpan={2} className="relative border border-black p-1 font-bold w-8">
              <div className="vertical-text">UOM</div>
              <div className="resizer print-hidden" onMouseDown={startResizing} />
            </th>
            <th rowSpan={2} className="relative border border-black p-1 font-bold w-8">
              <div className="vertical-text">QTY</div>
              <div className="resizer print-hidden" onMouseDown={startResizing} />
            </th>
            {hasWeight && (
              <th rowSpan={2} className="relative border border-black p-1 font-bold w-8">
                <div className="vertical-text">WT</div>
                <div className="resizer print-hidden" onMouseDown={startResizing} />
              </th>
            )}
            <th colSpan={3} className="relative border border-black p-1 bg-white font-bold">
              PREVIOUS PRICE
              <div className="resizer print-hidden" onMouseDown={startResizing} />
            </th>
            {vendors.map((v, i) => (
              <th key={i} colSpan={vendorCols} className="relative border border-black p-0 bg-white">
                <div className="flex items-center justify-center gap-1 group px-1 min-h-[30px]">
                  <AutoExpandingTextarea 
                    value={v} 
                    onChange={val => updateVendorName(v, val)} 
                    className="text-center font-black uppercase leading-tight" 
                    readOnly={readOnly} 
                    rows={1}
                  />
                  {!readOnly && (
                    <button onClick={() => removeVendor(v)} className="print-hidden p-0.5 opacity-0 group-hover:opacity-100 hover:text-black text-black cursor-pointer transition-opacity flex-shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="resizer print-hidden" onMouseDown={startResizing} />
                <div className="resizer-h print-hidden" onMouseDown={startResizingHeight} />
              </th>
            ))}
            <th rowSpan={2} className="print-hidden border border-black p-1 uppercase w-8 text-black" style={{ fontSize: `${fontSize - 1}px` }}>Act</th>
          </tr>
          <tr className="bg-white" style={{ fontSize: `${fontSize - 1}px` }}>
            <th className="relative border border-black p-0 font-bold text-black min-w-[50px]">
              <div className="p-1">VENDOR</div>
              <div className="resizer print-hidden" onMouseDown={startResizing} />
            </th>
            <th className="relative border border-black p-0 font-bold w-10 text-black">
              <div className="p-1">RATE</div>
              <div className="resizer print-hidden" onMouseDown={startResizing} />
            </th>
            <th className="relative border border-black p-0 font-bold w-12 text-black">
              <div className="p-1">DATE</div>
              <div className="resizer print-hidden" onMouseDown={startResizing} />
            </th>
            {vendors.map((_, i) => (
              <React.Fragment key={i}>
                <th className="relative border border-black p-1 font-bold min-w-[50px] text-black">
                  MAKE
                  <div className="resizer print-hidden" onMouseDown={startResizing} />
                </th>
                <th className="relative border border-black p-1 font-bold w-10 text-black">
                  MRP
                  <div className="resizer print-hidden" onMouseDown={startResizing} />
                </th>
                <th className="relative border border-black p-1 font-bold w-8 text-black">
                  DIS%
                  <div className="resizer print-hidden" onMouseDown={startResizing} />
                </th>
                <th className="relative border border-black p-1 font-bold w-12 text-black">
                  NET RATE
                  <div className="resizer print-hidden" onMouseDown={startResizing} />
                </th>
                <th className="relative border border-black p-1 font-bold w-14 bg-white text-black">
                  TOTAL
                  <div className="resizer print-hidden" onMouseDown={startResizing} />
                </th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, idx: number) => (
            <tr key={idx} className="hover:bg-white relative">
              <td className="relative border border-black p-0">
                <input type="text" value={item.indentNo || ''} onChange={e => updateItem(idx, 'indentNo', e.target.value)} className="text-center font-bold" readOnly={readOnly} />
                <div className="resizer-h print-hidden" onMouseDown={startResizingHeight} />
              </td>
              <td className="relative border border-black p-0">
                <input type="text" value={item.siNo || ''} onChange={e => updateItem(idx, 'siNo', e.target.value)} className="text-center" readOnly={readOnly} />
                <div className="resizer-h print-hidden" onMouseDown={startResizingHeight} />
              </td>
              <td className="relative border border-black p-0">
                <AutoExpandingTextarea 
                  value={item.description || ''} 
                  onChange={val => updateItem(idx, 'description', val)} 
                  className="text-left font-medium px-2" 
                  readOnly={readOnly} 
                  rows={1} 
                />
                <div className="resizer-h print-hidden" onMouseDown={startResizingHeight} />
              </td>
              <td className="relative border border-black p-0">
                <input type="text" value={item.uom || ''} onChange={e => updateItem(idx, 'uom', e.target.value)} className="text-center uppercase" readOnly={readOnly} />
                <div className="resizer-h print-hidden" onMouseDown={startResizingHeight} />
              </td>
              <td className="relative border border-black p-0">
                <input type="text" value={item.qty || ''} onChange={e => updateItem(idx, 'qty', e.target.value)} className="text-center font-bold" readOnly={readOnly} />
                <div className="resizer-h print-hidden" onMouseDown={startResizingHeight} />
              </td>
              {hasWeight && (
                <td className="relative border border-black p-0">
                  <input type="text" value={item.weight || ''} onChange={e => updateItem(idx, 'weight', e.target.value)} className="text-center font-bold" readOnly={readOnly} />
                  <div className="resizer-h print-hidden" onMouseDown={startResizingHeight} />
                </td>
              )}
              <td className="relative border border-black p-0">
                <input type="text" value={item.previousPrice?.vendor || ''} onChange={e => updatePreviousPrice(idx, 'vendor', e.target.value)} className="text-center italic text-black" readOnly={readOnly} />
                <div className="resizer-h print-hidden" onMouseDown={startResizingHeight} />
              </td>
              <td className="relative border border-black p-0">
                <input type="text" value={item.previousPrice?.rate || ''} onChange={e => updatePreviousPrice(idx, 'rate', e.target.value)} className="text-center text-black" readOnly={readOnly} />
                <div className="resizer-h print-hidden" onMouseDown={startResizingHeight} />
              </td>
              <td className="relative border border-black p-0">
                <input type="text" value={item.previousPrice?.date || ''} onChange={e => updatePreviousPrice(idx, 'date', e.target.value)} className="text-center text-black" readOnly={readOnly} />
                <div className="resizer-h print-hidden" onMouseDown={startResizingHeight} />
              </td>
              {vendors.map((v: string, vIdx: number) => {
                const quote = item.vendorQuotes?.find((q: any) => q.vendorName === v);
                return (
                  <React.Fragment key={vIdx}>
                    <td className="relative border border-black p-0">
                      <AutoExpandingTextarea value={quote?.make || ''} onChange={val => updateQuote(idx, v, 'make', val)} className="text-center italic text-black" readOnly={readOnly} rows={1}/>
                      <div className="resizer-h print-hidden" onMouseDown={startResizingHeight} />
                    </td>
                    <td className="relative border border-black p-0">
                      <input type="text" value={quote?.mrp ?? ''} onChange={e => updateQuote(idx, v, 'mrp', e.target.value)} className="text-center text-black" readOnly={readOnly} />
                      <div className="resizer-h print-hidden" onMouseDown={startResizingHeight} />
                    </td>
                    <td className="relative border border-black p-0">
                      <input type="text" value={quote?.discount ?? ''} onChange={e => updateQuote(idx, v, 'discount', e.target.value)} className="text-center text-black" readOnly={readOnly} />
                      <div className="resizer-h print-hidden" onMouseDown={startResizingHeight} />
                    </td>
                    <td className="relative border border-black p-0">
                      <input type="text" value={quote?.netRate ?? ''} onChange={e => updateQuote(idx, v, 'netRate', e.target.value)} className="text-center font-bold text-black" readOnly={readOnly} />
                      <div className="resizer-h print-hidden" onMouseDown={startResizingHeight} />
                    </td>
                    <td className="relative border border-black p-0 bg-white">
                      <input type="text" value={quote?.totalAmount ?? ''} onChange={e => updateQuote(idx, v, 'totalAmount', e.target.value)} className="text-center font-black text-black" readOnly={readOnly} />
                      <div className="resizer-h print-hidden" onMouseDown={startResizingHeight} />
                    </td>
                  </React.Fragment>
                )
              })}
              <td className="print-hidden border border-black p-0 text-center relative">
                {!readOnly && (
                  <button onClick={() => removeItem(idx)} className="p-1 hover:text-black text-black transition-colors" title="Remove Row">
                    <Trash2 className="w-3.5 h-3.5 mx-auto" />
                  </button>
                )}
                <div className="resizer-h print-hidden" onMouseDown={startResizingHeight} />
              </td>
            </tr>
          ))}

          {!readOnly && (
            <tr className="bg-white hover:bg-white transition-colors print-hidden">
              <td colSpan={totalCols} className="border border-black p-0 text-center">
                <button onClick={addItem} className="w-full py-3 flex items-center justify-center gap-2 text-black hover:text-black font-bold uppercase tracking-widest cursor-pointer" style={{ fontSize: `${fontSize - 1}px` }}>
                  <PlusCircle className="w-4 h-4" /> Add New Item Row
                </button>
              </td>
            </tr>
          )}

          <tr className="bg-white font-bold" style={{ fontSize: `${fontSize - 1}px` }}>
             <td colSpan={hasWeight ? 9 : 8} className="border border-black text-right px-4 uppercase text-black">Vendor Subtotal</td>
             {vendors.map((v, i) => (
               <React.Fragment key={i}>
                 <td colSpan={4} className="border border-black text-right p-1 uppercase text-black">TOTAL</td>
                 <td className="border border-black text-center p-1 font-black bg-white text-black" style={{ fontSize: `${fontSize}px` }}>{calculateVendorTotal(v).toFixed(2)}</td>
               </React.Fragment>
             ))}
             <td className="print-hidden border-black border"></td>
          </tr>
          
          <tr className="bg-white" style={{ fontSize: `${fontSize - 1}px` }}>
             <td colSpan={hasWeight ? 9 : 8} className="border border-black text-right px-4 uppercase text-black">Taxation (GST)</td>
             {vendors.map((v, i) => {
               const gst = calculateVendorTax(v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={4} className="border border-black text-right p-1 text-black uppercase">
                    TAX AMOUNT
                  </td>
                  <td className="border border-black text-center p-1 font-bold text-black" style={{ fontSize: `${fontSize}px` }}>
                    {gst > 0 ? gst.toFixed(2) : 'INCLUSIVE'}
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-black border"></td>
          </tr>

          <tr className="bg-white">
             <td colSpan={hasWeight ? 9 : 8} className="border border-black text-right px-4 uppercase font-black tracking-widest text-black" style={{ fontSize: `${fontSize}px` }}>Grand Total Summary</td>
             {vendors.map((v, i) => {
               const grandTotal = calculateVendorGrandTotal(v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={4} className="border border-black text-right p-2 font-black text-black" style={{ fontSize: `${fontSize + 1}px` }}>GRAND TOTAL</td>
                  <td className="border border-black text-center p-2 font-black bg-white text-black" style={{ fontSize: `${fontSize + 2}px` }}>{grandTotal.toFixed(2)}</td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-black border"></td>
          </tr>

          <tr className="bg-white">
             <td colSpan={hasWeight ? 9 : 8} className="border-none"></td>
             {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={2} className="border border-black p-1 italic text-right font-bold uppercase pr-2 text-black" style={{ fontSize: `${Math.max(fontSize - 2, 8)}px` }}>FREIGHT CHARGES</td>
                  <td colSpan={3} className="border border-black p-0">
                    <input 
                      type="text"
                      value={firstQuote?.freightAmount || ''} 
                      onChange={e => updateQuote(0, v, 'freightAmount', e.target.value)} 
                      className="text-center font-bold text-black" 
                      style={{ fontSize: `${fontSize}px` }} 
                      readOnly={readOnly}
                      placeholder="0.00"
                    />
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-black border"></td>
          </tr>
          <tr className="bg-white text-black">
             <td colSpan={hasWeight ? 9 : 8} className="border border-black text-center font-bold uppercase tracking-[0.3em] text-black" style={{ fontSize: `${Math.max(fontSize - 2, 8)}px` }}></td>
             {vendors.map((v, i) => (
                <td key={i} colSpan={vendorCols} className="border border-black text-center p-1.5 font-bold uppercase tracking-widest text-black" style={{ fontSize: `${fontSize - 1}px` }}>
                  TERMS & CONDITIONS
                </td>
             ))}
             <td className="print-hidden border-black border"></td>
          </tr>
          
          <tr className="bg-white">
             <td colSpan={hasWeight ? 9 : 8} className="border-none"></td>
             {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={2} className="border border-black p-1 italic text-right font-bold uppercase pr-2 text-black" style={{ fontSize: `${Math.max(fontSize - 2, 8)}px` }}>DELIVERY</td>
                  <td colSpan={3} className="border border-black p-0">
                    <AutoExpandingTextarea value={firstQuote?.deliveryPeriod || ''} onChange={val => updateQuote(0, v, 'deliveryPeriod', val)} className="text-center font-bold text-black" style={{ fontSize: `${fontSize}px` }} readOnly={readOnly} rows={1}/>
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-black border"></td>
          </tr>
          <tr className="bg-white">
             <td colSpan={hasWeight ? 9 : 8} className="border-none"></td>
             {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={2} className="border border-black p-1 italic text-right font-bold uppercase pr-2 text-black" style={{ fontSize: `${Math.max(fontSize - 2, 8)}px` }}>FREIGHT</td>
                  <td colSpan={3} className="border border-black p-0">
                    <AutoExpandingTextarea 
                      value={firstQuote?.freight || 'NILL'} 
                      onChange={val => updateQuote(0, v, 'freight', val)} 
                      className="text-center font-bold text-black" 
                      style={{ fontSize: `${fontSize}px` }} 
                      readOnly={readOnly} 
                      rows={1}
                    />
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-black border"></td>
          </tr>
          <tr className="bg-white">
             <td colSpan={hasWeight ? 9 : 8} className="border-none"></td>
             {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={2} className="border border-black p-1 italic text-right font-bold uppercase pr-2 text-black" style={{ fontSize: `${Math.max(fontSize - 2, 8)}px` }}>P & F</td>
                  <td colSpan={3} className="border border-black p-0">
                    <AutoExpandingTextarea 
                      value={firstQuote?.packingAndForwarding || 'NILL'} 
                      onChange={val => updateQuote(0, v, 'packingAndForwarding', val)} 
                      className="text-center font-bold text-black" 
                      style={{ fontSize: `${fontSize}px` }} 
                      readOnly={readOnly} 
                      rows={1}
                    />
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-black border"></td>
          </tr>
          <tr className="bg-white">
             <td colSpan={hasWeight ? 9 : 8} className="border-none"></td>
             {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={2} className="border border-black p-1 italic text-right font-bold uppercase pr-2 text-black" style={{ fontSize: `${Math.max(fontSize - 2, 8)}px` }}>STOCK</td>
                  <td colSpan={3} className="border border-black p-0">
                    <AutoExpandingTextarea value={firstQuote?.readyStock || ''} onChange={val => updateQuote(0, v, 'readyStock', val)} className="text-center font-bold text-black" style={{ fontSize: `${fontSize}px` }} readOnly={readOnly} rows={1}/>
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-black border"></td>
          </tr>
          <tr className="bg-white">
             <td colSpan={hasWeight ? 9 : 8} className="border-none"></td>
             {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={2} className="border border-black p-1 italic text-right font-bold uppercase pr-2 text-black" style={{ fontSize: `${Math.max(fontSize - 2, 8)}px` }}>GST STATUS</td>
                  <td colSpan={3} className="border border-black p-0">
                    <select 
                      value={firstQuote?.gstStatus || '18% Extra'} 
                      onChange={e => updateQuote(0, v, 'gstStatus', e.target.value)} 
                      className="text-center font-bold uppercase cursor-pointer text-black"
                      style={{ fontSize: `${fontSize}px` }}
                      disabled={readOnly}
                    >
                      <option value="Exclusive">Exclusive (18%)</option>
                      <option value="18% Extra">18% Extra</option>
                      <option value="12% Extra">12% Extra</option>
                      <option value="5% Extra">5% Extra</option>
                      <option value="28% Extra">28% Extra</option>
                      <option value="Inclusive">Inclusive</option>
                    </select>
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-black border"></td>
          </tr>
          <tr className="bg-white">
             <td colSpan={hasWeight ? 9 : 8} className="border-none"></td>
             {vendors.map((v, i) => {
               const firstQuote = data.items[0]?.vendorQuotes?.find(q => q.vendorName === v);
               return (
                <React.Fragment key={i}>
                  <td colSpan={2} className="border border-black p-1 italic text-right font-bold uppercase pr-2 text-black" style={{ fontSize: `${Math.max(fontSize - 2, 8)}px` }}>OTHER EXTRA</td>
                  <td colSpan={3} className="border border-black p-0">
                    <AutoExpandingTextarea value={firstQuote?.extra || ''} onChange={val => updateQuote(0, v, 'extra', val)} className="text-center font-bold text-black" style={{ fontSize: `${fontSize}px` }} readOnly={readOnly} rows={1}/>
                  </td>
                </React.Fragment>
               )
             })}
             <td className="print-hidden border-black border"></td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  );
});
