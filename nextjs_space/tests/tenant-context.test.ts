import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildThreatScope,
  canAssignDepartment,
  hasPermission,
  type TenantContext,
} from '../lib/tenant-context';

function context(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    source: 'session',
    userId: 'user-1',
    email: null,
    organizationId: 'org-1',
    role: 'ANALYST',
    departmentId: null,
    parentOrganizationId: null,
    permissions: [],
    ...overrides,
  };
}

test('organization users are always scoped to their organization', () => {
  assert.deepEqual(buildThreatScope(context()), { organizationId: 'org-1' });
});

test('department users can see their department and organization-wide threats', () => {
  assert.deepEqual(buildThreatScope(context({ departmentId: 'dept-1' })), {
    organizationId: 'org-1',
    OR: [{ departmentId: 'dept-1' }, { departmentId: null }],
  });
});

test('viewer is read-only', () => {
  const viewer = context({ role: 'VIEWER' });
  assert.equal(hasPermission(viewer, 'threats.read'), true);
  assert.equal(hasPermission(viewer, 'threats.create'), false);
  assert.equal(hasPermission(viewer, 'threats.update'), false);
  assert.equal(hasPermission(viewer, 'threats.delete'), false);
});

test('analyst can work threats but cannot delete them', () => {
  const analyst = context({ role: 'ANALYST' });
  assert.equal(hasPermission(analyst, 'threats.read'), true);
  assert.equal(hasPermission(analyst, 'threats.create'), true);
  assert.equal(hasPermission(analyst, 'threats.update'), true);
  assert.equal(hasPermission(analyst, 'threats.delete'), false);
});

test('organization admin can delete and assign departments', () => {
  const admin = context({ role: 'ADMIN' });
  assert.equal(hasPermission(admin, 'threats.delete'), true);
  assert.equal(canAssignDepartment(admin), true);
});

test('department admin cannot assign an arbitrary department', () => {
  assert.equal(canAssignDepartment(context({ role: 'DEPARTMENT_ADMIN' })), false);
});
