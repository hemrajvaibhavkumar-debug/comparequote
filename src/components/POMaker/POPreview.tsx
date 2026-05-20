import React, { useRef } from 'react';
import { PurchaseOrder, CompanySettings, POItem } from '../../types';
import { Download } from 'lucide-react';
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

  const updateVendor = (field: keyof PurchaseOrder['vendor_details'], value: string) => {
    setPo(prev => ({
      ...prev,
      vendor_details: { ...prev.vendor_details, [field]: value }
    }));
  };

  const updateItem = (index: number, field: keyof POItem, value: any) => {
    setPo(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      
      // Calculate total amount
      const total = newItems.reduce((acc, item) => acc + (Number(item.qty) * Number(item.rate)), 0);
      return { ...prev, items: newItems, total_amount: total };
    });
  };

  const updateTerms = (field: keyof PurchaseOrder['terms'], value: string) => {
    setPo(prev => ({
      ...prev,
      terms: { ...prev.terms, [field]: value }
    }));
  };

  const COMPANY_METADATA = {
    hemraj_ind: {
      name: "HEMRAJ INDUSTRIES PRIVATE LIMITED",
      gstin: settings?.gstin || "19AAACH8249K1Z4",
      pan: settings?.pan || "AAACH8249K",
      themeColor: "text-red-800",
      borderColor: "border-red-800"
    },
    hemraj_rice: {
      name: "HEMRAJ RICE MILL",
      gstin: "19AADFH4153N1Z2",
      pan: "AADFH4153N",
      themeColor: "text-red-700",
      borderColor: "border-red-700"
    },
    radhashyam: {
      name: "RADHASHYAM INDUSTRIES PVT. LTD.",
      gstin: "19AAGCR5957G1ZW",
      pan: "AAGCR5957G",
      themeColor: "text-red-900",
      borderColor: "border-red-900"
    }
  };

  const currentMeta = COMPANY_METADATA[po.version || 'hemraj_ind'];

  const handleDownload = async () => {
    if (!printRef.current) return;
    const canvas = await html2canvas(printRef.current, { scale: 2 });
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

  const labelClass = "font-bold text-black uppercase mb-1";

  return (
    <div className="flex flex-col items-center gap-4 text-black">
      <div className="flex gap-4 print-hidden">
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 bg-black text-white px-6 py-2 rounded-full hover:bg-black/90 transition shadow-lg font-bold text-sm"
        >
          <Download className="w-4 h-4" /> Print PO
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
          .print-hidden { display: none !important; }
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; color: black !important; }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            padding: 15mm;
            margin: 0 !important;
            box-shadow: none !important;
            background: white !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
          input {
            border: none !important;
            padding: 0 !important;
            background: transparent !important;
            appearance: none !important;
            color: black !important;
          }
        }
      `}</style>

      {/* A4 Paper Simulation */}
      <div 
        ref={printRef}
        className="bg-white shadow-2xl origin-top relative print-area text-black"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '15mm',
          paddingTop: '40mm', // Space for pre-printed letterhead
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          color: 'black'
        }}
      >
        <div className="text-center mb-8">
          <h2 className="inline-block border-b-2 border-black text-sm font-bold uppercase tracking-widest text-black">
            Purchase Order
          </h2>
        </div>

        <div className="flex justify-between items-start mb-6 text-sm text-black">
          <div>
            <p className="font-bold text-black">PO NO:: <span className="font-normal text-black">{po.po_no || 'HI /2026-27/00'}</span></p>
          </div>
          <div>
            <p className="font-bold text-black">Date : <span className="font-normal text-black">{po.date}</span></p>
          </div>
        </div>

        <div className="mb-6 text-xs text-black">
          <p className="font-bold text-black uppercase mb-1">To,</p>
          <p className="font-bold text-sm text-black">{po.vendor_name || 'VENDOR NAME'}</p>
          <p className="whitespace-pre-wrap max-w-[300px] text-black">{po.vendor_details.address}</p>
          <div className="mt-2 space-y-0.5 text-black">
            <p><span className="font-bold text-black">STATE :</span> {po.vendor_details.state}</p>
            <p><span className="font-bold text-black">GSTIN :</span> {po.vendor_details.gstin}</p>
            <p><span className="font-bold text-black">Mail ID :</span> {po.vendor_details.mail}</p>
            <p><span className="font-bold text-black">Ph :</span> {po.vendor_details.ph}</p>
          </div>
        </div>

        <p className="text-xs mb-4 italic text-black leading-relaxed">
          Dear Sir/Madam, As per your Quotation Ref No.:-<EditableText value={po.quote_ref_type || 'MAIL'} onChange={val => updatePO('quote_ref_type', val.toUpperCase())} /> Ref Date:-<EditableText value={po.quote_date || po.date} onChange={val => updatePO('quote_date', val)} />,We are sending the order so please supply the materials on urgent basis:-
        </p>

        {/* Items Table */}
        <table className="w-full border-collapse border border-black text-[10px] mb-6 text-black">
          <thead>
            <tr className="bg-white uppercase text-black border-b-2 border-black">
              <th className="border border-black p-1 w-8 text-center font-bold">S/N</th>
              <th className="border border-black p-1 text-left font-bold">Item Name</th>
              <th className="border border-black p-1 w-20 text-center font-bold">Make</th>
              <th className="border border-black p-1 w-14 text-center font-bold">Qnty</th>
              <th className="border border-black p-1 w-14 text-center font-bold">UOM</th>
              <th className="border border-black p-1 w-20 text-right font-bold">Rate</th>
              <th className="border border-black p-1 w-12 text-center font-bold">Dis%</th>
              <th className="border border-black p-1 w-16 text-center font-bold">Tax</th>
              <th className="border border-black p-1 w-24 text-right font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((item, idx) => (
              <tr key={idx} className="text-black">
                <td className="border border-black p-1 text-center font-bold">{item.sn}</td>
                <td className="border border-black p-1 uppercase">{item.itemName}</td>
                <td className="border border-black p-1 text-center uppercase">{item.make}</td>
                <td className="border border-black p-1 text-center">{Number(item.qty).toFixed(2)}</td>
                <td className="border border-black p-1 text-center uppercase">{item.uom}</td>
                <td className="border border-black p-1 text-right">{Number(item.rate).toFixed(2)}</td>
                <td className="border border-black p-1 text-center">{Number(item.discount).toFixed(2)}%</td>
                <td className="border border-black p-1 text-center">{item.tax}</td>
                <td className="border border-black p-1 text-right font-bold">{Number(item.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
            ))}
            {/* Summary Rows */}
            <tr className="text-black font-bold">
              <td colSpan={8} className="border border-black p-1 text-right uppercase">Total Item Amount</td>
              <td className="border border-black p-1 text-right">{Number(po.total_amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            </tr>
            {po.terms.freight_amount ? (
              <tr className="text-black font-bold">
                <td colSpan={8} className="border border-black p-1 text-right uppercase">Freight Amount</td>
                <td className="border border-black p-1 text-right">{Number(po.terms.freight_amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
            ) : null}
            <tr className="text-black font-black">
              <td colSpan={8} className="border border-black p-1 text-right uppercase text-xs">Grand Total Amount</td>
              <td className="border border-black p-1 text-right text-xs">₹{(Number(po.total_amount) + Number(po.terms.freight_amount || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            </tr>
          </tbody>
        </table>

        {/* Commercial Terms */}
        <div className="text-[10px] space-y-1 mb-6 text-black">
          <p className="font-bold text-xs underline mb-2">Commercial Terms::</p>
          <div className="grid grid-cols-[100px_1fr] gap-y-1">
            <span className="font-bold">Tax ::</span>
            <span>{po.terms.tax}</span>
            
            <span className="font-bold">Packing ::</span>
            <span>{po.terms.packing}</span>

            <span className="font-bold">Forwarding ::</span>
            <span>{po.terms.notes}</span>
            
            <span className="font-bold">Payment Terms ::</span>
            <span>{po.terms.payment}</span>
            
            <span className="font-bold">Freight ::</span>
            <span>{po.terms.freight} {po.terms.freight_amount ? `- ₹${Number(po.terms.freight_amount).toLocaleString()}` : ''}</span>
            
            <span className="font-bold">Delivery Period ::</span>
            <span>{po.terms.delivery}</span>
            
            {po.terms.contact_no && (
              <>
                <span className="font-bold">Contact No ::</span>
                <span>{po.terms.contact_no}</span>
              </>
            )}
          </div>
        </div>

        {/* Standard Notes */}
        <div className="text-[10px] space-y-2 mb-12 uppercase italic font-bold text-black">
           <p>NOTE 1 :: <span className="underline">E-Way bill is mandatory for Rs 50,000 and above Purchase Value , we can't accept material without it.</span></p>
           <p>NOTE 2 :: If we have any type of dispute from our required specification then, we will reject the material.</p>
        </div>

        <div className="flex justify-between items-end mt-32 text-black">
           <div className="text-left text-[10px]">
              <p className="font-bold">Yours faithfully,</p>
              <p className="font-black text-xs uppercase mt-1">{currentMeta.name}</p>
           </div>
           <div className="text-right text-[11px] font-black">
              <p>GSTIN ::{currentMeta.gstin}</p>
              <p className="mt-1">PAN :: {currentMeta.pan}</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default POPreview;
