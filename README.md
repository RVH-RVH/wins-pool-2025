# 2025 NFL Wins Pool (Next.js + Tailwind)

A simple wins-pool web app for the 2025 NFL season.

- 5 players
- 6 teams each
- Snake draft
- Live leaderboard
- Enter current wins per team
- LocalStorage persistence

## Getting Started

```bash
# 1) Install deps
npm install

# 2) Run dev server
npm run dev
# open http://localhost:3000
```

## Build & Run

```bash
npm run build
npm start
```

## Notes
- This project uses Next.js 14 App Router and TailwindCSS.
- All data is stored client-side in your browser (LocalStorage).
- You can rename players inline and draft by clicking teams.
- Head to **/results** to update team wins and see the leaderboard.

## Authentication (optional)
This project includes NextAuth with GitHub OAuth.

1. Create a GitHub OAuth app (Homepage: http://localhost:3000, Callback: http://localhost:3000/api/auth/callback/github)
2. Copy `.env.example` to `.env` and fill in `GITHUB_ID` and `GITHUB_SECRET`, plus set a strong `NEXTAUTH_SECRET`.
3. Install and run:
   ```bash
   npm install
   npm run dev
   ```

On the **Players** page, signed-in users can **Claim** a player slot (stored locally for now). For shared online leagues with real-time sync, we can add a tiny DB (Prisma + SQLite) and REST endpoints next.

## Database (Prisma + SQLite)
- Ensure `.env` has `DATABASE_URL="file:./dev.db"` (see `.env.example`).
- Initialize the database and client:
  ```bash
  npm run db:push
  npm run prisma:generate
  ```
- Start the app:
  ```bash
  npm run dev
  ```
- Create a league on the home page, then share the **League ID** from the URL with friends.
  They can join `/league/<id>/draft` and `/league/<id>/results`.

## Real-time (SSE)
- The app now streams updates per league using **Server-Sent Events**.
- Endpoint: `GET /api/leagues/:id/events`
- When any client makes changes (picks, wins, players), the server emits an update and all connected clients **auto-refresh** the league state.
- Works locally without external services. For production-grade scale, we can swap the bus to Pusher/Ably or Postgres NOTIFY.
