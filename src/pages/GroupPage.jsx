import React from 'react';
import { useParams, Navigate, useLocation } from 'react-router-dom';
import { GroupRoom } from '../components/GroupRoom';

export function GroupPage() {
  const { groupId } = useParams();
  const location = useLocation();
  const isHost = location.state?.isHost || false;

  if (!groupId) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="h-screen w-full flex flex-col">
      <GroupRoom groupId={groupId} isHost={isHost} />
    </div>
  );
}
