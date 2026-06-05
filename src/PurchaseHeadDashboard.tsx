import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Calendar, User, Factory, ChevronRight, FileText, CheckCircle, XCircle, Clock, ShieldCheck, StickyNote, IndianRupee, Plus } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import CommentsModal from './components/CommentsModal';

export default function PurchaseHeadDashboard() {
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING');
  
  // Advanced Filters State
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL'); // ALL, TODAY, THIS_WEEK, THIS_MONTH, CUSTOM
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [creatorFilter, setCreatorFilter] = useState('ALL');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('ALL'); // ALL, Capital, Consumables
  const [showFilters, setShowFilters] = useState(false);

  const [actioningId, setActioningId] = useState<number | null>(null);
  const { token, logout, user } = useAuth();
  
  // Comments State
  const [selectedPO, setSelectedPO] = useState<any | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  const canApproveL1 = user?.role === 'SUPERADMIN' || user?.permissions.includes('APPROVE_PO_L1');
  const canApproveL2 = user?.role === 'SUPERADMIN' || user?.permissions.includes('APPROVE_PO');
  const canEditApproved = user?.role === 'SUPERADMIN' || user?.permissions.includes('EDIT_APPROVED_PO');

  useEffect(() => {
    fetchPOs();
  }, []);

  const fetchPOs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/po', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.status === 401 || res.status === 403) {
        logout();
        return;
      }

      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setPos(data);
      } else {
        console.error("Failed to fetch POs: Expected array but received", data);
        setPos([]);
      }
    } catch (e) {
      console.error("Failed to fetch POs", e);
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

  const openComments = (e: React.MouseEvent, po: any) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPO(po);
    setIsCommentsOpen(true);
  };

  const handleQuickStatusUpdate = async (id: number, newStatus: 'PENDING_L2' | 'APPROVED' | 'REJECTED', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const label = newStatus === 'PENDING_L2' ? 'approve L1' : newStatus.toLowerCase();
    if (!window.confirm(`Are you sure you want to ${label} PO #${pos.find(p => p.id === id)?.po_no}?`)) return;

    try {
      setActioningId(id);
      const res = await fetch(`/api/po/${id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (res.ok) {
        setPos(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update status");
      }
    } catch (e) {
      console.error(e);
      alert("Error updating status");
    } finally {
      setActioningId(null);
    }
  };

  const filteredPOs = pos.filter(po => {
    // 1. Search Term
    const matchesSearch = po.po_no.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         po.vendor_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // 2. Status
    const poStatus = po.status || 'PENDING';
    const matchesStatus = statusFilter === 'ALL' || poStatus === statusFilter || (statusFilter === 'PENDING' && poStatus === 'PENDING_L2');

    // 3. Company (Version)
    const matchesCompany = companyFilter === 'ALL' || po.version === companyFilter;

    // 4. Creator
    const matchesCreator = creatorFilter === 'ALL' || po.created_by_name === creatorFilter;

    // 5. Amount Range
    const amount = Number(po.total_amount) || 0;
    const matchesMinAmount = !minAmount || amount >= Number(minAmount);
    const matchesMaxAmount = !maxAmount || amount <= Number(maxAmount);

    // 6. Date Filter
    let matchesDate = true;
    if (dateFilter !== 'ALL') {
      const poDate = new Date(po.date);
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      if (dateFilter === 'TODAY') {
        matchesDate = poDate >= now;
      } else if (dateFilter === 'THIS_WEEK') {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        matchesDate = poDate >= weekAgo;
      } else if (dateFilter === 'THIS_MONTH') {
        const monthAgo = new Date(now);
        monthAgo.setMonth(now.getMonth() - 1);
        matchesDate = poDate >= monthAgo;
      } else if (dateFilter === 'CUSTOM') {
        const start = customStartDate ? new Date(customStartDate) : null;
        const end = customEndDate ? new Date(customEndDate) : null;
        if (start) {
          start.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && poDate >= start;
        }
        if (end) {
          end.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && poDate <= end;
        }
      }
    }

    // 7. Classification
    const poType = po.terms?.po_type || 'Consumables';
    const matchesClassification = classificationFilter === 'ALL' || poType === classificationFilter;

    return matchesSearch && matchesStatus && matchesCompany && matchesCreator && matchesMinAmount && matchesMaxAmount && matchesDate && matchesClassification;
  });

  const uniqueCreators = Array.from(new Set(pos.map(p => p.created_by_name).filter(Boolean)));

  const getStatusBadge = (status: string) => {
    const s = status || 'PENDING';
    switch (s) {
      case 'APPROVED':
        return <span className="px-2 py-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Approved</span>;
      case 'PENDING_L2':
        return <span className="px-2 py-1 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1"><Clock className="w-3 h-3" /> Pending Final</span>;
      case 'REJECTED':
        return <span className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</span>;
      default:
        return <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border border-slate-200 dark:border-slate-700"><Clock className="w-3 h-3" /> Pending L1</span>;
    }
  };

  const renderPOCard = (po: any) => {
    const poStatus = po.status || 'PENDING';
    const isActioning = actioningId === po.id;

    return (
      <div 
        key={po.id} 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 group overflow-hidden relative flex flex-col"
      >
        <Link to={`/approve-po/${po.id}`} className="p-6 flex-1 cursor-pointer">
            <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl group-hover:bg-slate-900 group-hover:text-white dark:group-hover:bg-slate-100 dark:group-hover:text-slate-900 transition-all shadow-xs duration-300">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex flex-col items-end gap-2">
              {getStatusBadge(poStatus)}
              <button 
                onClick={(e) => openComments(e, po)}
                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all cursor-pointer relative"
                title="Internal Comments"
              >
                <StickyNote className="w-4 h-4" />
                {po.internal_comments && po.internal_comments.length > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full border border-white dark:border-slate-900"></span>
                )}
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
              po.version === 'hemraj_rice' ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800' :
              po.version === 'hemraj_ind' ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
              'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
            }`}>
              {po.version === 'hemraj_rice' ? 'Rice Mill' : po.version === 'hemraj_ind' ? 'Industries' : 'Radhashyam'}
            </span>
            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
              (po.terms?.po_type || 'Consumables') === 'Capital'
                ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                : 'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800'
            }`}>
              {po.terms?.po_type || 'Consumables'}
            </span>
          </div>

          <h3 className="text-lg font-extrabold text-slate-850 dark:text-slate-100 group-hover:text-slate-900 dark:group-hover:text-white transition-colors uppercase tracking-tight">
            PO #{po.po_no}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 line-clamp-1 font-semibold uppercase tracking-tight">{po.vendor_name}</p>
          <div className="flex flex-col gap-1 mb-4">
            {po.created_by_name && (
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1">
                <User className="w-3 h-3" /> Creator: {po.created_by_name}
              </p>
            )}
            {po.l1_approved_by && (
              <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> L1 Appr: {po.l1_approved_by}
              </p>
            )}
          </div>
          
          <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase">
              <Calendar className="w-4 h-4 text-slate-350 dark:text-slate-600" />
              {(() => {
                const d = new Date(po.date);
                if (isNaN(d.getTime())) return po.date;
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                return `${day}/${month}/${year}`;
              })()}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-850 dark:text-slate-100 font-black">
              <span className="text-slate-400 dark:text-slate-500 font-semibold text-xs uppercase tracking-wider">Amount:</span>
              ₹{po.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </Link>
        
        <div className="px-6 py-3.5 bg-slate-50/50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          {((poStatus === 'PENDING' && canApproveL1) || (poStatus === 'PENDING_L2' && canApproveL2)) ? (
            <div className="flex items-center gap-3.5 w-full">
              <button 
                onClick={(e) => handleQuickStatusUpdate(po.id, 'REJECTED', e)}
                disabled={isActioning}
                className="flex-1 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              >
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
              <button 
                onClick={(e) => handleQuickStatusUpdate(po.id, poStatus === 'PENDING' ? 'PENDING_L2' : 'APPROVED', e)}
                disabled={isActioning}
                className="flex-1 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black dark:hover:bg-white disabled:opacity-50 transition-all shadow-md shadow-slate-200 dark:shadow-none flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <CheckCircle className="w-3.5 h-3.5" /> {poStatus === 'PENDING' ? 'Approve L1' : 'Approve'}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full gap-4">
              <Link 
                to={`/approve-po/${po.id}`}
                className="text-xs font-black text-slate-900 dark:text-slate-100 hover:underline flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                {poStatus === 'APPROVED' ? 'Final PDF' : poStatus === 'REJECTED' ? 'Rejected' : 'Review'}
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              {(poStatus === 'APPROVED' && canEditApproved) && (
                 <Link 
                  to={`/po-maker?edit=${po.id}`}
                  className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 uppercase tracking-widest border border-indigo-200 dark:border-indigo-800 px-3 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                >
                  Edit Approved
                </Link>
              )}
            </div>
          )}
        </div>

        {isActioning && (
          <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-slate-900 dark:border-slate-100"></div>
          </div>
        )}
      </div>
    );
  };

  const l1PendingPos = filteredPOs.filter(p => (p.status || 'PENDING') === 'PENDING');
  const l2PendingPos = filteredPOs.filter(p => p.status === 'PENDING_L2');
  const actionedPos = filteredPOs.filter(p => p.status === 'APPROVED' || p.status === 'REJECTED');

  const totalCount = filteredPOs.length;
  const pendingCount = l1PendingPos.length + l2PendingPos.length;
  const approvedCount = filteredPOs.filter(p => p.status === 'APPROVED').length;
  const combinedValue = filteredPOs.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 transition-colors duration-300 p-4 sm:p-8 relative">
      {/* Background ambient glows */}
      <div className="ambient-glow bg-slate-200/50 dark:bg-slate-800/10 -top-20 -left-20" style={{ width: '400px', height: '400px' }}></div>
      <div className="ambient-glow bg-slate-100/50 dark:bg-slate-800/5 bottom-10 right-10" style={{ width: '400px', height: '400px' }}></div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        <div className="flex flex-col gap-6 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5 uppercase tracking-tight">
                <ShieldCheck className="text-slate-900 dark:text-slate-100 w-7 h-7" /> Purchase Approval Hub
              </h1>
              <p className="text-slate-400 dark:text-slate-500 font-semibold text-sm mt-0.5">Welcome back, <span className="text-slate-900 dark:text-slate-100 font-black">@{user?.username}</span>. Review, sign, and authorize pending POs.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 items-center shrink-0">
              <div className="relative group w-full sm:w-auto">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-slate-900 dark:group-focus-within:text-slate-100 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search POs..." 
                  className="pl-10 pr-4 py-2.5 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10 focus:border-slate-900 dark:focus:border-slate-100 w-full sm:w-64 transition-all text-sm font-medium text-slate-800 dark:text-slate-100"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="relative group w-full sm:w-auto">
                <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <select 
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="pl-10 pr-10 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10 transition-all appearance-none cursor-pointer w-full sm:w-auto"
                >
                  <option value="ALL">Show All POs</option>
                  <option value="PENDING">Pending Only</option>
                  <option value="APPROVED">Approved Only</option>
                  <option value="REJECTED">Rejected Only</option>
                </select>
                <ChevronRight className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
              </div>

              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-all cursor-pointer ${
                  showFilters 
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100' 
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Plus className={`w-4 h-4 transition-transform duration-300 ${showFilters ? 'rotate-45' : ''}`} /> Filters
              </button>
            </div>
          </div>

          {/* Expanded Filter Panel */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-6 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200">
              {/* Company Filter */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Company / Unit</label>
                <select 
                  value={companyFilter}
                  onChange={e => setCompanyFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Units</option>
                  <option value="hemraj_rice">Hemraj Rice Mill</option>
                  <option value="hemraj_ind">Hemraj Industries</option>
                  <option value="radhashyam">Radhashyam Industries</option>
                </select>
              </div>

              {/* Timeframe Filter */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Time Period</label>
                <select 
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Time</option>
                  <option value="TODAY">Today</option>
                  <option value="THIS_WEEK">Past 7 Days</option>
                  <option value="THIS_MONTH">Past 30 Days</option>
                  <option value="CUSTOM">Custom Range...</option>
                </select>
                {dateFilter === 'CUSTOM' && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold" />
                    <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold" />
                  </div>
                )}
              </div>

              {/* Classification Filter */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">PO Classification</label>
                <select 
                  value={classificationFilter}
                  onChange={e => setClassificationFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Types</option>
                  <option value="Consumables">Consumables</option>
                  <option value="Capital">Capital</option>
                </select>
              </div>

              {/* Other Filters (Creator & Amount) */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Created By</label>
                  <select 
                    value={creatorFilter}
                    onChange={e => setCreatorFilter(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Creators</option>
                    {uniqueCreators.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="col-span-full flex flex-col sm:flex-row items-end justify-between gap-4 mt-2">
                <div className="w-full sm:w-auto">
                  <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-1.5 block">Amount Range (₹)</label>
                  <div className="flex gap-2 items-center">
                    <input type="number" placeholder="Min" value={minAmount} onChange={e => setMinAmount(e.target.value)} className="w-32 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold" />
                    <span className="text-slate-300">to</span>
                    <input type="number" placeholder="Max" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} className="w-32 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold" />
                  </div>
                </div>
                
                <button 
                  onClick={() => {
                    setSearchTerm(''); setStatusFilter('ALL'); setCompanyFilter('ALL'); setDateFilter('ALL');
                    setCreatorFilter('ALL'); setMinAmount(''); setMaxAmount(''); setCustomStartDate(''); setCustomEndDate('');
                    setClassificationFilter('ALL');
                  }}
                  className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-500 hover:text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-900/50"
                >
                  <XCircle className="w-4 h-4" /> Reset All Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dashboard Analytics Banner Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-center gap-4">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-900 dark:text-slate-100">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Total Actions</span>
              <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">{totalCount} POs</h3>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-center gap-4 border-l-4 border-l-slate-400">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Awaiting Sign</span>
              <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">{pendingCount} POs</h3>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-center gap-4 border-l-4 border-l-slate-900 dark:border-l-slate-200">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-900 dark:text-slate-100">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Approved Count</span>
              <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">{approvedCount} POs</h3>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-center gap-4 border-l-4 border-l-black dark:border-l-white">
            <div className="p-3.5 bg-slate-900 dark:bg-slate-100 rounded-2xl text-white dark:text-slate-900">
              <span className="text-sm font-extrabold">₹</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Combined Value</span>
              <h3 className="text-md font-black text-slate-900 dark:text-slate-100 mt-0.5">₹{combinedValue.toLocaleString('en-IN')}</h3>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 dark:border-slate-100"></div>
          </div>
        ) : filteredPOs.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs p-16 text-center border border-slate-100 dark:border-slate-800 max-w-2xl mx-auto space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
              <FileText className="text-slate-350 dark:text-slate-600 w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">No purchase orders found</h3>
            <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">There are currently no POs matching your current criteria.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* L1 Approvals */}
            {(canApproveL1 || user?.role === 'SUPERADMIN') && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight font-sans">Level 1 Approvals (Initial Review)</h2>
                </div>
                {l1PendingPos.length === 0 ? (
                  <p className="text-slate-400 dark:text-slate-600 text-xs font-bold uppercase tracking-widest italic">No pending Level 1 reviews.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {l1PendingPos.map(po => renderPOCard(po))}
                  </div>
                )}
              </div>
            )}

            {/* L2 Approvals */}
            {(canApproveL2 || user?.role === 'SUPERADMIN') && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <ShieldCheck className="w-5 h-5 text-amber-600" />
                  <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight font-sans">Final Authorization (Purchase Head)</h2>
                </div>
                {l2PendingPos.length === 0 ? (
                  <p className="text-slate-400 dark:text-slate-600 text-xs font-bold uppercase tracking-widest italic">No pending final authorizations.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {l2PendingPos.map(po => renderPOCard(po))}
                  </div>
                )}
              </div>
            )}

            {/* Actioned / History */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <CheckCircle className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight font-sans">Actioned Records</h2>
              </div>
              {actionedPos.length === 0 ? (
                <p className="text-slate-400 dark:text-slate-600 text-xs font-bold uppercase tracking-widest italic">No actioned records found.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {actionedPos.map(po => renderPOCard(po))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
    }
