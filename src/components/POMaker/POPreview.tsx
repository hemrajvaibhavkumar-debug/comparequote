import React, { useRef, useState, useEffect } from 'react';
import { PurchaseOrder, CompanySettings, POItem } from '../../types';

interface POPreviewProps {
  po: PurchaseOrder;
  setPo: React.Dispatch<React.SetStateAction<PurchaseOrder>>;
  settings: CompanySettings | null;
  actions?: React.ReactNode;
  isPDF?: boolean;
}

const TermsAndNotes = ({ po }: { po: PurchaseOrder }) => (
  <div className="mt-4 no-break">
    <div className="text-[10px] space-y-1 mb-2 text-black border border-black p-2 rounded font-bold text-left bg-[#fdfdfe]">
      <p className="font-black text-[11px] underline mb-1 uppercase tracking-wide">Commercial Terms::</p>
      <div className="grid grid-cols-[140px_1fr] gap-y-1">
        <span className="uppercase text-[9px]">Tax ::</span> <span className="uppercase">{po.terms.tax}</span>
        <span className="uppercase text-[9px]">Packing ::</span> <span className="uppercase">{po.terms.packing}</span>
        <span className="uppercase text-[9px]">Forwarding ::</span> <span className="uppercase">{po.terms.notes}</span>
        <span className="uppercase text-[9px]">Payment Terms ::</span>
        <div className="flex flex-col">
          {po.terms.payment_milestones && po.terms.payment_milestones.length > 0 ? (
            po.terms.payment_milestones.map((m, idx) => (
              <span key={idx} className="uppercase font-black">{m.percentage}% - {m.description}</span>
            ))
          ) : (
            <span className="uppercase">{po.terms.payment}</span>
          )}
        </div>
        <span className="uppercase text-[9px]">Freight ::</span> <span className="uppercase">{po.terms.freight} {po.terms.freight_amount ? `- ₹${Number(po.terms.freight_amount).toLocaleString()}` : ''}</span>
        <span className="uppercase text-[9px]">Delivery Period ::</span> <span className="uppercase">{po.terms.delivery}</span>
        {po.terms.contact_no && <><span className="uppercase text-[9px]">Contact No ::</span> <span>{po.terms.contact_no}</span></>}
      </div>
    </div>

    <div className="text-[10px] space-y-1 mb-2 uppercase italic font-black text-black border-l-4 border-black pl-4 py-1 text-left">
       <p>NOTE 1 :: <span className="underline">E-Way bill is mandatory for Rs 50,000 and above Purchase Value.</span></p>
       <p>NOTE 2 :: If we have any type of dispute from specification then we will reject material.</p>
       {(po.terms.manual_notes || []).map((note, idx) => (
         <p key={idx}>NOTE {idx + 3} :: {note}</p>
       ))}
    </div>
  </div>
);

