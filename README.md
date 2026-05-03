# Raise

Discover fast-growing YouTube videos and creators — a minimalist, data-focused growth discovery platform.

## Project Structure

```
raise/
├── backend/          # Node.js + Express API
├── frontend/         # React + Vite + Tailwind CSS
└── docker-compose.yml
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- YouTube Data API v3 key

---

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/raise.git
cd raise

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

---

### 2. Configure Environment

**Backend** — copy and fill in `/backend/.env`:
```bash
cp backend/.env.example backend/.env
```

**Frontend** — copy and fill in `/frontend/.env`:
```bash
cp frontend/.env.example frontend/.env
```

---

### 3. Setup Database

```bash
cd backend
npm run db:migrate
```

---

### 4. Run Development Servers

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

---

## Features

- **Auth** — JWT-based signup/login with bcrypt password hashing
- **Niche Selection** — Personalized niche with autocomplete
- **Dashboard** — YouTube video grid with growth indicators
- **Filters** — Time (Today/Week/Month) × Sort (Views/Trending/Newest)
- **Growth Algorithm** — Calculates views/hour from snapshot history
- **Caching** — API responses cached to minimize YouTube quota usage

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Auth | JWT + bcrypt |
| Video Data | YouTube Data API v3 |
| Caching | Node-cache (in-memory) |
