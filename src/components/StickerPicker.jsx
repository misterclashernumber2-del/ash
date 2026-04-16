import React, { useState, useRef, useEffect } from 'react';
import { Smile, Plus, X, Image as ImageIcon, Trash2 } from 'lucide-react';
import { getAllPacks, getPackStickers, createPack, addSticker, deletePack } from '../lib/stickerStorage';
import { toast } from 'sonner';

export function StickerPicker({ onSelect, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef(null);
  const [packs, setPacks] = useState([]);
  const [activePackId, setActivePackId] = useState(null);
  const [stickers, setStickers] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newPackName, setNewPackName] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadPacks();
    }
  }, [isOpen]);

  useEffect(() => {
    if (activePackId) {
      loadStickers(activePackId);
    } else {
      setStickers([]);
    }
  }, [activePackId]);

  const loadPacks = async () => {
    try {
      const loadedPacks = await getAllPacks();
      setPacks(loadedPacks);
      if (loadedPacks.length > 0 && !activePackId) {
        setActivePackId(loadedPacks[0].packId);
      }
    } catch (err) {
      console.error('Failed to load packs', err);
    }
  };

  const loadStickers = async (packId) => {
    try {
      const loadedStickers = await getPackStickers(packId);
      setStickers(loadedStickers);
    } catch (err) {
      console.error('Failed to load stickers', err);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleCreatePack = async (e) => {
    e.preventDefault();
    if (!newPackName.trim()) return;
    try {
      const packId = await createPack(newPackName.trim());
      setIsCreating(false);
      setNewPackName('');
      await loadPacks();
      setActivePackId(packId);
      toast.success('Pack created');
    } catch (err) {
      toast.error('Failed to create pack');
    }
  };

  const handleAddStickers = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length || !activePackId) return;
    
    const validFiles = files.filter(f => f.size <= 2 * 1024 * 1024 && f.type.startsWith('image/'));
    if (validFiles.length < files.length) {
      toast.warning('Some files were ignored (must be image < 2MB)');
    }

    if (validFiles.length === 0) return;

    try {
      for (const file of validFiles) {
        await addSticker(activePackId, file);
      }
      await loadStickers(activePackId);
      await loadPacks(); // Update counts
      toast.success(`Added ${validFiles.length} stickers`);
    } catch (err) {
      toast.error('Failed to add stickers');
    }
    e.target.value = '';
  };

  const handleDeletePack = async (packId) => {
    if (!window.confirm('Delete this pack and all its stickers?')) return;
    try {
      await deletePack(packId);
      if (activePackId === packId) {
        setActivePackId(null);
      }
      await loadPacks();
      toast.success('Pack deleted');
    } catch (err) {
      toast.error('Failed to delete pack');
    }
  };

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-11 h-11 text-zinc-400 hover:text-zinc-200 rounded-full flex items-center justify-center transition-all disabled:opacity-50 shrink-0"
        title="Stickers"
      >
        <Smile className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-2">
          {/* Header / Tabs */}
          <div className="flex items-center gap-1 p-2 border-b border-zinc-800 overflow-x-auto custom-scrollbar">
            {packs.map(pack => (
              <button
                key={pack.packId}
                onClick={() => setActivePackId(pack.packId)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                  activePackId === pack.packId ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                }`}
              >
                {pack.name}
              </button>
            ))}
            <button
              onClick={() => setIsCreating(true)}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg shrink-0 ml-auto"
              title="New Pack"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-3 h-64 overflow-y-auto custom-scrollbar">
            {isCreating ? (
              <form onSubmit={handleCreatePack} className="flex flex-col gap-3 h-full justify-center">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium text-zinc-200">Create Sticker Pack</h3>
                  <button type="button" onClick={() => setIsCreating(false)} className="text-zinc-500 hover:text-zinc-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="text"
                  value={newPackName}
                  onChange={e => setNewPackName(e.target.value)}
                  placeholder="Pack Name"
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!newPackName.trim()}
                  className="bg-zinc-100 text-zinc-900 font-medium py-2 rounded-xl text-sm disabled:opacity-50"
                >
                  Create
                </button>
              </form>
            ) : activePackId ? (
              <div className="flex flex-col h-full">
                <div className="grid grid-cols-4 gap-2">
                  {stickers.map(sticker => (
                    <button
                      key={sticker.id}
                      onClick={() => {
                        const pack = packs.find(p => p.packId === activePackId);
                        onSelect({
                          packId: activePackId,
                          stickerId: sticker.id,
                          packName: pack?.name || 'Sticker Pack'
                        });
                        setIsOpen(false);
                      }}
                      className="aspect-square rounded-xl overflow-hidden hover:bg-zinc-800 transition-colors flex items-center justify-center p-1 group relative"
                    >
                      <img 
                        src={URL.createObjectURL(sticker.thumbnailBlob)} 
                        alt="sticker" 
                        className="w-full h-full object-contain group-hover:scale-110 transition-transform"
                        onLoad={(e) => URL.revokeObjectURL(e.target.src)}
                      />
                    </button>
                  ))}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 transition-colors flex flex-col items-center justify-center gap-1 text-zinc-500 hover:text-zinc-400"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-[10px] font-medium">Add</span>
                  </button>
                </div>
                
                <div className="mt-auto pt-4 flex justify-between items-center">
                  <span className="text-xs text-zinc-500">{stickers.length}/30 stickers</span>
                  <button 
                    onClick={() => handleDeletePack(activePackId)}
                    className="text-red-400/70 hover:text-red-400 text-xs flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete Pack
                  </button>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAddStickers}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-2">
                <ImageIcon className="w-8 h-8 opacity-50" />
                <p className="text-sm">No sticker packs yet</p>
                <button 
                  onClick={() => setIsCreating(true)}
                  className="text-xs text-emerald-400 hover:underline mt-1"
                >
                  Create your first pack
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