const POPreview: React.FC<POPreviewProps> = ({ po, setPo, settings, actions, isPDF }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (isPDF) {
      setScale(1);
      return;
    }

    const handleResize = () => {
      if (!printRef.current) return;
      const parentEl = printRef.current.parentElement;
      if (!parentEl) return;
      
      const parentWidth = parentEl.clientWidth;
      const targetWidth = 794; // 210mm in px at 96 DPI
      
      // Allow padding of 48px
      if (parentWidth > 0 && parentWidth < targetWidth + 48) {
        const newScale = (parentWidth - 48) / targetWidth;
        setScale(Math.max(0.4, newScale));
      } else {
        setScale(1);
      }
    };

    handleResize();

    const parentEl = printRef.current?.parentElement;
    if (!parentEl) return;

    const observer = new ResizeObserver(() => {
      handleResize();
    });

    observer.observe(parentEl);
    window.addEventListener('resize', handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [isPDF]);
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-CA');
    } catch (e) {
      return dateStr;
    }
  };

  const updatePO = (field: keyof PurchaseOrder, value: any) => {
    setPo(prev => ({ ...prev, [field]: value }));
  };

  const COMPANY_METADATA: Record<string, { 
    name: string, 
    logo: string, 
    gstin: string, 
    pan: string 
  }> = {
    hemraj_ind: {
      name: "HEMRAJ INDUSTRIES PRIVATE LIMITED",
      logo: "/hemraj_ind_logo.png",
      gstin: settings?.gstin || "19AAACH8249K1Z4",
      pan: settings?.pan || "AAACH8249K",
    },
    hemraj_rice: {
      name: "HEMRAJ RICE MILL",
      logo: "/hemraj_rice_logo.png",
      gstin: "19AADFH4153N1Z2",
      pan: "AADFH4153N",
    },
    radhashyam: {
      name: "RADHASHYAM INDUSTRIES PVT. LTD.",
      logo: "/radhashyam_logo.jpg",
      gstin: "19AAGCR5957G1ZW",
      pan: "AAGCR5957G",
    }
  };

  const currentMeta = COMPANY_METADATA[po.version || 'hemraj_ind'];

  const EditableText = ({ value, onChange, className = "" }: { value: string, onChange: (val: string) => void, className?: string }) => (
    <span
      contentEditable
      suppressContentEditableWarning
      className={`hover:underline focus:outline-none px-0.5 rounded transition-colors inline-block text-black ${className}`}
      style={{ backgroundColor: 'transparent' }}
      onBlur={(e) => onChange(e.currentTarget.textContent || '')}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    >
      {value}
    </span>
  );

  // --- MULTI-PAGE PAGING LOGIC ---
  const ITEMS_PER_PAGE_SUBSEQUENT = 18; 

  const splitItemsIntoPages = () => {
    const pages: POItem[][] = [];
    let currentItems = [...po.items];
    
    // Determine Page 1 capacity
    // If we have 8 or fewer items, we want to keep them on Page 1 with the terms.
    // If we have more than 8 items, the terms will be pushed to Page 2, 
    // allowing us to fill Page 1 with up to 15 items.
    const itemsOnFirstPage = po.items.length <= 8 ? 8 : 15;
    
    // Page 1
    pages.push(currentItems.slice(0, itemsOnFirstPage));
    currentItems = currentItems.slice(itemsOnFirstPage);
    
    // Subsequent Pages
    while (currentItems.length > 0) {
      pages.push(currentItems.slice(0, ITEMS_PER_PAGE_SUBSEQUENT));
      currentItems = currentItems.slice(ITEMS_PER_PAGE_SUBSEQUENT);
    }
    
    // Check if the last page can fit the totals and terms
    if (pages.length > 0) {
      const lastPageIdx = pages.length - 1;
      const lastPageItems = pages[lastPageIdx];
      
      if (lastPageIdx === 0) {
        // First page is also the last page
        // If there are more than 8 items, we MUST push terms and notes to a new page
        // because we filled the first page with items (up to 15).
        if (lastPageItems.length > 8) {
          pages.push([]); 
        }
      } else {
        // Subsequent pages fit up to 8 items comfortably with terms.
        if (lastPageItems.length > 8) {
          pages.push([]); 
        }
      }
    }
    
    return pages.length > 0 ? pages : [[]];
  };

  const itemPages = splitItemsIntoPages();

  const lastItemsPageIdx = itemPages.length > 1 && itemPages[itemPages.length - 1].length === 0 
    ? itemPages.length - 2 
    : itemPages.length - 1;

  const HeaderContent = () => (
    <div className="w-full h-full flex flex-col justify-center bg-white">
      {po.version === 'hemraj_ind' && (
        <div className="w-full flex items-start gap-4 px-[15mm]">
          <div className="w-24 shrink-0">
              <img src="/hemraj_ind_logo.png" className="w-full object-contain" alt="Logo" />
          </div>
          <div className="flex-1 text-center pt-2">
              <div className="bg-[#8B0000] text-white text-2xl font-black py-1 px-4 tracking-tighter uppercase w-full">
                HEMRAJ INDUSTRIES PRIVATE LIMITED
              </div>
              <p className="text-[#8B0000] text-[10px] font-bold mt-1">
                Rice Mill, Solvent Extraction. Edible Oil Refinery. Captive Power Plant
              </p>
              <p className="text-[#8B0000] text-[10px] font-bold">
                CIN : U01111WB1991PTC051314
              </p>
          </div>
        </div>
      )}

      {po.version === 'hemraj_rice' && (
        <div className="w-full flex flex-col px-[15mm]">
          <div className="flex items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-4">
              <img src="/hemraj_rice_logo.png" className="h-20 object-contain" alt="Logo" />
              <h1 className="text-4xl font-serif text-[#8B0000] font-black uppercase tracking-tighter" style={{ fontFamily: "'Times New Roman', serif" }}>
                HEMRAJ RICE MILL
              </h1>
            </div>
            <div className="text-[9px] text-right font-bold leading-tight">
              <p>Regd. Office : 46B Rafi Ahmed Kidwai Road</p>
              <p>1st Floor, Kolkata-700 016, Fax : 033-2229-2340</p>
              <p>Phone : 033-4064 9316, 4062 4362</p>
              <p>E-mail : hemrajinds.kolkata@gmail.com</p>
              <p>website : www.hemrajgroup.com</p>
            </div>
          </div>
          <div className="text-center py-1 text-[10px] font-bold border-t border-black">
            Factory : Katwa, Burdwan Road, Burdwan - 713130, Phone : 93336 51918, 8170033618
          </div>
        </div>
      )}

      {po.version === 'radhashyam' && (
        <div className="w-full flex justify-between items-start px-[15mm]">
          <div className="flex items-start gap-4">
            <img src="/radhashyam_logo.jpg" className="h-20 object-contain" alt="Logo" />
            <div>
              <h1 className="text-3xl font-serif text-[#8B0000] font-black uppercase tracking-tight" style={{ fontFamily: "'Times New Roman', serif" }}>
                RADHASHYAM INDUSTRIES PVT. LTD.
              </h1>
              <div className="bg-[#228B22] text-white text-xs font-black px-3 py-0.5 inline-block uppercase mt-1 tracking-widest">
                SOLVENT EXTRACTION & EDIBLE OIL
              </div>
            </div>
          </div>
          <div className="text-[9px] text-right font-bold leading-tight text-[#8B0000]">
            <p>Regd. Office : 46B Rafi Ahmed Kidwai Road</p>
            <p>1st Floor, Kolkata-700 016, Fax : +91 33 2229 2340</p>
            <p>Ph : +91 33 2229 8038 / 4064 9316 / 2265 4742</p>
            <p>Website : www.hemrajgroup.co.in</p>
            <p>E-mail : rsipl2014@gmail.com</p>
            <p>CIN No. : U74900WB2013PTC197187</p>
          </div>
        </div>
      )}
    </div>
  );

  const FooterContent = () => (
    <div className="w-full flex flex-col justify-between h-full bg-white">
      {/* Signature Block - Repeats on every page */}
      <div className="px-[15mm] pt-4 flex-1">
        <div className="flex justify-between items-start mb-2">
          <div className="text-left text-[10px] font-bold text-black">
            <p>Yours faithfully,</p>
            <p className="font-black text-xs uppercase mt-1">{currentMeta.name}</p>
          </div>
          <div className="text-right text-[10px] font-bold space-y-0.5 text-black">
            <p>GSTIN : <span className="font-black">{currentMeta.gstin}</span></p>
            <p>PAN : <span className="font-black">{currentMeta.pan}</span></p>
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div className="text-left">
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-0 h-24">
                {po.status === 'APPROVED' && (
                  <>
                    {/* Signature - Left side, larger */}
                    <img src="/signature.jpg" alt="Signature" className="h-20 w-auto object-contain -mr-8 z-10" />
                    
                    {/* Stamp - Right of signature, slightly behind */}
                    <div className="opacity-90">
                      {po.version === 'hemraj_rice' && (
                        <img src="/hemraj_rice_stamp.png" alt="Stamp" className="h-24 w-auto object-contain transform -rotate-6" />
                      )}
                      {po.version === 'hemraj_ind' && (
                        <img src="/hemraj_ind_stamp.png" alt="Stamp" className="h-24 w-auto object-contain transform -rotate-6" />
                      )}
                      {po.version === 'radhashyam' && (
                        <img src="/radhashyam_stamp.png" alt="Stamp" className="h-24 w-auto object-contain transform -rotate-6" />
                      )}
                    </div>
                  </>
                )}
                {(!po.status || po.status === 'PENDING') && (
                  <div className="h-16 w-48 mb-2 flex items-end text-[8px] font-normal italic text-gray-400" style={{ borderBottom: '1px dashed #d1d5db' }}>
                    Authorized Signatory Signature & Stamp
                  </div>
                )}
              </div>
              
              {/* Digital Verification Details */}
              {po.status === 'APPROVED' && (
                <div className="text-[7px] font-black uppercase leading-tight -mt-2 ml-4 text-blue-800">
                  <p>signed on : {po.approved_at ? new Date(po.approved_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : formatDate(po.date)}</p>
                  <p>digitally signed by Rohit Aggarwal</p>
                </div>
              )}
            </div>
            <p className="text-[9px] uppercase font-black mt-1 text-black">Authorized Signatory</p>
          </div>
        </div>
      </div>

      {/* Company Address - Bottom-most part of every page */}
      <div className="mt-auto">
        {po.version === 'hemraj_ind' && (
          <div className="text-center font-bold text-[9px] p-[2mm_15mm_4mm_15mm] w-full border-t border-black text-black">
              <p className="uppercase leading-tight">
                Regd. Office : 46B Rafi Ahmed Kidwai Road, 1st Floor, Kolkata-700 016
                <br/>
                Fax: +91 33 2229 2340, Ph: +91 33 2229 8038 / 4064 9316 /2265 4742
              </p>
              <p className="mt-0.5">
                Factory : Vill. P.O. Chandul, G.T. Road, Burdwan (W. B.) Pin : 713141
              </p>
              <p className="mt-0.5">
                Rice Mili Unit Ph. : +91 9064358638 / 9332148120, Oils Unit Ph. : 81 70035066 /8170035064
              </p>
          </div>
        )}

        {po.version === 'hemraj_rice' && (
          <div className="text-center font-bold text-[9px] p-[2mm_15mm_4mm_15mm] w-full border-t border-black text-black">
            <p className="uppercase leading-tight">
              Katwa, Burdwan Road, Burdwan - 713130, Phone : 93336 51918, 8170033618
            </p>
            <p className="text-[7px] mt-0.5 italic font-normal uppercase text-gray-500">Registered under Purba Bardhaman Jurisdiction</p>
          </div>
        )}

        {po.version === 'radhashyam' && (
          <div className="text-center font-bold text-[9px] p-[2mm_15mm_4mm_15mm] w-full border-t border-black text-black">
            <p className="uppercase italic">
              Factory Address : Bhasapul, P.O. : Pursha, P.S. : Galsi, Dist. : Burdwan, PIN:713406, West Bengal, Ph.:+91 8170021522/526/527
            </p>
            <p className="text-[7px] mt-0.5 italic font-normal uppercase text-gray-500">Registered under Purba Bardhaman Jurisdiction</p>
          </div>
        )}
      </div>
    </div>
  );

  const ItemsTable = ({ items }: { items: POItem[] }) => (
    <table className="w-full border-collapse border border-black text-[9px] text-black">
      <thead>
        <tr className="bg-white uppercase text-black border-b border-black font-bold">
          <th className="border border-black p-1 w-8 text-center">S/N</th>
          <th className="border border-black p-1 text-left">Item Name</th>
          <th className="border border-black p-1 w-20 text-center">Make</th>
          <th className="border border-black p-1 w-12 text-center">Qnty</th>
          <th className="border border-black p-1 w-12 text-center">UOM</th>
          <th className="border border-black p-1 w-16 text-right">Rate</th>
          <th className="border border-black p-1 w-10 text-center">Dis%</th>
          <th className="border border-black p-1 w-14 text-center">Tax</th>
          <th className="border border-black p-1 w-20 text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => (
          <tr key={idx} className="text-black font-medium">
            <td className="border border-black p-1 text-center font-bold">{item.sn}</td>
            <td className="border border-black p-1 uppercase">{item.itemName}</td>
            <td className="border border-black p-1 text-center uppercase">{item.make}</td>
            <td className="border border-black p-1 text-center">{Number(item.qty).toFixed(2)}</td>
            <td className="border border-black p-1 text-center uppercase">{item.uom}</td>
            <td className="border border-black p-1 text-right">{Number(item.rate).toFixed(2)}</td>
            <td className="border border-black p-1 text-center">{Number(item.discount).toFixed(2)}%</td>
            <td className="border border-black p-1 text-center whitespace-nowrap">{item.tax}</td>
            <td className="border border-black p-1 text-right font-black">{Number(item.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const TotalsSection = () => (
    <div className="flex justify-end mt-1">
      <table className="w-1/2 border-collapse border border-black text-[9px] text-black">
        <tbody>
          <tr className="font-black bg-gray-50">
            <td className="border border-black p-1 text-right uppercase">Total Item Amount</td>
            <td className="border border-black p-1 text-right w-24">{Number(po.total_amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
          </tr>
          {po.terms.freight_amount ? (
            <>
              <tr className="font-black bg-gray-50">
                <td className="border border-black p-1 text-right uppercase">Freight Amount</td>
                <td className="border border-black p-1 text-right">{Number(po.terms.freight_amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr className="font-black bg-gray-50">
                <td className="border border-black p-1 text-right uppercase">Freight GST ({po.terms.freight_tax || '18%'})</td>
                <td className="border border-black p-1 text-right">
                  {(() => {
                    const taxStr = po.terms.freight_tax || 'GST @18%';
                    const taxMatch = taxStr.match(/(\d+)%/);
                    const taxPercent = taxMatch ? parseFloat(taxMatch[1]) : 18;
                    return Number(po.terms.freight_amount * (taxPercent / 100)).toLocaleString(undefined, {minimumFractionDigits: 2});
                  })()}
                </td>
              </tr>
            </>
          ) : null}
          <tr className="font-black bg-white border-t-2 border-black">
            <td className="border border-black p-1.5 text-right uppercase text-[10px]">Grand Total Amount</td>
            <td className="border border-black p-1.5 text-right text-[10px]">
              ₹{(() => {
                const taxStr = po.terms.freight_tax || 'GST @18%';
                const taxMatch = taxStr.match(/(\d+)%/);
                const taxPercent = taxMatch ? parseFloat(taxMatch[1]) : 18;
                const fAmount = Number(po.terms.freight_amount) || 0;
                const fTax = fAmount * (taxPercent / 100);
                return (Number(po.total_amount) + fAmount + fTax).toLocaleString(undefined, {minimumFractionDigits: 2});
              })()}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-4 text-black w-full min-h-full">
      <div className="flex gap-4 print-hidden shrink-0 py-4">
        {actions}
      </div>

      <style>{`
        .pdf-paged-view {
          display: flex;
          flex-direction: column;
          gap: 40px;
          padding: 40px;
          background: #e5e7eb;
        }

        .pdf-page {
          width: 210mm;
          height: 297mm;
          background: white;
          position: relative;
          display: flex;
          flex-direction: column;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          margin: 0 auto;
          flex-shrink: 0;
          box-sizing: border-box;
          overflow: hidden;
        }

        .print-no-wrap {
          display: flex;
          justify-content: center;
          align-items: flex-start;
          flex-shrink: 0;
          overflow: hidden;
          transition: all 0.25s ease;
        }

        .pdf-header { height: 42mm; border-bottom: 2px solid black; flex-shrink: 0; }
        .pdf-footer { height: 60mm; border-top: 2px solid black; flex-shrink: 0; position: absolute; bottom: 0; left: 0; width: 100%; }
        .pdf-body { flex: 1; padding: 5mm 15mm 65mm 15mm; overflow: hidden; position: relative; }

        @media print {
          .pdf-paged-view { padding: 0 !important; gap: 0 !important; background: white !important; }
          .print-no-wrap {
            width: 210mm !important;
            height: 297mm !important;
            overflow: visible !important;
            transform: none !important;
          }
          .pdf-page { 
            box-shadow: none !important; 
            margin: 0 !important; 
            transform: none !important;
            page-break-after: always !important; 
          }
          .print-hidden { display: none !important; }
        }
      `}</style>

      <div ref={printRef} className="pdf-paged-view w-full flex flex-col items-center">
        {itemPages.map((pageItems, pageIdx) => (
          <div 
            key={pageIdx}
            style={{ 
              width: isPDF ? '210mm' : `${210 * scale}mm`, 
              height: isPDF ? '297mm' : `${297 * scale}mm`,
            }}
            className="print-no-wrap"
          >
            <div 
              className="pdf-page"
              style={{
                transform: isPDF ? 'none' : `scale(${scale})`,
                transformOrigin: 'top center',
                margin: 0
              }}
            >
              <div className="pdf-header"><HeaderContent /></div>
              <div className="pdf-body">
                {pageIdx === 0 && (
                  <>
                    <div className="text-center mb-2">
                      <h2 className="inline-block border-b-2 border-black text-sm font-bold uppercase tracking-[0.2em] text-black pb-0.5">
                        Purchase Order
                      </h2>
                    </div>
                    <div className="flex justify-between items-start mb-2 text-xs text-black">
                      <div className="border border-black p-2 rounded shadow-[1px_1px_0px_black]">
                        <p className="font-bold text-black uppercase">PO NO :: <span className="font-black text-sm">{po.po_no || 'HI /2026-27/00'}</span></p>
                      </div>
                      <div className="border border-black p-2 rounded shadow-[1px_1px_0px_black]">
                        <p className="font-bold text-black uppercase">Date : <span className="font-black text-sm">{formatDate(po.date)}</span></p>
                      </div>
                    </div>
                    <div className="mb-2 text-[11px] text-black flex gap-4">
                      <div className="font-bold pt-1 uppercase shrink-0">To,</div>
                      <div className="flex-1">
                        <p className="font-black text-sm text-black uppercase mb-1">{po.vendor_name || 'VENDOR NAME'}</p>
                        <p className="whitespace-pre-wrap max-w-[450px] text-black italic font-medium">{po.vendor_details.address}</p>
                        <div className="mt-1 space-y-0.5 text-black grid grid-cols-2 gap-x-8 border-t border-black/10 pt-1 font-bold text-left text-[10px]">
                          <p><span className="uppercase text-[8px] mr-1">STATE :</span> {po.vendor_details.state}</p>
                          <p><span className="uppercase text-[8px] mr-1">GSTIN :</span> {po.vendor_details.gstin}</p>
                          <p><span className="uppercase text-[8px] mr-1">Mail ID :</span> {po.vendor_details.mail}</p>
                          <p><span className="uppercase text-[8px] mr-1">Ph :</span> {po.vendor_details.ph}</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] mb-2 italic text-black leading-relaxed font-bold text-left">
                      Dear Sir/Madam, As per your Quotation Ref No.:-<EditableText value={po.quote_ref_type || 'MAIL'} onChange={val => updatePO('quote_ref_type', val.toUpperCase())} />, Ref Doc no:-<span className="text-black font-black uppercase mx-1 underline">{po.quote_doc_no || 'N/A'}</span>, Ref Date:-<EditableText value={po.quote_date || po.date} onChange={val => updatePO('quote_date', val)} />, We are sending the order so please supply the materials on urgent basis:-
                    </p>
                  </>
                )}

                {pageItems.length > 0 && <ItemsTable items={pageItems} />}

                {pageIdx === lastItemsPageIdx && (
                  <div className="mt-4">
                    <TotalsSection />
                  </div>
                )}

                {pageIdx === itemPages.length - 1 && (
                  <TermsAndNotes po={po} />
                )}
              </div>
              <div className="pdf-footer"><FooterContent /></div>
              <div className="absolute top-2 right-4 text-[8px] font-bold text-slate-400 print-hidden">Page {pageIdx + 1} of {itemPages.length}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default POPreview;
