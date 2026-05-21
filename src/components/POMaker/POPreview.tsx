import React, { useRef } from 'react';
import { PurchaseOrder, CompanySettings, POItem } from '../../types';
import { Download, Printer } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface POPreviewProps {
  po: PurchaseOrder;
  setPo: React.Dispatch<React.SetStateAction<PurchaseOrder>>;
  settings: CompanySettings | null;
}

const POPreview: React.FC<POPreviewProps> = ({ po, setPo, settings }) => {
  const printRef = useRef<HTMLDivElement>(null);

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

  const handleDownload = async () => {
    if (!printRef.current) return;
    const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`PO_${po.po_no || 'Draft'}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  const EditableText = ({ value, onChange, className = "" }: { value: string, onChange: (val: string) => void, className?: string }) => (
    <span
      contentEditable
      suppressContentEditableWarning
      className={`hover:underline focus:bg-blue-50 focus:outline-none px-0.5 rounded transition-colors inline-block text-black ${className}`}
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

  return (
    <div className="flex flex-col items-center gap-4 text-black w-full h-full overflow-hidden">
      <div className="flex gap-4 print-hidden shrink-0 py-4">
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 bg-black text-white px-6 py-2 rounded-full hover:bg-black/90 transition shadow-lg font-bold text-sm"
        >
          <Printer className="w-4 h-4" /> Print PO
        </button>
        <button 
          onClick={handleDownload}
          className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-full hover:bg-green-700 transition shadow-lg font-bold text-sm"
        >
          <Download className="w-4 h-4" /> Download PDF
        </button>
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
          }
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }
          body { 
            background: white !important;
            margin: 0 !important;
          }
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
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
      `}</style>

      <div className="print-area-wrapper w-full flex justify-center bg-gray-100 p-4 md:p-8 flex-1 overflow-auto text-black">
        <div ref={printRef} className="print-area">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <td className="p-0 border-none">
                  {/* Hemraj Industries Header */}
                  {po.version === 'hemraj_ind' && (
                    <div className="p-[10mm_15mm_5mm_15mm] mb-4">
                      <div className="flex items-start gap-4">
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
                      <div className="h-0.5 bg-black mt-4 w-full"></div>
                    </div>
                  )}

                  {/* Hemraj Rice Mill Header */}
                  {po.version === 'hemraj_rice' && (
                    <div className="p-[10mm_15mm_5mm_15mm] mb-4">
                      <div className="flex items-center justify-between border-b-2 border-black pb-2">
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
                      <div className="text-center py-1 text-[10px] font-bold border-b border-black">
                         Factory : Katwa, Burdwan Road, Burdwan - 713130, Phone : 93336 51918, 8170033618
                      </div>
                    </div>
                  )}

                  {/* Radhashyam Header */}
                  {po.version === 'radhashyam' && (
                    <div className="p-[10mm_15mm_5mm_15mm] mb-4">
                      <div className="flex justify-between items-start">
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
                      <div className="h-0.5 bg-black mt-2 w-full"></div>
                    </div>
                  )}
                </td>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td className="p-[0_15mm_5mm_15mm] border-none text-black">
                  {/* Center Body Content */}
                  <div className="text-center mb-8">
                    <h2 className="inline-block border-b-2 border-black text-sm font-bold uppercase tracking-[0.2em] text-black pb-0.5">
                      Purchase Order
                    </h2>
                  </div>

                  <div className="flex justify-between items-start mb-6 text-xs text-black">
                    <div className="border border-black p-2 rounded shadow-[1px_1px_0px_black]">
                      <p className="font-bold text-black uppercase">PO NO :: <span className="font-black text-sm">{po.po_no || 'HI /2026-27/00'}</span></p>
                    </div>
                    <div className="border border-black p-2 rounded shadow-[1px_1px_0px_black]">
                      <p className="font-bold text-black uppercase">Date : <span className="font-black text-sm">{po.date}</span></p>
                    </div>
                  </div>

                  <div className="mb-6 text-[11px] text-black flex gap-4">
                    <div className="font-bold pt-1 uppercase shrink-0">To,</div>
                    <div className="flex-1">
                      <p className="font-black text-sm text-black uppercase mb-1">{po.vendor_name || 'VENDOR NAME'}</p>
                      <p className="whitespace-pre-wrap max-w-[450px] text-black italic font-medium">{po.vendor_details.address}</p>
                      <div className="mt-2 space-y-0.5 text-black grid grid-cols-2 gap-x-8 border-t border-black/10 pt-2 font-bold">
                        <p><span className="uppercase opacity-60 text-[9px] mr-1">STATE :</span> {po.vendor_details.state}</p>
                        <p><span className="uppercase opacity-60 text-[9px] mr-1">GSTIN :</span> {po.vendor_details.gstin}</p>
                        <p><span className="uppercase opacity-60 text-[9px] mr-1">Mail ID :</span> {po.vendor_details.mail}</p>
                        <p><span className="uppercase opacity-60 text-[9px] mr-1">Ph :</span> {po.vendor_details.ph}</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] mb-4 italic text-black leading-relaxed font-bold">
                    Dear Sir/Madam, As per your Quotation Ref No.:-<EditableText value={po.quote_ref_type || 'MAIL'} onChange={val => updatePO('quote_ref_type', val.toUpperCase())} />, Ref Doc no:-<span className="text-black font-black uppercase mx-1 underline">{po.quote_doc_no || 'N/A'}</span>, Ref Date:-<EditableText value={po.quote_date || po.date} onChange={val => updatePO('quote_date', val)} />, We are sending the order so please supply the materials on urgent basis:-
                  </p>

                  <table className="w-full border-collapse border border-black text-[9px] mb-8 text-black">
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
                      {po.items.map((item, idx) => (
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
                      <tr className="text-black font-black bg-gray-50">
                        <td colSpan={8} className="border border-black p-1 text-right uppercase">Total Item Amount</td>
                        <td className="border border-black p-1 text-right">{Number(po.total_amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      </tr>
                      {po.terms.freight_amount ? (
                        <>
                          <tr className="text-black font-black bg-gray-50">
                            <td colSpan={8} className="border border-black p-1 text-right uppercase">Freight Amount</td>
                            <td className="border border-black p-1 text-right">{Number(po.terms.freight_amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          </tr>
                          <tr className="text-black font-black bg-gray-50">
                            <td colSpan={8} className="border border-black p-1 text-right uppercase">Freight GST ({po.terms.freight_tax || '18%'})</td>
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
                      <tr className="text-black font-black bg-white border-t-2 border-black">
                        <td colSpan={8} className="border border-black p-1.5 text-right uppercase text-[10px]">Grand Total Amount</td>
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

                  <div className="text-[10px] space-y-1 mb-6 text-black no-break border border-black p-4 rounded bg-gray-50/20 font-bold">
                    <p className="font-black text-[11px] underline mb-2 uppercase tracking-wide">Commercial Terms::</p>
                    <div className="grid grid-cols-[140px_1fr] gap-y-1.5">
                      <span className="opacity-60 uppercase text-[9px]">Tax ::</span>
                      <span className="uppercase">{po.terms.tax}</span>
                      
                      <span className="opacity-60 uppercase text-[9px]">Packing ::</span>
                      <span className="uppercase">{po.terms.packing}</span>

                      <span className="opacity-60 uppercase text-[9px]">Forwarding ::</span>
                      <span className="uppercase">{po.terms.notes}</span>
                      
                      <span className="opacity-60 uppercase text-[9px]">Payment Terms ::</span>
                      <div className="flex flex-col">
                        {po.terms.payment_milestones && po.terms.payment_milestones.length > 0 ? (
                          po.terms.payment_milestones.map((m, idx) => (
                            <span key={idx} className="uppercase font-black">
                              {m.percentage}% - {m.description}
                            </span>
                          ))
                        ) : (
                          <span className="uppercase">{po.terms.payment}</span>
                        )}
                      </div>
                      <span className="opacity-60 uppercase text-[9px]">Freight ::</span>
                      <span className="uppercase">{po.terms.freight} {po.terms.freight_amount ? `- ₹${Number(po.terms.freight_amount).toLocaleString()}` : ''}</span>
                      
                      <span className="opacity-60 uppercase text-[9px]">Delivery Period ::</span>
                      <span className="uppercase">{po.terms.delivery}</span>
                      
                      {po.terms.contact_no && (
                        <>
                          <span className="opacity-60 uppercase text-[9px]">Contact No ::</span>
                          <span>{po.terms.contact_no}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-[10px] space-y-2 mb-8 uppercase italic font-black text-black no-break border-l-4 border-black pl-4 py-2">
                     <p>NOTE 1 :: <span className="underline">E-Way bill is mandatory for Rs 50,000 and above Purchase Value , we can't accept material without it.</span></p>
                     <p>NOTE 2 :: If we have any type of dispute from our required specification then, we will reject the material.</p>
                     {(po.terms.manual_notes || []).map((note, idx) => (
                       <p key={idx}>NOTE {idx + 3} :: {note}</p>
                     ))}
                  </div>
                </td>
              </tr>
            </tbody>

            <tfoot>
              <tr>
                <td className="p-[0_15mm_10mm_15mm] border-none text-black">
                  {/* Hemraj Industries Footer */}
                  {po.version === 'hemraj_ind' && (
                    <div className="text-center font-bold text-[9px] border-t border-b border-black py-2">
                       <p className="uppercase leading-tight">
                         Regd. Office : 46B Rafi Ahmed Kidwai Road, 1st Floor, Kolkata-700 016
                         <br/>
                         Fax: +91 33 2229 2340, Ph: +91 33 2229 8038 / 4064 9316 /2265 4742
                       </p>
                       <p className="mt-1">
                         Factory : Vill. P.O. Chandul, G.T. Road, Burdwan (W. B.) Pin : 713141
                       </p>
                       <p className="mt-1">
                         Rice Mili Unit Ph. : +91 9064358638 / 9332148120, Oils Unit Ph. : 81 70035066 /8170035064
                       </p>
                    </div>
                  )}

                  {/* Standard Signatory block for other companies */}
                  {po.version !== 'hemraj_ind' && po.version !== 'radhashyam' && (
                    <div className="border-t-2 border-black pt-4">
                      <div className="flex justify-between items-end">
                        <div className="text-left text-[10px]">
                            <p className="font-bold">Yours faithfully,</p>
                            <p className="font-black text-xs uppercase mt-1 mb-10">{currentMeta.name}</p>
                            <div className="border-t border-black w-40 pt-1">
                              <p className="font-bold uppercase text-[9px]">(Authorized Signatory)</p>
                            </div>
                        </div>
                        <div className="text-right text-[10px] font-bold space-y-0.5">
                            <p>GSTIN : <span className="font-black">{currentMeta.gstin}</span></p>
                            <p>PAN : <span className="font-black">{currentMeta.pan}</span></p>
                            <p className="text-[8px] mt-2 italic font-normal opacity-60 text-black">Registered under Purba Bardhaman Jurisdiction</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Radhashyam Footer */}
                  {po.version === 'radhashyam' && (
                    <div className="border-t border-black pt-2 text-center font-bold text-[9px]">
                       <p className="uppercase italic">
                         Factory Address : Bhasapul, P.O. : Pursha, P.S. : Galsi, Dist. : Burdwan, PIN:713406, West Bengal, Ph.:+91 8170021522/526/527
                       </p>
                    </div>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default POPreview;
