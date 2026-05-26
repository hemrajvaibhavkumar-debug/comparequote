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

      const pagedContainer = document.querySelector('.pdf-paged-view');
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
      console.error("[generatePDFBase64] Paged Error:", e);
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
    <div className="flex items-center gap-3 w-full flex-wrap">
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
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs mr-auto bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/60 shadow-sm transition-all duration-200 disabled:opacity-50"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${submitting ? 'animate-spin' : ''}`} /> Regenerate Snapshot
        </button>
      )}
      <button 
        onClick={handlePrint}
        className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/60 shadow-sm transition-all duration-200"
      >
        <Printer className="w-3.5 h-3.5" /> Print
      </button>
      <button 
        onClick={handleDownload}
        className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5"
      >
        <Download className="w-3.5 h-3.5" /> Download PDF
      </button>

      {isApproved && (
        <button 
          onClick={handleSendToVendor}
          disabled={sending}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50"
        >
          {sending ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Mail className="w-3.5 h-3.5" />}
          Send to Vendor
        </button>
      )}

      {isPending && canApprove && (
        <div className="flex items-center gap-2 ml-auto md:ml-0">
          <button 
            onClick={() => handleStatusUpdate('REJECTED')}
            disabled={submitting}
            className="px-4 py-2 border rounded-xl font-semibold text-xs flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200/60 transition-all duration-200 disabled:opacity-50"
          >
            <XCircle className="w-3.5 h-3.5" /> Reject
          </button>
          <button 
            onClick={() => handleStatusUpdate('APPROVED')}
            disabled={submitting}
            className="px-5 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/10 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50"
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Approve & Sign
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="ambient-glow ambient-indigo -top-40 -right-40" />
      <div className="ambient-glow ambient-blue -bottom-40 -left-40" />

      {/* Glass navigation header */}
      <div className="glass-navbar px-6 py-4 sticky top-0 z-50 shadow-sm print-hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => navigate('/purchase-head')} 
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-semibold group transition-all duration-200 bg-white hover:bg-slate-100/80 px-4 py-2 rounded-xl border border-slate-200/60 shadow-sm text-sm"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to List
            </button>
            <div className="h-6 w-px bg-slate-200/80"></div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest font-sans">
               Approver Hub / PO #{po.po_no}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-8 relative z-10" ref={printRef}>
        {/* Document Preview Frame */}
        <div 
          className={`bg-white relative mb-8 min-h-[800px] transition-all duration-300 ${
            isExporting 
              ? 'rounded-none border-none shadow-none' 
              : 'rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden'
          }`}
        >
          {po.pdf_base64 && !isExporting ? (
            <div className="w-full flex flex-col">
              <div className="flex justify-end p-3 bg-slate-50/80 border-b border-slate-100 print-hidden">
                {headerActions}
              </div>
              {pdfUrl ? (
                <iframe 
                  src={`${pdfUrl}#toolbar=0&navpanes=0`} 
                  className="w-full min-h-[1100px] border-none"
                  title="Purchase Order PDF"
                />
              ) : (
                <div className="w-full min-h-[1100px] flex items-center justify-center bg-slate-50/50 text-slate-400">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
                    <p className="text-sm font-semibold text-slate-600">Loading document viewer...</p>
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
          
          {/* Hidden POPreview for capturing signed PDF */}
          {po.pdf_base64 && settings && !isExporting && (
            <div className="hidden pointer-events-none absolute opacity-0" style={{ left: '-9999px', top: '-9999px' }}>
              <POPreview po={po} setPo={() => {}} settings={settings} />
            </div>
          )}
        </div>
        
        {/* Large Action Card at the Bottom */}
        <div className={`glass-card p-8 rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-6 print-hidden border-l-4 transition-all duration-300 ${
          isApproved ? 'border-l-emerald-500' : isPending ? 'border-l-indigo-600' : 'border-l-rose-500'
        }`}>
          <div className="flex-1">
            {isPending ? (
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100/50">
                  <Stamp className="w-6 h-6 text-indigo-600 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-900 font-sans">
                    {canApprove ? 'Finalize Approval' : 'Awaiting Review'}
                  </h4>
                  <p className="text-sm text-slate-500 mt-1">
                    {canApprove 
                      ? 'Carefully review the document above. Approving will apply your signature and the company stamp.'
                      : 'This document is currently pending approval by the Purchase Head.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-2xl border ${
                  isApproved 
                    ? 'bg-emerald-50 border-emerald-100/50 text-emerald-600' 
                    : 'bg-rose-50 border-rose-100/50 text-rose-600'
                }`}>
                  {isApproved ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-900 font-sans">
                    {isApproved ? 'Order Approved' : 'Order Rejected'}
                  </h4>
                  <p className="text-sm text-slate-500 mt-1">
                    {isApproved 
                      ? `Digitally signed by ${po.approved_by || 'Admin'} on ${po.approved_at ? new Date(po.approved_at).toLocaleString() : 'N/A'}`
                      : 'This purchase order has been rejected and will not be processed.'}
                  </p>
                  {!isApproved && !isPending && po.rejection_remarks && (
                    <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-950 font-medium">
                      <span className="uppercase text-[10px] font-bold text-rose-600 block mb-1 tracking-wider">Reason for Rejection:</span>
                      {po.rejection_remarks}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-end">
            {isPending && canApprove ? (
              <>
                <button 
                  onClick={() => handleStatusUpdate('REJECTED')}
                  disabled={submitting}
                  className="px-6 py-3 border border-rose-200 rounded-xl font-bold text-sm text-rose-600 bg-white hover:bg-rose-50 flex items-center gap-2 transition-all duration-200 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" /> Reject PO
                </button>
                <button 
                  onClick={() => handleStatusUpdate('APPROVED')}
                  disabled={submitting}
                  className="px-8 py-3 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-5 h-5" /> Approve & Sign
                </button>
              </>
            ) : isApproved ? (
              <button 
                onClick={handleSendToVendor}
                disabled={sending}
                className="px-8 py-3 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 flex items-center gap-3 transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Send to Vendor
                  </>
                )}
              </button>
            ) : (
              <button 
                onClick={() => navigate('/purchase-head')}
                className="px-8 py-3 rounded-xl font-bold text-sm bg-slate-900 hover:bg-slate-800 text-white shadow-lg flex items-center gap-2 transition-all duration-200 cursor-pointer"
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
