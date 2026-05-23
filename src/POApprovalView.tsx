import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, ArrowLeft, Download, ShieldCheck, Stamp, Printer } from 'lucide-react';
import POPreview from './components/POMaker/POPreview';
import { useAuth } from './context/AuthContext';
import { PurchaseOrder, CompanySettings } from './types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function POApprovalView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const canApprove = user?.role === 'SUPERADMIN' || user?.permissions.includes('APPROVE_PO');

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
    if (!window.confirm(`Are you sure you want to ${newStatus.toLowerCase()} this Purchase Order?`)) return;
    
    try {
      setSubmitting(true);
      const res = await fetch(`/api/po/${id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
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

  const handleDownload = async () => {
    if (!printRef.current || !po) return;
    try {
      const printArea = printRef.current.querySelector('.print-area') as HTMLElement;
      if (!printArea) return;

      const canvas = await html2canvas(printArea, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`PO_${po.po_no || 'Draft'}.pdf`);
    } catch (e) {
      console.error("Download error", e);
      alert("Failed to generate PDF");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  if (!po) return <div className="p-8 text-center">PO not found</div>;

  const poStatus = po.status || 'PENDING';

  // Header Actions to be passed to POPreview
  const headerActions = (
    <>
      <button 
        onClick={handlePrint}
        className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition font-bold text-sm"
      >
        <Printer className="w-4 h-4" /> Print
      </button>
      <button 
        onClick={handleDownload}
        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition shadow-md font-bold text-sm"
      >
        <Download className="w-4 h-4" /> Download PDF
      </button>

      {poStatus === 'PENDING' && canApprove && (
        <>
          <button 
            onClick={() => handleStatusUpdate('REJECTED')}
            disabled={submitting}
            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ml-2"
          >
            <XCircle className="w-4 h-4" /> Reject
          </button>
          <button 
            onClick={() => handleStatusUpdate('APPROVED')}
            disabled={submitting}
            className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold shadow-md flex items-center gap-2 transition-all"
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
        <div className="bg-white shadow-xl rounded-none ring-1 ring-gray-200 overflow-hidden relative mb-8 min-h-[800px]">
          {settings && (
            <POPreview 
              po={po} 
              setPo={() => {}} 
              settings={settings} 
              actions={headerActions}
            />
          )}
        </div>
        
        {/* Large Action Card at the Bottom */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 print-hidden border-b-4 border-b-blue-600">
          <div className="flex-1">
            {poStatus === 'PENDING' ? (
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
                <div className={`p-3 rounded-xl ${poStatus === 'APPROVED' ? 'bg-green-50' : 'bg-red-50'}`}>
                  {poStatus === 'APPROVED' ? <CheckCircle className="w-6 h-6 text-green-600" /> : <XCircle className="w-6 h-6 text-red-600" />}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900">{poStatus === 'APPROVED' ? 'Order Approved' : 'Order Rejected'}</h4>
                  <p className="text-sm text-gray-500">
                    {poStatus === 'APPROVED' 
                      ? `Digitally signed by ${po.approved_by || 'Admin'} on ${po.approved_at ? new Date(po.approved_at).toLocaleString() : 'N/A'}`
                      : 'This purchase order has been rejected and will not be processed.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {poStatus === 'PENDING' && canApprove ? (
              <>
                <button 
                  onClick={() => handleStatusUpdate('REJECTED')}
                  disabled={submitting}
                  className="px-8 py-3.5 bg-white text-red-600 hover:bg-red-50 border border-red-200 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm"
                >
                  <XCircle className="w-5 h-5" /> Reject PO
                </button>
                <button 
                  onClick={() => handleStatusUpdate('APPROVED')}
                  disabled={submitting}
                  className="px-10 py-3.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-bold shadow-lg shadow-blue-200 flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
                >
                  <ShieldCheck className="w-6 h-6" /> Approve & Sign
                </button>
              </>
            ) : (
              <button 
                onClick={() => navigate('/purchase-head')}
                className="px-10 py-3.5 bg-gray-900 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-gray-200"
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
