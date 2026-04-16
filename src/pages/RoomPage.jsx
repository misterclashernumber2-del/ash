import React from 'react';
import { useParams, Navigate, useLocation } from 'react-router-dom';
import { Room } from '../components/Room';

export function RoomPage() {
  const { roomId } = useParams();
  const location = useLocation();
  const importedMessages = location.state?.importedMessages || null;

  if (!roomId) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="h-screen w-full flex flex-col">
      <Room roomId={roomId} importedMessages={importedMessages} />
    </div>
  );
}
