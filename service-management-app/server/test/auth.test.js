import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessClass, allowRoles } from '../src/auth.js';

function response() {
  return {
    code: 200,
    body: null,
    status(n) { this.code = n; return this; },
    json(v) { this.body = v; return this; },
    sendStatus(n) { this.code = n; return this; }
  };
}

function checkAccess(user, params = {}, body = {}, query = {}) {
  const req = { user, params, body, query };
  const res = response();
  let passed = false;
  canAccessClass(req, res, () => { passed = true; });
  return { passed, res };
}

test('class servant may access assigned class', () => {
  const r = checkAccess(
    { role: 'class_servant', class_id: 'class-a' },
    { classId: 'class-a' }
  );
  assert.equal(r.passed, true);
});

test('class servant is blocked from another class', () => {
  const r = checkAccess(
    { role: 'class_servant', class_id: 'class-a' },
    { classId: 'class-b' }
  );
  assert.equal(r.passed, false);
  assert.equal(r.res.code, 403);
});

test('admin may access any class', () => {
  assert.equal(
    checkAccess({ role: 'admin' }, { classId: 'class-b' }).passed,
    true
  );
});

test('service manager may access any class', () => {
  assert.equal(
    checkAccess({ role: 'service_manager' }, { classId: 'class-b' }).passed,
    true
  );
});

test('class servant request without class id is rejected', () => {
  const r = checkAccess({
    role: 'class_servant',
    class_id: 'class-a'
  });
  assert.equal(r.passed, false);
  assert.equal(r.res.code, 400);
});

test('class servant class restriction applies to body class_id', () => {
  const allowed = checkAccess(
    { role: 'class_servant', class_id: 'class-a' },
    {},
    { class_id: 'class-a' }
  );
  const blocked = checkAccess(
    { role: 'class_servant', class_id: 'class-a' },
    {},
    { class_id: 'class-b' }
  );
  assert.equal(allowed.passed, true);
  assert.equal(blocked.passed, false);
  assert.equal(blocked.res.code, 403);
});

test('class servant class restriction applies to query class_id', () => {
  const r = checkAccess(
    { role: 'class_servant', class_id: 'class-a' },
    {},
    {},
    { class_id: 'class-b' }
  );
  assert.equal(r.passed, false);
  assert.equal(r.res.code, 403);
});

test('admin role middleware allows admin only', () => {
  let passed = false;
  allowRoles('admin')(
    { user: { role: 'admin' } },
    response(),
    () => { passed = true; }
  );
  assert.equal(passed, true);
});

test('admin role middleware blocks service manager', () => {
  let passed = false;
  allowRoles('admin')(
    { user: { role: 'service_manager' } },
    response(),
    () => { passed = true; }
  );
  assert.equal(passed, false);
});

test('attendance roles allow all three assigned roles', () => {
  for (const role of ['admin', 'service_manager', 'class_servant']) {
    let passed = false;
    allowRoles('admin', 'service_manager', 'class_servant')(
      { user: { role } },
      response(),
      () => { passed = true; }
    );
    assert.equal(passed, true, `${role} should be allowed`);
  }
});

test('unknown role is blocked', () => {
  let passed = false;
  allowRoles('admin', 'service_manager', 'class_servant')(
    { user: { role: 'unknown' } },
    response(),
    () => { passed = true; }
  );
  assert.equal(passed, false);
});

