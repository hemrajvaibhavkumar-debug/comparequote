import React, { useState } from 'react';
import { X, Plus, User, Clock, MessageSquare, StickyNote, Lock } from 'lucide-react';
import { InternalComment } from '../types';
import { useAuth } from '../context/AuthContext';

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  comments: InternalComment[];
  onAddComment: (text: string) => Promise<void>;
  title: string;
}

export default function CommentsModal({ isOpen, onClose, comments, onAddComment, title }: CommentsModalProps) {
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const canAddNote = user?.role === 'SUPERADMIN' || user?.permissions.includes('ADD_INTERNAL_COMMENTS');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting || !canAddNote) return;

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 text-white rounded-lg">
              <StickyNote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Internal Notes & Points</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-full cursor-pointer">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-white">
          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <StickyNote className="w-12 h-12 mb-3 opacity-10" />
              <p className="text-sm font-semibold italic">No internal notes added yet.</p>
              {canAddNote ? (
                <p className="text-[10px] uppercase font-bold tracking-tighter mt-1 opacity-60 text-slate-500">Add a point for the team below.</p>
              ) : (
                <p className="text-[10px] uppercase font-bold tracking-tighter mt-1 opacity-60 text-rose-500 flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Read-only access</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment, idx) => (
                <div key={idx} className="flex gap-3 pb-4 border-b border-slate-50 last:border-0">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-2 h-2 rounded-full bg-slate-900 shadow-sm" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{comment.author}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(comment.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-sm text-slate-650 leading-relaxed font-medium">
                      {comment.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer / Input (Only for authorized users) */}
        <div className="p-4 bg-slate-50 border-t border-slate-100">
          {canAddNote ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                autoFocus
                className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 text-slate-800 text-sm font-medium transition-all resize-none min-h-[80px]"
                placeholder="Write an internal note or point..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <div className="flex items-center justify-between">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                  Notes are persistent and visible to all users.
                </p>
                <button
                  type="submit"
                  disabled={!newComment.trim() || isSubmitting}
                  className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-black transition-all shadow-md shadow-slate-100 disabled:opacity-30 disabled:shadow-none flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Plus className="w-3.5 h-3.5" />}
                  Save Note
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-center py-2 gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <Lock className="w-3 h-3" /> Note creation restricted
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
