import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, XCircle, ArrowLeft, Download, ShieldCheck, Stamp, Printer, Mail, Send, RotateCcw, MessageSquare, StickyNote, ChevronRight, User } from 'lucide-react';
import POPreview from './components/POMaker/POPreview';
import { ComparisonTable } from './components/ComparisonTable';
import { useAuth } from './context/AuthContext';
import { PurchaseOrder, CompanySettings } from './types';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import CommentsModal from './components/CommentsModal';
import { useToast } from './context/ToastContext';

export default function POApprovalView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [comparisonRecord, setComparisonRecord] = useState<any | null>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const comparisonTableRef = useRef<HTMLDivElement>(null);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<'PENDING_L2' | 'APPROVED' | null>(null);
  const [approverName, setApproverName] = useState('');
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState('');

  const canApproveL1 = user?.role === 'SUPERADMIN' || user?.permissions.includes('APPROVE_PO_L1');
  const canApproveL2 = user?.role === 'SUPERADMIN' || user?.permissions.includes('APPROVE_PO');
  const canAddNote = user?.role === 'SUPERADMIN' || user?.permissions.includes('ADD_INTERNAL_COMMENTS');
  const hasHubAccess = user?.role === 'SUPERADMIN' || user?.permissions.includes('VIEW_APPROVAL_HUB') || user?.permissions.includes('APPROVE_PO') || user?.permissions.includes('APPROVE_PO_L1');

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

          // Fetch associated comparison table if quote_doc_no exists
          if (poData.quote_doc_no) {
            setLoadingComparison(true);
            try {
              const compRes = await fetch(`/api/comparisons/by-doc/${encodeURIComponent(poData.quote_doc_no)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (compRes.ok) {
                const compData = await compRes.json();
                setComparisonRecord(compData);
              } else {
                console.warn(`Comparison table ${poData.quote_doc_no} not found`);
              }
            } catch (err) {
              console.error("Failed to fetch associated comparison table", err);
            } finally {
              setLoadingComparison(false);
            }
          }
        }
      } catch (e) {
        console.error("Fetch error", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, token]);

  const handleStatusUpdate = async (newStatus: 'PENDING_L2' | 'APPROVED' | 'REJECTED') => {
    if (newStatus === 'PENDING_L2' && !canApproveL1) return;
    if (newStatus === 'APPROVED' && !canApproveL2) return;
    
    if (newStatus === 'REJECTED') {
      setShowRejectModal(true);
      return;
    } else if (newStatus === 'APPROVED') {
      // Final Approval: Default to ROHIT AGGARWAL and skip modal
      if (!window.confirm(`Are you sure you want to finalize and sign this Purchase Order?`)) return;
      executeStatusUpdate('APPROVED', '', 'ROHIT AGGARWAL');
    } else {
      // L1 Approval: Still prompt for name
      setPendingStatusUpdate(newStatus);
      setApproverName(user?.username || '');
      setShowApproveModal(true);
    }
  };

  const executeStatusUpdate = async (newStatus: 'PENDING_L2' | 'APPROVED' | 'REJECTED', remarks: string, customApprover?: string) => {
    try {
      setSubmitting(true);
      
      let pdf_base64 = po?.pdf_base64;
      
      // If approving final, we need to generate a new SIGNED PDF snapshot
      if (newStatus === 'APPROVED') {
        // Temporarily set status to APPROVED in local state to render signatures for capture
        const signedPo = { ...po!, status: 'APPROVED', approved_at: new Date().toISOString(), approved_by: customApprover || user?.username || 'Admin' };
        setPo(signedPo);
        
        // IMPORTANT: We need to make sure isExporting is true before capturing
        setIsExporting(true);
        
        // Wait for render cycle to apply signatures and for paged view to appear
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const generated = await generatePDFBase64Internal();
        if (generated) {
          pdf_base64 = generated;
        } else {
          showToast("Critical: Failed to generate signed PDF snapshot. Approval aborted.", "error");
          setPo(po); // Revert local state
          setSubmitting(false);
          setIsExporting(false);
          return;
        }
        setIsExporting(false);
      }

      const body: any = { status: newStatus, remarks, pdf_base64 };
      if (newStatus === 'PENDING_L2' && customApprover) body.l1_approved_by = customApprover;
      if (newStatus === 'APPROVED' && customApprover) body.approved_by = customApprover;

      const res = await fetch(`/api/po/${id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        const updatedPo = await res.json();
        setPo(updatedPo);
        setShowRejectModal(false);
        setRejectRemarks('');
        showToast(`PO has been ${newStatus.toLowerCase()} successfully.`);
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to update status", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error updating status", "error");
    } finally {
      setSubmitting(false);
      setIsExporting(false);
    }
  };

  const generatePDFBase64Internal = async (): Promise<string | null> => {
    try {
      const pagedContainer = document.querySelector('.pdf-paged-view');
      if (!pagedContainer) {
        console.error("[generatePDFBase64Internal] Paged container not found");
        return null;
      }

      const pages = pagedContainer.querySelectorAll('.pdf-page');
      if (pages.length === 0) {
        console.error("[generatePDFBase64Internal] No pages found to capture");
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
      return pdfOutput.split(',')[1];
    } catch (e) {
      console.error("[generatePDFBase64Internal] Paged Error:", e);
      return null;
    }
  };

  const generatePDFBase64 = async (): Promise<string | null> => {
    setIsExporting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const result = await generatePDFBase64Internal();
    setIsExporting(false);
    return result;
  };

  const executeSendToVendor = async () => {
    if (!po) return;

    const vendorEmail = po.vendor_details?.mail;
    const companyNames: Record<string, string> = {
      hemraj_ind: "HEMRAJ INDUSTRIES PRIVATE LIMITED",
      hemraj_rice: "HEMRAJ RICE MILL",
      radhashyam: "RADHASHYAM INDUSTRIES PVT. LTD."
    };
    const companyName = companyNames[po.version || 'hemraj_ind'] || "Hemraj Industries";
    const formattedDate = po.date ? po.date.split('-').reverse().join('-') : '';

    try {
      setSending(true);
      const pdfBase64 = po.pdf_base64 || await generatePDFBase64();

      if (!pdfBase64) {
        showToast("Failed to generate PDF for sending.", "error");
        return;
      }

      const res = await fetch(`/api/po/${id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          poNo: po.po_no.replace(/\//g, '_'),
          vendorEmail: vendorEmail,
          vendorName: po.vendor_name,
          companyName: companyName,
          date: po.date,
          createdBy: po.created_by_name,
          ccEmails: po.vendor_details?.cc || '',
          contact_no: (po.terms?.contact_no || '').split(' - ')[0],
          pdfBase64: pdfBase64
        })
      });
      if (res.ok) {
        showToast("Purchase Order has been sent to the vendor successfully.");
      } else {
        const data = await res.json();
        showToast(`Failed to send PO: ${data.error || 'Unknown error'}`, "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error sending PO to vendor.", "error");
    } finally {
      setSending(false);
    }
  };

  const handleSendToVendor = () => {
    if (!po || po.status !== 'APPROVED') return;
    
    if (!po.vendor_details?.mail) {
      showToast("Vendor email is missing. Please update the vendor details first.", "error");
      return;
    }

    const recipient = po.vendor_details?.mail || '';
    const cc = po.vendor_details?.cc ? ` (CC: ${po.vendor_details?.cc})` : '';
    if (window.confirm(`Are you sure you want to send PO #${po.po_no} to ${recipient}${cc}?`)) {
      executeSendToVendor();
    }
  };

  const handleDownload = async () => {
    if (!po) return;
    
    // If we have a stored PDF, download it directly
    if (po.pdf_base64) {
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${po.pdf_base64}`;
      link.download = `PO_${(po.po_no || 'Draft').replace(/\//g, '_')}.pdf`;
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
        link.download = `PO_${(po.po_no || 'Draft').replace(/\//g, '_')}.pdf`;
        link.click();
      }
    } catch (e) {
      console.error("Download error", e);
      showToast("Failed to generate PDF", "error");
    } finally {
      setSubmitting(false);
    }
  };
  const handleAddComment = async (text: string) => {
    if (!po) return;
    try {
      const res = await fetch(`/api/po/${po.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const updatedPO = await res.json();
        setPo(updatedPO);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateComment = async (commentId: string, text: string) => {
    if (!po) return;
    try {
      const res = await fetch(`/api/po/${po.id}/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const updatedPO = await res.json();
        setPo(updatedPO);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!po) return;
    try {
      const res = await fetch(`/api/po/${po.id}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const updatedPO = await res.json();
        setPo(updatedPO);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="flex justify-center items-center min-h-screen bg-slate-50 dark:bg-slate-950"><div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderBottomColor: '#2563eb' }}></div></div>;
  if (!po) return <div className="p-8 text-center text-black dark:text-white dark:bg-slate-950 min-h-screen">PO not found</div>;

  const rawStatus = po.status || 'PENDING';
  const poStatus = rawStatus.toUpperCase();
  const isApproved = poStatus === 'APPROVED';
  const isPendingL1 = poStatus === 'PENDING';
  const isPendingL2 = poStatus === 'PENDING_L2';
  const isPending = isPendingL1 || isPendingL2;

  // Modal Recipients & Company Info
  const vendorEmail = po?.vendor_details?.mail || '';
  const companyNames: Record<string, string> = {
    hemraj_ind: "HEMRAJ INDUSTRIES PRIVATE LIMITED",
    hemraj_rice: "HEMRAJ RICE MILL",
    radhashyam: "RADHASHYAM INDUSTRIES PVT. LTD."
  };
  const companyName = companyNames[po?.version || 'hemraj_ind'] || "Hemraj Industries";

  // Header Actions to be passed to POPreview
  const headerActions = (
    <div className="flex items-center gap-3 w-full flex-wrap">
      {isApproved && (
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
                  showToast("Snapshot regenerated successfully.");
                }
              }
            } catch (e) {
              console.error(e);
              showToast("Failed to regenerate snapshot.", "error");
            } finally {
              setSubmitting(false);
            }
          }}
          disabled={submitting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest mr-auto bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-200 disabled:opacity-50 cursor-pointer"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${submitting ? 'animate-spin' : ''}`} /> Regenerate Snapshot
        </button>
      )}
      <button 
        onClick={handlePrint}
        className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-200 cursor-pointer"
      >
        <Printer className="w-3.5 h-3.5" /> Print
      </button>
      <button 
        onClick={handleDownload}
        className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" /> Download PDF
      </button>

      <button 
        onClick={handleSendToVendor}
        disabled={sending || !isApproved}
        className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer disabled:cursor-not-allowed"
        title={!isApproved ? "PO must be approved and signed before sending to vendor" : ""}
      >
        {sending ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Mail className="w-3.5 h-3.5" />}
        Send to Vendor
      </button>

      {isPendingL1 && canApproveL1 && (
        <div className="flex items-center gap-2 ml-auto md:ml-0">
          <button 
            onClick={() => handleStatusUpdate('REJECTED')}
            disabled={submitting}
            className="px-4 py-2 border rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 transition-all duration-200 disabled:opacity-50 cursor-pointer"
          >
            <XCircle className="w-3.5 h-3.5" /> Reject
          </button>
          <button 
            onClick={() => handleStatusUpdate('PENDING_L2')}
            disabled={submitting}
            className="px-5 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/10 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Approve L1
          </button>
        </div>
      )}

      {isPendingL2 && canApproveL2 && (
        <div className="flex items-center gap-2 ml-auto md:ml-0">
          <button 
            onClick={() => handleStatusUpdate('REJECTED')}
            disabled={submitting}
            className="px-4 py-2 border rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 transition-all duration-200 disabled:opacity-50 cursor-pointer"
          >
            <XCircle className="w-3.5 h-3.5" /> Reject
          </button>
          <button 
            onClick={() => handleStatusUpdate('APPROVED')}
            disabled={submitting}
            className="px-5 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/10 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Final Approve & Sign
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 pb-20 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="ambient-glow ambient-indigo -top-40 -right-40" />
      <div className="ambient-glow ambient-blue -bottom-40 -left-40" />

      {/* Glass navigation header */}
      <div className="glass-navbar sticky top-0 z-[45] shadow-sm print-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(hasHubAccess ? '/purchase-head' : '/saved-pos')} 
              className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-semibold group transition-all duration-200 bg-white dark:bg-slate-900 hover:bg-slate-100/80 dark:hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> Back to List
            </button>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800"></div>
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] font-sans">
               Approver Hub / PO #{po.po_no}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-4 pt-2 sm:px-8 sm:pb-8 sm:pt-2 relative z-0" ref={printRef}>
        {/* Document Preview Frame */}
        <div 
          className={`bg-white dark:bg-white relative mb-8 min-h-[800px] transition-all duration-300 ${
            isExporting 
              ? 'rounded-none border-none shadow-none' 
              : 'rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden'
          }`}
        >
          {po.pdf_base64 && !isExporting ? (
            <div className="w-full flex flex-col">
              <div className="flex justify-end p-3 bg-slate-50/80 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 print-hidden">
                {headerActions}
              </div>
              {pdfUrl ? (
                <iframe 
                  src={`${pdfUrl}#toolbar=0&navpanes=0`} 
                  className="w-full min-h-[1100px] border-none"
                  title="Purchase Order PDF"
                />
              ) : (
                <div className="w-full min-h-[1100px] flex items-center justify-center bg-slate-50/50 dark:bg-slate-950 text-slate-400 dark:text-slate-600">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Loading document viewer...</p>
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
        
        {/* Associated Quotation Comparison Section */}
        {comparisonRecord && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-8 print-hidden transition-colors">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg shadow-md">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2.5"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Original Quotation Comparison</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5 uppercase tracking-wide">Ref Doc: #{comparisonRecord.doc_no} • Created by @{comparisonRecord.data?.header?.preparedBy || 'N/A'}</p>
                </div>
              </div>
              <Link 
                to={`/saved/${comparisonRecord.id}`}
                className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
              >
                Open Full Table <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="p-6 overflow-auto">
              <ComparisonTable 
                data={comparisonRecord.data?.data || { items: [], vendors: [] }} 
                setData={() => {}} 
                header={comparisonRecord.data?.header || {}} 
                tableRef={comparisonTableRef} 
                readOnly={true} 
              />
            </div>
          </div>
        )}
        
        {/* Internal Notes Section */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-8 print-hidden transition-colors">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg shadow-md">
                <StickyNote className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Comments</h3>
            </div>
            <button 
              onClick={() => setIsCommentsOpen(true)}
              className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
            >
              {canAddNote ? 'Add Point' : 'View All'} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-6">
            {!po.internal_comments || po.internal_comments.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold italic uppercase tracking-widest">No internal points recorded for this PO.</p>
            ) : (
              <div className="space-y-5">
                {po.internal_comments.slice(-3).map((note, idx) => (
                  <div key={note.id || idx} className="flex gap-3 text-sm items-start">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-slate-100 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">@{note.author}</span>
                        <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{new Date(note.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 font-semibold leading-relaxed line-clamp-3">{note.text}</p>
                    </div>
                  </div>
                ))}
                {po.internal_comments.length > 3 && (
                  <button onClick={() => setIsCommentsOpen(true)} className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 uppercase tracking-widest mt-2 cursor-pointer flex items-center gap-1">
                    View all {po.internal_comments.length} points <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Large Action Card at the Bottom */}
        <div className={`glass-card p-8 rounded-3xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-6 print-hidden border-l-4 transition-all duration-300 ${
          isApproved ? 'border-l-emerald-500' : isPending ? 'border-l-indigo-600' : 'border-l-rose-500'
        }`}>
          <div className="flex-1">
            {isPending ? (
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100/50 dark:border-indigo-800/50">
                  <Stamp className="w-6 h-6 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 dark:text-slate-100 font-sans tracking-tight uppercase">
                    {(canApproveL1 || canApproveL2) ? 'Finalize Approval' : 'Awaiting Review'}
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                    {(canApproveL1 || canApproveL2) 
                      ? 'Carefully review the document above. Approving will apply your signature and the company stamp.'
                      : 'This document is currently pending approval by the Purchase Head.'}
                  </p>
                  {po.created_by_name && (
                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em]">Original Creator:</span>
                        <span className="text-[10px] font-black text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs uppercase tracking-tight">{po.created_by_name}</span>
                      </div>
                      {po.l1_approved_by && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-[0.1em]">L1 Approved By:</span>
                          <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-900/50 shadow-xs uppercase tracking-tight">@{po.l1_approved_by}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-2xl border ${
                  isApproved 
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100/50 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-rose-50 dark:bg-rose-900/20 border-rose-100/50 dark:border-rose-800/50 text-rose-600 dark:text-rose-400'
                }`}>
                  {isApproved ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 dark:text-slate-100 font-sans tracking-tight uppercase">
                    {isApproved ? 'Order Approved' : 'Order Rejected'}
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                    {isApproved 
                      ? `Digitally signed by @${po.approved_by || 'Admin'} on ${po.approved_at ? new Date(po.approved_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'N/A'}`
                      : 'This purchase order has been rejected and will not be processed.'}
                  </p>
                  {!isApproved && !isPending && po.rejection_remarks && (
                    <div className="mt-4 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-xl text-sm text-rose-950 dark:text-rose-100 font-semibold italic">
                      <span className="uppercase text-[9px] font-black text-rose-600 dark:text-rose-400 block mb-1 tracking-[0.2em]">Reason for Rejection:</span>
                      "{po.rejection_remarks}"
                    </div>
                  )}
                  {po.created_by_name && (
                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em]">Original Creator:</span>
                        <span className="text-[10px] font-black text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs uppercase tracking-tight">{po.created_by_name}</span>
                      </div>
                      {po.l1_approved_by && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-[0.1em]">L1 Approved By:</span>
                          <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-900/50 shadow-xs uppercase tracking-tight">@{po.l1_approved_by}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-end">
            {isPendingL1 && canApproveL1 ? (
              <>
                <button 
                  onClick={() => handleStatusUpdate('REJECTED')}
                  disabled={submitting}
                  className="px-6 py-3 border border-rose-200 dark:border-rose-800 rounded-xl font-black text-xs uppercase tracking-widest text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-900/30 flex items-center gap-2 transition-all duration-200 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" /> Reject PO
                </button>
                <button 
                  onClick={() => handleStatusUpdate('PENDING_L2')}
                  disabled={submitting}
                  className="px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/20 flex items-center gap-2 transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-5 h-5" /> Approve L1
                </button>
              </>
            ) : isPendingL2 && canApproveL2 ? (
              <>
                <button 
                  onClick={() => handleStatusUpdate('REJECTED')}
                  disabled={submitting}
                  className="px-6 py-3 border border-rose-200 dark:border-rose-800 rounded-xl font-black text-xs uppercase tracking-widest text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-900/30 flex items-center gap-2 transition-all duration-200 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" /> Reject PO
                </button>
                <button 
                  onClick={() => handleStatusUpdate('APPROVED')}
                  disabled={submitting}
                  className="px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-5 h-5" /> Final Approve & Sign
                </button>
              </>
            ) : isApproved ? (
              <button 
                onClick={handleSendToVendor}
                disabled={sending}
                className="px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 flex items-center gap-3 transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
                title=""
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
                onClick={() => navigate(hasHubAccess ? '/purchase-head' : '/saved-pos')}
                className="px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest bg-slate-900 dark:bg-slate-100 hover:bg-black dark:hover:bg-white text-white dark:text-slate-900 shadow-lg flex items-center gap-2 transition-all duration-200 cursor-pointer active:scale-95"
              >
                {hasHubAccess ? 'Return to Hub' : 'Return to Database'}
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl">
                  <XCircle className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Reject Purchase Order</h3>
              </div>
              <button onClick={() => setShowRejectModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-2">Reason for Rejection</label>
                <textarea 
                  autoFocus
                  className="w-full h-32 p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 dark:focus:border-rose-400 text-slate-800 dark:text-slate-100 text-sm font-semibold transition-all resize-none placeholder-slate-400 dark:placeholder-slate-600"
                  placeholder="Please provide a clear reason for rejecting this PO..."
                  value={rejectRemarks}
                  onChange={(e) => setRejectRemarks(e.target.value)}
                />
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold italic uppercase tracking-tight">
                Note: This comment will be visible to the procurement team in the PO database.
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button 
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (!rejectRemarks.trim()) {
                    showToast("Please enter a reason for rejection.", "error");
                    return;
                  }
                  executeStatusUpdate('REJECTED', rejectRemarks);
                }}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 shadow-md shadow-rose-200 dark:shadow-none disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <XCircle className="w-3.5 h-3.5" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Confirm Approval</h3>
              </div>
              <button onClick={() => setShowApproveModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-2">Approved By (Employee Name)</label>
                <div className="relative group">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors z-10" />
                  <select 
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 text-slate-800 dark:text-slate-100 text-sm font-semibold transition-all appearance-none cursor-pointer"
                    value={approverName}
                    onChange={(e) => setApproverName(e.target.value)}
                  >
                    <option value="" disabled>Select employee name...</option>
                    <option value="Amit Ray">Amit Ray</option>
                    <option value="Sayanta Chakroborty">Sayanta Chakroborty</option>
                    <option value="Arpita Ghosh">Arpita Ghosh</option>
                    <option value="Proloy Ghosh">Proloy Ghosh</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronRight className="w-4 h-4 rotate-90" />
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold italic uppercase tracking-tight">
                {pendingStatusUpdate === 'APPROVED' 
                  ? "This name will appear on the final signed PDF document."
                  : "This name will be recorded as the L1 reviewer for this PO."}
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button 
                onClick={() => setShowApproveModal(false)}
                className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (!approverName.trim()) {
                    showToast("Please enter the approver name.", "error");
                    return;
                  }
                  setShowApproveModal(false);
                  if (pendingStatusUpdate) {
                    executeStatusUpdate(pendingStatusUpdate, '', approverName);
                  }
                }}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-md shadow-indigo-200 dark:shadow-none disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <CheckCircle className="w-3.5 h-3.5" />}
                Confirm & Approve
              </button>
            </div>
          </div>
        </div>
      )}

      <CommentsModal 
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
        comments={po.internal_comments || []}
        onAddComment={handleAddComment}
        onUpdateComment={handleUpdateComment}
        onDeleteComment={handleDeleteComment}
        title={`PO #${po.po_no}`}
      />
    </div>
  );
}
