import React, { useState } from 'react';
import { X, Send, User, Clock, MessageSquare } from 'lucide-react';
import { InternalComment } from '../types';

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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onAddComment(newComment.trim());
      setNewComment('');
    } catch (error) {
      console.error("Failed to add comment", error);
      alert("Failed to add comment. Please try again.");
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
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Internal Comments</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-full">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/30">
          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-semibold italic">No internal comments yet.</p>
              <p className="text-[10px] uppercase font-bold tracking-tighter mt-1 opacity-60">Be the first to add a point.</p>
            </div>
          ) : (
            comments.map((comment, idx) => (
              <div key={idx} className="flex gap-4 group">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 border border-white shadow-sm">
                    <User className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs font-black text-slate-900 uppercase">{comment.author}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {new Date(comment.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm text-sm text-slate-700 leading-relaxed">
                    {comment.text}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer / Input */}
        <div className="p-4 bg-white border-t border-slate-100">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <textarea
              autoFocus
              className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 text-slate-800 text-sm font-medium transition-all resize-none min-h-[44px] max-h-32"
              placeholder="Add a point-by-point internal comment..."
              rows={1}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-black transition-all shadow-md shadow-slate-100 disabled:opacity-30 disabled:shadow-none flex items-center justify-center self-end"
            >
              {isSubmitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Send className="w-4 h-4" />}
            </button>
          </form>
          <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-tight text-center">
            Shift + Enter for new line. Comments are visible to all internal users.
          </p>
        </div>
      </div>
    </div>
  );
}
