/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { RoomPage } from './pages/RoomPage';
import { TestPage } from './pages/TestPage';
import { LanguageProvider } from './lib/i18n';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/r/:roomId" element={<RoomPage />} />
          <Route path="/test" element={<TestPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster theme="dark" position="top-center" />
    </LanguageProvider>
  );
}
