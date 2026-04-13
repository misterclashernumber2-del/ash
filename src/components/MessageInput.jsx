import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../lib/i18n';
import { Send, Paperclip, X, AlertCircle } from 'lucide-react';

export function MessageInput({ onSend, onSendFile, disabled, draggedFile, onClearDraggedFile, onTyping }) {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [qualityMode, setQualityMode] = useState('balance');
  const [error, setError] = useState('');
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const MAX_LENGTH = 2000;
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

  useEffect(() => {
    if (draggedFile) {
      processFile(draggedFile);
      onClearDraggedFile?.();
    }
  }, [draggedFile]);

  const handleChange = (e) => {
    const val = e.target.value;
    if (val.length <= MAX_LENGTH) {
      setText(val);
      if (onTyping && !disabled) {
        if (!isTypingRef.current) {
          onTyping(true);
          isTypingRef.current = true;
        }
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          onTyping(false);
          isTypingRef.current = false;
        }, 2000);
      }
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1 || items[i].type.indexOf('video') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processFile(file);
            break;
          }
        }
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (selectedFile) {
        handleSendFile();
      } else {
        handleSubmit(e);
      }
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (text.trim() && !disabled && !selectedFile) {
      onSend(text.trim());
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const processFile = (file) => {
    setError('');
    if (!file) return;
    
    if (file.size > MAX_FILE_SIZE) {
      setError(t('videoTooLarge'));
      return;
    }
    
    setSelectedFile(file);
  };

  const handleFileChange = (e) => {
    processFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const handleSendFile = async () => {
    if (selectedFile && !disabled) {
      onSendFile(selectedFile, qualityMode, text.trim());
      setSelectedFile(null);
      setText('');
    }
  };

  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [text]);

  const showCount = text.length > 1800;

  if (selectedFile) {
    const isImage = selectedFile.type.startsWith('image/') || selectedFile.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const isVideo = selectedFile.type.startsWith('video/') || selectedFile.name.match(/\.(mp4|webm|ogg|mov|avi|mkv)$/i);
    
    return (
      <div className="flex flex-col gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 animate-in slide-in-from-bottom-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-zinc-200 truncate pr-4">{selectedFile.name}</span>
          <button onClick={() => setSelectedFile(null)} className="text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 p-1 rounded-full transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {previewUrl && (
          <div className="relative rounded-lg overflow-hidden bg-black/40 flex items-center justify-center min-h-[100px] max-h-[200px]">
            {isImage ? (
              <img src={previewUrl} alt="preview" className="max-h-[200px] object-contain" />
            ) : isVideo ? (
              <video src={previewUrl} className="max-h-[200px] object-contain" controls />
            ) : (
              <div className="text-zinc-500 text-sm py-8">Document / File</div>
            )}
          </div>
        )}
        
        {isImage && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-500 font-medium">{t('quality')}</label>
            <select 
              value={qualityMode} 
              onChange={(e) => setQualityMode(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-700 transition-all"
            >
              <option value="fast">{t('fast')}</option>
              <option value="balance">{t('balance')}</option>
              <option value="original">{t('original')}</option>
            </select>
          </div>
        )}
        {isVideo && (
          <div className="text-xs text-zinc-500 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5">
            {t('videoOriginalQuality')}
          </div>
        )}

        <input 
          type="text" 
          placeholder={t('messagePlaceholder')}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-700 transition-all"
        />
        
        <button
          onClick={handleSendFile}
          className="w-full py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 mt-1"
        >
          <Send className="w-4 h-4" />
          {isImage ? t('sendImage') : isVideo ? t('sendVideo') : t('sendFile')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded-xl border border-red-400/20 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto p-0.5 hover:bg-red-400/20 rounded-md"><X className="w-3 h-3" /></button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-zinc-900 border border-zinc-800 rounded-3xl p-1.5 focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600 transition-all">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="w-11 h-11 text-zinc-400 hover:text-zinc-200 rounded-full flex items-center justify-center transition-all disabled:opacity-50 shrink-0"
          title={t('attachFile')}
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*,video/*" 
          className="hidden" 
        />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
          placeholder={disabled ? t('waitingConnection') : t('messagePlaceholder')}
          className="flex-1 bg-transparent px-2 py-2.5 text-[15px] focus:outline-none text-zinc-100 resize-none overflow-y-auto min-h-[44px] max-h-[150px] disabled:opacity-50 placeholder:text-zinc-500"
          rows={1}
        />
        <button
          type="submit"
          disabled={!text.trim() || disabled}
          className="w-11 h-11 bg-zinc-100 hover:bg-white text-zinc-950 rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Send className="w-5 h-5 ml-0.5" />
        </button>
      </form>
      {showCount && (
        <div className={`text-xs text-right pr-4 ${text.length >= MAX_LENGTH ? 'text-red-400' : 'text-zinc-500'}`}>
          {text.length} / {MAX_LENGTH}
        </div>
      )}
    </div>
  );
}
