import { Router } from 'express';
import { q, one, tx } from '../db.js';
import { h, fail, clean, pickLang, intId, LANG_LABEL } from '../util.js';
import { gemini } from '../ai.js';
import { tutorSystemPrompt } from '../prompts.js';
import { emitTo, projectRole } from '../socket.js';
import { awardXp, XP } from '../xp.js';

export const projectsRouter = Router();
const RANK = { viewer: 1, editor: 2, owner: 3 };
const ROLES = ['owner', 'editor', 'viewer'];

// Project-level RBAC: loads the caller's role and checks the minimum required role
const member = (minRole = 'viewer') => async (req, res, next) => {
  try {
    const pid = intId(req.params.pid);
    const role = await projectRole(pid, req.user.id);
    if (!role) return res.status(404).json({ error: 'Project not found or you are not a member.' });
    if (RANK[role] < RANK[minRole]) return res.status(403).json({ error: `Only ${minRole}s can do that.` });
    req.pid = pid;
    req.projectRole = role;
    next();
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};

async function logActivity(pid, userId, text) {
  const row = await one(
    `with ins as (insert into project_activity (project_id, user_id, text) values ($1, $2, $3) returning *)
     select ins.id, ins.text, ins.created_at as "createdAt", u.name as "userName"
     from ins left join users u on u.id = ins.user_id`,
    [pid, userId, text]
  );
  emitTo(`project:${pid}`, 'activity:new', row);
}

const AI_SELECT = `select m.id, m.user_id as "userId", u.name as "userName", m.question, m.answer,
  m.file_name as "fileName", m.pinned, m.created_at as "createdAt"
  from project_ai_messages m join users u on u.id = m.user_id`;
const TEAM_SELECT = `select t.id, t.user_id as "userId", u.name as "userName", u.role as "userRole", t.text,
  t.ref_ai_id as "refAiId", a.question as "refQuestion", t.created_at as "createdAt"
  from project_team_messages t join users u on u.id = t.user_id
  left join project_ai_messages a on a.id = t.ref_ai_id`;
const FILE_SELECT = `select f.id, f.name, f.language, f.content, f.updated_at as "updatedAt", u.name as "updatedBy"
  from project_files f left join users u on u.id = f.updated_by`;

const membersOf = (pid) =>
  q(
    `select u.id, u.name, u.email, u.role as "appRole", pm.role, u.last_seen as "lastSeen"
     from project_members pm join users u on u.id = pm.user_id
     where pm.project_id = $1 order by case pm.role when 'owner' then 1 when 'editor' then 2 else 3 end, u.name`,
    [pid]
  );

// ---------- Projects ----------
projectsRouter.get(
  '/',
  h(async (req) =>
    q(
      `select p.id, p.name, p.language, p.description, p.created_at as "createdAt", pm.role,
         o.name as "ownerName",
         (select count(*)::int from project_members x where x.project_id = p.id) as "memberCount",
         (select count(*)::int from project_ai_messages x where x.project_id = p.id) as "aiCount"
       from project_members pm join projects p on p.id = pm.project_id join users o on o.id = p.owner_id
       where pm.user_id = $1 order by p.created_at desc`,
      [req.user.id]
    )
  )
);

projectsRouter.post(
  '/',
  h(async (req) => {
    const name = clean(req.body.name, 60);
    if (name.length < 2) fail(400, 'Give your project a name.');
    const language = pickLang(req.body.language);
    const description = clean(req.body.description, 1500);
    const project = await tx(async (c) => {
      const p = (
        await c.query('insert into projects (name, language, description, owner_id) values ($1,$2,$3,$4) returning id, name', [
          name, language, description, req.user.id,
        ])
      ).rows[0];
      await c.query(`insert into project_members (project_id, user_id, role) values ($1, $2, 'owner')`, [p.id, req.user.id]);
      return p;
    });
    await logActivity(project.id, req.user.id, `${req.user.name} created the project`);
    return project;
  })
);

projectsRouter.get(
  '/:pid',
  member(),
  h(async (req) => {
    const project = await one(
      `select id, name, language, description, owner_id as "ownerId", created_at as "createdAt" from projects where id = $1`,
      [req.pid]
    );
    return { ...project, myRole: req.projectRole, members: await membersOf(req.pid) };
  })
);

projectsRouter.put(
  '/:pid',
  member('owner'),
  h(async (req) => {
    const name = clean(req.body.name, 60);
    const description = clean(req.body.description, 1500);
    if (name.length < 2) fail(400, 'Name too short.');
    await q('update projects set name = $1, description = $2 where id = $3', [name, description, req.pid]);
    emitTo(`project:${req.pid}`, 'project:update', { name, description });
    await logActivity(req.pid, req.user.id, `${req.user.name} updated the project details`);
  })
);

projectsRouter.delete(
  '/:pid',
  member('owner'),
  h(async (req) => {
    emitTo(`project:${req.pid}`, 'project:deleted', { id: req.pid });
    await q('delete from projects where id = $1', [req.pid]);
  })
);

// ---------- Members & roles ----------
projectsRouter.post(
  '/:pid/members',
  member('owner'),
  h(async (req) => {
    const email = clean(req.body.email, 120).toLowerCase();
    const role = ['editor', 'viewer'].includes(req.body.role) ? req.body.role : 'viewer';
    const user = await one('select id, name from users where email = $1', [email]);
    if (!user) fail(404, 'No CodeBuddy account uses that email. Ask them to sign up first.');
    const added = await one(
      `insert into project_members (project_id, user_id, role) values ($1, $2, $3)
       on conflict do nothing returning user_id`,
      [req.pid, user.id, role]
    );
    if (!added) fail(409, `${user.name} is already in this project.`);
    const members = await membersOf(req.pid);
    emitTo(`project:${req.pid}`, 'members:update', members);
    emitTo(`user:${user.id}`, 'project:invited', { projectId: req.pid, by: req.user.name });
    await logActivity(req.pid, req.user.id, `${req.user.name} added ${user.name} as ${role}`);
    return members;
  })
);

projectsRouter.put(
  '/:pid/members/:uid',
  member('owner'),
  h(async (req) => {
    const uid = intId(req.params.uid);
    const role = req.body.role;
    if (!ROLES.includes(role) || role === 'owner') fail(400, 'Role must be editor or viewer.');
    if (uid === req.user.id) fail(400, 'You are the owner.');
    const u = await one(
      'update project_members pm set role = $1 from users u where pm.project_id = $2 and pm.user_id = $3 and u.id = pm.user_id returning u.name',
      [role, req.pid, uid]
    );
    if (!u) fail(404, 'Member not found');
    const members = await membersOf(req.pid);
    emitTo(`project:${req.pid}`, 'members:update', members);
    await logActivity(req.pid, req.user.id, `${req.user.name} changed ${u.name}'s role to ${role}`);
    return members;
  })
);

projectsRouter.delete(
  '/:pid/members/:uid',
  member(),
  h(async (req) => {
    const uid = intId(req.params.uid);
    const leaving = uid === req.user.id;
    if (!leaving && req.projectRole !== 'owner') fail(403, 'Only the owner can remove members.');
    if (leaving && req.projectRole === 'owner') fail(400, 'The owner cannot leave. Delete the project instead.');
    const u = await one('select name from users where id = $1', [uid]);
    await q('delete from project_members where project_id = $1 and user_id = $2', [req.pid, uid]);
    const members = await membersOf(req.pid);
    emitTo(`project:${req.pid}`, 'members:update', members);
    emitTo(`user:${uid}`, 'project:removed', { projectId: req.pid });
    await logActivity(req.pid, req.user.id, leaving ? `${u?.name} left the project` : `${req.user.name} removed ${u?.name}`);
    return members;
  })
);

// ---------- Shared AI chat ----------
projectsRouter.get('/:pid/ai', member(), h(async (req) => q(`${AI_SELECT} where m.project_id = $1 order by m.id`, [req.pid])));

projectsRouter.post(
  '/:pid/ai',
  member('editor'),
  h(async (req) => {
    const question = clean(req.body.question, 8000);
    if (!question) fail(400, 'Type a question first.');
    const project = await one('select name, language, description from projects where id = $1', [req.pid]);
    let file = null;
    if (req.body.fileId) {
      file = await one('select name, language, content from project_files where id = $1 and project_id = $2', [intId(req.body.fileId), req.pid]);
    }
    emitTo(`project:${req.pid}`, 'ai:thinking', { userName: req.user.name, question });

    const history = await q(
      `select question, answer from (select id, question, answer from project_ai_messages where project_id = $1 order by id desc limit 4) t order by id`,
      [req.pid]
    );
    const messages = history.flatMap((m) => [
      { role: 'user', content: m.question },
      { role: 'assistant', content: m.answer },
    ]);
    const asked = file
      ? `${question}\n\nFile "${file.name}":\n\`\`\`${file.language}\n${file.content.slice(0, 12000)}\n\`\`\``
      : question;
    messages.push({ role: 'user', content: `${req.user.name} asks: ${asked}` });

    let answer;
    try {
      answer = await gemini({
        system: tutorSystemPrompt({
          language: LANG_LABEL[project.language],
          level: 'intermediate',
          mode: 'chat',
          projectContext: `Project name: ${project.name}\nLanguage: ${LANG_LABEL[project.language]}\nDescription: ${project.description || '(none)'}`,
        }),
        messages,
      });
    } catch (e) {
      emitTo(`project:${req.pid}`, 'ai:failed', { userName: req.user.name });
      throw e;
    }
    const { id } = await one(
      'insert into project_ai_messages (project_id, user_id, question, answer, file_name) values ($1,$2,$3,$4,$5) returning id',
      [req.pid, req.user.id, question, answer, file?.name || null]
    );
    const msg = await one(`${AI_SELECT} where m.id = $1`, [id]);
    emitTo(`project:${req.pid}`, 'ai:new', msg);
    await logActivity(req.pid, req.user.id, `${req.user.name} asked AI: "${question.slice(0, 60)}${question.length > 60 ? '…' : ''}"`);
    await awardXp(req.user.id, XP.projectQuestion, { reason: 'Project AI question', stat: 'questions', language: project.language });
    return msg;
  })
);

projectsRouter.put(
  '/:pid/ai/:mid/pin',
  member('editor'),
  h(async (req) => {
    const row = await one(
      'update project_ai_messages set pinned = not pinned where id = $1 and project_id = $2 returning id, pinned, question',
      [intId(req.params.mid), req.pid]
    );
    if (!row) fail(404, 'Message not found');
    emitTo(`project:${req.pid}`, 'ai:update', { id: row.id, pinned: row.pinned });
    if (row.pinned) await logActivity(req.pid, req.user.id, `${req.user.name} pinned an answer: "${row.question.slice(0, 50)}"`);
    return row;
  })
);

// ---------- Team discussion chat ----------
projectsRouter.get(
  '/:pid/team',
  member(),
  h(async (req) => q(`select * from (${TEAM_SELECT} where t.project_id = $1 order by t.id desc limit 200) x order by id`, [req.pid]))
);

projectsRouter.post(
  '/:pid/team',
  member(),
  h(async (req) => {
    const text = clean(req.body.text, 4000);
    if (!text) fail(400, 'Message is empty.');
    let refAiId = null;
    if (req.body.refAiId) {
      const ref = await one('select id from project_ai_messages where id = $1 and project_id = $2', [intId(req.body.refAiId), req.pid]);
      refAiId = ref?.id || null;
    }
    const { id } = await one(
      'insert into project_team_messages (project_id, user_id, text, ref_ai_id) values ($1,$2,$3,$4) returning id',
      [req.pid, req.user.id, text, refAiId]
    );
    const msg = await one(`${TEAM_SELECT} where t.id = $1`, [id]);
    emitTo(`project:${req.pid}`, 'team:new', msg);
    if (refAiId) await logActivity(req.pid, req.user.id, `${req.user.name} started a discussion on an AI answer`);
    return msg;
  })
);

// ---------- Shared code files ----------
projectsRouter.get(
  '/:pid/files',
  member(),
  h(async (req) => q(`${FILE_SELECT} where f.project_id = $1 order by f.name`, [req.pid]))
);

projectsRouter.post(
  '/:pid/files',
  member('editor'),
  h(async (req) => {
    const name = clean(req.body.name, 80).replace(/[\\/]/g, '_');
    if (!name) fail(400, 'File name required.');
    const language = pickLang(req.body.language);
    const content = String(req.body.content ?? '').slice(0, 100000);
    const row = await one(
      `insert into project_files (project_id, name, language, content, updated_by) values ($1,$2,$3,$4,$5)
       on conflict (project_id, name) do nothing returning id`,
      [req.pid, name, language, content, req.user.id]
    );
    if (!row) fail(409, 'A file with that name already exists.');
    const file = await one(`${FILE_SELECT} where f.id = $1`, [row.id]);
    emitTo(`project:${req.pid}`, 'file:update', file);
    await logActivity(req.pid, req.user.id, `${req.user.name} created ${name}`);
    return file;
  })
);

projectsRouter.put(
  '/:pid/files/:fid',
  member('editor'),
  h(async (req) => {
    const content = String(req.body.content ?? '').slice(0, 100000);
    const row = await one(
      'update project_files set content = $1, updated_by = $2, updated_at = now() where id = $3 and project_id = $4 returning id, name',
      [content, req.user.id, intId(req.params.fid), req.pid]
    );
    if (!row) fail(404, 'File not found');
    const file = await one(`${FILE_SELECT} where f.id = $1`, [row.id]);
    emitTo(`project:${req.pid}`, 'file:update', file);
    await logActivity(req.pid, req.user.id, `${req.user.name} saved ${row.name}`);
    return file;
  })
);

projectsRouter.delete(
  '/:pid/files/:fid',
  member('editor'),
  h(async (req) => {
    const row = await one('delete from project_files where id = $1 and project_id = $2 returning id, name', [intId(req.params.fid), req.pid]);
    if (!row) fail(404, 'File not found');
    emitTo(`project:${req.pid}`, 'file:delete', { id: row.id });
    await logActivity(req.pid, req.user.id, `${req.user.name} deleted ${row.name}`);
  })
);

// ---------- Activity feed ----------
projectsRouter.get(
  '/:pid/activity',
  member(),
  h(async (req) =>
    q(
      `select a.id, a.text, a.created_at as "createdAt", u.name as "userName"
       from project_activity a left join users u on u.id = a.user_id
       where a.project_id = $1 order by a.id desc limit 40`,
      [req.pid]
    )
  )
);
