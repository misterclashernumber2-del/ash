import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../lib/i18n';

export function MessageInput({ onSend, disabled }) {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const textareaRef = useRef(null);
  const MAX_LENGTH = 2000;

  const handleChange = (e) => {
    const val = e.target.value;
    if (val.length <= MAX_LENGTH) {
      setText(val);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [text]);

  const showCount = text.length > 1800;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="relative flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? t('waitingConnection') : t('messagePlaceholder')}
          className="flex-1 bg-[#121212] border border-[#333] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#555] text-[#ccc] resize-none overflow-y-auto min-h-[46px] max-h-[150px] disabled:opacity-50"
          rows={1}
        />
        <button
          type="submit"
          disabled={!text.trim() || disabled}
          className="px-4 py-3 bg-[#e5e5e5] hover:bg-white text-[#0a0a0a] font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-[46px] shrink-0"
        >
          {t('send')}
        </button>
      </div>
      {showCount && (
        <div className={`text-xs text-right ${text.length >= MAX_LENGTH ? 'text-red-500' : 'text-[#888888]'}`}>
          {text.length} / {MAX_LENGTH}
        </div>
      )}
    </form>
  );
}
