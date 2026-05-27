import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ComparisonTable } from './components/ComparisonTable';
import { Download, Eye, MessageSquare, StickyNote, ChevronRight } from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as htmlToImage from 'html-to-image';
import { useAuth } from './context/AuthContext';
import CommentsModal from './components/CommentsModal';

export default function ViewTable() {
  const { id } = useParams();
  const { token, logout, user } = useAuth();
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
      
      alert("Changes saved successfully!");
      setRecord((prev: any) => ({ ...prev, doc_no: payload.doc_no, data: payload.data }));
      setIsEditing(false);
    } catch (err: any) {
      console.error(err);
      alert("Update Failed: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="p-8 max-w-7xl mx-auto">Loading...</div>;
  if (!record || record.error) return <div className="p-8 max-w-7xl mx-auto text-red-500">Not found or error</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between print-hidden">
        <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
          <Link to="/saved" className="hover:text-indigo-600 transition-colors">Saved Tables</Link>
          <span>/</span>
          <span className="text-slate-800">{header?.docNo || record.doc_no}</span>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setIsEditing(!isEditing)}
             className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${isEditing ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
           >
             {isEditing ? 'Cancel Editing' : 'Edit Table'}
           </button>
           {isEditing && (
             <button 
               onClick={handleUpdate}
               disabled={isSaving}
               className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
             >
               {isSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
               Save Changes
             </button>
           )}
        </div>
      </div>

      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print-hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{header?.docNo || record.doc_no}</h1>
          <p className="text-slate-500 text-sm mt-1">Saved on {new Date(record.created_at).toLocaleString()}</p>
        </div>
        <div className="flex gap-3">
          <button 
             onClick={handlePrint}
             className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg"
          >
            <Download className="w-4 h-4" /> Export/Print PDF
          </button>
        </div>
      </div>

      {/* Internal Notes Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6 print-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-slate-900 text-white rounded-lg">
              <StickyNote className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Internal Team Notes</h3>
          </div>
          <button 
            onClick={() => setIsCommentsOpen(true)}
            className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors cursor-pointer"
          >
            {canAddNote ? 'Add Point' : 'View All'} <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="p-6">
          {!record.internal_comments || record.internal_comments.length === 0 ? (
            <p className="text-xs text-slate-400 font-medium italic">No internal points recorded for this comparison.</p>
          ) : (
            <div className="space-y-4">
              {record.internal_comments.slice(-3).map((note: any, idx: number) => (
                <div key={idx} className="flex gap-3 text-sm">
                  <div className="w-1 h-auto bg-slate-200 rounded-full shrink-0" />
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-black text-slate-800 uppercase">{note.author}</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase">{new Date(note.date).toLocaleDateString('en-IN')}</span>
                    </div>
                    <p className="text-slate-600 font-medium leading-relaxed line-clamp-2">{note.text}</p>
                  </div>
                </div>
              ))}
              {record.internal_comments.length > 3 && (
                <button onClick={() => setIsCommentsOpen(true)} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest mt-2 cursor-pointer">
                  + {record.internal_comments.length - 3} more notes
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-5 border-b border-slate-100 flex justify-between items-center">
           <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Result Table {isEditing && <span className="ml-2 text-xs text-amber-600 font-bold uppercase tracking-widest bg-amber-50 px-2 py-1 rounded">Edit Mode Active</span>}</h2>
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 pr-4 border-r border-black/10">
                <label className="text-[10px] font-bold uppercase text-black cursor-pointer select-none" htmlFor="multiplyByWeight">Multiply by Weight (WT)</label>
                <input 
                  id="multiplyByWeight"
                  type="checkbox" 
                  checked={data?.multiplyByWeight || false} 
                  disabled={!isEditing}
                  onChange={e => setData((prev: any) => ({ ...prev, multiplyByWeight: e.target.checked }))} 
                  className="w-4 h-4 accent-black cursor-pointer disabled:opacity-50"
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
