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
  Filter,
  Image as ImageIcon,
  Table as TableIcon,
  Trash2,
  Edit,
  Upload,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Indent, IndentItem } from '../../types';

const IndentDashboard: React.FC = () => {
  const [indents, setIndents] = useState<Indent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  
  // New Indent State
  const [newIndent, setNewIndent] = useState<Indent>({
    indent_no: `IND-${Date.now().toString().slice(-6)}`,
    date: new Date().toISOString().split('T')[0],
    items: [],
    total_items: 0,
    department: ''
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

    console.log("Saving Indent Payload:", payload);

    try {
      const res = await fetch('/api/indents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast("Indent saved successfully");
        setShowModal(false);
        setNewIndent({
          indent_no: `IND-${Date.now().toString().slice(-6)}`,
          date: new Date().toISOString().split('T')[0],
          items: [],
          total_items: 0,
          department: ''
        });
        fetchIndents();
      } else {
        const err = await res.json();
        console.error("Save Error Response:", err);
        showToast(err.error || "Failed to save indent", "error");
      }
    } catch (err) {
      console.error("Save Network Error:", err);
      showToast("Error saving indent", "error");
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Approved</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-1 bg-rose-100 text-rose-700 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</span>;
      default:
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>;
    }
  };

  const filteredIndents = indents.filter(ind => {
    const matchesSearch = ind.indent_no.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (ind.department || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || ind.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-20">
        <div className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-100 rounded-xl transition-all border border-slate-200">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Debasis Indent Hub</h1>
              <p className="text-sm text-slate-400 font-semibold">Manage and approve order slip indents</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="Search Indents..."
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-200 active:scale-95"
            >
              <Plus className="w-4 h-4" /> New Indent
            </button>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50/50 flex items-center gap-2 border-t border-slate-100">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                statusFilter === f ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
        ) : filteredIndents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {filteredIndents.map(indent => (
              <div key={indent.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:border-slate-300 hover:shadow-md transition-all group flex flex-col h-full">
                <div className="p-5 border-b border-slate-100 flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <h3 className="font-black text-slate-900 uppercase tracking-tight truncate">#{indent.indent_no}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{new Date(indent.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div className="shrink-0">
                    {getStatusBadge(indent.status || 'PENDING')}
                  </div>
                </div>
                
                <div className="p-5 space-y-3.5 flex-1">
                  <div className="flex justify-between text-xs gap-4">
                    <span className="text-slate-400 font-bold uppercase tracking-wider shrink-0">Dept / Purpose</span>
                    <span className="text-slate-900 font-black uppercase truncate text-right">{indent.department || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-bold uppercase tracking-wider">Total Items</span>
                    <span className="text-slate-900 font-black uppercase">{indent.total_items}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-bold uppercase tracking-wider">Created By</span>
                    <span className="text-slate-900 font-black uppercase truncate">{indent.created_by_name || 'System'}</span>
                  </div>

                  {indent.status === 'REJECTED' && indent.rejection_remarks && (
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 mt-2">
                      <p className="text-[9px] font-black text-rose-600 uppercase mb-1">Rejection Reason:</p>
                      <p className="text-xs text-rose-800 italic line-clamp-2" title={indent.rejection_remarks}>"{indent.rejection_remarks}"</p>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex gap-2 mt-auto">
                  {indent.status === 'PENDING' && canApprove ? (
                    <>
                      <button 
                        onClick={() => handleStatusUpdate(indent.id!, 'REJECTED')}
                        className="flex-1 py-2 bg-white border border-rose-200 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all"
                      >
                        Reject
                      </button>
                      <button 
                        onClick={() => handleStatusUpdate(indent.id!, 'APPROVED')}
                        className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all"
                      >
                        Approve
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => alert("Detailed view coming soon")}
                      className="w-full py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                    >
                      View Details <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200 max-w-xl mx-auto">
            <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h3 className="font-bold text-slate-900 uppercase tracking-tight">No Indents Found</h3>
            <p className="text-slate-400 text-sm mt-1">Start by creating a new indent or uploading an order slip.</p>
          </div>
        )}
      </div>

      {/* New Indent Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Create New Indent</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Order Slip Digitalization Hub</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-all">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Indent Number</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:outline-none"
                    value={newIndent.indent_no}
                    onChange={e => setNewIndent({...newIndent, indent_no: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Date</label>
                  <input 
                    type="date"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:outline-none"
                    value={newIndent.date}
                    onChange={e => setNewIndent({...newIndent, date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Department / Purpose</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:outline-none"
                    placeholder="e.g. Electrical Dept / Plant Maintenance"
                    value={newIndent.department}
                    onChange={e => setNewIndent({...newIndent, department: e.target.value})}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4 mb-8">
                <label className="flex items-center gap-2 px-6 py-3 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-all cursor-pointer">
                  <ImageIcon className="w-4 h-4" />
                  Upload Order Slip (Vision AI)
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
                <button 
                  onClick={addItem}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-50 border border-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Item Manually
                </button>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Item Name</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 w-24">Qty</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 w-24">UOM</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Application Area</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Placed By</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Passed By</th>
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {newIndent.items.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-slate-50/50">
                        <td className="p-2">
                          <input 
                            type="text" 
                            className="w-full px-3 py-1.5 text-xs font-bold border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-slate-300 rounded-lg outline-none uppercase"
                            value={item.itemName}
                            onChange={e => updateItem(idx, 'itemName', e.target.value)}
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="text" 
                            className="w-full px-3 py-1.5 text-xs font-bold border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-slate-300 rounded-lg outline-none"
                            value={item.qty}
                            onChange={e => updateItem(idx, 'qty', e.target.value)}
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="text" 
                            className="w-full px-3 py-1.5 text-xs font-bold border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-slate-300 rounded-lg outline-none uppercase"
                            value={item.uom}
                            onChange={e => updateItem(idx, 'uom', e.target.value)}
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="text" 
                            className="w-full px-3 py-1.5 text-xs font-bold border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-slate-300 rounded-lg outline-none uppercase"
                            value={item.applicationArea}
                            onChange={e => updateItem(idx, 'applicationArea', e.target.value)}
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="text" 
                            className="w-full px-3 py-1.5 text-xs font-bold border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-slate-300 rounded-lg outline-none uppercase"
                            value={item.orderPlacedBy}
                            onChange={e => updateItem(idx, 'orderPlacedBy', e.target.value)}
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="text" 
                            className="w-full px-3 py-1.5 text-xs font-bold border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-slate-300 rounded-lg outline-none uppercase"
                            value={item.orderPassedBy}
                            onChange={e => updateItem(idx, 'orderPassedBy', e.target.value)}
                          />
                        </td>
                        <td className="p-2">
                          <button onClick={() => removeItem(idx)} className="p-1.5 text-slate-300 hover:text-rose-600 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {newIndent.items.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center">
                          {isExtracting ? (
                            <div className="flex flex-col items-center gap-3">
                              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                              <p className="text-xs font-black uppercase text-indigo-600 tracking-widest animate-pulse">Gemini Vision AI is extracting data...</p>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No items added. Use Vision AI or Manual Entry.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Summary:</span>
                <span className="text-xs font-black text-slate-900">{newIndent.items.length} Items to be recorded</span>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowModal(false)}
                  className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95 shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveIndent}
                  disabled={isExtracting}
                  className="px-10 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-lg shadow-slate-200 disabled:opacity-50"
                >
                  Finalize & Save Indent
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndentDashboard;
