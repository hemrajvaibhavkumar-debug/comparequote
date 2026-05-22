import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, ArrowLeft, Download, ShieldCheck, Stamp } from 'lucide-react';
import POPreview from './components/POMaker/POPreview';
import { useAuth } from './context/AuthContext';
import { PurchaseOrder, CompanySettings } from './types';

export default function POApprovalView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
        navigate('/purchase-head');
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

  if (loading) return <div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  if (!po) return <div className="p-8 text-center">PO not found</div>;

  const poStatus = po.status || 'PENDING';

  // Format the date properly if it's an ISO string from the database
  // This handles the "2026-05-22T00:00:00.000Z" bug by converting it back to YYYY-MM-DD
  const formattedDate = po.date ? new Date(po.date).toLocaleDateString('en-CA') : '';
  const poWithFormattedDate = { ...po, date: formattedDate, status: poStatus };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/purchase-head')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium">
            <ArrowLeft className="w-4 h-4" /> Back to List
          </button>
          
          <div className="flex items-center gap-3">
             <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
               Reviewing PO #{po.po_no}
             </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-8">
        <div className="bg-white shadow-xl rounded-none ring-1 ring-gray-200 overflow-hidden relative mb-8 min-h-[800px]">
          {settings && <POPreview po={poWithFormattedDate} setPo={() => {}} settings={settings} />}
        </div>
        
        {/* Action Buttons at the Bottom */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            {poStatus === 'PENDING' ? (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Stamp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">Pending Approval</h4>
                  <p className="text-sm text-gray-500">Sign and stamp this document to finalize the purchase order.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${poStatus === 'APPROVED' ? 'bg-green-50' : 'bg-red-50'}`}>
                  {poStatus === 'APPROVED' ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{poStatus === 'APPROVED' ? 'Order Approved' : 'Order Rejected'}</h4>
                  <p className="text-sm text-gray-500">
                    {poStatus === 'APPROVED' 
                      ? `Digitally signed by ${po.approved_by || 'Admin'} on ${po.approved_at ? new Date(po.approved_at).toLocaleString() : 'N/A'}`
                      : 'This purchase order has been declined.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {poStatus === 'PENDING' ? (
              <>
                <button 
                  onClick={() => handleStatusUpdate('REJECTED')}
                  disabled={submitting}
                  className="px-8 py-3 bg-white text-red-600 hover:bg-red-50 border border-red-200 rounded-xl font-bold flex items-center gap-2 transition-all"
                >
                  <XCircle className="w-5 h-5" /> Reject PO
                </button>
                <button 
                  onClick={() => handleStatusUpdate('APPROVED')}
                  disabled={submitting}
                  className="px-10 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-bold shadow-lg shadow-blue-200 flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:scale-95"
                >
                  <ShieldCheck className="w-6 h-6" /> Approve & Sign
                </button>
              </>
            ) : (
              <button 
                onClick={() => navigate('/purchase-head')}
                className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold flex items-center gap-2 transition-all"
              >
                Return to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
