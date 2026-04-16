import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];
const EMOJIS = [
  '😀','😂','🥰','😎','🤔','😴','🤯','🥳',
  '👻','💀','🤖','👾','🐱','🐶','🦊','🐻',
  '🐼','🐨','🦁','🐯','🦋','🌸','🌺','🌈',
  '⚡','🔥','💧','🌊','🍀','🎯','🎨','🎸',
  '🎭','🏆','💎','🔮','🌙','⭐','🎲','🚀',
  '🛸','🌍','🔐','⚔️','🎭','🌸','👑','👤'
];

export function ProfileModal({ isOpen, onClose, onSave }) {
  const [nick, setNick] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('👤');
  const [color, setColor] = useState(COLORS[0]);

  useEffect(() => {
    if (isOpen) {
      const saved = JSON.parse(localStorage.getItem('ash_profile') || 'null');
      if (saved) {
        setNick(saved.nick || '');
        setAvatarEmoji(saved.avatarEmoji || '👤');
        setColor(saved.color || COLORS[0]);
      }
    }
  }, [isOpen]);

  const handleSave = () => {
    const profile = { nick: nick.trim().substring(0, 24), avatarEmoji, color };
    localStorage.setItem('ash_profile', JSON.stringify(profile));
    onSave(profile);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
        >
          <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
            <h2 className="text-zinc-100 font-semibold">Your Profile</h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Preview */}
            <div className="flex flex-col items-center gap-3">
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-lg"
                style={{ backgroundColor: color }}
              >
                {avatarEmoji}
              </div>
            </div>

            {/* Nickname */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Nickname</label>
              <input 
                type="text" 
                value={nick}
                onChange={e => setNick(e.target.value)}
                maxLength={24}
                placeholder="Your name..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Color</label>
              <div className="flex gap-3 justify-center">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform ${color === c ? 'scale-110 ring-2 ring-white/20' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }}
                  >
                    {color === c && <Check className="w-4 h-4 text-white/90" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Emoji */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Avatar Emoji</label>
              <div className="grid grid-cols-8 gap-2 bg-zinc-950 p-3 rounded-xl border border-zinc-800 h-48 overflow-y-auto">
                {EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => setAvatarEmoji(e)}
                    className={`text-xl p-1 rounded hover:bg-zinc-800 transition-colors ${avatarEmoji === e ? 'bg-zinc-800 ring-1 ring-zinc-700' : ''}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 flex justify-end gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="px-6 py-2 bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl text-sm font-semibold transition-colors"
            >
              Save Profile
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
