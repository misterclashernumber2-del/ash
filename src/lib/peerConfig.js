export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.cloudflare.com:3478' },
    {
      urls: 'turn:your.metered.ca:80',
      username: 'YOUR_METERED_USERNAME',
      credential: 'YOUR_METERED_CREDENTIAL',
    },
  ],
};
