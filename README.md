# Drawspace — Real-time Collaborative Whiteboard

A full-stack, real-time collaborative whiteboard (think Figma / Miro) built with **NestJS**, **PostgreSQL**, **WebSockets**, **RabbitMQ** and a premium **Next.js 15** frontend.

Multiple users draw on the same canvas simultaneously — strokes, shapes, text and images sync live across every connected client and persist to the database.

---

## ✨ Features

- **Real-time collaboration** — draw together live over WebSockets (Socket.IO)
- **JWT authentication** — register / login, protected routes, `bcrypt` hashing
- **Role-based access control** — board owner / editor / viewer
- **Rich canvas** — pencil, eraser, line, rectangle, circle, text and image tools
- **Image support** — paste / drop / upload, drag to move and resize, high-quality rendering
- **Persistence** — every element saved to PostgreSQL and reloaded on open
- **Async pipeline** — RabbitMQ queue decouples heavy writes from the socket path
- **Cluster mode** — multi-core scaling with Node.js `cluster`
- **Presence** — live cursors and online-user avatars
- **Premium SaaS UI** — Obsera-inspired design system, light theme, Framer Motion

---

## 🏗️ Architecture

```
Next.js (3001)
   │  REST (auth, boards, elements)
   │  WebSocket (draw, cursor, presence)
   ▼
NestJS (3000)
   ├── AuthModule      JWT · Passport · bcrypt
   ├── UsersModule     TypeORM user repo
   ├── BoardsModule    boards · members · canvas elements (RBAC)
   ├── CanvasModule    WebSocket gateway (real-time)
   └── RabbitMQModule  async persist queue
        │
   PostgreSQL (data)   RabbitMQ (queue)
```

**Request flow:** client → JWT guard → controller → service → TypeORM → PostgreSQL.
**Draw flow:** client `emit('draw')` → gateway broadcasts to room + persists element to DB.

---

## 🧰 Tech Stack

| Layer | Tech |
|---|---|
| Backend | NestJS 11, TypeScript |
| Database | PostgreSQL + TypeORM |
| Real-time | Socket.IO WebSocket gateway |
| Queue | RabbitMQ (amqplib) |
| Auth | JWT, Passport, bcrypt |
| Frontend | Next.js 15 (App Router), React 19 |
| Styling | Tailwind CSS, Framer Motion, Lucide |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Docker (for PostgreSQL + RabbitMQ)

### 1. Infrastructure
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
npm run dev              # http://localhost:3001
```

Open http://localhost:3001, register an account, create a board and start drawing.

---

## 📁 Structure

```
drawspace/
├── backend/     NestJS API + WebSocket gateway
│   └── src/
│       ├── auth/        auth, JWT strategy, guards
│       ├── users/       user entity + service
│       ├── boards/      boards, members, canvas elements
│       ├── canvas/      WebSocket gateway
│       └── rabbitmq/    message queue
└── frontend/    Next.js 15 dashboard + whiteboard editor
    └── src/
        ├── app/         routes (login, register, dashboard, board)
        ├── components/  Sidebar, BoardCard, Canvas, Toolbar…
        ├── hooks/       useAuth
        └── lib/         api client, socket client
```

---

## 🔌 API (selected)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account, returns JWT |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/boards` | List my boards |
| POST | `/api/boards` | Create board |
| GET | `/api/boards/:id` | Board with elements |
| PATCH | `/api/boards/:id` | Rename / update board |
| DELETE | `/api/boards/:id` | Delete board |

**WebSocket** (`/canvas`): `board:join`, `draw`, `cursor:move`, `element:*`.

---

## 📄 License

UNLICENSED — personal portfolio project.
