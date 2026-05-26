import React, { useRef, useEffect } from 'react';
import { PurchaseOrder, CompanySettings, POItem } from '../../types';
import { Download, Printer } from 'lucide-react';
import * as htmlToImage from 'html-to-image';

interface POPreviewProps {
  po: PurchaseOrder;
  setPo: React.Dispatch<React.SetStateAction<PurchaseOrder>>;
  settings: CompanySettings | null;
  actions?: React.ReactNode;
  isPDF?: boolean;
}

const POPreview: React.FC<POPreviewProps> = ({ po, setPo, settings, actions, isPDF }) => {
  const printRef = useRef<HTMLDivElement>(null);
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

  // --- PDF PAGING LOGIC ---
  const ITEMS_PER_PAGE_FIRST = 12;
  const ITEMS_PER_PAGE_SUBSEQUENT = 18;

  const splitItemsIntoPages = () => {
    const pages: POItem[][] = [];
    let currentItems = [...po.items];
    
    pages.push(currentItems.slice(0, ITEMS_PER_PAGE_FIRST));
    currentItems = currentItems.slice(ITEMS_PER_PAGE_FIRST);
    
    while (currentItems.length > 0) {
      pages.push(currentItems.slice(0, ITEMS_PER_PAGE_SUBSEQUENT));
      currentItems = currentItems.slice(ITEMS_PER_PAGE_SUBSEQUENT);
    }
    
    return pages.length > 0 ? pages : [[]];
  };

  const itemPages = splitItemsIntoPages();

  const HeaderContent = () => (
    <div className="w-full h-full flex flex-col justify-center bg-white">
      {po.version === 'hemraj_ind' && (
        <div className="w-full flex items-center gap-6 px-[15mm]">
          <div className="w-24 shrink-0">
              <img src="/hemraj_ind_logo.png" className="w-full object-contain" alt="Logo" />
          </div>
          <div className="flex-1 text-center">
              <div className="bg-[#8B0000] text-white text-3xl font-black py-1.5 px-4 tracking-tighter uppercase w-full shadow-sm">
                HEMRAJ INDUSTRIES PRIVATE LIMITED
              </div>
              <p className="text-[#8B0000] text-[11px] font-black mt-1 uppercase tracking-wider">
                Rice Mill • Solvent Extraction • Edible Oil Refinery • Captive Power Plant
              </p>
              <p className="text-[#8B0000] text-[10px] font-bold mt-0.5 opacity-80">
                CIN : U01111WB1991PTC051314
              </p>
          </div>
        </div>
      )}

      {po.version === 'hemraj_rice' && (
        <div className="w-full flex flex-col px-[15mm]">
          <div className="flex items-center justify-between gap-6 pb-2">
            <div className="flex items-center gap-6">
              <img src="/hemraj_rice_logo.png" className="h-20 object-contain" alt="Logo" />
              <h1 className="text-4xl font-serif text-[#8B0000] font-black uppercase tracking-tighter leading-none" style={{ fontFamily: "'Times New Roman', serif" }}>
                HEMRAJ RICE MILL
              </h1>
            </div>
            <div className="text-[10px] text-right font-bold leading-tight text-gray-700">
              <p>Regd. Office : 46B Rafi Ahmed Kidwai Road</p>
              <p>1st Floor, Kolkata-700 016, Fax : 033-2229-2340</p>
              <p>Phone : 033-4064 9316, 4062 4362</p>
              <p>E-mail : hemrajinds.kolkata@gmail.com</p>
              <p>website : www.hemrajgroup.com</p>
            </div>
          </div>
          <div className="text-center py-1.5 text-[11px] font-black border-t-2 border-black/10 mt-1 uppercase tracking-wide">
            Factory : Katwa, Burdwan Road, Burdwan - 713130, Phone : 93336 51918, 8170033618
          </div>
        </div>
      )}

      {po.version === 'radhashyam' && (
        <div className="w-full flex justify-between items-center px-[15mm]">
          <div className="flex items-center gap-6">
            <img src="/radhashyam_logo.jpg" className="h-24 object-contain" alt="Logo" />
            <div>
              <h1 className="text-3xl font-serif text-[#8B0000] font-black uppercase tracking-tight leading-none" style={{ fontFamily: "'Times New Roman', serif" }}>
                RADHASHYAM INDUSTRIES PVT. LTD.
              </h1>
              <div className="bg-[#228B22] text-white text-xs font-black px-4 py-1 inline-block uppercase mt-2 tracking-[0.2em] shadow-sm">
                SOLVENT EXTRACTION & EDIBLE OIL
              </div>
            </div>
          </div>
          <div className="text-[10px] text-right font-bold leading-tight text-[#8B0000]">
            <p className="font-black text-xs mb-1">Regd. Office : 46B Rafi Ahmed Kidwai Road</p>
            <p>1st Floor, Kolkata-700 016, Fax : +91 33 2229 2340</p>
            <p>Ph : +91 33 2229 8038 / 4064 9316 / 2265 4742</p>
            <p>Website : www.hemrajgroup.co.in</p>
            <p>E-mail : rsipl2014@gmail.com</p>
            <p className="font-black mt-1">CIN No. : U74900WB2013PTC197187</p>
          </div>
        </div>
      )}
    </div>
  );

  const FooterContent = () => (
    <div className="w-full flex flex-col justify-between h-full bg-white">
      <div className="px-[15mm] pt-4 flex-1">
        <div className="flex justify-between items-start mb-2">
          <div className="text-left text-[11px] font-bold text-black">
            <p className="mb-1">Yours faithfully,</p>
            <p className="font-black text-sm uppercase tracking-tight">{currentMeta.name}</p>
          </div>
          <div className="text-right text-[10px] font-bold space-y-1 text-black bg-gray-50 p-2 border border-black/10 rounded">
            <p className="flex justify-between gap-4"><span className="text-gray-400 uppercase text-[9px]">GSTIN</span> <span className="font-black">{currentMeta.gstin}</span></p>
            <p className="flex justify-between gap-4"><span className="text-gray-400 uppercase text-[9px]">PAN</span> <span className="font-black">{currentMeta.pan}</span></p>
          </div>
        </div>

        <div className="flex justify-between items-end mt-2">
          <div className="text-left">
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-0 h-28 relative">
                {po.status === 'APPROVED' && (
                  <>
                    <img src="/signature.jpg" alt="Signature" className="h-24 w-auto object-contain -mr-10 z-10 opacity-90" />
                    <div className="opacity-95">
                      {po.version === 'hemraj_rice' && (
                        <img src="/hemraj_rice_stamp.png" alt="Stamp" className="h-28 w-auto object-contain transform -rotate-6" />
                      )}
                      {po.version === 'hemraj_ind' && (
                        <img src="/hemraj_ind_stamp.png" alt="Stamp" className="h-28 w-auto object-contain transform -rotate-6" />
                      )}
                      {po.version === 'radhashyam' && (
                        <img src="/radhashyam_stamp.png" alt="Stamp" className="h-28 w-auto object-contain transform -rotate-6" />
                      )}
                    </div>
                  </>
                )}
                {(!po.status || po.status === 'PENDING') && (
                  <div className="h-20 w-56 mb-2 flex items-end justify-center text-[10px] font-bold italic text-gray-300 uppercase tracking-widest bg-gray-50 rounded" style={{ border: '2px dashed #e5e7eb' }}>
                    Signature & Stamp
                  </div>
                )}
              </div>
              {po.status === 'APPROVED' && (
                <div className="text-[8px] font-black uppercase leading-tight -mt-4 ml-6 text-blue-800 bg-blue-50/50 p-1 px-2 border-l-2 border-blue-800">
                  <p>digitally signed by Rohit Aggarwal</p>
                  <p className="text-[7px] opacity-70">Timestamp: {po.approved_at ? new Date(po.approved_at).toLocaleString('en-IN') : formatDate(po.date)}</p>
                </div>
              )}
            </div>
            <p className="text-[10px] uppercase font-black mt-2 text-black tracking-widest border-t border-black pt-1">Authorized Signatory</p>
          </div>
        </div>
      </div>

      <div className="mt-auto">
        {po.version === 'hemraj_ind' && (
          <div className="text-center font-bold text-[10px] p-[3mm_15mm_5mm_15mm] w-full border-t-2 border-black text-black bg-gray-50">
              <p className="uppercase leading-tight tracking-tight">
                Regd. Office : 46B Rafi Ahmed Kidwai Road, 1st Floor, Kolkata-700 016
                <br/>
                Fax: +91 33 2229 2340 • Ph: +91 33 2229 8038 / 4064 9316 / 2265 4742
              </p>
              <div className="h-px bg-black/10 my-1"></div>
              <p className="font-black uppercase tracking-wide">
                Factory : Vill. P.O. Chandul, G.T. Road, Burdwan (W.B.) Pin : 713141
              </p>
              <p className="text-[9px] mt-0.5 opacity-80 uppercase">
                Rice Mili Unit Ph : +91 9064358638 / 9332148120 • Oils Unit Ph : 81 70035066 / 8170035064
              </p>
          </div>
        )}
        {po.version === 'hemraj_rice' && (
          <div className="text-center font-bold text-[10px] p-[3mm_15mm_5mm_15mm] w-full border-t-2 border-black text-black bg-gray-50">
            <p className="uppercase leading-tight font-black tracking-wide">
              Factory : Katwa, Burdwan Road, Burdwan - 713130, Phone : 93336 51918, 8170033618
            </p>
            <p className="text-[8px] mt-1 italic font-bold uppercase text-gray-500 tracking-widest opacity-60">Registered under Purba Bardhaman Jurisdiction</p>
          </div>
        )}
        {po.version === 'radhashyam' && (
          <div className="text-center font-bold text-[10px] p-[3mm_15mm_5mm_15mm] w-full border-t-2 border-black text-black bg-gray-50">
            <p className="uppercase italic font-black leading-tight tracking-tight">
              Factory Address : Bhasapul, P.O. : Pursha, P.S. : Galsi, Dist. : Burdwan, PIN: 713406, West Bengal
              <br/>
              Ph.: +91 8170021522 / 526 / 527
            </p>
            <p className="text-[8px] mt-1 italic font-bold uppercase text-gray-500 tracking-widest opacity-60">Registered under Purba Bardhaman Jurisdiction</p>
          </div>
        )}
      </div>
    </div>
  );

  const ItemsTable = ({ items }: { items: POItem[] }) => (
    <table className="w-full border-collapse border-2 border-black text-[10px] text-black mb-0">
      <thead>
        <tr className="bg-gray-100 uppercase text-black border-b-2 border-black font-bold">
          <th className="border border-black p-1.5 w-[40px] text-center">S/N</th>
          <th className="border border-black p-1.5 text-left min-w-[200px]">Item Description</th>
          <th className="border border-black p-1.5 w-[100px] text-center">Make</th>
          <th className="border border-black p-1.5 w-[60px] text-center">Qty</th>
          <th className="border border-black p-1.5 w-[60px] text-center">UOM</th>
          <th className="border border-black p-1.5 w-[90px] text-right">Rate</th>
          <th className="border border-black p-1.5 w-[60px] text-center">Disc%</th>
          <th className="border border-black p-1.5 w-[80px] text-center">Tax</th>
          <th className="border border-black p-1.5 w-[110px] text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => (
          <tr key={idx} className="text-black font-medium border-b border-black/20">
            <td className="border border-black p-1.5 text-center font-bold">{item.sn}</td>
            <td className="border border-black p-1.5 uppercase leading-tight font-bold">{item.itemName}</td>
            <td className="border border-black p-1.5 text-center uppercase">{item.make}</td>
            <td className="border border-black p-1.5 text-center">{Number(item.qty).toFixed(2)}</td>
            <td className="border border-black p-1.5 text-center uppercase">{item.uom}</td>
            <td className="border border-black p-1.5 text-right font-mono">{Number(item.rate).toFixed(2)}</td>
            <td className="border border-black p-1.5 text-center">{Number(item.discount).toFixed(2)}%</td>
            <td className="border border-black p-1.5 text-center whitespace-nowrap">{item.tax}</td>
            <td className="border border-black p-1.5 text-right font-black font-mono">{Number(item.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const TotalsSection = () => (
    <div className="flex justify-end -mt-[2px]">
      <table className="w-[350px] border-collapse border-2 border-black text-[10px] text-black">
        <tbody>
          <tr className="font-bold bg-white">
            <td className="border border-black p-1.5 text-right uppercase bg-gray-50 w-2/3">Total Item Amount</td>
            <td className="border border-black p-1.5 text-right font-mono font-black">{Number(po.total_amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
          </tr>
          {po.terms.freight_amount ? (
            <>
              <tr className="font-bold bg-white">
                <td className="border border-black p-1.5 text-right uppercase bg-gray-50">Freight / Transport</td>
                <td className="border border-black p-1.5 text-right font-mono font-black">{Number(po.terms.freight_amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
              <tr className="font-bold bg-white">
                <td className="border border-black p-1.5 text-right uppercase bg-gray-50">Freight GST ({po.terms.freight_tax || '18%'})</td>
                <td className="border border-black p-1.5 text-right font-mono font-black">
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
          <tr className="font-black bg-black text-white">
            <td className="border border-black p-2 text-right uppercase text-xs tracking-wider">Grand Total Amount</td>
            <td className="border border-black p-2 text-right text-xs font-mono">
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

  if (isPDF) {
    return (
      <div className="pdf-paged-view flex flex-col gap-10 bg-gray-400 p-10 overflow-visible">
        <style>{`
          .pdf-page {
            width: 210mm;
            height: 297mm;
            background: white;
            position: relative;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 30px rgba(0,0,0,0.4);
            page-break-after: always;
            margin: 0 auto;
          }
          .pdf-header { height: 50mm; border-bottom: 2px solid black; flex-shrink: 0; }
          .pdf-footer { height: 75mm; border-top: 2px solid black; flex-shrink: 0; position: absolute; bottom: 0; left: 0; width: 100%; }
          .pdf-body { flex: 1; padding: 5mm 15mm 80mm 15mm; overflow: hidden; }
        `}</style>
        
        {itemPages.map((pageItems, pageIdx) => (
          <div key={pageIdx} className="pdf-page">
            <div className="pdf-header"><HeaderContent /></div>
            <div className="pdf-body">
              {pageIdx === 0 && (
                <>
                  <div className="text-center mb-6">
                    <h2 className="inline-block border-b-2 border-black text-lg font-black uppercase tracking-[0.4em] text-black pb-1">
                      Purchase Order
                    </h2>
                  </div>
                  <div className="flex justify-between items-stretch mb-6 text-xs text-black gap-0 border-2 border-black rounded-lg overflow-hidden shadow-sm">
                    <div className="p-3 flex-1 flex flex-col justify-center items-center bg-gray-100 border-r-2 border-black">
                      <p className="font-bold text-gray-500 uppercase text-[9px] tracking-widest mb-1">Purchase Order Number</p>
                      <p className="font-black text-xl tracking-tighter">{po.po_no || 'HI /2026-27/00'}</p>
                    </div>
                    <div className="p-3 flex-1 flex flex-col justify-center items-center bg-white">
                      <p className="font-bold text-gray-500 uppercase text-[9px] tracking-widest mb-1">Date of Issue</p>
                      <p className="font-black text-xl tracking-tighter">{formatDate(po.date)}</p>
                    </div>
                  </div>
                  <div className="mb-6 text-[11px] text-black border-2 border-black p-5 rounded-xl flex flex-col gap-4 bg-gray-50/30">
                    <div className="flex gap-4">
                      <div className="font-black uppercase shrink-0 text-gray-300 text-xs">To,</div>
                      <div className="flex-1">
                        <p className="font-black text-lg text-black uppercase mb-1 leading-none">{po.vendor_name || 'VENDOR NAME'}</p>
                        <p className="whitespace-pre-wrap max-w-[500px] text-black italic font-semibold leading-relaxed text-[12px]">{po.vendor_details.address}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-12 gap-y-2 border-t-2 border-black/10 pt-4 font-bold text-[11px]">
                      <div className="flex justify-between items-center border-b border-black/5 pb-1"><span className="uppercase text-gray-400 text-[9px] tracking-widest">STATE</span> <span className="uppercase">{po.vendor_details.state}</span></div>
                      <div className="flex justify-between items-center border-b border-black/5 pb-1"><span className="uppercase text-gray-400 text-[9px] tracking-widest">GSTIN</span> <span className="font-black bg-yellow-50 px-1">{po.vendor_details.gstin}</span></div>
                      <div className="flex justify-between items-center border-b border-black/5 pb-1"><span className="uppercase text-gray-400 text-[9px] tracking-widest">EMAIL</span> <span>{po.vendor_details.mail}</span></div>
                      <div className="flex justify-between items-center border-b border-black/5 pb-1"><span className="uppercase text-gray-400 text-[9px] tracking-widest">PHONE</span> <span>{po.vendor_details.ph}</span></div>
                    </div>
                  </div>
                  <div className="text-[11px] mb-5 italic text-black leading-relaxed font-bold text-left border-l-4 border-black pl-4 py-2 bg-gray-100 rounded-r-lg">
                    Dear Sir/Madam, As per your Quotation Ref No.:- <span className="font-black underline decoration-2">{po.quote_ref_type || 'MAIL'}</span>, Ref Doc no:- <span className="text-black font-black uppercase underline decoration-2">{po.quote_doc_no || 'N/A'}</span>, Ref Date:- <span className="font-black underline decoration-2">{po.quote_date || po.date}</span>, We are pleased to place this order as per the following terms:-
                  </div>
                </>
              )}

              <ItemsTable items={pageItems} />

              {pageIdx === itemPages.length - 1 && (
                <div className="mt-0">
                  <TotalsSection />

                  <div className="text-[10px] space-y-2 mt-5 text-black border-2 border-black p-5 rounded-xl font-bold text-left bg-[#fdfdfe] shadow-inner">
                    <p className="font-black text-[12px] underline mb-3 uppercase tracking-[0.2em] text-[#8B0000]">Commercial Terms & Conditions::</p>
                    <div className="grid grid-cols-[160px_1fr] gap-y-2.5">
                      <span className="uppercase text-[9px] text-gray-400 tracking-wider">Taxation ::</span>
                      <span className="uppercase font-black border-b border-black/5 pb-1.5">{po.terms.tax}</span>
                      
                      <span className="uppercase text-[9px] text-gray-400 tracking-wider">Packing ::</span>
                      <span className="uppercase font-black border-b border-black/5 pb-1.5">{po.terms.packing}</span>
                      
                      <span className="uppercase text-[9px] text-gray-400 tracking-wider">Forwarding ::</span>
                      <span className="uppercase font-black border-b border-black/5 pb-1.5">{po.terms.notes}</span>
                      
                      <span className="uppercase text-[9px] text-gray-400 tracking-wider">Payment Terms ::</span>
                      <div className="flex flex-col border-b border-black/5 pb-1.5">
                        {po.terms.payment_milestones && po.terms.payment_milestones.length > 0 ? (
                          po.terms.payment_milestones.map((m, idx) => (
                            <span key={idx} className="uppercase font-black flex items-center gap-2"><div className="w-1.5 h-1.5 bg-black rounded-full"></div> {m.percentage}% - {m.description}</span>
                          ))
                        ) : (
                          <span className="uppercase font-black">{po.terms.payment}</span>
                        )}
                      </div>
                      
                      <span className="uppercase text-[9px] text-gray-400 tracking-wider">Freight ::</span>
                      <span className="uppercase font-black border-b border-black/5 pb-1.5">{po.terms.freight} {po.terms.freight_amount ? `- ₹${Number(po.terms.freight_amount).toLocaleString()}` : ''}</span>
                      
                      <span className="uppercase text-[9px] text-gray-400 tracking-wider">Delivery Period ::</span>
                      <span className="uppercase font-black">{po.terms.delivery}</span>
                    </div>
                  </div>

                  <div className="text-[11px] space-y-2 mt-5 uppercase italic font-black text-black border-l-4 border-[#8B0000] pl-5 py-3 text-left bg-red-50/30 rounded-r-xl">
                     <p className="flex items-center gap-3"><span className="bg-[#8B0000] text-white px-2 py-0.5 rounded text-[10px]">NOTE 1</span> <span className="underline decoration-2">E-Way bill is mandatory for Rs 50,000 and above Purchase Value.</span></p>
                     <p className="flex items-center gap-3"><span className="bg-gray-800 text-white px-2 py-0.5 rounded text-[10px]">NOTE 2</span> If we have any type of dispute from specification then we will reject material.</p>
                     {(po.terms.manual_notes || []).map((note, idx) => (
                       <p key={idx} className="flex items-center gap-3"><span className="bg-gray-800 text-white px-2 py-0.5 rounded text-[10px]">NOTE {idx + 3}</span> {note}</p>
                     ))}
                  </div>
                </div>
              )}
            </div>
            <div className="pdf-footer"><FooterContent /></div>
            <div className="absolute top-2 right-4 text-[10px] font-black text-gray-400 bg-gray-100 px-3 py-1 rounded-full shadow-sm border border-black/5">Page {pageIdx + 1} of {itemPages.length}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-black w-full min-h-full">
      <div className="flex gap-4 print-hidden shrink-0 py-4">
        {actions}
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            display: block !important;
            background: white !important;
          }
          .page-header-fixed {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 210mm !important;
            height: 50mm !important;
            background: white !important;
            z-index: 9999 !important;
            border-bottom: 2px solid black !important;
            display: flex !important;
          }
          .page-footer-fixed {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            width: 210mm !important;
            height: 75mm !important;
            background: white !important;
            z-index: 9999 !important;
            border-top: 2px solid black !important;
            display: flex !important;
          }
          @page { size: A4 portrait; margin: 0 !important; }
          body { background: white !important; margin: 0 !important; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }

        .print-area {
          background: white;
          color: black;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          position: relative;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .page-header-fixed {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 50mm;
          border-bottom: 2px solid black;
          background: white;
          overflow: hidden;
        }

        .page-footer-fixed {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 75mm;
          border-top: 2px solid black;
          background: white;
          overflow: hidden;
        }

        .page-header-spacer { height: 50mm; }
        .page-footer-spacer { height: 75mm; }

        .no-break {
          break-inside: avoid;
          page-break-inside: avoid;
        }
      `}</style>

      <div className="print-area-wrapper w-full flex justify-center bg-gray-100 p-4 md:p-8 flex-1 overflow-auto text-black">
        <div ref={printRef} className="print-area">
          <div className="page-header-fixed"><HeaderContent /></div>
          
          <table className="w-full border-collapse">
            <thead>
              <tr><td><div className="page-header-spacer"></div></td></tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-[5mm_15mm_5mm_15mm] border-none text-black">
                  <div className="text-center mb-8">
                    <h2 className="inline-block border-b-2 border-black text-lg font-black uppercase tracking-[0.4em] text-black pb-1">
                      Purchase Order
                    </h2>
                  </div>

                  <div className="flex justify-between items-stretch mb-6 text-xs text-black gap-0 border-2 border-black rounded-lg overflow-hidden shadow-sm">
                    <div className="p-3 flex-1 flex flex-col justify-center items-center bg-gray-100 border-r-2 border-black">
                      <p className="font-bold text-gray-500 uppercase text-[9px] tracking-widest mb-1">Purchase Order Number</p>
                      <p className="font-black text-xl tracking-tighter">{po.po_no || 'HI /2026-27/00'}</p>
                    </div>
                    <div className="p-3 flex-1 flex flex-col justify-center items-center bg-white">
                      <p className="font-bold text-gray-500 uppercase text-[9px] tracking-widest mb-1">Date of Issue</p>
                      <p className="font-black text-xl tracking-tighter">{formatDate(po.date)}</p>
                    </div>
                  </div>

                  <div className="mb-6 text-[11px] text-black border-2 border-black p-5 rounded-xl flex flex-col gap-4 bg-gray-50/30">
                    <div className="flex gap-4">
                      <div className="font-black uppercase shrink-0 text-gray-300 text-xs">To,</div>
                      <div className="flex-1">
                        <p className="font-black text-lg text-black uppercase mb-1 leading-none">{po.vendor_name || 'VENDOR NAME'}</p>
                        <p className="whitespace-pre-wrap max-w-[500px] text-black italic font-semibold leading-relaxed text-[12px]">{po.vendor_details.address}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-12 gap-y-2 border-t-2 border-black/10 pt-4 font-bold text-[11px]">
                      <div className="flex justify-between items-center border-b border-black/5 pb-1"><span className="uppercase text-gray-400 text-[9px] tracking-widest">STATE</span> <span className="uppercase">{po.vendor_details.state}</span></div>
                      <div className="flex justify-between items-center border-b border-black/5 pb-1"><span className="uppercase text-gray-400 text-[9px] tracking-widest">GSTIN</span> <span className="font-black bg-yellow-50 px-1">{po.vendor_details.gstin}</span></div>
                      <div className="flex justify-between items-center border-b border-black/5 pb-1"><span className="uppercase text-gray-400 text-[9px] tracking-widest">EMAIL</span> <span>{po.vendor_details.mail}</span></div>
                      <div className="flex justify-between items-center border-b border-black/5 pb-1"><span className="uppercase text-gray-400 text-[9px] tracking-widest">PHONE</span> <span>{po.vendor_details.ph}</span></div>
                    </div>
                  </div>

                  <div className="text-[11px] mb-5 italic text-black leading-relaxed font-bold text-left border-l-4 border-black pl-4 py-2 bg-gray-100 rounded-r-lg">
                    Dear Sir/Madam, As per your Quotation Ref No.:- <span className="font-black underline decoration-2"><EditableText value={po.quote_ref_type || 'MAIL'} onChange={val => updatePO('quote_ref_type', val.toUpperCase())} /></span>, Ref Doc no:- <span className="text-black font-black uppercase underline decoration-2">{po.quote_doc_no || 'N/A'}</span>, Ref Date:- <span className="font-black underline decoration-2"><EditableText value={po.quote_date || po.date} onChange={val => updatePO('quote_date', val)} /></span>, We are pleased to place this order as per the following terms:-
                  </div>

                  <ItemsTable items={po.items} />
                  <TotalsSection />

                  <div className="mt-8">
                    <div className="text-[10px] space-y-2 mb-6 text-black no-break border-2 border-black p-5 rounded-xl font-bold text-left bg-[#fdfdfe] shadow-inner">
                      <p className="font-black text-[12px] underline mb-3 uppercase tracking-[0.2em] text-[#8B0000]">Commercial Terms & Conditions::</p>
                      <div className="grid grid-cols-[160px_1fr] gap-y-2.5">
                        <span className="uppercase text-[9px] text-gray-400 tracking-wider">Taxation ::</span>
                        <span className="uppercase font-black border-b border-black/5 pb-1.5">{po.terms.tax}</span>
                        
                        <span className="uppercase text-[9px] text-gray-400 tracking-wider">Packing ::</span>
                        <span className="uppercase font-black border-b border-black/5 pb-1.5">{po.terms.packing}</span>
                        
                        <span className="uppercase text-[9px] text-gray-400 tracking-wider">Forwarding ::</span>
                        <span className="uppercase font-black border-b border-black/5 pb-1.5">{po.terms.notes}</span>
                        
                        <span className="uppercase text-[9px] text-gray-400 tracking-wider">Payment Terms ::</span>
                        <div className="flex flex-col border-b border-black/5 pb-1.5">
                          {po.terms.payment_milestones && po.terms.payment_milestones.length > 0 ? (
                            po.terms.payment_milestones.map((m, idx) => (
                              <span key={idx} className="uppercase font-black flex items-center gap-2"><div className="w-1.5 h-1.5 bg-black rounded-full"></div> {m.percentage}% - {m.description}</span>
                            ))
                          ) : (
                            <span className="uppercase font-black">{po.terms.payment}</span>
                          )}
                        </div>
                        
                        <span className="uppercase text-[9px] text-gray-400 tracking-wider">Freight ::</span>
                        <span className="uppercase font-black border-b border-black/5 pb-1.5">{po.terms.freight} {po.terms.freight_amount ? `- ₹${Number(po.terms.freight_amount).toLocaleString()}` : ''}</span>
                        
                        <span className="uppercase text-[9px] text-gray-400 tracking-wider">Delivery Period ::</span>
                        <span className="uppercase font-black">{po.terms.delivery}</span>
                        {po.terms.contact_no && <><span className="uppercase text-[9px] text-gray-400 tracking-wider">Contact No ::</span> <span className="font-black">{po.terms.contact_no}</span></>}
                      </div>
                    </div>

                    <div className="text-[11px] space-y-2 mb-8 uppercase italic font-black text-black no-break border-l-4 border-[#8B0000] pl-5 py-3 text-left bg-red-50/30 rounded-r-xl">
                       <p className="flex items-center gap-3"><span className="bg-[#8B0000] text-white px-2 py-0.5 rounded text-[10px]">NOTE 1</span> <span className="underline decoration-2">E-Way bill is mandatory for Rs 50,000 and above Purchase Value.</span></p>
                       <p className="flex items-center gap-3"><span className="bg-gray-800 text-white px-2 py-0.5 rounded text-[10px]">NOTE 2</span> If we have any type of dispute from specification then we will reject material.</p>
                       {(po.terms.manual_notes || []).map((note, idx) => (
                         <p key={idx} className="flex items-center gap-3"><span className="bg-gray-800 text-white px-2 py-0.5 rounded text-[10px]">NOTE {idx + 3}</span> {note}</p>
                       ))}
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr><td><div className="page-footer-spacer"></div></td></tr>
            </tfoot>
          </table>
          <div className="page-footer-fixed"><FooterContent /></div>
        </div>
      </div>
    </div>
  );
};

export default POPreview;
