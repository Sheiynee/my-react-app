# TaskFlow

Project + task management web app with Discord OAuth login, slash-command bot, and email/Discord assignment notifications.

## Stack

- **Frontend**: React 19, Vite, react-router v7, Tailwind v4, Tiptap, Firebase Auth/Storage SDK
- **Backend**: Node + Express, Firebase Admin (Firestore), helmet, express-rate-limit, sanitize-html, Resend, discord.js
- **Deploy**: frontend on Vercel, backend on Render/Railway, Firestore for data

## Local development

Prereqs: Node 20+, a Firebase project (Auth + Firestore), a Discord application, a Resend account.

```bash
# install
npm install
cd server && npm install && cd ..

# configure env
cp .env.example .env                  # frontend
cp server/.env.example server/.env    # backend

# run (two terminals)
npm run dev          # frontend on :5173
cd server && npm start   # backend on :3001
cd server && npm run bot # discord bot (optional)
```

Fill in the Firebase web config in `.env` and the server credentials in `server/.env`. See each file for details.

## Project layout

```
src/                React app — pages, components, context, api client
  pages/            Login, Dashboard, ProjectDetail, Team, Notes, Settings
  context/          Auth + App state
  api.js            Backend client
server/             Express API
  index.js          Routes (projects/tasks/comments/notes/members + Discord OAuth)
  bot.js            Discord slash-command bot
  notify.js         Assignment notifications (email + Discord channel mention)
  email.js          Resend templates
  db.js             Firebase Admin / Firestore init
public/             Static assets
```

## Roles

App-level roles: `viewer < member < manager < admin`. Project-level roles override per project. App admins can read everything; project managers can manage tasks/notes within their project.

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — production build to `dist/`
- `npm run lint` — ESLint
- `cd server && npm start` — backend
- `cd server && npm run bot` — Discord bot
- `cd server && npm run deploy` — register Discord slash commands

## Required env

See `.env.example` (frontend) and `server/.env.example` (backend). Notable backend vars: `GOOGLE_CREDENTIALS`, `FRONTEND_URL`, `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, `DISCORD_GUILD_ID`, `DISCORD_NOTIFICATION_CHANNEL_ID`, `RESEND_API_KEY`, `EMAIL_FROM`.
