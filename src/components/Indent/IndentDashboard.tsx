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
  X,
  Link2,
  Link2Off
} from 'lucide-react';

const LinkToggle = ({ isLinked, onToggle, className = "" }: { isLinked: boolean, onToggle: () => void, className?: string }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onToggle(); }} 
    className={`print:hidden p-1 rounded-md hover:bg-slate-200/50 transition-all cursor-pointer border ${
      isLinked 
        ? 'text-blue-600 bg-blue-50 border-blue-200 shadow-sm' 
        : 'text-slate-500 border-transparent hover:border-slate-300'
    } ${className}`}
    title={isLinked ? "Unlink column" : "Link column (auto-fill all rows)"}
  >
    {isLinked ? <Link2 className="w-3.5 h-3.5" /> : <Link2Off className="w-3.5 h-3.5" />}
  </button>
);
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Indent, IndentItem } from '../../types';

const EditableText = ({ value, onChange, className = "", readOnly = false }: { value: string, onChange: (val: string) => void, className?: string, readOnly?: boolean }) => {
  if (readOnly) {
    return <span className={`inline-block border-b border-black px-2 flex-1 text-center ml-2 ${className}`}>{value || 'N/A'}</span>;
  }
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      className={`hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500/30 px-2 rounded transition-all inline-block border-b border-black px-2 flex-1 text-center ml-2 min-w-[50px] ${className}`}
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
};

