# CodeBuddy – AI-Powered Programming Tutor & Collaborative Coding Workspace

**FSD Assignment 2.** A full-stack web app where students learn programming with an AI tutor, write and run code in the browser, and work on team projects together in real time.

---

## ✨ Features

**Account & Profile**
- Sign up / log in with our own authentication: bcrypt-hashed passwords and JWT tokens
- Every user is a student; no admin accounts
- Profile page with stats, an activity calendar and a languages-used chart
- Dark / light mode (Context API)

**AI Tutor**
- Python, Java, C, C++ and JavaScript
- Beginner / Intermediate / Advanced levels
- Quick actions: Explain, Debug, Line-by-line, Optimise, Practice question
- "Explain like I'm 5" toggle
- Code file upload for analysis
- Saved chat history

**Code Editor**
- Monaco (VS Code) editor with syntax highlighting
- Run code in the browser (Judge0 sandbox), with stdin input
- **Fix with CodeBuddy**: sends the error to the AI
- Compare two solutions (AI verdict, comparison table, best version)

**Collaborative Projects ⭐**
- Create projects and invite teammates by email as Owner / Editor / Viewer
- **Shared AI chat**: everyone sees questions and answers live
- **Team discussion chat** with "typing…" indicator and online status
- "Discuss this" on any AI answer, plus pinned answers
- Shared code files (edit in Monaco, ask the AI about a file)
- The AI uses the project description as context
- Live activity feed

**Learning & Gamification**
- Daily coding challenge, AI-checked (+20 XP)
- Quiz mode (5 AI-generated MCQs)
- Learning Paths (step-by-step topics per language) with progress
- XP, levels, 🔥 daily streaks
- Weekly and all-time leaderboard
- Charts on the dashboard and profile (Recharts)

---

## 🧱 Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router, Context API, Vite, Monaco Editor, Recharts |
| Backend | Node.js, Express.js REST API |
| Real-time | Socket.io (live chat, presence, typing, XP updates) |
| Database | PostgreSQL on **Supabase** (cloud) |
| Auth | bcrypt + JSON Web Tokens (JWT) |
| AI | Google Gemini API |
| Code runner | Judge0 CE |
| Deployment | **Render** (one web service: React + API + Socket.io) |

```
Browser (React) ──REST /api──▶ Express ──SQL──▶ Supabase PostgreSQL
       ▲   │                     │  ├──────▶ Gemini API (AI answers)
       │   └──WebSocket──────────┘  └──────▶ Judge0 (run code)
       └──── live events (Socket.io)
```

### Security (Unit 4)
- **Authentication vs Authorization**: `requireAuth` checks *who you are* (JWT); project roles (Owner / Editor / Viewer) check *what you may do* inside a team project (RBAC).
- **SQL Injection**: every query uses parameterised SQL (`$1, $2`); user input is never concatenated into SQL.
- **XSS**: React escapes all text, and Markdown is rendered with raw HTML disabled (`skipHtml`). Input is sanitised and length-limited on the server.
- **CSRF**: the JWT is sent in the `Authorization` header, not a cookie, so other sites can't make requests as the user.
- Passwords hashed with bcrypt, Helmet security headers, rate limiting on login and AI routes, and API keys kept only on the server.

### Database tables
`users`, `chats`, `chat_messages`, `projects`, `project_members`, `project_ai_messages`, `project_team_messages`, `project_files`, `project_activity`, `xp_events`, `activity_log`, `language_usage`, `roadmap_progress`, `daily_challenges`, `daily_solves` (see `db/schema.sql`). Tables are created automatically when the server starts.

---

## 🚀 Deployment (about 20 minutes, all free)

