import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, ArrowLeft, Download, ShieldCheck, Stamp, Printer, Mail, Send, RotateCcw } from 'lucide-react';
import POPreview from './components/POMaker/POPreview';
import { useAuth } from './context/AuthContext';
import { PurchaseOrder, CompanySettings } from './types';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';

export default function POApprovalView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const canApprove = user?.role === 'SUPERADMIN' || user?.permissions.includes('APPROVE_PO');

  useEffect(() => {
    if (po?.pdf_base64) {
      try {
        const byteCharacters = atob(po.pdf_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        
        return () => URL.revokeObjectURL(url);
      } catch (e) {
        console.error("Error creating PDF blob URL", e);
      }
    }
  }, [po?.pdf_base64]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [poRes, settingsRes] = await Promise.all([
          fetch(`/api/po/${id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/settings/company', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        
        if (poRes.ok && settingsRes.ok) {
          const poData = await poRes.json();
          const settingsData = await settingsRes.json();
          setPo(poData);
          setSettings(settingsData);
        }
      } catch (e) {
        console.error("Fetch error", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, token]);

  const handleStatusUpdate = async (newStatus: 'APPROVED' | 'REJECTED') => {
    if (!canApprove) return;
    
    let remarks = '';
    if (newStatus === 'REJECTED') {
      remarks = window.prompt("Please enter the reason for rejection:", "") || "";
      if (remarks === null) return; // User cancelled
      if (remarks.trim() === "") {
        alert("A reason is required for rejection.");
        return;
      }
    } else {
      if (!window.confirm(`Are you sure you want to approve this Purchase Order?`)) return;
    }
    
    try {
      setSubmitting(true);
      
      let pdf_base64 = po?.pdf_base64;
      
      // If approving, we need to generate a new SIGNED PDF snapshot
      if (newStatus === 'APPROVED') {
        // Temporarily set status to APPROVED in local state to render signatures for capture
        const signedPo = { ...po!, status: 'APPROVED', approved_at: new Date().toISOString(), approved_by: user?.username || 'Admin' };
        setPo(signedPo);
        
        // Wait for render cycle to apply signatures in the hidden POPreview
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const generated = await generatePDFBase64();
        if (generated) {
          pdf_base64 = generated;
        }
      }

      const res = await fetch(`/api/po/${id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus, remarks, pdf_base64 })
      });
      
      if (res.ok) {
        const updatedPo = await res.json();
        setPo(updatedPo);
        alert(`PO has been ${newStatus.toLowerCase()} successfully.`);
      } else {
        alert("Failed to update status");
      }
    } catch (e) {
      console.error(e);
      alert("Error updating status");
    } finally {
      setSubmitting(false);
    }
  };

  const generatePDFBase64 = async (): Promise<string | null> => {
    if (!printRef.current || !po) {
      console.error("[generatePDFBase64] Missing ref or PO data");
      return null;
    }
    try {
      // 1. Switch to Paged Mode for capture
      setIsExporting(true);
      // Wait for React to render the paged view
      await new Promise(resolve => setTimeout(resolve, 800));

      const pagedContainer = printRef.current.querySelector('.pdf-paged-view');
      if (!pagedContainer) {
        console.error("[generatePDFBase64] Paged container not found");
        setIsExporting(false);
        return null;
      }

      const pages = pagedContainer.querySelectorAll('.pdf-page');
      if (pages.length === 0) {
        console.error("[generatePDFBase64] No pages found to capture");
        setIsExporting(false);
        return null;
      }

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();
        
        const pageEl = pages[i] as HTMLElement;
        const canvas = await htmlToImage.toPng(pageEl, { 
          pixelRatio: 2, 
          backgroundColor: '#ffffff',
          style: { margin: '0', padding: '0' }
        });

        pdf.addImage(canvas, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      }

      const pdfOutput = pdf.output('datauristring');
      setIsExporting(false);
      return pdfOutput.split(',')[1];
    } catch (e) {
      console.error("[generatePDFBase64] Multi-page generation error:", e);
      setIsExporting(false);
      return null;
    }
  };

  const handleSendToVendor = async () => {
    if (!po || po.status !== 'APPROVED') return;

    const vendorEmail = po.vendor_details?.mail;
    if (!vendorEmail) {
      alert("Vendor email is missing. Please update the vendor details first.");
      return;
    }

    const companyNames: Record<string, string> = {
      hemraj_ind: "HEMRAJ INDUSTRIES PRIVATE LIMITED",
      hemraj_rice: "HEMRAJ RICE MILL",
      radhashyam: "RADHASHYAM INDUSTRIES PVT. LTD."
    };

    const companyName = companyNames[po.version || 'hemraj_ind'] || "Hemraj Industries";

    if (!window.confirm(`Send PO #${po.po_no} from ${companyName} to ${vendorEmail}?`)) return;

    try {
      setSending(true);
      
      // Use stored PDF if available (which should be the signed version if approved)
      const pdfBase64 = po.pdf_base64 || await generatePDFBase64();

      if (!pdfBase64) {
        alert("Failed to generate PDF for sending.");
        return;
      }

      const res = await fetch(`/api/po/${id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          poNo: po.po_no,
          vendorEmail: vendorEmail,
          vendorName: po.vendor_name,
          companyName: companyName,
          pdfBase64: pdfBase64
        })
      });
      if (res.ok) {
        alert("Purchase Order has been sent to the vendor successfully.");
      } else {
        const data = await res.json();
        alert(`Failed to send PO: ${data.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.error(e);
      alert("Error sending PO to vendor.");
    } finally {
      setSending(false);
    }
  };

  const handleDownload = async () => {
    if (!po) return;
    
    // If we have a stored PDF, download it directly
    if (po.pdf_base64) {
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${po.pdf_base64}`;
      link.download = `PO_${po.po_no || 'Draft'}.pdf`;
      link.click();
      return;
    }

    if (!printRef.current) return;
    try {
      setSubmitting(true);
      const generated = await generatePDFBase64();
      if (generated) {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${generated}`;
        link.download = `PO_${po.po_no || 'Draft'}.pdf`;
        link.click();
      }
    } catch (e) {
      console.error("Download error", e);
      alert("Failed to generate PDF");
    } finally {
      setSubmitting(false);
    }
  };
  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderBottomColor: '#2563eb' }}></div></div>;
  if (!po) return <div className="p-8 text-center text-black">PO not found</div>;

  const rawStatus = po.status || 'PENDING';
  const poStatus = rawStatus.toUpperCase();
  const isApproved = poStatus === 'APPROVED';
  const isPending = poStatus === 'PENDING';

  // Header Actions to be passed to POPreview
  const headerActions = (
    <>
      {po.pdf_base64 && (
        <button 
          onClick={async () => {
            if (!window.confirm("Regenerate the PDF snapshot? This can fix display issues.")) return;
            try {
              setSubmitting(true);
              const generated = await generatePDFBase64();
              if (generated) {
                const res = await fetch(`/api/po/${id}/status`, {
                  method: 'PUT',
                  headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({ status: po.status, pdf_base64: generated })
                });
                if (res.ok) {
                  const updatedPo = await res.json();
                  setPo(updatedPo);
                  alert("Snapshot regenerated successfully.");
                }
              }
            } catch (e) {
              console.error(e);
              alert("Failed to regenerate snapshot.");
            } finally {
              setSubmitting(false);
            }
          }}
          disabled={submitting}
          style={{ backgroundColor: '#f3f4f6', color: '#374151' }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm mr-auto"
        >
          <RotateCcw className={`w-4 h-4 ${submitting ? 'animate-spin' : ''}`} /> Regenerate Snapshot
        </button>
      )}
      <button 
        onClick={handlePrint}
        style={{ backgroundColor: '#f3f4f6', color: '#374151' }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm"
      >
        <Printer className="w-4 h-4" /> Print
      </button>
      <button 
        onClick={handleDownload}
        style={{ backgroundColor: '#16a34a', color: '#ffffff' }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg shadow-md font-bold text-sm"
      >
        <Download className="w-4 h-4" /> Download PDF
      </button>

      {isApproved && (
        <button 
          onClick={handleSendToVendor}
          disabled={sending}
          style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg shadow-md font-bold text-sm"
        >
          {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Mail className="w-4 h-4" />}
          Send to Vendor
        </button>
      )}

      {isPending && canApprove && (
        <>
          <button 
            onClick={() => handleStatusUpdate('REJECTED')}
            disabled={submitting}
            style={{ backgroundColor: '#fef2f2', color: '#dc2626', borderColor: '#fee2e2' }}
            className="px-4 py-2 border rounded-lg font-bold text-sm flex items-center gap-2 ml-2"
          >
            <XCircle className="w-4 h-4" /> Reject
          </button>
          <button 
            onClick={() => handleStatusUpdate('APPROVED')}
            disabled={submitting}
            style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
            className="px-6 py-2 rounded-lg font-bold shadow-md flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" /> Approve & Sign
          </button>
        </>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-50 shadow-sm print-hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/purchase-head')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium group transition-colors">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to List
            </button>
            <div className="h-6 w-px bg-gray-200"></div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
               Approver Hub / PO #{po.po_no}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-8" ref={printRef}>
        <div 
          className="bg-white rounded-none relative mb-8 min-h-[800px]"
          style={{ 
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e5e7eb'
          }}
        >
          {po.pdf_base64 && !isExporting ? (
            <div className="w-full flex flex-col">
              <div className="flex justify-end p-2 bg-gray-50 border-b border-gray-200 print-hidden">
                {headerActions}
              </div>
              {pdfUrl ? (
                <iframe 
                  src={`${pdfUrl}#toolbar=0&navpanes=0`} 
                  className="w-full min-h-[1100px] border-none"
                  title="Purchase Order PDF"
                />
              ) : (
                <div className="w-full min-h-[1100px] flex items-center justify-center bg-gray-50 text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-sm font-medium">Loading document viewer...</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            settings && (
              <POPreview 
                po={po} 
                setPo={() => {}} 
                settings={settings} 
                actions={headerActions}
                isPDF={isExporting}
              />
            )
          )}
          
          {/* Hidden POPreview for re-generating signed PDF if needed or if PDF is being displayed */}
          {po.pdf_base64 && settings && !isExporting && (
            <div className="hidden pointer-events-none absolute opacity-0" style={{ left: '-9999px', top: '-9999px' }}>
              <POPreview po={po} setPo={() => {}} settings={settings} />
            </div>
          )}
        </div>
        
        {/* Large Action Card at the Bottom */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 print-hidden border-b-4 border-b-blue-600">
          <div className="flex-1">
            {isPending ? (
              <div className="flex items-start gap-3">
                <div className="p-3 bg-blue-50 rounded-xl">
                  <Stamp className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900">
                    {canApprove ? 'Finalize Approval' : 'Awaiting Review'}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {canApprove 
                      ? 'Carefully review the document above. Approving will apply your signature and the company stamp.'
                      : 'This document is currently pending approval by the Purchase Head.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className={`p-3 rounded-xl ${isApproved ? 'bg-green-50' : 'bg-red-50'}`}>
                  {isApproved ? <CheckCircle className="w-6 h-6 text-green-600" /> : <XCircle className="w-6 h-6 text-red-600" />}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900">{isApproved ? 'Order Approved' : 'Order Rejected'}</h4>
                  <p className="text-sm text-gray-500">
                    {isApproved 
                      ? `Digitally signed by ${po.approved_by || 'Admin'} on ${po.approved_at ? new Date(po.approved_at).toLocaleString() : 'N/A'}`
                      : 'This purchase order has been rejected and will not be processed.'}
                  </p>
                  {!isApproved && !isPending && po.rejection_remarks && (
                    <div className="mt-3 p-3 bg-red-100/50 border-l-4 border-red-500 rounded text-sm text-red-900 font-bold">
                      <span className="uppercase text-[10px] opacity-60 block mb-1">Reason for Rejection:</span>
                      {po.rejection_remarks}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {isPending && canApprove ? (
              <>
                <button 
                  onClick={() => handleStatusUpdate('REJECTED')}
                  disabled={submitting}
                  style={{ backgroundColor: '#ffffff', color: '#dc2626', borderColor: '#fecaca' }}
                  className="px-8 py-3.5 border rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm"
                >
                  <XCircle className="w-5 h-5" /> Reject PO
                </button>
                <button 
                  onClick={() => handleStatusUpdate('APPROVED')}
                  disabled={submitting}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                  className="px-10 py-3.5 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
                >
                  <ShieldCheck className="w-6 h-6" /> Approve & Sign
                </button>
              </>
            ) : isApproved ? (
              <button 
                onClick={handleSendToVendor}
                disabled={sending}
                style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                className="px-10 py-3.5 rounded-xl font-bold shadow-lg flex items-center gap-3 transition-all transform hover:-translate-y-0.5"
              >
                {sending ? (
                  <>
                    <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" /> Send to Vendor
                  </>
                )}
              </button>
            ) : (
              <button 
                onClick={() => navigate('/purchase-head')}
                style={{ backgroundColor: '#111827', color: '#ffffff' }}
                className="px-10 py-3.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"
              >
                Return to Hub
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
