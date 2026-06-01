import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Plus, 
  Search, 
  ArrowLeft, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ChevronRight, 
  ChevronLeft,
  Menu,
  Filter,
  Image as ImageIcon,
  Trash2,
  Edit,
  Upload,
  Loader2,
  ArrowRight,
  Printer,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Indent, IndentItem } from '../../types';

const IndentDashboard: React.FC = () => {
  const [indents, setIndents] = useState<Indent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewState, setViewState] = useState<'idle' | 'view' | 'create' | 'edit'>('idle');
  const [selectedIndent, setSelectedIndent] = useState<Indent | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Form State (used for both create and edit)
  const [newIndent, setNewIndent] = useState<Indent>({
    indent_no: `IND-${Date.now().toString().slice(-6)}`,
    date: new Date().toISOString().split('T')[0],
    items: [],
    total_items: 0,
    department: '',
    order_placed_by: '',
    order_passed_by: ''
  });

  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  
  const canApprove = user?.role === 'SUPERADMIN' || user?.permissions.includes('APPROVE_PO');

  useEffect(() => {
    fetchIndents();
  }, []);

  const fetchIndents = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/indents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIndents(data);
      }
    } catch (err) {
      showToast("Failed to fetch indents", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: number, status: 'APPROVED' | 'REJECTED') => {
    let remarks = '';
    if (status === 'REJECTED') {
      remarks = window.prompt("Enter rejection remarks:") || '';
      if (!remarks) return;
    }

    try {
      const res = await fetch(`/api/indents/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, remarks })
      });
      if (res.ok) {
        showToast(`Indent ${status.toLowerCase()} successfully`);
        fetchIndents();
        if (selectedIndent && selectedIndent.id === id) {
          setSelectedIndent({ ...selectedIndent, status, rejection_remarks: remarks });
        }
      }
    } catch (err) {
      showToast("Failed to update status", "error");
    }
  };

  const handleSaveIndent = async () => {
    if (newIndent.items.length === 0) {
      showToast("Please add at least one item", "error");
      return;
    }

    const payload = {
      ...newIndent,
      total_items: newIndent.items.length,
      created_by_name: user?.username
    };

    try {
      const isEdit = viewState === 'edit';
      const url = isEdit ? `/api/indents/${newIndent.id}` : '/api/indents';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(isEdit ? "Indent updated successfully" : "Indent saved successfully");
        setViewState('idle');
        setNewIndent({
          indent_no: `IND-${Date.now().toString().slice(-6)}`,
          date: new Date().toISOString().split('T')[0],
          items: [],
          total_items: 0,
          department: '',
          order_placed_by: '',
          order_passed_by: ''
        });
        fetchIndents();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to save indent", "error");
      }
    } catch (err) {
      showToast("Error saving indent", "error");
    }
  };

  const handleEditIndent = () => {
    if (!selectedIndent) return;
    setNewIndent(selectedIndent);
    setViewState('edit');
  };

  const handleDeleteIndent = async (id: number) => {
    if (!confirm("Are you sure you want to delete this indent? This action cannot be undone.")) return;

    try {
      const res = await fetch(`/api/indents/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        showToast("Indent deleted successfully");
        setViewState('idle');
        setSelectedIndent(null);
        fetchIndents();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to delete indent", "error");
      }
    } catch (err) {
      showToast("Error deleting indent", "error");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        setIsExtracting(true);
        const res = await fetch('/api/extract-indent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ imageBase64: base64 })
        });
        if (res.ok) {
          const data = await res.json();
          setNewIndent(prev => ({
            ...prev,
            items: [...prev.items, ...data.items]
          }));
          showToast("Items extracted successfully");
        }
      } catch (err) {
        showToast("Extraction failed", "error");
      } finally {
        setIsExtracting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const addItem = () => {
    setNewIndent(prev => ({
      ...prev,
      items: [...prev.items, {
        itemName: '',
        qty: '',
        uom: 'NOS',
        applicationArea: '',
        orderPlacedBy: '',
        orderPassedBy: ''
      }]
    }));
  };

  const updateItem = (index: number, field: keyof IndentItem, value: string) => {
    const newItems = [...newIndent.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setNewIndent(prev => ({ ...prev, items: newItems }));
  };

  const removeItem = (index: number) => {
    setNewIndent(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const filteredIndents = indents.filter(ind => {
    const matchesSearch = ind.indent_no.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (ind.department || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || ind.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectIndent = (indent: Indent) => {
    setSelectedIndent(indent);
    setViewState('view');
  };

  const startCreate = () => {
    setViewState('create');
    setNewIndent({
      indent_no: `IND-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      items: [],
      total_items: 0,
      department: '',
      order_placed_by: '',
      order_passed_by: ''
    });
    setSelectedIndent(null);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-950 transition-colors duration-300 overflow-hidden relative print:bg-white print:h-auto print:overflow-visible print:block">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          /* Reset everything for print */
          html, body {
            background-color: white !important;
            color: black !important;
            height: auto !important;
            overflow: visible !important;
          }
          /* Hide all UI elements */
          .no-print, .glass-navbar, .fixed, button, .ambient-glow {
            display: none !important;
            visibility: hidden !important;
          }
          /* Show only the paper slip */
          .print-paper {
            position: static !important;
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background-color: white !important;
          }
          .print-paper * {
            visibility: visible !important;
            color: black !important;
            border-color: black !important;
            background-color: transparent !important;
          }
          /* Special case for table borders */
          .print-paper table, .print-paper td, .print-paper th {
            border: 1px solid black !important;
          }
          /* Force colors for Chrome/Safari */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Sidebar Toggle Button */}
      <button 
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        className={`fixed bottom-8 left-6 z-[100] p-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all cursor-pointer border border-slate-700 dark:border-slate-200 group flex items-center gap-2 pr-4 no-print`}
        title={isSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
      >
        {isSidebarCollapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        <span className="text-[10px] font-black uppercase tracking-widest">{isSidebarCollapsed ? 'Open List' : 'Collapse'}</span>
      </button>

      {/* Left Pane - Sidebar List */}
      <div className={`${isSidebarCollapsed ? 'w-0 -translate-x-full opacity-0' : 'w-80 sm:w-96 translate-x-0 opacity-100'} flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 relative z-20 transition-all duration-500 ease-in-out shrink-0 overflow-hidden no-print`}>
        <div className="p-5 space-y-4 border-b border-slate-100 dark:border-slate-800 min-w-[320px]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Indents</h2>
            <button 
              onClick={startCreate}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Create New Indent"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Search by ID or Dept..."
              className="w-full pl-9 pr-4 py-2 bg-slate-100/50 dark:bg-slate-950 border-none rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === f ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
          ) : filteredIndents.length > 0 ? (
            filteredIndents.map(indent => (
              <button
                key={indent.id}
                onClick={() => selectIndent(indent)}
                className={`w-full text-left p-4 rounded-2xl transition-all group border ${
                  selectedIndent?.id === indent.id 
                    ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 shadow-md' 
                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[9px] font-bold uppercase ${
                    selectedIndent?.id === indent.id ? 'text-slate-400 dark:text-slate-500' : 'text-slate-400'
                  }`}>
                    {new Date(indent.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </span>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    indent.status === 'APPROVED' ? 'bg-emerald-500' : 
                    indent.status === 'REJECTED' ? 'bg-rose-500' : 'bg-amber-500'
                  }`} />
                </div>
                <h3 className={`font-black text-sm uppercase tracking-tight mb-1 truncate ${
                  selectedIndent?.id === indent.id ? 'text-white dark:text-slate-900' : 'text-slate-800 dark:text-slate-100'
                }`}>
                  #{indent.indent_no}
                </h3>
                <div className="flex justify-between items-center mt-3">
                   <div className="flex flex-col truncate max-w-[140px]">
                      <span className={`text-[10px] font-black uppercase tracking-tight truncate ${
                        selectedIndent?.id === indent.id ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400'
                      }`}>{indent.department || 'General Indent'}</span>
                   </div>
                   
                   <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {indent.status === 'PENDING' && (
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedIndent(indent); handleEditIndent(); }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              selectedIndent?.id === indent.id 
                                ? 'text-white/60 hover:text-white hover:bg-white/10' 
                                : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                            }`}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteIndent(indent.id!); }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              selectedIndent?.id === indent.id 
                                ? 'text-white/60 hover:text-white hover:bg-white/10' 
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <span className={`text-[9px] font-black uppercase ml-1 ${
                        selectedIndent?.id === indent.id ? 'text-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'
                      }`}>
                        {indent.total_items} ITEMS
                      </span>
                   </div>
                </div>
              </button>
            ))
          ) : (
            <div className="text-center py-10 text-slate-300 dark:text-slate-700 font-bold text-xs uppercase tracking-widest">
              No results found
            </div>
          )}
        </div>
      </div>

      {/* Right Pane - Content Area */}
      <div className="flex-1 overflow-y-auto bg-slate-100/50 dark:bg-slate-950/20 relative custom-scrollbar">
        {/* Sidebar Toggle Button */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`fixed bottom-8 left-6 z-[60] p-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all cursor-pointer border border-slate-700 dark:border-slate-200 group flex items-center gap-2 pr-4`}
          title={isSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
        >
          {isSidebarCollapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          <span className="text-[10px] font-black uppercase tracking-widest">{isSidebarCollapsed ? 'Open List' : 'Collapse'}</span>
        </button>

        {viewState === 'idle' ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-3xl flex items-center justify-center shadow-sm border border-slate-200 dark:border-slate-800">
              <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
            <div className="max-w-xs">
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Select an Indent</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">Choose an indent from the list to view the digital order book entry or create a new one.</p>
            </div>
            <button 
              onClick={startCreate}
              className="px-6 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg active:scale-95 cursor-pointer"
            >
              New Indent Request
            </button>
          </div>
        ) : viewState === 'view' && selectedIndent ? (
          <div className="p-4 sm:p-8 lg:p-12 animate-in fade-in duration-500">
            {/* Action Bar */}
            <div className="max-w-4xl mx-auto mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 relative z-10">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  selectedIndent.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600' :
                  selectedIndent.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-600' :
                  'bg-amber-500/10 text-amber-600'
                }`}>
                  {selectedIndent.status === 'APPROVED' ? <CheckCircle className="w-5 h-5" /> : 
                   selectedIndent.status === 'REJECTED' ? <XCircle className="w-5 h-5" /> : 
                   <Clock className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">{selectedIndent.status || 'PENDING'} STATUS</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Indent #{selectedIndent.indent_no}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 mr-2 bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <button 
                    onClick={handleEditIndent}
                    className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 px-3"
                    title="Edit Indent"
                  >
                    <Edit className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Edit</span>
                  </button>
                  
                  {(!selectedIndent.status || selectedIndent.status === 'PENDING') && (
                    <>
                      <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                      <button 
                        onClick={() => handleDeleteIndent(selectedIndent.id!)}
                        className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 px-3"
                        title="Delete Indent"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Delete</span>
                      </button>
                    </>
                  )}
                </div>

                {selectedIndent.status === 'PENDING' && canApprove && (
                  <>
                    <button 
                      onClick={() => handleStatusUpdate(selectedIndent.id!, 'REJECTED')}
                      className="px-5 py-2 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all cursor-pointer"
                    >
                      Reject
                    </button>
                    <button 
                      onClick={() => handleStatusUpdate(selectedIndent.id!, 'APPROVED')}
                      className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-md shadow-emerald-200 dark:shadow-none transition-all cursor-pointer"
                    >
                      Approve
                    </button>
                  </>
                )}
                <button 
                  onClick={() => window.print()}
                  className="p-2.5 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
                  title="Print Slip"
                >
                  <Printer className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setViewState('idle')}
                  className="p-2.5 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Realistic Paper Format - WRAPPED IN print-paper for fixed printing */}
            <div className="print-paper max-w-4xl mx-auto bg-white shadow-2xl border border-slate-300 dark:border-slate-800 p-8 sm:p-12 mb-20 relative text-black print:shadow-none print:p-0 print:border-none">
              <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600 print:hidden" />
              
              {/* Slip Header */}
              <div className="space-y-6">
                <div className="text-center border-b-2 border-black pb-4">
                  <h1 className="text-2xl font-black tracking-tighter uppercase mb-0.5">Order Book (Urgent)</h1>
                  <p className="text-[10px] font-bold print:hidden">DIGITAL RECORD SYNCED: {new Date(selectedIndent.created_at || "").toLocaleString()}</p>
                </div>

                <div className="grid grid-cols-2 gap-x-12 gap-y-4 pt-4">
                  <div className="border-b border-black/20 pb-1 flex justify-between items-end">
                    <span className="text-[11px] font-black uppercase tracking-tight">Plant Name :-</span>
                    <span className="text-sm font-bold font-serif italic border-b border-black px-2 flex-1 text-center ml-2">{selectedIndent.department || 'N/A'}</span>
                  </div>
                  <div className="border-b border-black/20 pb-1 flex justify-between items-end">
                    <span className="text-[11px] font-black uppercase tracking-tight">Order Date :-</span>
                    <span className="text-sm font-bold font-serif italic border-b border-black px-2 flex-1 text-center ml-2">
                      {new Date(selectedIndent.date).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                  <div className="border-b border-black/20 pb-1 flex justify-between items-end">
                    <span className="text-[11px] font-black uppercase tracking-tight">Order No :-</span>
                    <span className="text-sm font-bold font-serif italic border-b border-black px-2 flex-1 text-center ml-2">{selectedIndent.indent_no}</span>
                  </div>
                  <div className="border-b border-black/20 pb-1 flex justify-between items-end">
                    <span className="text-[11px] font-black uppercase tracking-tight">Order Placed By :-</span>
                    <span className="text-sm font-bold font-serif italic border-b border-black px-2 flex-1 text-center ml-2">{selectedIndent.order_placed_by || 'N/A'}</span>
                  </div>
                  <div className="border-b border-black/20 pb-1 flex justify-between items-end">
                    <span className="text-[11px] font-black uppercase tracking-tight">Order Passed By :-</span>
                    <span className="text-sm font-bold font-serif italic border-b border-black px-2 flex-1 text-center ml-2">{selectedIndent.order_passed_by || 'N/A'}</span>
                  </div>
                  <div className="border-b border-black/20 pb-1 flex justify-between items-end">
                    <span className="text-[11px] font-black uppercase tracking-tight">Created By :-</span>
                    <span className="text-sm font-bold font-serif italic border-b border-black px-2 flex-1 text-center ml-2">{selectedIndent.created_by_name || 'SYSTEM'}</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="mt-10 border-2 border-black">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b-2 border-black">
                      <th className="border-r border-black p-2 text-[10px] font-black uppercase w-12 text-center">SL NO</th>
                      <th className="border-r border-black p-2 text-[10px] font-black uppercase text-left">ITEM NAME</th>
                      <th className="border-r border-black p-2 text-[10px] font-black uppercase w-16 text-center">QTY</th>
                      <th className="border-r border-black p-2 text-[10px] font-black uppercase w-16 text-center">UOM</th>
                      <th className="border-r border-black p-2 text-[10px] font-black uppercase w-32 text-center">APPLICATION AREA</th>
                      <th className="border-r border-black p-2 text-[10px] font-black uppercase w-32 text-center">MATERIAL REQ BY</th>
                      <th className="p-2 text-[10px] font-black uppercase w-32 text-center leading-tight">OLD MATERIAL STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedIndent.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-black last:border-b-0 min-h-[40px]">
                        <td className="border-r border-black p-2 text-xs font-bold text-center italic">{idx + 1}</td>
                        <td className="border-r border-black p-2 text-xs font-bold uppercase italic">{item.itemName}</td>
                        <td className="border-r border-black p-2 text-xs font-bold text-center italic">{item.qty}</td>
                        <td className="border-r border-black p-2 text-xs font-bold text-center italic uppercase">{item.uom}</td>
                        <td className="border-r border-black p-2 text-xs font-bold text-center italic uppercase">{item.applicationArea || '-'}</td>
                        <td className="border-r border-black p-2 text-xs font-bold text-center italic uppercase">{item.orderPlacedBy || '-'}</td>
                        <td className="p-2 text-xs font-bold text-center italic uppercase">{item.orderPassedBy || '-'}</td>
                      </tr>
                    ))}
                    {Array.from({ length: Math.max(0, 10 - selectedIndent.items.length) }).map((_, i) => (
                      <tr key={`filler-${i}`} className="border-b border-black last:border-b-0 h-10">
                        <td className="border-r border-black p-2"></td>
                        <td className="border-r border-black p-2"></td>
                        <td className="border-r border-black p-2"></td>
                        <td className="border-r border-black p-2"></td>
                        <td className="border-r border-black p-2"></td>
                        <td className="border-r border-black p-2"></td>
                        <td className="p-2"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signature Blocks */}
              <div className="mt-16 grid grid-cols-3 gap-8 pt-8">
                <div className="text-center space-y-12">
                   <div className="border-b border-black w-3/4 mx-auto" />
                   <span className="text-[10px] font-black uppercase tracking-wider block">STORE INCHARGE SIGN.</span>
                </div>
                <div className="text-center space-y-12">
                   <div className="border-b border-black w-3/4 mx-auto" />
                   <span className="text-[10px] font-black uppercase tracking-wider block">ORDER RECEIVED SIGN.</span>
                </div>
                <div className="text-center space-y-12">
                   <div className="border-b border-black w-3/4 mx-auto" />
                   <span className="text-[10px] font-black uppercase tracking-wider block">ORDER PASSED SIGN.</span>
                </div>
              </div>

              {selectedIndent.rejection_remarks && (
                <div className="mt-12 p-4 bg-rose-50 border-2 border-rose-200 rounded-lg text-rose-800 italic">
                  <p className="text-[9px] font-black uppercase mb-1 not-italic tracking-widest">Office Rejection Note:</p>
                  "{selectedIndent.rejection_remarks}"
                </div>
              )}
            </div>
          </div>
        ) : (viewState === 'create' || viewState === 'edit') ? (
          <div className="p-4 sm:p-8 lg:p-12 animate-in slide-in-from-right-4 duration-300">
            <div className="max-w-5xl mx-auto space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight uppercase">
                    {viewState === 'edit' ? `Edit Indent #${newIndent.indent_no}` : 'New Indent Request'}
                  </h2>
                  <p className="text-sm text-slate-400 dark:text-slate-500 font-semibold mt-1">
                    {viewState === 'edit' ? 'Update the details below to resubmit the indent' : 'Fill the details or use Vision AI to extract from a physical order book'}
                  </p>
                </div>
                <button 
                  onClick={() => setViewState('idle')}
                  className="p-3 bg-white dark:bg-slate-900 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Indent Number</label>
                  <input 
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border-none rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                    value={newIndent.indent_no}
                    onChange={e => setNewIndent({...newIndent, indent_no: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Indent Date</label>
                  <input 
                    type="date"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border-none rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                    value={newIndent.date}
                    onChange={e => setNewIndent({...newIndent, date: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Dept / Purpose</label>
                  <input 
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border-none rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                    placeholder="e.g. Electrical Dept"
                    value={newIndent.department}
                    onChange={e => setNewIndent({...newIndent, department: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Order Placed By</label>
                  <input 
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border-none rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                    placeholder="Name..."
                    value={newIndent.order_placed_by}
                    onChange={e => setNewIndent({...newIndent, order_placed_by: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Order Passed By</label>
                  <input 
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border-none rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                    placeholder="Name..."
                    value={newIndent.order_passed_by}
                    onChange={e => setNewIndent({...newIndent, order_passed_by: e.target.value})}
                  />
                </div>
              </div>

              {viewState === 'create' && (
                <div className="flex flex-wrap gap-4 items-center">
                  <label className="flex items-center gap-2.5 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-indigo-600/20 active:scale-95 group">
                    {isExtracting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                    {isExtracting ? "AI Working..." : "Scan physical Order Slip"}
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isExtracting} />
                  </label>
                  <div className="h-10 w-px bg-slate-200 dark:bg-slate-800 mx-2" />
                  <button 
                    onClick={addItem}
                    className="flex items-center gap-2.5 px-6 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer active:scale-95 shadow-sm"
                  >
                    <Plus className="w-5 h-5" /> Add Row Manually
                  </button>
                </div>
              )}
              {viewState === 'edit' && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={addItem}
                    className="flex items-center gap-2.5 px-6 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all cursor-pointer active:scale-95 shadow-sm"
                  >
                    <Plus className="w-5 h-5" /> Add New Row
                  </button>
                </div>
              )}

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 w-12 text-center">#</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-left">Description</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 w-24 text-center">Qty</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 w-24 text-center">UOM</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-left">App. Area</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 text-left">Req By</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {newIndent.items.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-slate-50/50 dark:hover:bg-slate-950/50 transition-colors">
                        <td className="px-4 py-2 text-center text-[10px] font-black text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-2">
                          <textarea 
                            rows={1}
                            className="w-full bg-transparent border-none text-[11px] font-bold text-slate-900 dark:text-slate-100 uppercase focus:ring-0 resize-none min-h-[1.5rem] py-1 no-scrollbar overflow-hidden"
                            placeholder="Enter item description..."
                            value={item.itemName}
                            onChange={e => {
                               updateItem(idx, 'itemName', e.target.value);
                               // Auto-expand height
                               e.target.style.height = 'inherit';
                               e.target.style.height = `${e.target.scrollHeight}px`;
                            }}
                            onFocus={e => {
                               e.target.style.height = 'inherit';
                               e.target.style.height = `${e.target.scrollHeight}px`;
                            }}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            type="text" 
                            className="w-full bg-transparent border-none text-[11px] font-bold text-center text-slate-900 dark:text-slate-100 focus:ring-0"
                            placeholder="0"
                            value={item.qty}
                            onChange={e => updateItem(idx, 'qty', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            type="text" 
                            className="w-full bg-transparent border-none text-[11px] font-bold text-center text-slate-900 dark:text-slate-100 uppercase focus:ring-0"
                            placeholder="NOS"
                            value={item.uom}
                            onChange={e => updateItem(idx, 'uom', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            type="text" 
                            className="w-full bg-transparent border-none text-[11px] font-bold text-slate-900 dark:text-slate-100 uppercase focus:ring-0"
                            placeholder="Area..."
                            value={item.applicationArea}
                            onChange={e => updateItem(idx, 'applicationArea', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            type="text" 
                            className="w-full bg-transparent border-none text-[11px] font-bold text-slate-900 dark:text-slate-100 uppercase focus:ring-0"
                            placeholder="Name..."
                            value={item.orderPlacedBy}
                            onChange={e => updateItem(idx, 'orderPlacedBy', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button onClick={() => removeItem(idx)} className="p-1 text-slate-300 hover:text-rose-600 transition-colors cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {newIndent.items.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-20 text-center">
                          <div className="max-w-xs mx-auto space-y-2 opacity-50">
                            <Plus className="w-8 h-8 mx-auto text-slate-300" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">List is empty. Use the toolbar above to add items.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4">
                <div className="flex items-center gap-3">
                   <div className="px-4 py-2 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-2">Count:</span>
                      <span className="text-sm font-black text-slate-900 dark:text-slate-100">{newIndent.items.length} Items</span>
                   </div>
                </div>
                <div className="flex gap-4 w-full sm:w-auto">
                  <button 
                    onClick={() => setViewState('idle')}
                    className="flex-1 sm:flex-none px-10 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Discard
                  </button>
                  <button 
                    onClick={handleSaveIndent}
                    disabled={newIndent.items.length === 0 || isExtracting}
                    className="flex-1 sm:flex-none px-12 py-3.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-black dark:hover:bg-white transition-all shadow-xl active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {viewState === 'edit' ? 'Update Indent Request' : 'Submit Indent Request'} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default IndentDashboard;