### Step 1 – Supabase database
1. Go to **supabase.com** → sign in with GitHub → **New project**.
2. Name it `codebuddy`, set a **database password** (save it!) and pick region **Mumbai (ap-south-1)**.
3. When it's ready, click **Connect** (top bar) → **Connection string** → choose **Session pooler**.
4. Copy the URI. It looks like
   `postgresql://postgres.abcd1234:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`
   Replace `[YOUR-PASSWORD]` with your database password. This is your **DATABASE_URL**.

> Use the **Session pooler** string, not "Direct connection". Render can't reach the direct one.
> You don't need to create tables: the app does it on first start.

### Step 2 – Gemini API key
1. Go to **aistudio.google.com** → **Get API key** → **Create API key**.
2. Copy it. This is your **GEMINI_API_KEY**.

### Step 3 – Put the code on GitHub
1. Create a new repository on github.com (e.g. `codebuddy`).
2. Upload this whole folder **except `node_modules`, `dist` and `.env`** (drag and drop on GitHub's "uploading an existing file" page), or use git:
   ```bash
   git init && git add . && git commit -m "CodeBuddy"
   git branch -M main
   git remote add origin https://github.com/<you>/codebuddy.git
   git push -u origin main
   ```

### Step 4 – Deploy on Render
1. Go to **render.com** → sign in with GitHub → **New +** → **Web Service** → select your repo.
2. Settings:
   - **Runtime:** Node
   - **Build command:** `npm install --include=dev && npm run build`
   - **Start command:** `npm start`
   - **Instance type:** Free
3. **Environment variables** (Add from .env, or one by one):

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | your Supabase session pooler URI |
   | `GEMINI_API_KEY` | your Gemini key |
   | `JWT_SECRET` | any long random text, e.g. `cb-9f8a7d6s5a4-secret-2026` |
      | `GEMINI_MODEL` | `gemini-flash-lite-latest` |
   | `APP_TZ` | `Asia/Kolkata` |

4. Click **Create Web Service**. After 2–4 minutes you get a URL like `https://codebuddy-xxxx.onrender.com`. **This is the URL for your report and Excel sheet.**
5. Open it and sign up.

> Render's free tier sleeps after 15 min idle, so the first visit can take about 50 s. Open the site once before your demo/viva.
> Supabase pauses free projects after 7 days of no activity. Open the Supabase dashboard before your demo if it's been a while.

---

## 💻 Run locally (optional)
```bash
npm install
cp .env.example .env        # fill in DATABASE_URL, GEMINI_API_KEY, JWT_SECRET
npm run dev                 # React on http://localhost:5173, API on :5000
```

## 🛟 Troubleshooting
| Problem | Fix |
|---|---|
| "Database connection failed" in Render logs | Check `DATABASE_URL`: use the **Session pooler** string and the correct password (no `[ ]`). |
| AI says "AI is not configured" | Add `GEMINI_API_KEY` in Render → Environment, then redeploy. |
| "AI is busy (free-tier limit)" | Gemini free tier allows a limited number of requests per minute; wait a minute. |
| Code runner unavailable | The free public Judge0 server is busy; try again. |

---

## 📁 Project structure
```
codebuddy/
├── db/schema.sql            PostgreSQL tables
├── server/
│   ├── index.js             Express app, security middleware, static hosting
│   ├── auth.js              Signup/login, JWT, requireAuth
│   ├── socket.js            Socket.io: presence, project channels, typing
│   ├── ai.js / prompts.js   Gemini integration and tutor prompts
│   ├── xp.js                XP, streaks, leaderboard
│   └── routes/              tutor, projects (with Owner/Editor/Viewer RBAC), learn (REST API)
├── src/
│   ├── context/             AuthContext, SettingsContext, SocketContext (global state)
│   ├── components/          Layout, CodeEditor, Markdown, Avatar, Modal
│   ├── pages/               Dashboard, Tutor, Playground, Projects, ProjectWorkspace,
│   │                        Quiz, LearningPaths, Leaderboard, Profile
│   └── lib/                 api client, constants, helpers
└── render.yaml              Render deployment blueprint
```
