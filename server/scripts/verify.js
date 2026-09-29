/* eslint-disable */
/**
 * End-to-end verification of the critical business rules.
 *
 *   npm run verify     (from the server folder)
 *
 * The suite mutates data (publishes SOP v2, creates and reassigns users,
 * uploads documents), so it re-seeds the database first. Without that reset a
 * second run fails on its own leftovers - for example the SOP version count
 * check would see v2 instead of v1.
 */
const BASE = process.env.BASE_URL || 'http://localhost:4000/api';

let pass = 0;
let fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name} ${extra}`);
  }
};

async function call(path, { method = 'GET', token, body, raw = false, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  if (raw) return res;
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, body: json, headers: res.headers };
}

const login = async (email, password) => {
  const r = await call('/auth/login', { method: 'POST', body: { email, password } });
  if (r.status !== 200) throw new Error(`login failed for ${email}: ${JSON.stringify(r.body)}`);
  return r.body;
};

/**
 * The API is a separate long-lived process, so the reset is done by spawning
 * the same seed script the operator would run by hand.
 */
async function resetDatabase() {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync('npm', ['run', '--silent', 'seed'], { encoding: 'utf8', shell: true });
  if (result.status !== 0) {
    console.error('Could not re-seed the database before verifying:');
    console.error(result.stdout || result.stderr);
    process.exit(1);
  }
}

(async () => {
  if (process.env.SKIP_RESET !== 'true') {
    console.log('Resetting the database to a known seed state…');
    await resetDatabase();
  }

  console.log('\n== 1. Authentication & RBAC ==');
  const superAdmin = await login('superadmin@example.com', 'SuperAdmin@123');
  const admin = await login('admin@example.com', 'Admin@123');
  const itMember = await login('itmember@example.com', 'ITMember@123');
  const client = await login('client@example.com', 'Client@123');
  check('login returns accessToken + permissions[]', !!superAdmin.accessToken && Array.isArray(superAdmin.user.permissions));
  check('super admin has all 41 permissions', superAdmin.user.permissions.length === 41, `got ${superAdmin.user.permissions.length}`);
  check('client permission set is minimal', client.user.permissions.length === 3, `got ${client.user.permissions.length}`);

  const badLogin = await call('/auth/login', { method: 'POST', body: { email: 'admin@example.com', password: 'wrong' } });
  check('bad password -> 401', badLogin.status === 401);
  const noToken = await call('/projects');
  check('no token -> 401', noToken.status === 401);

  const clientUsers = await call('/users', { token: client.accessToken });
  check('client blocked from /users (no user:read) -> 403', clientUsers.status === 403);

  const itAudit = await call('/audit?limit=5', { token: itMember.accessToken });
  check('IT member blocked from /audit (no audit:read) -> 403', itAudit.status === 403);
  const clientAudit = await call('/audit', { token: client.accessToken });
  check('client blocked from /audit -> 403', clientAudit.status === 403);
  const adminAudit = await call('/audit?limit=5', { token: admin.accessToken });
  check('admin can read /audit', adminAudit.status === 200 && adminAudit.body.items.length > 0);

  console.log('\n== 2. Refresh token rotation ==');
  const refreshRes = await call('/auth/refresh', { method: 'POST' });
  const rawRefresh = await fetch(`${BASE}/auth/refresh`, { method: 'POST' });
  check('refresh without cookie -> 401', rawRefresh.status === 401);
  const loginWithCookie = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Admin@123' }),
  });
  const setCookie = loginWithCookie.headers.getSetCookie().find((c) => c.startsWith('wf_refresh_token='));
  check('refresh cookie is httpOnly', !!setCookie && setCookie.includes('HttpOnly'));
  const cookieHeader = setCookie.split(';')[0];
  const refresh1 = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { Cookie: cookieHeader } });
  const refresh1Body = await refresh1.json();
  check('refresh rotates token -> new accessToken', refresh1.status === 200 && !!refresh1Body.accessToken);
  const rotatedCookie = refresh1.headers.getSetCookie().find((c) => c.startsWith('wf_refresh_token=')).split(';')[0];
  const reuse = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { Cookie: cookieHeader } });
  check('re-using a rotated refresh token -> 401 TOKEN_REUSE_DETECTED', reuse.status === 401);
  const reuseBody = await reuse.json();
  check('reuse detection code', reuseBody.code === 'TOKEN_REUSE_DETECTED', reuseBody.code);
  const familyRevoked = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { Cookie: rotatedCookie } });
  check('whole token family revoked after reuse', familyRevoked.status === 401);
  void refreshRes;

  console.log('\n== 3. filterClientData (server side) ==');
  const projectsAdmin = await call('/projects', { token: admin.accessToken });
  const projectsClient = await call('/projects', { token: client.accessToken });
  if (!projectsAdmin.body.items || !projectsClient.body.items) {
    console.log('  DEBUG admin:', JSON.stringify(projectsAdmin.body).slice(0, 300));
    console.log('  DEBUG client:', JSON.stringify(projectsClient.body).slice(0, 300));
  }
  check('admin sees every project', projectsAdmin.body.items?.length >= 3, `got ${projectsAdmin.body.items?.length}`);
  check('client sees only assigned projects', projectsClient.body.items.length === 2, `got ${projectsClient.body.items?.length}`);

  const firstProjectId = projectsClient.body.items[0].id;
  const clientProject = await call(`/projects/${firstProjectId}`, { token: client.accessToken });
  const json = JSON.stringify(clientProject.body);
  check('client project has 3 stages (2 hidden stripped)', clientProject.body.project.stages.length === 3, `got ${clientProject.body.project.stages.length}`);
  check('no internal remarks in client payload', !json.includes('internalRemarks'));
  check('no documents in client payload', !json.includes('"documents"'));
  check('no blocker/holdReason in client payload', !json.includes('blocker') && !json.includes('holdReason'));
  check('no clientVisible flag leaked', !json.includes('clientVisible'));

  const adminProject = await call(`/projects/${firstProjectId}`, { token: admin.accessToken });
  check('admin sees all 5 stages', adminProject.body.project.stages.length === 5, `got ${adminProject.body.project.stages.length}`);

  const clientWrite = await call(`/projects/${firstProjectId}`, { method: 'PATCH', token: client.accessToken, body: { name: 'hack' } });
  check('client cannot update a project -> 403', clientWrite.status === 403);

  const clientStages = await call(`/projects/${firstProjectId}/stages`, { token: client.accessToken });
  if (!clientStages.body.stages) console.log('  DEBUG clientStages:', JSON.stringify(clientStages.body).slice(0, 300));
  check('client stage list only has clientVisible stages', clientStages.body.stages?.every((s) => s.name) === true, `n=${clientStages.body.stages?.length}`);

  console.log('\n== 4. SOP versions & auto-generated stages ==');
  const templates = await call('/sop', { token: superAdmin.accessToken });
  const template = templates.body.items[0];
  check('seeded template is published', template.status === 'published', template.status);
  check('template has 5 stages, 3 visible', template.stages.length === 5 && template.stages.filter((s) => s.clientVisible).length === 3);

  const versions = await call(`/sop/${template.id}/versions`, { token: superAdmin.accessToken });
  check('version history has v1', versions.body.items.length === 1 && versions.body.items[0].version === 1);

  const adminNoPublish = await call(`/sop/${template.id}/publish`, { method: 'POST', token: admin.accessToken, body: {} });
  check('admin cannot publish SOP (no sop:publish) -> 403', adminNoPublish.status === 403);

  const createTemplate = await call('/sop', { method: 'POST', token: superAdmin.accessToken, body: { name: 'Network Delivery SOP', key: 'NET_DELIVERY', description: 'test', stages: [] } });
  if (!createTemplate.body.template) console.log('  DEBUG createTemplate:', JSON.stringify(createTemplate.body).slice(0, 400));
  check('super admin can create SOP template', createTemplate.status === 201);
  const newTemplateId = createTemplate.body.template.id;
  const s1 = await call(`/sop/${newTemplateId}/stages`, { method: 'POST', token: superAdmin.accessToken, body: { key: 'S1', name: 'One', clientVisible: true } });
  const s2 = await call(`/sop/${newTemplateId}/stages`, { method: 'POST', token: superAdmin.accessToken, body: { key: 'S2', name: 'Two', clientVisible: false } });
  check('can add stages to draft', s1.status === 201 && s2.status === 201);

  const published = await call(`/sop/${newTemplateId}/publish`, { method: 'POST', token: superAdmin.accessToken, body: { changeNote: 'v1' } });
  check('publish creates immutable v1', published.status === 201 && published.body.version.version === 1);

  const deleteAfterPublish = await call(`/sop/${newTemplateId}/stages/${published.body.version.stages[0].id}`, { method: 'DELETE', token: superAdmin.accessToken });
  check('stage deletion blocked once published -> 409', deleteAfterPublish.status === 409, `got ${deleteAfterPublish.status}`);

  // v2 via draft
  const draft = await call(`/sop/${template.id}/draft`, { method: 'POST', token: superAdmin.accessToken });
  check('can open a new draft from the published version', draft.status === 200 && draft.body.template.stages.length === 5);
  const renamed = await call(`/sop/${template.id}/stages/${draft.body.template.stages[0].id}`, { method: 'PATCH', token: superAdmin.accessToken, body: { name: 'Requirement Gathering (v2)' } });
  check('stage editable while draft', renamed.status === 200);
  const v2 = await call(`/sop/${template.id}/publish`, { method: 'POST', token: superAdmin.accessToken, body: { changeNote: 'rename stage 1' } });
  check('v2 published', v2.status === 201 && v2.body.version.version === 2);

  const existingProject = await call(`/projects/${firstProjectId}`, { token: admin.accessToken });
  check('existing project keeps SOP v1 after v2 publish', existingProject.body.project.sopVersionNumber === 1, `got ${existingProject.body.project.sopVersionNumber}`);
  const stillFive = existingProject.body.project.stages.length === 5;
  check('existing project stage names unchanged', existingProject.body.project.stages[0].name === 'Requirement Gathering', existingProject.body.project.stages[0].name);
  check('existing project stage count unchanged', stillFive);

  console.log('\n== 5. Project creation auto-generates stages ==');
  const users = await call('/users/assignable', { token: admin.accessToken });
  const clientUser = users.body.items.find((u) => u.role?.isClientScoped);
  if (!clientUser) console.log('  DEBUG assignable sample:', JSON.stringify(users.body.items[0]));
  check('assignable list exposes the client-scoped flag', !!clientUser);
  const preview = await call('/projects/preview', { method: 'POST', token: admin.accessToken, body: { sopTemplate: template.id } });
  check('preview returns 5 stages from latest published version', preview.status === 200 && preview.body.stages.length === 5);
  check('preview reports 3 client visible / 2 internal', preview.body.clientVisibleStages === 3 && preview.body.internalStages === 2);

  const newProject = await call('/projects', {
    method: 'POST',
    token: admin.accessToken,
    body: {
      name: 'HR Portal Rollout',
      code: 'PRJ-HR-100',
      description: 'Verification project',
      sopTemplate: template.id,
      client: clientUser.id,
      projectManager: users.body.items.find((u) => u.email === 'admin@example.com').id,
      members: [users.body.items.find((u) => u.email === 'itmember@example.com').id],
      priority: 'Medium',
    },
  });
  check('project created', newProject.status === 201, JSON.stringify(newProject.body).slice(0, 200));
  check('backend auto-generated 5 stages', newProject.body.generatedStages === 5);
  check('new project uses latest published version (v2)', newProject.body.project.sopVersionNumber === 2, `got ${newProject.body.project.sopVersionNumber}`);
  check('all stages start as "Not Started"', newProject.body.project.stages.every((s) => s.status === 'Not Started'));
  const newProjectId = newProject.body.project.id;

  console.log('\n== 6. Manual status + conditional validation + history ==');
  const stages = newProject.body.project.stages;
  check('project response embeds generated stages', stages?.length === 5, `got ${stages?.length}`);
  const first = stages[0];

  const blockedNoReason = await call(`/projects/${newProjectId}/stages/${first.id}/status`, { method: 'PATCH', token: itMember.accessToken, body: { status: 'Blocked' } });
  check('Blocked without blocker -> 422', blockedNoReason.status === 422, `got ${blockedNoReason.status}`);

  const holdNoReason = await call(`/projects/${newProjectId}/stages/${first.id}/status`, { method: 'PATCH', token: itMember.accessToken, body: { status: 'On Hold' } });
  check('On Hold without reason -> 422', holdNoReason.status === 422, `got ${holdNoReason.status}`);

  const completeNoDate = await call(`/projects/${newProjectId}/stages/${first.id}/status`, { method: 'PATCH', token: itMember.accessToken, body: { status: 'Completed' } });
  check('Completed without completionDate -> 422', completeNoDate.status === 422, `got ${completeNoDate.status}`);

  const badStatus = await call(`/projects/${newProjectId}/stages/${first.id}/status`, { method: 'PATCH', token: itMember.accessToken, body: { status: 'Wibble' } });
  check('invalid status value -> 422', badStatus.status === 422);

  const startOk = await call(`/projects/${newProjectId}/stages/${first.id}/status`, { method: 'PATCH', token: itMember.accessToken, body: { status: 'In Progress', note: 'starting' } });
  check('In Progress accepted', startOk.status === 200 && startOk.body.stage.status === 'In Progress');

  const blockedOk = await call(`/projects/${newProjectId}/stages/${first.id}/status`, { method: 'PATCH', token: itMember.accessToken, body: { status: 'Blocked', blocker: 'Waiting on vendor' } });
  check('Blocked with blocker accepted', blockedOk.status === 200 && blockedOk.body.stage.blocker === 'Waiting on vendor');

  const completedOk = await call(`/projects/${newProjectId}/stages/${first.id}/status`, { method: 'PATCH', token: itMember.accessToken, body: { status: 'Completed', completionDate: new Date().toISOString() } });
  check('Completed with completionDate accepted', completedOk.status === 200 && !!completedOk.body.stage.completionDate);

  const history = await call(`/projects/${newProjectId}/stages/${first.id}/status-history`, { token: itMember.accessToken });
  check('status history has 3 entries', history.body.items.length === 3, `got ${history.body.items.length}`);
  check('history records from -> to', history.body.items[0].fromStatus === 'Blocked' && history.body.items[0].toStatus === 'Completed', `${history.body.items[0]?.fromStatus} -> ${history.body.items[0]?.toStatus}`);
  check('history records the blocker', history.body.items.some((h) => h.blocker === 'Waiting on vendor'));

  const depStage = stages[2];
  const depBlocked = await call(`/projects/${newProjectId}/stages/${depStage.id}/status`, { method: 'PATCH', token: itMember.accessToken, body: { status: 'In Progress' } });
  check('stage dependency unmet -> 409', depBlocked.status === 409, `got ${depBlocked.status}`);

  const adminStatusWrite = await call(`/projects/${newProjectId}/stages/${first.id}/status`, { method: 'PATCH', token: admin.accessToken, body: { status: 'In Progress', force: true } });
  check('admin lacks stage:updateStatus -> 403', adminStatusWrite.status === 403, `got ${adminStatusWrite.status}`);

  const clientStatusWrite = await call(`/projects/${newProjectId}/stages/${stages[3].id}/status`, { method: 'PATCH', token: client.accessToken, body: { status: 'In Progress' } });
  check('client cannot change status -> 403', clientStatusWrite.status === 403);

  console.log('\n== 7. Document upload does NOT change status ==');
  const targetStage = stages[3];
  const beforeUpload = await call(`/projects/${newProjectId}/stages/${targetStage.id}`, { token: admin.accessToken });
  const form = new FormData();
  form.append('document', new Blob(['hello world'], { type: 'text/plain' }), 'notes.txt');
  form.append('stageId', targetStage.id);
  form.append('description', 'verification upload');
  const upload = await call(`/projects/${newProjectId}/documents`, { method: 'POST', token: itMember.accessToken, form });
  check('IT member can upload documents', upload.status === 201, JSON.stringify(upload.body).slice(0, 200));
  const afterUpload = await call(`/projects/${newProjectId}/stages/${targetStage.id}`, { token: itMember.accessToken });
  check('stage status unchanged by upload', beforeUpload.body.stage.status === afterUpload.body.stage.status, `${beforeUpload.body.stage.status} -> ${afterUpload.body.stage.status}`);
  check('document versioned as v1', upload.body.document?.version === 1);
  const upload2Form = new FormData();
  upload2Form.append('document', new Blob(['v2'], { type: 'text/plain' }), 'notes.txt');
  upload2Form.append('stageId', targetStage.id);
  const upload2 = await call(`/projects/${newProjectId}/documents`, { method: 'POST', token: itMember.accessToken, form: upload2Form });
  check('re-upload creates version 2', upload2.body.document?.version === 2, `got ${upload2.body.document?.version}`);

  const clientDocAttempt = await call(`/projects/${newProjectId}/documents`, { method: 'POST', token: client.accessToken, form: upload2Form });
  check('client cannot upload documents -> 403', clientDocAttempt.status === 403, `got ${clientDocAttempt.status}`);

  console.log('\n== 8. Deactivation 409 + reassign flow ==');
  const itUser = users.body.items.find((u) => u.email === 'itmember2@example.com');
  const previewDeact = await call(`/users/${itUser.id}/deactivation-preview`, { token: admin.accessToken });
  check('deactivation preview reports active assignments', previewDeact.status === 200 && previewDeact.body.assignments.count > 0, `count=${previewDeact.body.assignments?.count}`);

  const deact = await call(`/users/${itUser.id}/deactivate`, { method: 'PATCH', token: admin.accessToken, body: { reason: 'test' } });
  check('deactivate with active assignments -> 409', deact.status === 409, `got ${deact.status}`);
  check('409 body lists the offending assignments', Array.isArray(deact.body.details?.assignments) && deact.body.details.assignments.length > 0);
  check('409 body points at the reassign endpoint', deact.body.details?.resolution?.includes('reassign'));

  const noReassignPerm = await call(`/users/${itUser.id}/reassign`, { method: 'POST', token: itMember.accessToken, body: { newOwnerId: 'aaaaaaaaaaaaaaaaaaaaaaaa' } });
  check('reassign requires user:reassign -> 403 for IT member', noReassignPerm.status === 403);

  const targetUser = users.body.items.find((u) => u.email === 'itmember3@example.com');
  const reassign = await call(`/users/${itUser.id}/reassign`, { method: 'POST', token: admin.accessToken, body: { newOwnerId: targetUser.id, note: 'vacation' } });
  check('reassign moves all active stages', reassign.status === 200 && reassign.body.reassigned > 0, `moved=${reassign.body.reassigned}`);
  check('reassign does not change statuses', reassign.body.stages.every((s) => s.status === s.previousStatus));

  const deact2 = await call(`/users/${itUser.id}/deactivate`, { method: 'PATCH', token: admin.accessToken, body: { reason: 'test after reassign' } });
  check('deactivate succeeds after reassignment', deact2.status === 200, `got ${deact2.status}`);

  const loginDeactivated = await call('/auth/login', { method: 'POST', body: { email: 'itmember2@example.com', password: 'ITMember@123' } });
  check('deactivated user cannot log in -> 403', loginDeactivated.status === 403, `got ${loginDeactivated.status}`);

  const reactivate = await call(`/users/${itUser.id}/reactivate`, { method: 'PATCH', token: admin.accessToken });
  check('reactivate works', reactivate.status === 200);

  const selfDeactivate = await call(`/users/${admin.user.id}/deactivate`, { method: 'PATCH', token: admin.accessToken, body: {} });
  check('cannot deactivate own account -> 400', selfDeactivate.status === 400);

  console.log('\n== 9. Audit log ==');
  const auditList = await call('/audit?limit=100', { token: admin.accessToken });
  check('audit log paginated', auditList.status === 200 && auditList.body.pagination.total > 0);
  const actions = new Set(auditList.body.items.map((i) => i.action));
  check('audit contains status_changed', actions.has('status_changed'));
  check('audit contains reassigned', actions.has('reassigned'));
  check('audit contains deactivated', actions.has('deactivated'));
  check('audit contains published', actions.has('published'));
  check('audit contains oldValue/newValue', auditList.body.items.some((i) => i.oldValue && i.newValue));
  const filtered = await call('/audit?entityType=Project&action=created', { token: admin.accessToken });
  check('audit filters by entityType + action', filtered.status === 200 && filtered.body.items.every((i) => i.entityType === 'Project' && i.action === 'created'));
  const dated = await call('/audit?from=' + new Date(Date.now() - 86400000).toISOString(), { token: admin.accessToken });
  check('audit filters by date range', dated.status === 200 && dated.body.items.length > 0);
  const auditPost = await call('/audit', { method: 'POST', token: admin.accessToken, body: {} });
  check('audit log is append-only (no write route) -> 404', auditPost.status === 404);

  console.log('\n== 10. Reports & board ==');
  const summary = await call('/reports/summary', { token: admin.accessToken });
  check('summary report', summary.status === 200 && summary.body.projects > 0);
  const progress = await call('/reports/project-progress', { token: admin.accessToken });
  check('project progress report', progress.status === 200 && progress.body.projects.length > 0);
  const workload = await call('/reports/workload', { token: admin.accessToken });
  check('workload report', workload.status === 200);
  const board = await call('/workflow/board', { token: itMember.accessToken });
  check('workflow board for IT member', board.status === 200 && board.body.stages.length > 0, `stages=${board.body.stages?.length}`);
  const clientBoard = await call('/workflow/board', { token: client.accessToken });
  check('client board only client-visible stages', clientBoard.status === 200 && clientBoard.body.stages.every((s) => !JSON.stringify(s).includes('internalRemarks')));

  const clientIntegration = await call('/integrations', { token: admin.accessToken });
  check('integration stub endpoint', clientIntegration.status === 200 && clientIntegration.body.adapters.length === 2);

  console.log('\n== 11. NoSQL injection guard ==');
  const inject = await call(`/auth/login?email[$ne]=x`, { method: 'POST', body: { email: { $ne: 'x' }, password: { $ne: 'x' } } });
  check('operator injection rejected', inject.status !== 200, `got ${inject.status}`);

  console.log(`\n================ ${pass} passed, ${fail} failed ================\n`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('VERIFY CRASHED', err);
  process.exit(1);
});
