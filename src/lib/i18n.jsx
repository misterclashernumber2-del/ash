import React, { createContext, useContext, useState } from 'react';

const translations = {
  en: {
    tagline: "No servers. No history. No trace.",
    subTagline: "Ephemeral P2P messaging. Room becomes active when both peers join.",
    shareLabel: "Shareable Link",
    copy: "Copy",
    copied: "Copied!",
    openRoom: "Open Room",
    oneLinkWarning: "One link = one private conversation. Share with exactly one person.",
    waiting: "Waiting for the other person...",
    shareToConnect: "Share the link below to connect.",
    connecting: "Connecting...",
    tapToConnect: "Tap to connect (Safari fallback)",
    reconnecting: "Reconnecting...",
    disconnected: "Connection lost. The conversation is gone.",
    startNew: "Start new room",
    encryptionNotice: "End-to-end encrypted · No logs · Messages vanish in 5 min",
    messagePlaceholder: "Message...",
    waitingConnection: "Waiting for connection...",
    send: "Send",
    left: "left",
    langToggle: "RU",
    joinRoom: "Join Room",
    enterRoomId: "Enter Room ID",
    cancel: "Cancel",
    leaveRoom: "Leave Room",
    or: "— OR —"
  },
  ru: {
    tagline: "Нет серверов. Нет истории. Нет следов.",
    subTagline: "Временные P2P сообщения. Комната активируется, когда присоединяются оба участника.",
    shareLabel: "Ссылка для приглашения",
    copy: "Копировать",
    copied: "Скопировано!",
    openRoom: "Войти в комнату",
    oneLinkWarning: "Одна ссылка = один приватный разговор. Делитесь только с одним человеком.",
    waiting: "Ожидание собеседника...",
    shareToConnect: "Поделитесь ссылкой ниже для подключения.",
    connecting: "Подключение...",
    tapToConnect: "Нажмите для подключения (Safari)",
    reconnecting: "Переподключение...",
    disconnected: "Соединение потеряно. Переписка удалена.",
    startNew: "Создать новую комнату",
    encryptionNotice: "Сквозное шифрование · Без логов · Сообщения исчезают через 5 мин",
    messagePlaceholder: "Сообщение...",
    waitingConnection: "Ожидание подключения...",
    send: "Отправить",
    left: "осталось",
    langToggle: "EN",
    joinRoom: "Присоединиться",
    enterRoomId: "Введите ID комнаты",
    cancel: "Отмена",
    leaveRoom: "Покинуть комнату",
    or: "— ИЛИ —"
  }
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState('en');
  const t = (key) => translations[lang][key] || key;
  const toggleLang = () => setLang(l => l === 'en' ? 'ru' : 'en');
  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
