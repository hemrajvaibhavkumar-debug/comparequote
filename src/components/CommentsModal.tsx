import React, { useState } from 'react';
import { X, Plus, User, Clock, StickyNote, Lock, Trash2, Edit2, ChevronRight } from 'lucide-react';
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

export default function CommentsModal({ isOpen, onClose, comments, onAddComment, onUpdateComment, onDeleteComment, title }: CommentsModalProps) {
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const { user } = useAuth();

  const canManageNotes = user?.role === 'SUPERADMIN' || user?.permissions.includes('ADD_INTERNAL_COMMENTS');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting || !canManageNotes) return;

    try {
      setIsSubmitting(true);
      await onAddComment(newComment.trim());
      setNewComment('');
    } catch (error) {
      console.error("Failed to add note", error);
      alert("Failed to add note. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (comment: InternalComment) => {
    setEditingId(comment.id);
    setEditText(comment.text);
  };

  const handleUpdate = async () => {
    if (!editingId || !editText.trim() || isUpdating) return;
    try {
      setIsUpdating(true);
      await onUpdateComment(editingId, editText.trim());
      setEditingId(null);
      setEditText('');
    } catch (error) {
      console.error("Failed to update note", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canManageNotes || deletingId) return;
    if (!window.confirm("Are you sure you want to delete this internal note?")) return;

    try {
      setDeletingId(id);
      await onDeleteComment(id);
    } catch (error) {
      console.error("Failed to delete note", error);
      alert("Failed to delete note.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 text-white rounded-lg shadow-sm">
              <StickyNote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Internal Points & Observations</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-full cursor-pointer">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Notes List (Bullet Points Layout) */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">
          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <StickyNote className="w-16 h-16 mb-4 opacity-10" />
              <p className="text-sm font-semibold italic text-slate-500">No internal points recorded yet.</p>
              {canManageNotes ? (
                <p className="text-[10px] uppercase font-bold tracking-widest mt-2 text-indigo-600">Add the first team observation below</p>
              ) : (
                <p className="text-[10px] uppercase font-bold tracking-widest mt-2 text-rose-500 flex items-center gap-1"><Lock className="w-3 h-3" /> Read-only access</p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {comments.map((comment, idx) => {
                const safeId = comment.id || `legacy-${idx}`;
                
                return (
                  <div key={safeId} className="flex gap-4 group items-start border-b border-slate-50 pb-6 last:border-0">
                    {/* Bullet Indicator */}
                    <div className="mt-1.5 shrink-0">
                      <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-colors duration-300">
                        <span className="text-[10px] font-bold">{idx + 1}</span>
                      </div>
                    </div>

                    <div className="flex-1 space-y-2">
                      {/* Meta Info */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{comment.author}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300" />
                          <span className="text-[9px] font-bold text-slate-400 uppercase">
                            {new Date(comment.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        
                        {canManageNotes && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleStartEdit(comment)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                              title="Edit Point"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDelete(comment.id)}
                              disabled={deletingId === comment.id}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                              title="Remove Point"
                            >
                              {deletingId === comment.id ? <div className="w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin"></div> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Content Area */}
                      <div className="text-sm text-slate-700 leading-relaxed font-medium">
                        {editingId === comment.id ? (
                          <div className="flex flex-col gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2">
                            <textarea
                              autoFocus
                              className="w-full p-3 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 resize-none min-h-[80px]"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                            />
                            <div className="flex gap-2 justify-end">
                              <button 
                                onClick={() => setEditingId(null)}
                                className="px-4 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-slate-50 uppercase tracking-widest transition-all"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={handleUpdate}
                                disabled={isUpdating || !editText.trim()}
                                className="px-5 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded-lg hover:bg-black disabled:opacity-50 uppercase tracking-widest shadow-sm transition-all"
                              >
                                {isUpdating ? 'Saving...' : 'Update Point'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{comment.text}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer / Input (Authorized Only) */}
        <div className="p-6 bg-slate-50 border-t border-slate-100">
          {canManageNotes ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <textarea
                  autoFocus
                  className="w-full p-5 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 text-slate-800 text-sm font-medium transition-all resize-none min-h-[100px]"
                  placeholder="Record an internal team observation or technical point..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400 font-bold">
                  <Plus className="w-4 h-4 text-slate-900" />
                  <span className="text-[9px] uppercase tracking-widest text-slate-500">Add Point-by-Point Team Note</span>
                </div>
                <button
                  type="submit"
                  disabled={!newComment.trim() || isSubmitting}
                  className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-black transition-all shadow-md shadow-slate-100 disabled:opacity-30 disabled:shadow-none flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Plus className="w-4 h-4" />}
                  Save New Point
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-center py-2 gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <Lock className="w-4 h-4" /> Note Management Restricted
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
