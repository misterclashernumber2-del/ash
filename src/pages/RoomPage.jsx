import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Room } from '../components/Room';

export function RoomPage() {
  const { roomId } = useParams();

  if (!roomId) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="h-screen w-full flex flex-col">
      <Room roomId={roomId} />
    </div>
  );
}
