import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ComparisonTable } from './components/ComparisonTable';
import { Download, Eye, MessageSquare, StickyNote, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import CommentsModal from './components/CommentsModal';
import { useToast } from './context/ToastContext';

export default function ViewTable() {
  const { id } = useParams();
  const { token, logout, user } = useAuth();
  const { showToast } = useToast();
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Comments State
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const canAddNote = user?.role === 'SUPERADMIN' || user?.permissions.includes('ADD_INTERNAL_COMMENTS');

  // Local state for editing
  const [header, setHeader] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/comparisons/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (res.status === 401 || res.status === 403) {
          logout();
          throw new Error("Session expired. Please log in again.");
        }
        return res.json();
      })
      .then(d => {
        setRecord(d);
        setHeader(d.data?.header || {});
        setData(d.data?.data || { items: [], vendors: [] });
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [id, token]);

  const handleAddComment = async (text: string) => {
    try {
      const res = await fetch(`/api/comparisons/${id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const updatedRecord = await res.json();
        setRecord(updatedRecord);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateComment = async (commentId: string, text: string) => {
    try {
      const res = await fetch(`/api/comparisons/${id}/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const updatedRecord = await res.json();
        setRecord(updatedRecord);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const res = await fetch(`/api/comparisons/${id}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const updatedRecord = await res.json();
        setRecord(updatedRecord);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      const payload = {
        doc_no: header.docNo || record.doc_no,
        data: { header, data }
      };
      const res = await fetch(`/api/comparisons/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      let result;
      const text = await res.text();
      try {
        result = text ? JSON.parse(text) : {};
      } catch (e) {
        throw new Error("Server returned an invalid response. Please check if the server is running.");
      }

      if (res.status === 401 || res.status === 403) {
        logout();
        return;
      }

      if (!res.ok) throw new Error(result.error || "Failed to update");
      
      showToast("Changes saved successfully!");
      setRecord((prev: any) => ({ ...prev, doc_no: payload.doc_no, data: payload.data }));
      setIsEditing(false);
    } catch (err: any) {
      console.error(err);
      showToast("Update Failed: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="p-8 max-w-7xl mx-auto text-slate-400 font-bold">Loading...</div>;
  if (!record || record.error) return <div className="p-8 max-w-7xl mx-auto text-rose-500 font-bold">Not found or error</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 min-h-screen bg-slate-50/50 dark:bg-slate-950 transition-colors duration-300">
      <div className="flex items-center justify-between print-hidden">
        <div className="flex items-center gap-4 text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          <Link to="/saved" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Saved Tables</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-800 dark:text-slate-100 font-black">{header?.docNo || record.doc_no}</span>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setIsEditing(!isEditing)}
             className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${isEditing ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'}`}
           >
             {isEditing ? 'Cancel Editing' : 'Edit Table'}
           </button>
           {isEditing && (
             <button 
               onClick={handleUpdate}
               disabled={isSaving}
               className="px-5 py-2 bg-green-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-md shadow-green-600/10"
             >
               {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
               Save Changes
             </button>
           )}
        </div>
      </div>

      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 print-hidden">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight uppercase">{header?.docNo || record.doc_no}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest">Saved on {new Date(record.created_at).toLocaleString()}</p>
        </div>
        <div className="flex gap-3">
          <button 
             onClick={handlePrint}
             className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black dark:hover:bg-white transition-all shadow-lg shadow-slate-200 dark:shadow-none cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4" /> Export/Print PDF
          </button>
        </div>
      </div>

      {/* Internal Notes Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-6 print-hidden transition-all duration-300">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg shadow-md">
              <StickyNote className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Internal Comments</h3>
          </div>
          <button 
            onClick={() => setIsCommentsOpen(true)}
            className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
          >
            {canAddNote ? 'Add Points' : 'View All'} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-6">
          {!record.internal_comments || record.internal_comments.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold italic tracking-wide">No internal points recorded for this comparison.</p>
          ) : (
            <div className="space-y-4">
              {record.internal_comments.slice(-3).map((note: any, idx: number) => (
                <div key={idx} className="flex gap-3 text-sm">
                  <div className="w-1 h-auto bg-slate-200 dark:bg-slate-800 rounded-full shrink-0" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">@{note.author}</span>
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{new Date(note.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 font-semibold leading-relaxed line-clamp-2">{note.text}</p>
                  </div>
                </div>
              ))}
              {record.internal_comments.length > 3 && (
                <button onClick={() => setIsCommentsOpen(true)} className="text-[10px] font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 uppercase tracking-widest mt-2 cursor-pointer transition-colors">
                  + {record.internal_comments.length - 3} more notes
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
         <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/20 dark:bg-slate-950/20">
           <h2 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Result Table {isEditing && <span className="ml-2 text-[10px] text-amber-600 dark:text-amber-400 font-black uppercase tracking-widest bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-lg border border-amber-100 dark:border-amber-900/30 shadow-xs">Edit Mode Active</span>}</h2>
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 pr-4 border-r border-slate-200 dark:border-slate-800">
                <label className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-400 cursor-pointer select-none tracking-widest" htmlFor="multiplyByWeight">Multiply by Weight (WT)</label>
                <input 
                  id="multiplyByWeight"
                  type="checkbox" 
                  checked={data?.multiplyByWeight || false} 
                  disabled={!isEditing}
                  onChange={e => setData((prev: any) => ({ ...prev, multiplyByWeight: e.target.checked }))} 
                  className="w-4.5 h-4.5 accent-slate-900 dark:accent-white cursor-pointer disabled:opacity-50 rounded-lg"
                />
              </div>
            </div>
         </div>
         <div className="p-5 overflow-auto">
           <ComparisonTable 
              data={data} 
              setData={setData} 
              header={header} 
              setHeader={setHeader}
              tableRef={tableRef} 
              readOnly={!isEditing} 
            />
         </div>
      </div>

      <CommentsModal 
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
        comments={record.internal_comments || []}
        onAddComment={handleAddComment}
        onUpdateComment={handleUpdateComment}
        onDeleteComment={handleDeleteComment}
        title={`Comparison #${record.doc_no}`}
      />
    </div>
  );
}
