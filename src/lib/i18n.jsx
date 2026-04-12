import React, { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  en: {
    tagline: "No servers. No history. No trace.",
    subTagline: "Ephemeral P2P messaging. Room becomes active when both peers join.",
    shareLabel: "Shareable Link",
    copy: "Copy",
    copied: "Copied!",
    openRoom: "Open Room",
    oneLinkWarning: "One link = one private conversation. Share with exactly one person.",
    waiting: "Waiting for peer...",
    shareToConnect: "Share the link below to connect.",
    connecting: "Connecting...",
    connected: "Connected",
    tapToConnect: "Tap to connect (Safari fallback)",
    reconnecting: "Reconnecting...",
    disconnected: "Connection lost. The conversation is gone.",
    startNew: "Start new room",
    encryptionNotice: "End-to-end encrypted · No logs",
    messagePlaceholder: "Message...",
    waitingConnection: "Waiting for connection...",
    send: "Send",
    left: "left",
    langToggle: "RU",
    joinRoom: "Join Room",
    enterRoomId: "Enter Room ID",
    cancel: "Cancel",
    leaveRoom: "Leave Room",
    or: "— OR —",
    devTestMode: "Developer Test Mode",
    closeTest: "Close Test",
    testLocally: "Test Locally (Split Screen)",
    offlineWarning: "No internet connection. Waiting for network...",
    roomSettings: "Room Settings",
    messageLifespan: "Message Lifespan",
    maxMessages: "Max Messages",
    unlimited: "Unlimited",
    seconds: "sec",
    minutes: "min",
    hours: "hour",
    vanishIn: "Messages vanish in",
    attachFile: "Attach file",
    fast: "Fast (WebP, 1280px)",
    balance: "Balance (WebP, 1920px)",
    original: "Original",
    sendImage: "Send Image",
    sendVideo: "Send Video",
    sendFile: "Send File",
    videoTooLarge: "File is too large (max 100MB)",
    sendingFile: "Sending file...",
    receivingFile: "Receiving file...",
    processingFile: "Processing...",
    quality: "Quality",
    download: "Download",
    videoOriginalQuality: "Video will be sent in original quality.",
    peerJoined: "Peer joined the room",
    peerLeft: "Peer left the room",
    peerTyping: "Peer is typing..."
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
    connected: "Собеседник в чате",
    tapToConnect: "Нажмите для подключения (Safari)",
    reconnecting: "Переподключение...",
    disconnected: "Соединение потеряно. Переписка удалена.",
    startNew: "Создать новую комнату",
    encryptionNotice: "Сквозное шифрование · Без логов",
    messagePlaceholder: "Сообщение...",
    waitingConnection: "Ожидание подключения...",
    send: "Отправить",
    left: "осталось",
    langToggle: "EN",
    joinRoom: "Присоединиться",
    enterRoomId: "Введите ID комнаты",
    cancel: "Отмена",
    leaveRoom: "Покинуть комнату",
    or: "— ИЛИ —",
    devTestMode: "Режим тестирования",
    closeTest: "Закрыть тест",
    testLocally: "Локальный тест (Split Screen)",
    offlineWarning: "Нет подключения к интернету. Ожидание сети...",
    roomSettings: "Настройки комнаты",
    messageLifespan: "Время жизни сообщений",
    maxMessages: "Лимит сообщений",
    unlimited: "Без лимита",
    seconds: "сек",
    minutes: "мин",
    hours: "час",
    vanishIn: "Сообщения исчезают через",
    attachFile: "Прикрепить файл",
    fast: "Быстро (WebP, 1280px)",
    balance: "Баланс (WebP, 1920px)",
    original: "Оригинал",
    sendImage: "Отправить фото",
    sendVideo: "Отправить видео",
    sendFile: "Отправить файл",
    videoTooLarge: "Файл слишком большой (макс 100MB)",
    sendingFile: "Отправка файла...",
    receivingFile: "Получение файла...",
    processingFile: "Обработка...",
    quality: "Качество",
    download: "Скачать",
    videoOriginalQuality: "Видео будет отправлено в оригинальном качестве.",
    peerJoined: "Собеседник вошел в комнату",
    peerLeft: "Собеседник покинул комнату",
    peerTyping: "Собеседник печатает..."
  }
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('ash_lang') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('ash_lang', lang);
  }, [lang]);

  const t = (key) => translations[lang][key] || key;
  const toggleLang = () => setLang(l => l === 'en' ? 'ru' : 'en');
  
  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
