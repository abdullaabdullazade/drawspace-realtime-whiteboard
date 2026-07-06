# 🎨 Drawspace — Real-time Collaborative Whiteboard

A full-stack, real-time collaborative whiteboard (think **Figma / Miro / Excalidraw**) — draw together live, share a link, and anyone can join and edit **without signing in**.

Built with **NestJS · PostgreSQL · WebSockets · RabbitMQ** and a premium **Next.js 15** frontend.

<p align="center">
  <img src="docs/demo.gif" alt="Two browsers collaborating live on the same board" width="100%">
</p>

> **Left:** a logged-in user. **Right:** a guest who opened the shared link with **no account**. Both draw on the same infinite canvas and see each other live — cursors, strokes and images sync in real time.

---

## ✨ Features

- 🔴 **Real-time collaboration** — strokes, shapes, text and images sync live over WebSockets; presence cursors show who's where
- 🔗 **Public share links** — make a board public and anyone can open + edit it **without logging in** (anonymous guests)
- 🔐 **JWT auth** — register / login, `bcrypt` hashing, protected routes, role-based access (owner / editor / viewer)
- 🖊️ **Rich canvas** — pencil, eraser, line, rectangle, circle, text and image tools
- 🖼️ **Images** — paste / drop / upload, then move and resize from **any side or corner**
- 🔲 **Selection** — marquee-select, `Ctrl/⌘+A` select all, drag to move, 8-handle resize, `Delete` to remove
- ♾️ **Infinite canvas** — pan in every direction (two-finger scroll / drag), pinch or `⌘+scroll` to zoom, **Fit to content**
- 💾 **Persistence** — every element saved to PostgreSQL and reloaded on open; view state (pan/zoom) remembered per board
- 📨 **Invites** — invite collaborators by email; boards track their members
- 🗑️ **Trash** — soft-delete to trash, restore or delete forever
- ⭐ **Favorites** — star boards for quick access
- ⚙️ **Cluster mode & async pipeline** — Node.js `cluster` for multi-core scaling; RabbitMQ available for decoupled writes
- 🎨 **Premium SaaS UI** — Obsera-inspired emerald design system, collapsible sidebar, Framer Motion, Lucide icons

---

## 🏗️ Architecture

```
 Next.js 15 (:3001)
    │  REST  → auth, boards, elements, invites, trash
    │  WS    → draw, cursor, presence  (guests allowed on public boards)
    ▼
 NestJS (:3000)
    ├── AuthModule      JWT · Passport · bcrypt · @Public() guard bypass
    ├── UsersModule     TypeORM user repository
    ├── BoardsModule    boards · members (RBAC) · canvas elements · trash · invite
    ├── CanvasModule    Socket.IO gateway — real-time draw + DB persistence
    └── RabbitMQModule  async persist queue (graceful fallback)
         │
    PostgreSQL              RabbitMQ
```

**Draw flow:** client `emit('draw')` → gateway broadcasts to the board room **and** persists the element to PostgreSQL → every other client (including anonymous guests) renders it instantly and gets it on reload.

---

## 🧰 Tech Stack

| Layer | Tech |
|---|---|
| Backend | NestJS 11, TypeScript |
| Database | PostgreSQL + TypeORM |
| Real-time | Socket.IO WebSocket gateway |
| Queue | RabbitMQ (amqplib) |
| Auth | JWT, Passport, bcrypt |
| Frontend | Next.js 15 (App Router, Turbopack), React 19 |
| Styling | Tailwind CSS, Framer Motion, Lucide |
| E2E demo | Playwright + FFmpeg |

---

## 🚀 Getting Started

**Prerequisites:** Node.js 20+, Docker.

### 1. Infrastructure (PostgreSQL + RabbitMQ)
```bash
docker run -d --name whiteboard-postgres -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=whiteboard -p 5432:5432 postgres:16-alpine

docker run -d --name whiteboard-rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management-alpine
```

### 2. Backend
```bash
cd backend
cp .env.example .env
npm install
npm run start:dev        # http://localhost:3000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev              # http://localhost:3001  (Turbopack)
```

Open http://localhost:3001, register, create a board and start drawing.
Make a board **Public**, hit **Share**, and open the link in another browser (or incognito) — no login needed.

---

## 🎬 The demo video

The clip at the top is generated end-to-end with **Playwright**: it registers a user, creates a public board, draws, adds an image, then opens the shared link in a second (guest) browser and draws — with both browser recordings stitched side-by-side by FFmpeg. Source: [`frontend/scripts/demo.mjs`](frontend/scripts/demo.mjs) (in the app repo). Full-quality MP4: [`docs/demo.mp4`](docs/demo.mp4).

---

## 📁 Structure

```
drawspace/
├── backend/     NestJS API + Socket.IO gateway
│   └── src/{auth, users, boards, canvas, rabbitmq, common}
├── frontend/    Next.js 15 dashboard + whiteboard editor
│   └── src/{app, components, hooks, lib}
└── docs/        demo.gif · demo.mp4
```

---

## 🔌 API (selected)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` · `/login` | Auth, returns JWT |
| GET | `/api/boards` | My boards |
| POST | `/api/boards` | Create board |
| GET | `/api/boards/:id` | Board with elements (auth) |
| GET | `/api/boards/:id/public` | Board with elements (**no auth**, public only) |
| PATCH | `/api/boards/:id` | Rename / update |
| POST | `/api/boards/:id/invite` | Invite by email |
| DELETE | `/api/boards/:id` | Move to trash |
| POST | `/api/boards/:id/restore` | Restore from trash |

**WebSocket** (`/canvas`): `board:join`, `draw`, `cursor:move`, `board:leave` — authenticated users and anonymous guests (on public boards).

---

## 📄 License

UNLICENSED — personal portfolio project.