const IndentDashboard: React.FC = () => {
  const [indents, setIndents] = useState<Indent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewState, setViewState] = useState<'idle' | 'view' | 'create' | 'edit'>('idle');
  const [selectedIndent, setSelectedIndent] = useState<Indent | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [linkedColumns, setLinkedColumns] = useState<Set<string>>(new Set());
  
  const toggleLink = (field: string) => {
    setLinkedColumns(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };
  
  // Form State (used for both create and edit)
  const [newIndent, setNewIndent] = useState<Indent>({
    indent_no: '',
    date: new Date().toISOString().split('T')[0],
    plant_name: '',
    items: [],
    total_items: 0,
    department: '',
    order_placed_by: '',
    order_passed_by: '',
    is_urgent: false
  });

  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { showToast } = useToast();
  
  const canApprove = user?.role === 'SUPERADMIN' || user?.permissions.includes('APPROVE_INDENT');

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

  const handleStatusUpdate = async (id: number, status: 'APPROVED' | 'REJECTED' | 'PENDING') => {
    let remarks = '';
    if (status === 'REJECTED') {
      remarks = window.prompt("Enter rejection remarks:") || '';
      if (!remarks) return;
    }

    if (status === 'PENDING') {
      if (!window.confirm("Are you sure you want to unapprove this indent?")) return;
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
        showToast(`Indent ${status === 'PENDING' ? 'unapproved' : status.toLowerCase()} successfully`);
        fetchIndents();
        if (selectedIndent && selectedIndent.id === id) {
          setSelectedIndent({ ...selectedIndent, status, rejection_remarks: remarks || null });
        }
      }
    } catch (err) {
      showToast("Failed to update status", "error");
    }
  };

  const handleSaveIndent = async () => {
    if (!newIndent.indent_no.trim()) {
      showToast("Please enter an indent number", "error");
      return;
    }

    if (newIndent.items.length === 0) {
      showToast("Please add at least one item", "error");
      return;
    }

    // Add serial numbers to items
    const itemsWithSn = newIndent.items.map((item, index) => ({
      ...item,
      sn: index + 1
    }));

    const payload = {
      ...newIndent,
      items: itemsWithSn,
      total_items: itemsWithSn.length
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
          indent_no: '',
          date: new Date().toISOString().split('T')[0],
          plant_name: '',
          items: [],
          total_items: 0,
          department: '',
          order_placed_by: '',
          order_passed_by: '',
          is_urgent: false
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
        orderPassedBy: '',
        oldMaterialStatus: ''
      }]
    }));
  };

  const updateItem = (index: number, field: keyof IndentItem, value: string) => {
    const isLinked = linkedColumns.has(field);
    setNewIndent(prev => {
      const newItems = [...prev.items];
      if (isLinked) {
        // Propagate to all items
        for (let i = 0; i < newItems.length; i++) {
          newItems[i] = { ...newItems[i], [field]: value };
        }
      } else {
        newItems[index] = { ...newItems[index], [field]: value };
      }
      return { ...prev, items: newItems };
    });
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
      indent_no: '',
      date: new Date().toISOString().split('T')[0],
      plant_name: '',
      items: [],
      total_items: 0,
      department: '',
      order_placed_by: '',
      order_passed_by: '',
      is_urgent: false
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
              <div
                key={indent.id}
                onClick={() => selectIndent(indent)}
                className={`w-full text-left p-4 rounded-2xl transition-all group border cursor-pointer ${
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
                      }`}>{indent.plant_name || indent.department || 'General Indent'}</span>
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
              </div>
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
        ) : (viewState === 'view' || viewState === 'create' || viewState === 'edit') ? (
          <div className="p-4 sm:p-8 lg:p-12 animate-in fade-in duration-500">
            {/* Action Bar */}
            <div className="max-w-4xl mx-auto mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 relative z-10 no-print">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  (viewState === 'view' ? selectedIndent?.status : newIndent.status) === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600' :
                  (viewState === 'view' ? selectedIndent?.status : newIndent.status) === 'REJECTED' ? 'bg-rose-500/10 text-rose-600' :
                  'bg-amber-500/10 text-amber-600'
                }`}>
                  {(viewState === 'view' ? selectedIndent?.status : newIndent.status) === 'APPROVED' ? <CheckCircle className="w-5 h-5" /> : 
                   (viewState === 'view' ? selectedIndent?.status : newIndent.status) === 'REJECTED' ? <XCircle className="w-5 h-5" /> : 
                   <Clock className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">
                    {viewState === 'view' ? selectedIndent?.status : (viewState === 'edit' ? 'EDITING' : 'NEW INDENT')} STATUS
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    {viewState === 'view' ? `Indent #${selectedIndent?.indent_no}` : (newIndent.indent_no ? `Indent #${newIndent.indent_no}` : 'Draft Indent')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {viewState === 'view' && selectedIndent ? (
                  <>
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
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    {(viewState === 'create' || viewState === 'edit') && (
                      <label className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-md active:scale-95">
                        {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                        {isExtracting ? "Scanning..." : "Scan Slip"}
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isExtracting} />
                      </label>
                    )}
                    <button 
                      onClick={addItem}
                      className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      Add Row
                    </button>
                    <button 
                      onClick={handleSaveIndent}
                      disabled={newIndent.items.length === 0 || isExtracting}
                      className="px-6 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {viewState === 'edit' ? 'Update' : 'Save'} Indent
                    </button>
                  </div>
                )}
                <button 
                  onClick={() => setViewState('idle')}
                  className="p-2.5 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Realistic Paper Format */}
            <div className="print-paper max-w-4xl mx-auto bg-white shadow-2xl border border-slate-300 dark:border-slate-800 p-8 sm:p-12 mb-20 relative text-black print:shadow-none print:p-0 print:border-none">
              <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600 print:hidden" />
              
              {/* Slip Header */}
              <div className="space-y-6">
                <div className="text-center border-b-2 border-black pb-4 relative">
                  <h1 className="text-2xl font-black tracking-tighter uppercase mb-0.5">
                    Order Book {(viewState === 'view' ? selectedIndent?.is_urgent : newIndent.is_urgent) ? '(Urgent)' : '(Normal)'}
                  </h1>
                  {viewState !== 'view' && (
                    <button 
                      onClick={() => setNewIndent(prev => ({ ...prev, is_urgent: !prev.is_urgent }))}
                      className="absolute top-0 right-0 p-1.5 bg-slate-100 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all no-print"
                    >
                      Toggle Urgency
                    </button>
                  )}
                  <p className="text-[10px] font-bold print:hidden uppercase">
                    DIGITAL RECORD SYNCED: {new Date((viewState === 'view' ? selectedIndent?.created_at : new Date().toISOString()) || "").toLocaleString()}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-x-12 gap-y-4 pt-4">
                  <div className="border-b border-black/20 pb-1 flex justify-between items-end">
                    <span className="text-[11px] font-black uppercase tracking-tight">Plant Name :-</span>
                    <EditableText 
                      value={(viewState === 'view' ? selectedIndent?.plant_name : newIndent.plant_name) || ''} 
                      onChange={val => viewState !== 'view' && setNewIndent({...newIndent, plant_name: val})}
                      readOnly={viewState === 'view'}
                      className="font-serif italic text-sm"
                    />
                  </div>
                  <div className="border-b border-black/20 pb-1 flex justify-between items-end">
                    <span className="text-[11px] font-black uppercase tracking-tight">Order Date :-</span>
                    {viewState === 'view' ? (
                      <span className="text-sm font-bold font-serif italic border-b border-black px-2 flex-1 text-center ml-2">
                        {new Date(selectedIndent?.date || "").toLocaleDateString('en-GB')}
                      </span>
                    ) : (
                      <input 
                        type="date"
                        className="bg-transparent border-none text-sm font-bold font-serif italic border-b border-black px-2 flex-1 text-center ml-2 focus:ring-0 p-0"
                        value={newIndent.date}
                        onChange={e => setNewIndent({...newIndent, date: e.target.value})}
                      />
                    )}
                  </div>
                  <div className="border-b border-black/20 pb-1 flex justify-between items-end">
                    <span className="text-[11px] font-black uppercase tracking-tight">Order No :-</span>
                    <EditableText 
                      value={(viewState === 'view' ? selectedIndent?.indent_no : newIndent.indent_no) || ''} 
                      onChange={val => viewState !== 'view' && setNewIndent({...newIndent, indent_no: val})}
                      readOnly={viewState === 'view'}
                      className="font-serif italic text-sm"
                    />
                  </div>
                  <div className="border-b border-black/20 pb-1 flex justify-between items-end">
                    <span className="text-[11px] font-black uppercase tracking-tight text-nowrap">Order Placed By :-</span>
                    <EditableText 
                      value={(viewState === 'view' ? selectedIndent?.order_placed_by : newIndent.order_placed_by) || ''} 
                      onChange={val => viewState !== 'view' && setNewIndent({...newIndent, order_placed_by: val})}
                      readOnly={viewState === 'view'}
                      className="font-serif italic text-sm"
                    />
                  </div>
                  <div className="border-b border-black/20 pb-1 flex justify-between items-end">
                    <span className="text-[11px] font-black uppercase tracking-tight text-nowrap">Order Passed By :-</span>
                    <EditableText 
                      value={(viewState === 'view' ? selectedIndent?.order_passed_by : newIndent.order_passed_by) || ''} 
                      onChange={val => viewState !== 'view' && setNewIndent({...newIndent, order_passed_by: val})}
                      readOnly={viewState === 'view'}
                      className="font-serif italic text-sm"
                    />
                  </div>
                  <div className="border-b border-black/20 pb-1 flex justify-between items-end">
                    <span className="text-[11px] font-black uppercase tracking-tight">Department :-</span>
                    <EditableText 
                      value={(viewState === 'view' ? selectedIndent?.department : newIndent.department) || ''} 
                      onChange={val => viewState !== 'view' && setNewIndent({...newIndent, department: val})}
                      readOnly={viewState === 'view'}
                      className="font-serif italic text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="mt-10 border-2 border-black overflow-x-auto no-scrollbar">
                <table className="w-full border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 border-b-2 border-black">
                      <th className="border-r border-black p-2 text-[10px] font-black uppercase w-12 text-center">SL NO</th>
                      <th className="border-r border-black p-2 text-[10px] font-black uppercase text-left">ITEM NAME</th>
                      <th className="border-r border-black p-2 text-[10px] font-black uppercase w-16 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span>QTY</span>
                          {viewState !== 'view' && <LinkToggle isLinked={linkedColumns.has('qty')} onToggle={() => toggleLink('qty')} />}
                        </div>
                      </th>
                      <th className="border-r border-black p-2 text-[10px] font-black uppercase w-16 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span>UOM</span>
                          {viewState !== 'view' && <LinkToggle isLinked={linkedColumns.has('uom')} onToggle={() => toggleLink('uom')} />}
                        </div>
                      </th>
                      <th className="border-r border-black p-2 text-[10px] font-black uppercase w-32 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span>APPLICATION AREA</span>
                          {viewState !== 'view' && <LinkToggle isLinked={linkedColumns.has('applicationArea')} onToggle={() => toggleLink('applicationArea')} />}
                        </div>
                      </th>
                      <th className="border-r border-black p-2 text-[10px] font-black uppercase w-32 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span>MATERIAL REQ BY</span>
                          {viewState !== 'view' && <LinkToggle isLinked={linkedColumns.has('orderPlacedBy')} onToggle={() => toggleLink('orderPlacedBy')} />}
                        </div>
                      </th>
                      <th className="border-r border-black p-2 text-[10px] font-black uppercase w-32 text-center leading-tight">
                        <div className="flex flex-col items-center gap-0.5">
                          <span>OLD MATERIAL STATUS</span>
                          {viewState !== 'view' && <LinkToggle isLinked={linkedColumns.has('oldMaterialStatus')} onToggle={() => toggleLink('oldMaterialStatus')} />}
                        </div>
                      </th>
                      {viewState !== 'view' && <th className="p-2 text-[10px] font-black uppercase w-10 text-center no-print"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(viewState === 'view' ? selectedIndent?.items : newIndent.items)?.map((item, idx) => (
                      <tr key={idx} className="border-b border-black last:border-b-0 min-h-[40px] group">
                        <td className="border-r border-black p-2 text-xs font-bold text-center italic">{idx + 1}</td>
                        <td className="border-r border-black p-2 text-xs font-bold uppercase italic">
                          {viewState === 'view' ? item.itemName : (
                            <textarea 
                              ref={el => {
                                if (el) {
                                  el.style.height = 'inherit';
                                  el.style.height = `${el.scrollHeight}px`;
                                }
                              }}
                              rows={1}
                              className="w-full bg-transparent border-none p-0 focus:ring-0 resize-none font-bold uppercase italic text-xs min-h-[1rem]"
                              value={item.itemName}
                              onChange={e => {
                                updateItem(idx, 'itemName', e.target.value);
                                e.target.style.height = 'inherit';
                                e.target.style.height = `${e.target.scrollHeight}px`;
                              }}
                            />
                          )}
                        </td>
                        <td className="border-r border-black p-2 text-xs font-bold text-center italic">
                          {viewState === 'view' ? item.qty : (
                            <textarea 
                              ref={el => {
                                if (el) {
                                  el.style.height = 'inherit';
                                  el.style.height = `${el.scrollHeight}px`;
                                }
                              }}
                              rows={1}
                              className="w-full bg-transparent border-none p-0 focus:ring-0 resize-none font-bold italic text-xs text-center min-h-[1rem]"
                              value={item.qty}
                              onChange={e => {
                                updateItem(idx, 'qty', e.target.value);
                                e.target.style.height = 'inherit';
                                e.target.style.height = `${e.target.scrollHeight}px`;
                              }}
                            />
                          )}
                        </td>
                        <td className="border-r border-black p-2 text-xs font-bold text-center italic uppercase">
                          {viewState === 'view' ? item.uom : (
                            <textarea 
                              ref={el => {
                                if (el) {
                                  el.style.height = 'inherit';
                                  el.style.height = `${el.scrollHeight}px`;
                                }
                              }}
                              rows={1}
                              className="w-full bg-transparent border-none p-0 focus:ring-0 resize-none font-bold italic text-xs text-center uppercase min-h-[1rem]"
                              value={item.uom}
                              onChange={e => {
                                updateItem(idx, 'uom', e.target.value);
                                e.target.style.height = 'inherit';
                                e.target.style.height = `${e.target.scrollHeight}px`;
                              }}
                            />
                          )}
                        </td>
                        <td className="border-r border-black p-2 text-xs font-bold text-center italic uppercase">
                          {viewState === 'view' ? item.applicationArea : (
                            <textarea 
                              ref={el => {
                                if (el) {
                                  el.style.height = 'inherit';
                                  el.style.height = `${el.scrollHeight}px`;
                                }
                              }}
                              rows={1}
                              className="w-full bg-transparent border-none p-0 focus:ring-0 resize-none font-bold italic text-xs text-center uppercase min-h-[1rem]"
                              value={item.applicationArea}
                              onChange={e => {
                                updateItem(idx, 'applicationArea', e.target.value);
                                e.target.style.height = 'inherit';
                                e.target.style.height = `${e.target.scrollHeight}px`;
                              }}
                            />
                          )}
                        </td>
                        <td className="border-r border-black p-2 text-xs font-bold text-center italic uppercase">
                          {viewState === 'view' ? item.orderPlacedBy : (
                            <textarea 
                              ref={el => {
                                if (el) {
                                  el.style.height = 'inherit';
                                  el.style.height = `${el.scrollHeight}px`;
                                }
                              }}
                              rows={1}
                              className="w-full bg-transparent border-none p-0 focus:ring-0 resize-none font-bold italic text-xs text-center uppercase min-h-[1rem]"
                              value={item.orderPlacedBy}
                              onChange={e => {
                                updateItem(idx, 'orderPlacedBy', e.target.value);
                                e.target.style.height = 'inherit';
                                e.target.style.height = `${e.target.scrollHeight}px`;
                              }}
                            />
                          )}
                        </td>
                        <td className="border-r border-black p-2 text-xs font-bold text-center italic uppercase">
                          {viewState === 'view' ? item.oldMaterialStatus : (
                            <textarea 
                              ref={el => {
                                if (el) {
                                  el.style.height = 'inherit';
                                  el.style.height = `${el.scrollHeight}px`;
                                }
                              }}
                              rows={1}
                              className="w-full bg-transparent border-none p-0 focus:ring-0 resize-none font-bold italic text-xs text-center uppercase min-h-[1rem]"
                              value={item.oldMaterialStatus}
                              onChange={e => {
                                updateItem(idx, 'oldMaterialStatus', e.target.value);
                                e.target.style.height = 'inherit';
                                e.target.style.height = `${el.scrollHeight}px`;
                              }}
                            />
                          )}
                        </td>
                        {viewState !== 'view' && (
                          <td className="p-2 text-center no-print">
                            <button onClick={() => removeItem(idx)} className="text-rose-400 hover:text-rose-600 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {Array.from({ length: Math.max(0, 10 - (viewState === 'view' ? selectedIndent?.items.length || 0 : newIndent.items.length)) }).map((_, i) => (
                      <tr key={`filler-${i}`} className="border-b border-black last:border-b-0 h-10">
                        <td className="border-r border-black p-2"></td>
                        <td className="border-r border-black p-2"></td>
                        <td className="border-r border-black p-2"></td>
                        <td className="border-r border-black p-2"></td>
                        <td className="border-r border-black p-2"></td>
                        <td className="border-r border-black p-2"></td>
                        <td className="border-r border-black p-2"></td>
                        {viewState !== 'view' && <td className="no-print"></td>}
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

              {viewState === 'view' && selectedIndent?.rejection_remarks && (
                <div className="mt-12 p-4 bg-rose-50 border-2 border-rose-200 rounded-lg text-rose-800 italic">
                  <p className="text-[9px] font-black uppercase mb-1 not-italic tracking-widest">Office Rejection Note:</p>
                  "{selectedIndent.rejection_remarks}"
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default IndentDashboard;
