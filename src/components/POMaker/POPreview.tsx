import React, { useRef } from 'react';
import { PurchaseOrder, CompanySettings } from '../../types';
import { Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface POPreviewProps {
  po: PurchaseOrder;
  settings: CompanySettings | null;
}

const POPreview: React.FC<POPreviewProps> = ({ po, settings }) => {
  const printRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex flex-col items-center gap-4">
      <button 
        onClick={handleDownload}
        className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-full hover:bg-green-700 transition shadow-lg font-bold text-sm"
      >
        <Download className="w-4 h-4" /> Download PDF
      </button>

      {/* A4 Paper Simulation */}
      <div 
        ref={printRef}
        className="bg-white shadow-2xl origin-top relative"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '15mm',
          paddingTop: '40mm', // Space for pre-printed letterhead
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
        }}
      >
        <div className="text-center mb-8">
          <h2 className="inline-block border-b-2 border-black text-sm font-bold uppercase tracking-widest">
            Purchase Order
          </h2>
        </div>

        <div className="flex justify-between items-start mb-6 text-sm">
          <div>
            <p className="font-bold">PO NO:: <span className="font-normal">{po.po_no || 'HI /2026-27/00'}</span></p>
          </div>
          <div>
            <p className="font-bold">Date : <span className="font-normal">{po.date}</span></p>
          </div>
        </div>

        <div className="mb-6 text-xs">
          <p className="font-bold text-gray-500 uppercase mb-1">To,</p>
          <p className="font-bold text-sm">{po.vendor_name || 'VENDOR NAME'}</p>
          <p className="whitespace-pre-wrap max-w-[300px]">{po.vendor_details.address}</p>
          <div className="mt-2 space-y-0.5">
            <p><span className="font-bold">STATE :</span> {po.vendor_details.state}</p>
            <p><span className="font-bold">GSTIN :</span> {po.vendor_details.gstin}</p>
            <p><span className="font-bold">Mail ID :</span> {po.vendor_details.mail}</p>
            <p><span className="font-bold">Ph :</span> {po.vendor_details.ph}</p>
          </div>
        </div>

        <p className="text-xs mb-4 italic">
          Dear Sir/Madam, As per your Quotation Ref No.:-MAIL Ref Date:-{po.date} ,We are sending the order so please supply the materials on urgent basis:-
        </p>

        {/* Items Table */}
        <table className="w-full border-collapse border border-black text-[10px] mb-6">
          <thead>
            <tr className="bg-gray-100 uppercase">
              <th className="border border-black p-1 w-8 text-center font-bold">S/N</th>
              <th className="border border-black p-1 text-left font-bold">Item Name</th>
              <th className="border border-black p-1 w-14 text-center font-bold">Qnty</th>
              <th className="border border-black p-1 w-14 text-center font-bold">UOM</th>
              <th className="border border-black p-1 w-20 text-right font-bold">Rate</th>
              <th className="border border-black p-1 w-16 text-center font-bold">Dis%</th>
              <th className="border border-black p-1 w-20 text-center font-bold">Tax</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((item, idx) => (
              <tr key={idx}>
                <td className="border border-black p-1 text-center font-bold">{item.sn}</td>
                <td className="border border-black p-1 uppercase">{item.itemName}</td>
                <td className="border border-black p-1 text-center">{Number(item.qty).toFixed(2)}</td>
                <td className="border border-black p-1 text-center uppercase">{item.uom}</td>
                <td className="border border-black p-1 text-right">{Number(item.rate).toFixed(2)}</td>
                <td className="border border-black p-1 text-center">{Number(item.discount).toFixed(3)}</td>
                <td className="border border-black p-1 text-center whitespace-nowrap">{item.tax || 'GST @18%'}</td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 4 - po.items.length) }).map((_, i) => (
              <tr key={`empty-${i}`} className="h-6">
                <td className="border border-black p-1"></td>
                <td className="border border-black p-1"></td>
                <td className="border border-black p-1"></td>
                <td className="border border-black p-1"></td>
                <td className="border border-black p-1"></td>
                <td className="border border-black p-1"></td>
                <td className="border border-black p-1"></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Commercial Terms */}
        <div className="text-[10px] space-y-1 mb-6">
          <p className="font-bold text-xs underline mb-2">Commercial Terms::</p>
          <p><span className="font-bold">Tax ::</span> {po.terms.tax}</p>
          <p><span className="font-bold">Packing & Forwarding ::</span> {po.terms.packing}</p>
          <p><span className="font-bold">Payment Terms ::</span> {po.terms.payment}</p>
          <p><span className="font-bold">Freight ::</span> {po.terms.freight}</p>
          <p><span className="font-bold">Delivery Period ::</span> {po.terms.delivery}</p>
          {po.terms.contact_no && <p><span className="font-bold">Contact No ::</span> {po.terms.contact_no}</p>}
        </div>

        {/* Standard Notes */}
        <div className="text-[10px] space-y-2 mb-12 uppercase italic font-bold">
           <p>NOTE 1 :: <span className="underline">E-Way bill is mandatory for Rs 50,000 and above Purchase Value , we can't accept material without it.</span></p>
           <p>NOTE 2 :: If we have any type of dispute from our required specification then, we will reject the material.</p>
        </div>

        <div className="flex justify-between items-start mt-12">
           <div className="text-left text-[10px]">
              <p className="font-bold">Yours faithfully,</p>
              <p className="font-black text-xs uppercase mt-1">{currentMeta.name}</p>
              <div className="h-16"></div>
              <p className="font-bold text-xs uppercase tracking-widest">Authorized Signatory</p>
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
