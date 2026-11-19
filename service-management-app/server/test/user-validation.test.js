import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUserContacts, validateUserCreate, validateUserPatch } from '../src/user-validation.js';

test('create accepts a valid email and normalizes its case and whitespace', () => {
  const result = validateUserCreate({
    full_name: '  أحمد خادم  ', email: '  USER@EXAMPLE.COM ', phone: '',
    password: 'long-password', role: 'service_manager'
  });
  assert.equal(result.error, undefined);
  assert.equal(result.value.full_name, 'أحمد خادم');
  assert.equal(result.value.email, 'user@example.com');
  assert.equal(result.value.phone, null);
});

test('create accepts a valid phone when email is omitted', () => {
  const result = validateUserCreate({
    full_name: 'خادم فصل', phone: '+20 100 123 4567',
    password: 'long-password', role: 'class_servant', class_id: 'class-1'
  });
  assert.equal(result.error, undefined);
  assert.equal(result.value.phone, '+20 100 123 4567');
});

test('contacts made only of whitespace are rejected', () => {
  assert.match(normalizeUserContacts('   ', '   ').error, /يجب إدخال البريد/);
});

test('malformed email is rejected', () => {
  assert.match(normalizeUserContacts('not-an-email', null).error, /صيغة البريد/);
});

test('phone containing letters or too few digits is rejected', () => {
  assert.match(normalizeUserContacts(null, 'abc1234567').error, /رقم الهاتف/);
  assert.match(normalizeUserContacts(null, '12345').error, /رقم الهاتف/);
});

test('create rejects a blank name, short password, invalid role and unassigned servant', () => {
  assert.ok(validateUserCreate({ full_name: '  ', password: 'long-password', role: 'admin', email: 'a@b.com' }).error);
  assert.ok(validateUserCreate({ full_name: 'اسم', password: 'short', role: 'admin', email: 'a@b.com' }).error);
  assert.ok(validateUserCreate({ full_name: 'اسم', password: 'long-password', role: 'owner', email: 'a@b.com' }).error);
  assert.ok(validateUserCreate({ full_name: 'اسم', password: 'long-password', role: 'class_servant', email: 'a@b.com' }).error);
});

test('patch preserves the existing contact when the other contact is edited', () => {
  const result = validateUserPatch({ email: ' NEW@EXAMPLE.COM ' }, { email: 'old@example.com', phone: null });
  assert.equal(result.error, undefined);
  assert.equal(result.value.email, 'new@example.com');
  assert.equal(result.value.phone, null);
});

test('patch can clear one contact only while retaining the other', () => {
  const result = validateUserPatch({ email: '   ' }, { email: 'old@example.com', phone: '+201001234567' });
  assert.equal(result.error, undefined);
  assert.equal(result.value.email, null);
  assert.equal(result.value.phone, '+201001234567');
});

test('patch cannot clear both contact methods', () => {
  const result = validateUserPatch({ email: ' ', phone: null }, { email: 'old@example.com', phone: '01001234567' });
  assert.match(result.error, /يجب إدخال البريد/);
});
