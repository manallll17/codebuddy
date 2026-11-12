-- CodeBuddy database schema (PostgreSQL / Supabase)
-- Safe to run many times: the server runs it automatically on start-up.

create table if not exists users (
  id            serial primary key,
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  bio           text not null default '',
  xp            int  not null default 0,
  streak_count  int  not null default 0,
  streak_best   int  not null default 0,
  streak_last   date,
  questions     int  not null default 0,
  solved        int  not null default 0,
  quizzes       int  not null default 0,
  created_at    timestamptz not null default now(),
  last_seen     timestamptz not null default now()
);

-- ---------- Gamification ----------
create table if not exists xp_events (
  id         serial primary key,
  user_id    int not null references users(id) on delete cascade,
  amount     int not null,
  reason     text not null,
  created_at timestamptz not null default now()
);
create index if not exists xp_events_time_idx on xp_events (created_at);

create table if not exists activity_log (
  user_id int  not null references users(id) on delete cascade,
  day     date not null,
  count   int  not null default 0,
  primary key (user_id, day)
);

create table if not exists language_usage (
  user_id  int  not null references users(id) on delete cascade,
  language text not null,
  count    int  not null default 0,
  primary key (user_id, language)
);

create table if not exists roadmap_progress (
  user_id  int  not null references users(id) on delete cascade,
  language text not null,
  topic_id text not null,
  done_at  timestamptz not null default now(),
  primary key (user_id, language, topic_id)
);

create table if not exists daily_challenges (
  day        date primary key,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists daily_solves (
  user_id   int  not null references users(id) on delete cascade,
  day       date not null,
  language  text not null,
  solved_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ---------- Personal AI tutor ----------
create table if not exists chats (
  id         serial primary key,
  user_id    int  not null references users(id) on delete cascade,
  title      text not null,
  language   text not null,
  level      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chats_user_idx on chats (user_id, updated_at desc);

create table if not exists chat_messages (
  id         serial primary key,
  chat_id    int  not null references chats(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  mode       text not null default 'chat',
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_chat_idx on chat_messages (chat_id, id);

-- ---------- Collaborative projects ----------
create table if not exists projects (
  id          serial primary key,
  name        text not null,
  language    text not null,
  description text not null default '',
  owner_id    int  not null references users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists project_members (
  project_id int  not null references projects(id) on delete cascade,
  user_id    int  not null references users(id) on delete cascade,
  role       text not null check (role in ('owner', 'editor', 'viewer')),
  added_at   timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists project_ai_messages (
  id         serial primary key,
  project_id int  not null references projects(id) on delete cascade,
  user_id    int  not null references users(id) on delete cascade,
  question   text not null,
  answer     text not null,
  file_name  text,
  pinned     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists project_ai_idx on project_ai_messages (project_id, id);

create table if not exists project_team_messages (
  id         serial primary key,
  project_id int  not null references projects(id) on delete cascade,
  user_id    int  not null references users(id) on delete cascade,
  text       text not null,
  ref_ai_id  int  references project_ai_messages(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists project_team_idx on project_team_messages (project_id, id);

create table if not exists project_files (
  id         serial primary key,
  project_id int  not null references projects(id) on delete cascade,
  name       text not null,
  language   text not null,
  content    text not null default '',
  updated_by int  references users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);

create table if not exists project_activity (
  id         serial primary key,
  project_id int  not null references projects(id) on delete cascade,
  user_id    int  references users(id) on delete set null,
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists project_activity_idx on project_activity (project_id, id desc);
