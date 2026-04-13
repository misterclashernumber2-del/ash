const turnUrl = import.meta.env.VITE_METERED_URL || 'turn:relay.metered.ca:80';
const turnUsername = import.meta.env.VITE_METERED_USERNAME;
const turnCredential = import.meta.env.VITE_METERED_CREDENTIAL;

export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.nextcloud.com:443' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    ...(turnUsername && turnCredential ? [
      { urls: 'turn:relay.metered.ca:80',           username: turnUsername, credential: turnCredential },
      { urls: 'turn:relay.metered.ca:443',           username: turnUsername, credential: turnCredential },
      { urls: 'turn:relay.metered.ca:443?transport=tcp', username: turnUsername, credential: turnCredential },
      { urls: 'turns:relay.metered.ca:443',          username: turnUsername, credential: turnCredential },
    ] : []),
  ],
};
