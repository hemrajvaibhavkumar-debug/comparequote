import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PurchaseOrder, InternalComment } from './types';
import { FileText, Eye, Edit, Trash2, Search, ArrowLeft, ShieldCheck, CheckCircle, XCircle, Clock, Filter, ChevronRight, IndianRupee, StickyNote } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { useApiCache } from './context/ApiCacheContext';
import CommentsModal from './components/CommentsModal';

const SavedPOs: React.FC = () => {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const navigate = useNavigate();
  
  // Comments State
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  const { token, user, logout } = useAuth();
  const { fetchPOs: fetchPOsFromCache, invalidatePOs } = useApiCache();
  const canView = user?.role === 'SUPERADMIN' || user?.permissions.includes('VIEW_SAVED_POS');

  useEffect(() => {
    if (canView) {
      fetchPOs(false);
    }
  }, [canView]);

  const fetchPOs = async (forceRefresh = false) => {
    try {
      setLoading(true);
      const data = await fetchPOsFromCache(forceRefresh);
      setPos(data);
    } catch (err) {
      console.error('Failed to fetch POs', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (text: string) => {
    if (!selectedPO) return;
    try {
      const res = await fetch(`/api/po/${selectedPO.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const updatedPO = await res.json();
        setPos(prev => prev.map(p => p.id === updatedPO.id ? updatedPO : p));
        setSelectedPO(updatedPO);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateComment = async (commentId: string, text: string) => {
    if (!selectedPO) return;
    try {
      const res = await fetch(`/api/po/${selectedPO.id}/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const updatedPO = await res.json();
        setPos(prev => prev.map(p => p.id === updatedPO.id ? updatedPO : p));
        setSelectedPO(updatedPO);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedPO) return;
    try {
      const res = await fetch(`/api/po/${selectedPO.id}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const updatedPO = await res.json();
        setPos(prev => prev.map(p => p.id === updatedPO.id ? updatedPO : p));
        setSelectedPO(updatedPO);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openComments = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setIsCommentsOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this PO?')) return;
    
    try {
      const res = await fetch(`/api/po/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        invalidatePOs();
        setPos(pos.filter(po => po.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete PO', err);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status || 'PENDING';
    switch (s) {
      case 'APPROVED':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 text-white rounded-full border border-slate-900 shadow-sm">
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-wider">Approved</span>
          </div>
        );
      case 'REJECTED':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white text-slate-900 rounded-full border border-slate-900 shadow-sm">
            <XCircle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-wider">Rejected</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-500 rounded-full border border-slate-200 shadow-xs">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-wider">Pending</span>
          </div>
        );
    }
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white m-8 rounded-2xl border border-slate-200 shadow-sm">
        <ShieldCheck className="w-16 h-16 text-slate-400 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">Access Restricted</h2>
        <p className="text-slate-500 mt-2 max-w-md font-medium">You do not have the 'VIEW_SAVED_POS' permission required to view the Purchase Order database.</p>
        <Link to="/" className="mt-8 px-6 py-2 bg-slate-900 text-white rounded-lg font-bold text-xs uppercase tracking-widest shadow-md shadow-slate-200 hover:bg-black transition-all active:scale-95">Back to Dashboard</Link>
      </div>
    );
  }

  const filteredPOs = pos.filter(po => {
    const matchesSearch = po.po_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         po.vendor_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || (po.status || 'PENDING') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-50/50 relative pb-24">
      {/* Background ambient blobs */}
      <div className="ambient-glow bg-slate-200/50 -top-20 -left-20"></div>

      {/* Dynamic Full-Width Header */}
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-150/80 sticky top-16 z-10">
        <div className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="p-2.5 hover:bg-slate-100 rounded-xl transition-all border border-slate-200 shadow-xs cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">PO Database</h1>
              <p className="text-sm text-slate-400 font-semibold mt-0.5">Manage and track all finalized purchase orders</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
              <input 
                type="text"
                placeholder="Search POs..."
                className="pl-10 pr-4 py-2.5 bg-slate-50/60 border border-slate-200 focus:border-slate-900 rounded-xl w-full md:w-72 focus:outline-none focus:ring-2 focus:ring-slate-900/10 text-slate-800 transition-all text-sm font-medium"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1">
              {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    statusFilter === f 
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-100' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full-Width Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900"></div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Records...</p>
          </div>
        ) : filteredPOs.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-xs border border-slate-150/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">PO Details</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Vendor Information</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Grand Total</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Workflow Status</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPOs.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-5 cursor-pointer" onClick={() => navigate(`/approve-po/${po.id}`)}>
                        <div className="flex flex-col">
                          <span className="font-extrabold text-slate-800 group-hover:text-slate-900 transition-colors uppercase tracking-tight">#{po.po_no}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase mt-1 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" /> {new Date(po.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          {po.created_by_name && (
                            <span className="text-[9px] font-black text-slate-500 uppercase mt-1 bg-slate-100 px-1.5 py-0.5 rounded-md w-fit border border-slate-200 shadow-xs">
                              Created By: {po.created_by_name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 cursor-pointer" onClick={() => navigate(`/approve-po/${po.id}`)}>
                        <div className="flex flex-col">
                          <span className="font-extrabold text-slate-850 uppercase text-xs tracking-tight truncate max-w-xs">{po.vendor_name}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase mt-1">GST: {po.vendor_details.gstin || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right cursor-pointer" onClick={() => navigate(`/approve-po/${po.id}`)}>
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-0.5 text-sm font-black text-slate-850">
                            <IndianRupee className="w-3.5 h-3.5" />
                            {Number(po.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">Total Payable</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 cursor-pointer" onClick={() => navigate(`/approve-po/${po.id}`)}>
                        <div className="flex flex-col items-center gap-2">
                          {getStatusBadge(po.status || 'PENDING')}
                          {po.status === 'REJECTED' && po.rejection_remarks && (
                            <div className="max-w-[150px] text-center">
                              <p className="text-[9px] font-bold text-slate-900 uppercase tracking-tighter mb-0.5 underline decoration-slate-300">Reason:</p>
                              <p className="text-[10px] text-slate-500 font-medium leading-tight italic line-clamp-2" title={po.rejection_remarks}>
                                "{po.rejection_remarks}"
                              </p>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex justify-end items-center gap-2">
                          <button 
                            onClick={() => openComments(po)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-xl transition-all shadow-none hover:shadow-xs cursor-pointer relative"
                            title="Internal Comments"
                          >
                            <StickyNote className="w-4.5 h-4.5" />
                            {po.internal_comments && po.internal_comments.length > 0 && (
                              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-600 rounded-full border-2 border-white"></span>
                            )}
                          </button>
                          {po.status !== 'APPROVED' && (
                            <button 
                              onClick={() => navigate(`/po-maker?edit=${po.id}`)}
                              className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded-xl transition-all shadow-none hover:shadow-xs cursor-pointer"
                              title="Edit Revision"
                            >
                              <Edit className="w-4.5 h-4.5" />
                            </button>
                          )}
                          <Link 
                            to={`/approve-po/${po.id}`}
                            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded-xl transition-all shadow-none hover:shadow-xs"
                            title="View Document"
                          >
                            <Eye className="w-4.5 h-4.5" />
                          </Link>
                          {po.status !== 'APPROVED' && (
                            <button 
                              onClick={() => handleDelete(po.id!)}
                              className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded-xl transition-all shadow-none hover:shadow-xs cursor-pointer"
                              title="Delete PO"
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          )}
                          <div className="w-6 flex justify-center text-slate-300 ml-2">
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform group-hover:text-slate-850" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-32 bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm max-w-2xl mx-auto">
            <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-slate-350" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">No Records Found</h3>
            <p className="text-slate-400 mt-2 font-semibold text-sm">Try adjusting your filters or search terms.</p>
            <Link to="/po-maker" className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-slate-200 cursor-pointer active:scale-95">
              Create New PO
            </Link>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {!loading && filteredPOs.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-slate-900/95 text-white rounded-full shadow-2xl flex items-center gap-6 border border-white/10 backdrop-blur-md z-40">
          <div className="flex items-center gap-2 border-r border-white/10 pr-6">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Total POs</span>
            <span className="text-sm font-black">{filteredPOs.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Combined Value</span>
            <div className="flex items-center text-sm font-black text-white">
               <IndianRupee className="w-3.5 h-3.5" />
               {filteredPOs.reduce((acc, po) => acc + (Number(po.total_amount) || 0), 0).toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      )}

      <CommentsModal 
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
        comments={selectedPO?.internal_comments || []}
        onAddComment={handleAddComment}
        onUpdateComment={handleUpdateComment}
        onDeleteComment={handleDeleteComment}
        title={`PO #${selectedPO?.po_no} - ${selectedPO?.vendor_name}`}
      />
    </div>
  );
};

export default SavedPOs;
