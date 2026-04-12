# Ephemeral P2P Messenger

A secure, serverless, ephemeral messaging application. Messages are sent directly between peers using WebRTC and automatically self-destruct after 5 minutes. Supabase Realtime is used exclusively as a signaling channel to establish the initial P2P connection, after which it is disconnected.

## Architecture
```text
[User A] <--- WebRTC (PeerJS) ---> [User B]
   |                                  |
   +-----> [Supabase Realtime] <------+
           (Signaling Only)
```

## How to run locally
1. Clone the repository.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in your Supabase credentials.
4. Run `npm run dev`.

## Supabase Setup
1. Create a new project on [Supabase](https://supabase.com).
2. Go to **Database** -> **Realtime** and ensure Realtime is enabled.
3. No tables or Row Level Security (RLS) policies are needed, as the app only uses Broadcast channels.
4. Copy the `Project URL` and `anon public` API key into your `.env` file.

## Vercel Deployment
1. Push your code to GitHub.
2. Import the project into Vercel.
3. Add the environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the Vercel dashboard.
4. Deploy! The included `vercel.json` handles SPA routing automatically.
