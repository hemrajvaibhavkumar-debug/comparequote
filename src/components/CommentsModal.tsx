import React, { useState, useEffect } from 'react';
import { X, Lock, FileText, Save, Clock, User } from 'lucide-react';
import { InternalComment } from '../types';
import { useAuth } from '../context/AuthContext';

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  comments: InternalComment[];
  onAddComment: (text: string) => Promise<void>;
  onUpdateComment: (commentId: string, text: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  title: string;
}

export default function CommentsModal({ isOpen, onClose, comments, onAddComment, onUpdateComment, title }: CommentsModalProps) {
  const [noteText, setNoteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();

  const canEdit = user?.role === 'SUPERADMIN' || user?.permissions.includes('ADD_INTERNAL_COMMENTS');

  // Load the initial value from the first comment in the array
  const activeComment = comments[0];

  useEffect(() => {
    if (isOpen) {
      setNoteText(activeComment?.text || '');
    }
  }, [isOpen, activeComment]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (isSaving || !canEdit) return;

    try {
      setIsSaving(true);
      if (activeComment) {
        // If there's an existing comment, update it
        await onUpdateComment(activeComment.id, noteText);
      } else {
        // If no comment yet, add it
        await onAddComment(noteText);
      }
      alert("Notepad saved successfully!");
    } catch (error) {
      console.error("Failed to save notepad notes", error);
      alert("Failed to save notes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col h-[75vh] max-h-[600px] animate-in zoom-in-95 duration-200 transition-colors">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-md font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Internal Points & Observations</h3>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate max-w-[300px]">{title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notepad Textarea */}
        <div className="flex-1 p-6 bg-amber-50/20 dark:bg-slate-900/50 relative flex flex-col overflow-hidden">
          {/* Ruled lines pattern overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.04] dark:opacity-[0.02]" style={{
            backgroundImage: 'linear-gradient(#000000 1px, transparent 1px)',
            backgroundSize: '100% 28px',
            marginTop: '28px'
          }} />
          
          <textarea
            readOnly={!canEdit}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className={`w-full flex-1 p-5 rounded-xl border border-amber-200/60 dark:border-slate-700 bg-amber-50/30 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 text-sm font-medium leading-[28px] focus:outline-none transition-all resize-none shadow-inner custom-scrollbar ${
              canEdit ? 'focus:ring-2 focus:ring-amber-500/10 focus:border-amber-400 dark:focus:border-slate-600' : 'cursor-not-allowed bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
            }`}
            placeholder={canEdit ? "Write internal observations, terms review details, or commercial negotiation notes here..." : "No observations recorded yet."}
          />
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between transition-colors">
          <div className="flex items-center gap-2 text-slate-550">
            {activeComment ? (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">
                <User className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
                <span>Last updated by @{activeComment.author}</span>
                <span className="w-1 h-1 rounded-full bg-slate-350 dark:bg-slate-700" />
                <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
                <span>{new Date(activeComment.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ) : (
              <div className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> Clean notepad sheet
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 border border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer transition-all active:scale-[0.98]"
            >
              Close
            </button>
            {canEdit ? (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-black dark:hover:bg-white transition-all shadow-md shadow-slate-100 dark:shadow-none flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:scale-100 active:scale-[0.98]"
              >
                {isSaving ? (
                  <div className="w-3.5 h-3.5 border-2 border-white dark:border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save Notes
              </button>
            ) : (
              <div className="flex items-center gap-1 text-[10px] font-black text-rose-500 uppercase tracking-widest px-4 py-2 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-100 dark:border-rose-900/30">
                <Lock className="w-3.5 h-3.5" /> Read-Only
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
