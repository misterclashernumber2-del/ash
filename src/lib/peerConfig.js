const turnUrl = import.meta.env.VITE_METERED_URL || 'turn:relay.metered.ca:80';
const turnUsername = import.meta.env.VITE_METERED_USERNAME;
const turnCredential = import.meta.env.VITE_METERED_CREDENTIAL;

export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.nextcloud.com:443' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
    ...(turnUsername && turnCredential ? [{
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    }] : []),
  ],
};
