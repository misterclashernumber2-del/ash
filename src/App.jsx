/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { RoomPage } from './pages/RoomPage';
import { TestPage } from './pages/TestPage';
import { MusicPage } from './pages/MusicPage';
import { GroupPage } from './pages/GroupPage';
import { LanguageProvider } from './lib/i18n';
import { MusicPlayerProvider } from './hooks/useMusicPlayer';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <LanguageProvider>
      <MusicPlayerProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/r/:roomId" element={<RoomPage />} />
            <Route path="/g/:groupId" element={<GroupPage />} />
            <Route path="/test" element={<TestPage />} />
            <Route path="/music" element={<MusicPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster theme="dark" position="top-center" />
      </MusicPlayerProvider>
    </LanguageProvider>
  );
}
