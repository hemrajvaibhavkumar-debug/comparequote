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
    address: string, 
    regd_office?: string, 
    email?: string, 
    website?: string, 
    gstin: string, 
    pan: string 
  }> = {
    hemraj_ind: {
      name: "HEMRAJ INDUSTRIES PRIVATE LIMITED",
      logo: "/hemraj_ind_logo.png",
      address: "At - Nabagram, P.O. - Ajhapur, Dist. - Purba Bardhaman, W.B. - 713401",
      regd_office: "8, Khairu Place, 2nd Floor, Room No. 209, Kolkata - 700072",
      email: "hemrajindustries@gmail.com",
      website: "www.hemrajgroup.com",
      gstin: settings?.gstin || "19AAACH8249K1Z4",
      pan: settings?.pan || "AAACH8249K",
    },
    hemraj_rice: {
      name: "HEMRAJ RICE MILL",
      logo: "/hemraj_rice_logo.png",
      address: "At - Nabagram, P.O. - Ajhapur, Dist. - Purba Bardhaman, W.B. - 713401",
      email: "hemrajricemill@gmail.com",
      website: "www.hemrajgroup.com",
      gstin: "19AADFH4153N1Z2",
      pan: "AADFH4153N",
    },
    radhashyam: {
      name: "RADHASHYAM INDUSTRIES PVT. LTD.",
      logo: "/radhashyam_logo.jpg",
      address: "At - Nabagram, P.O. - Ajhapur, Dist. - Purba Bardhaman, W.B. - 713401",
      email: "radhashyamindustries@gmail.com",
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
          /* 1. Hide everything on the page */
          body * { visibility: hidden !important; }
          
          /* 2. Show ONLY the print area and its contents */
          .print-area, .print-area * { visibility: visible !important; }

          /* 3. Force the print area to take over the whole physical page */
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

          /* 4. Reset the page margins to zero */
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }

          body { 
            background: white !important;
            margin: 0 !important;
          }

          /* 5. Handle repeating headers/footers */
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }

        /* Screen Preview */
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

      <div className="print-area-wrapper w-full flex justify-center bg-gray-100 p-4 md:p-8 flex-1 overflow-auto">
        <div ref={printRef} className="print-area">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <td className="p-0 border-none">
                  <div className="header-content flex items-start justify-between p-[10mm_15mm_5mm_15mm] border-b-2 border-black mb-6">
                    <div className="flex-1 text-left">
                      <h1 className="text-xl font-black text-black leading-tight mb-1 uppercase tracking-tight">{currentMeta.name}</h1>
                      <div className="text-[10px] text-black leading-snug">
                        <p className="font-bold">H.O. & Works:</p>
                        <p>{currentMeta.address}</p>
                        {currentMeta.regd_office && (
                          <>
                            <p className="font-bold mt-1 uppercase">Regd. Office:</p>
                            <p>{currentMeta.regd_office}</p>
                          </>
                        )}
                        <div className="flex gap-3 mt-1">
                          {currentMeta.email && <p><span className="font-bold">Email:</span> {currentMeta.email}</p>}
                          {currentMeta.website && <p><span className="font-bold">Web:</span> {currentMeta.website}</p>}
                        </div>
                      </div>
                    </div>
                    {currentMeta.logo && (
                      <div className="w-24 h-24 ml-4 flex items-center justify-center shrink-0">
                        <img src={currentMeta.logo} alt="Company Logo" className="max-w-full max-h-full object-contain" />
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td className="p-[0_15mm_5mm_15mm] border-none">
                  <div className="text-center mb-8" style={{ textAlign: 'center' }}>
                    <h2 className="inline-block border-b-2 border-black text-sm font-bold uppercase tracking-widest text-black pb-0.5" style={{ display: 'inline-block' }}>
                      Purchase Order
                    </h2>
                  </div>

                  <div className="flex justify-between items-start mb-6 text-xs text-black">
                    <div className="text-left">
                      <p className="font-bold text-black uppercase">PO NO :: <span className="font-normal text-black">{po.po_no || 'HI /2026-27/00'}</span></p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-black uppercase">Date : <span className="font-normal text-black">{po.date}</span></p>
                    </div>
                  </div>

                  <div className="mb-6 text-[11px] text-black text-left">
                    <p className="font-bold text-black uppercase mb-1">To,</p>
                    <p className="font-bold text-sm text-black uppercase">{po.vendor_name || 'VENDOR NAME'}</p>
                    <p className="whitespace-pre-wrap max-w-[400px] text-black italic">{po.vendor_details.address}</p>
                    <div className="mt-2 space-y-0.5 text-black grid grid-cols-2 gap-x-4 border-t border-black/10 pt-2">
                      <p><span className="font-bold text-black uppercase">STATE :</span> {po.vendor_details.state}</p>
                      <p><span className="font-bold text-black uppercase">GSTIN :</span> {po.vendor_details.gstin}</p>
                      <p><span className="font-bold text-black uppercase">Mail ID :</span> {po.vendor_details.mail}</p>
                      <p><span className="font-bold text-black uppercase">Ph :</span> {po.vendor_details.ph}</p>
                    </div>
                  </div>

                  <p className="text-[10px] mb-4 italic text-black leading-relaxed text-left">
                    Dear Sir/Madam, As per your Quotation Ref No.:-<EditableText value={po.quote_ref_type || 'MAIL'} onChange={val => updatePO('quote_ref_type', val.toUpperCase())} />, Ref Doc no:-<span className="text-black font-normal uppercase mx-1 underline">{po.quote_doc_no || 'N/A'}</span>, Ref Date:-<EditableText value={po.quote_date || po.date} onChange={val => updatePO('quote_date', val)} />, We are sending the order so please supply the materials on urgent basis:-
                  </p>

                  <table className="w-full border-collapse border border-black text-[9px] mb-8 text-black">
                    <thead>
                      <tr className="bg-white uppercase text-black border-b border-black">
                        <th className="border border-black p-1 w-8 text-center font-bold">S/N</th>
                        <th className="border border-black p-1 text-left font-bold">Item Name</th>
                        <th className="border border-black p-1 w-20 text-center font-bold">Make</th>
                        <th className="border border-black p-1 w-12 text-center font-bold">Qnty</th>
                        <th className="border border-black p-1 w-12 text-center font-bold">UOM</th>
                        <th className="border border-black p-1 w-16 text-right font-bold">Rate</th>
                        <th className="border border-black p-1 w-10 text-center font-bold">Dis%</th>
                        <th className="border border-black p-1 w-14 text-center font-bold">Tax</th>
                        <th className="border border-black p-1 w-20 text-right font-bold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {po.items.map((item, idx) => (
                        <tr key={idx} className="text-black">
                          <td className="border border-black p-1 text-center font-bold">{item.sn}</td>
                          <td className="border border-black p-1 uppercase font-medium">{item.itemName}</td>
                          <td className="border border-black p-1 text-center uppercase">{item.make}</td>
                          <td className="border border-black p-1 text-center">{Number(item.qty).toFixed(2)}</td>
                          <td className="border border-black p-1 text-center uppercase">{item.uom}</td>
                          <td className="border border-black p-1 text-right">{Number(item.rate).toFixed(2)}</td>
                          <td className="border border-black p-1 text-center">{Number(item.discount).toFixed(2)}%</td>
                          <td className="border border-black p-1 text-center whitespace-nowrap">{item.tax}</td>
                          <td className="border border-black p-1 text-right font-bold">{Number(item.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        </tr>
                      ))}
                      <tr className="text-black font-bold">
                        <td colSpan={8} className="border border-black p-1 text-right uppercase">Total Item Amount</td>
                        <td className="border border-black p-1 text-right">{Number(po.total_amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      </tr>
                      {po.terms.freight_amount ? (
                        <>
                          <tr className="text-black font-bold">
                            <td colSpan={8} className="border border-black p-1 text-right uppercase">Freight Amount</td>
                            <td className="border border-black p-1 text-right">{Number(po.terms.freight_amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          </tr>
                          <tr className="text-black font-bold">
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
                      <tr className="text-black font-black">
                        <td colSpan={8} className="border border-black p-1 text-right uppercase text-[10px]">Grand Total Amount</td>
                        <td className="border border-black p-1 text-right text-[10px]">
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

                  <div className="text-[10px] space-y-1 mb-6 text-black no-break border border-black/20 p-4 rounded-lg bg-gray-50/30 text-left">
                    <p className="font-bold text-[11px] underline mb-2 uppercase tracking-wide">Commercial Terms::</p>
                    <div className="grid grid-cols-[140px_1fr] gap-y-1">
                      <span className="font-bold uppercase opacity-60">Tax ::</span>
                      <span className="uppercase">{po.terms.tax}</span>
                      <span className="font-bold uppercase opacity-60">Packing ::</span>
                      <span className="uppercase">{po.terms.packing}</span>
                      <span className="font-bold uppercase opacity-60">Forwarding ::</span>
                      <span className="uppercase">{po.terms.notes}</span>
                      <span className="font-bold uppercase opacity-60">Payment Terms ::</span>
                      <div className="flex flex-col">
                        {po.terms.payment_milestones && po.terms.payment_milestones.length > 0 ? (
                          po.terms.payment_milestones.map((m, idx) => (
                            <span key={idx} className="uppercase font-bold">
                              {m.percentage}% - {m.description}
                            </span>
                          ))
                        ) : (
                          <span className="uppercase">{po.terms.payment}</span>
                        )}
                      </div>
                      <span className="font-bold uppercase opacity-60">Freight ::</span>
                      <span className="uppercase">{po.terms.freight} {po.terms.freight_amount ? `- ₹${Number(po.terms.freight_amount).toLocaleString()}` : ''}</span>
                      <span className="font-bold uppercase opacity-60">Delivery Period ::</span>
                      <span className="uppercase">{po.terms.delivery}</span>
                      {po.terms.contact_no && (
                        <>
                          <span className="font-bold uppercase opacity-60">Contact No ::</span>
                          <span>{po.terms.contact_no}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Standard & Custom Notes */}
                  <div className="text-[10px] space-y-2 mb-8 uppercase italic font-bold text-black no-break border-l-4 border-black pl-4 py-2">
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
                <td className="p-[0_15mm_10mm_15mm] border-none">
                  <div className="footer-content border-t-2 border-black pt-4">
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
                          <p className="text-[8px] mt-2 italic font-normal opacity-60">Registered under Purba Bardhaman Jurisdiction</p>
                       </div>
                    </div>
                  </div>
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
