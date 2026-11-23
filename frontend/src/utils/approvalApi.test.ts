/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { autodeleteApi, deletionApi, policyengineApi } from './api';
import {
  APPROVAL_READ_ROLES,
  APPROVER_ROLES,
  ApprovalShapeError,
  MIN_JUSTIFICATION_LENGTH,
  RESTORE_ROLES,
  SOFT_DELETE_LIST_ROLES,
  abilityFor,
  approvalProgress,
  assetLabel,
  canApprove,
  canBreakGlassRole,
  canListSoftDeletes,
  canReadApprovals,
  canRestore,
  classLabel,
  countPending,
  describeApprovalError,
  describeApprovalWithdrawal,
  describeRestoreError,
  describeRestoreReason,
  fetchApproval,
  fetchApprovals,
  fetchInbox,
  fetchSoftDeletes,
  formatUtcMinute,
  requesterLabel,
  restoreSoftDeleted,
  ruleTimingLines,
  describeRestoreSuccess,
  RULE_STATES,
  RESTORABLE_STATES,
  SOFT_DELETE_LABELS,
  statusView,
  submitBreakGlass,
  submitDecision,
  validateComment,
  validateJustification,
  type ApprovalRequestView,
} from './approvalApi';

vi.mock('./api', () => ({
  policyengineApi: { get: vi.fn(), post: vi.fn() },
  deletionApi: { get: vi.fn(), post: vi.fn() },
  autodeleteApi: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('../keycloak', () => ({ default: {} }));

const pe = policyengineApi as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
const del = deletionApi as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
const autodel = autodeleteApi as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

const ID = '0d4f9c40-1a2b-3c4d-8e5f-000000000002';
const ALICE = '7d0e6c55-0000-4000-8000-00000000a11c';

function view(overrides: Partial<ApprovalRequestView> = {}): ApprovalRequestView {
  return {
    id: ID,
    status: 'PENDING',
    actionClass: 'HARD_DELETE',
    actionType: 'delete',
    assetId: '11111111-1111-4111-8111-111111111111',
    assetUri: 'gs://orders-raw',
    approvals: 0,
    requiredApprovals: 2,
    requestedBy: 'policy:9',
    requesterKind: 'POLICY',
    submittedBy: 'da-policyengine',
    excludedSubjects: ['policy:9', 'da-policyengine'],
    decisions: [],
    ...overrides,
  };
}

const failure = (status: number, data: Record<string, unknown> = {}) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

describe('role helpers', () => {
  it.each(APPROVER_ROLES)('lets %s decide', (role) => {
    expect(canApprove([role])).toBe(true);
    expect(canReadApprovals([role])).toBe(true);
  });

  it.each([['ROLE_DATA_ENGINEER'], ['ROLE_DATA_SCIENTIST'], ['ROLE_AUDITOR']])('lets %s read but not decide', (role) => {
    expect(canApprove([role])).toBe(false);
    expect(canReadApprovals([role])).toBe(true);
  });

  it.each([[[]], [['ROLE_VIEWER']], [['ROLE_DATA_ANALYST']], [['offline_access']]])('keeps %j out', (roles) => {
    expect(canApprove(roles)).toBe(false);
    expect(canReadApprovals(roles)).toBe(false);
  });

  it('never lets a machine decide or read, even with a human role', () => {
    expect(canApprove(['ROLE_ADMIN', 'ROLE_SERVICE_ACCOUNT'])).toBe(false);
    expect(canReadApprovals(['ROLE_ADMIN', 'ROLE_SERVICE_ACCOUNT'])).toBe(false);
    expect(canBreakGlassRole(['ROLE_ADMIN', 'ROLE_SERVICE_ACCOUNT'])).toBe(false);
    expect(canRestore(['ROLE_ADMIN', 'ROLE_SERVICE_ACCOUNT'])).toBe(false);
    expect(canListSoftDeletes(['ROLE_ADMIN', 'ROLE_SERVICE_ACCOUNT'])).toBe(false);
  });

  it('allows break-glass for ADMIN only', () => {
    expect(canBreakGlassRole(['ROLE_ADMIN'])).toBe(true);
    for (const role of ['ROLE_CDO', 'ROLE_DIRECTOR', 'ROLE_POLICY_MANAGER', 'ROLE_AUDITOR']) {
      expect(canBreakGlassRole([role])).toBe(false);
    }
  });

  it('keeps the read list a superset of the approver list', () => {
    for (const role of APPROVER_ROLES) {
      expect(APPROVAL_READ_ROLES).toContain(role);
    }
  });

  it('mirrors the restore and list roles of da-autodelete', () => {
    expect([...RESTORE_ROLES].sort()).toEqual(['ROLE_ADMIN', 'ROLE_DIRECTOR', 'ROLE_POLICY_MANAGER']);
    expect([...SOFT_DELETE_LIST_ROLES].sort()).toEqual([
      'ROLE_ADMIN',
      'ROLE_CDO',
      'ROLE_DATA_ENGINEER',
      'ROLE_DIRECTOR',
      'ROLE_POLICY_MANAGER',
    ]);
    expect(canRestore(['ROLE_DIRECTOR'])).toBe(true);
    expect(canRestore(['ROLE_CDO'])).toBe(false);
    expect(canListSoftDeletes(['ROLE_CDO'])).toBe(true);
    expect(canListSoftDeletes(['ROLE_DIRECTOR'])).toBe(true);
    expect(canListSoftDeletes(['ROLE_POLICY_MANAGER'])).toBe(true);
  });

  it('lets everyone who can restore also list what to restore (Q-624)', () => {
    for (const role of RESTORE_ROLES) {
      expect(SOFT_DELETE_LIST_ROLES).toContain(role);
      expect(canListSoftDeletes([role])).toBe(true);
    }
    expect(canListSoftDeletes(['ROLE_AUDITOR'])).toBe(false);
  });
});

describe('abilityFor', () => {
  const approver = { id: ALICE, roles: ['ROLE_CDO'] };

  it('offers approve and reject to an eligible approver of a pending request', () => {
    expect(abilityFor(view(), approver)).toEqual({ canDecide: true, canBreakGlass: false, reason: null });
  });

  it('adds break-glass for an ADMIN', () => {
    expect(abilityFor(view(), { id: ALICE, roles: ['ROLE_ADMIN'] })).toEqual({ canDecide: true, canBreakGlass: true, reason: null });
  });

  it('hides everything and says nothing for a closed request', () => {
    for (const status of ['APPROVED', 'APPROVED_BREAK_GLASS', 'REJECTED', 'EXPIRED']) {
      expect(abilityFor(view({ status }), approver)).toEqual({ canDecide: false, canBreakGlass: false, reason: null });
    }
  });

  it('hides the controls from the requester, the submitter and a listed policy author', () => {
    for (const field of [{ requestedBy: ALICE }, { submittedBy: ALICE }, { excludedSubjects: [ALICE] }]) {
      const ability = abilityFor(view(field), approver);
      expect(ability.canDecide).toBe(false);
      expect(ability.canBreakGlass).toBe(false);
      expect(ability.reason).toContain('you asked for it, submitted it, or wrote its policy');
    }
  });

  it('hides the break-glass control from an ADMIN who is a party', () => {
    const ability = abilityFor(view({ excludedSubjects: [ALICE] }), { id: ALICE, roles: ['ROLE_ADMIN'] });
    expect(ability.canBreakGlass).toBe(false);
  });

  it('hides the controls from someone who already decided', () => {
    const decided = view({ decisions: [{ approverSub: ALICE, decision: 'APPROVE', comment: 'ok' }] });
    expect(abilityFor(decided, approver)).toEqual({ canDecide: false, canBreakGlass: false, reason: 'You have already decided this request.' });
  });

  it('hides the controls from a role that cannot decide', () => {
    expect(abilityFor(view(), { id: ALICE, roles: ['ROLE_AUDITOR'] }).reason).toBe('Your role cannot decide approval requests.');
  });

  it('hides the controls from a machine with a human role', () => {
    expect(abilityFor(view(), { id: ALICE, roles: ['ROLE_ADMIN', 'ROLE_SERVICE_ACCOUNT'] }).canDecide).toBe(false);
  });

  it('hides the controls when the token has no subject', () => {
    expect(abilityFor(view(), { id: '', roles: ['ROLE_ADMIN'] }).canDecide).toBe(false);
  });

  it('copes with a request that carries no party lists', () => {
    const bare: ApprovalRequestView = { id: ID, status: 'PENDING' };
    expect(abilityFor(bare, approver).canDecide).toBe(true);
  });
});

describe('validation', () => {
  it('requires a non-blank comment', () => {
    expect(validateComment('')).toBe('A comment is required.');
    expect(validateComment('   \n ')).toBe('A comment is required.');
    expect(validateComment(' ok ')).toBeNull();
  });

  it('caps the comment at the configurable ceiling', () => {
    expect(validateComment('x'.repeat(10000))).toBeNull();
    expect(validateComment('x'.repeat(10001))).toContain('at most 10000');
  });

  it('requires 20 trimmed characters for break-glass', () => {
    expect(MIN_JUSTIFICATION_LENGTH).toBe(20);
    expect(validateJustification('x'.repeat(19))).toContain('19 so far');
    expect(validateJustification('x'.repeat(20))).toBeNull();
    expect(validateJustification(`   ${'x'.repeat(19)}   `)).toContain('19 so far');
    expect(validateJustification('x'.repeat(10001))).toContain('at most 10000');
  });
});

describe('wording', () => {
  it('names every state of the spec and passes an unknown one through', () => {
    expect(statusView('PENDING')).toEqual({ label: 'Waiting for decisions', variant: 'warning' });
    expect(statusView('APPROVED').variant).toBe('success');
    expect(statusView('APPROVED_BREAK_GLASS').variant).toBe('error');
    expect(statusView('REJECTED').label).toBe('Rejected');
    expect(statusView('EXPIRED').label).toBe('Expired');
    expect(statusView('WITHDRAWN')).toEqual({ label: 'Withdrawn', variant: 'neutral' });
    expect(statusView('NEW_STATE')).toEqual({ label: 'NEW_STATE', variant: 'neutral' });
    expect(statusView(undefined).label).toBe('-');
  });

  it('names the action classes', () => {
    expect(classLabel('HARD_DELETE')).toBe('Hard delete');
    expect(classLabel('SOFT_DELETE')).toBe('Soft delete');
    expect(classLabel('ARCHIVE')).toBe('Archive');
    expect(classLabel('OTHER')).toBe('Other action');
    expect(classLabel('X')).toBe('X');
    expect(classLabel(undefined)).toBe('-');
  });

  it('shows progress, and a dash when a number is missing', () => {
    expect(approvalProgress(view({ approvals: 1, requiredApprovals: 2 }))).toBe('1 of 2');
    expect(approvalProgress(view({ approvals: 0, requiredApprovals: 1 }))).toBe('0 of 1');
    expect(approvalProgress({ id: ID })).toBe('-');
  });

  it('names a policy requester and passes a person through', () => {
    expect(requesterLabel(view({ policyName: 'Old logs' }))).toBe('Policy Old logs');
    expect(requesterLabel(view({ policyName: undefined, policyId: 'pol-1' }))).toBe('Policy pol-1');
    expect(requesterLabel(view({ requesterKind: 'USER', requestedBy: ALICE }))).toBe(ALICE);
    expect(requesterLabel({ id: ID })).toBe('-');
  });

  it('prefers the asset URI over its id', () => {
    expect(assetLabel(view())).toBe('gs://orders-raw');
    expect(assetLabel(view({ assetUri: undefined }))).toBe('11111111-1111-4111-8111-111111111111');
    expect(assetLabel({ id: ID })).toBe('-');
  });

  it('formats a time in UTC to the minute, with a dash for nothing or nonsense', () => {
    expect(formatUtcMinute('2026-10-21T09:14:03.120004Z')).toBe('2026-10-21 09:14 UTC');
    expect(formatUtcMinute(undefined)).toBe('-');
    expect(formatUtcMinute(null)).toBe('-');
    expect(formatUtcMinute('not a date')).toBe('-');
  });
});

describe('describeApprovalError', () => {
  it.each([
    ['self-approval', 403, 'you cannot decide a request you asked for'],
    ['not-an-approver', 403, 'not an approver role'],
    ['mfa-required', 403, 'multi-factor authentication'],
    ['no-subject', 403, 'no subject'],
    ['break-glass-disabled', 403, 'switched off'],
    ['on-behalf-refused', 403, 'only a service account'],
    ['not-found', 404, 'no longer exists'],
    ['not-pending', 409, 'already decided or closed'],
    ['expired', 409, 'expired'],
    ['already-decided', 409, 'already decided this request'],
    ['invalid', 400, 'not valid'],
  ])('explains reason %s', (reason, status, fragment) => {
    expect(describeApprovalError(failure(status, { reason }))).toContain(fragment);
  });

  it('appends a server message that adds something', () => {
    const text = describeApprovalError(failure(403, { reason: 'self-approval', message: 'sub 7d0e is the requester' }));
    expect(text).toContain('(sub 7d0e is the requester)');
  });

  it('falls back on the status when the reason is unknown', () => {
    expect(describeApprovalError(failure(403, { message: 'nope' }))).toBe('Refused: nope');
    expect(describeApprovalError(failure(403))).toBe('Refused: your role may not do this.');
    expect(describeApprovalError(failure(409, { message: 'moved' }))).toBe('Conflict: moved');
    expect(describeApprovalError(failure(409))).toContain('no longer in a state');
    expect(describeApprovalError(failure(404))).toContain('no longer exists');
    expect(describeApprovalError(failure(400, { message: 'comment too long' }))).toBe('Not accepted: comment too long');
    expect(describeApprovalError(failure(500))).toBe('The policy engine answered an error (HTTP 500).');
  });

  it('says so when nothing answered', () => {
    expect(describeApprovalError(new Error('Network Error'))).toContain('could not be reached');
    expect(describeApprovalError(undefined)).toContain('could not be reached');
  });

  it('passes a shape error through', () => {
    expect(describeApprovalError(new ApprovalShapeError('bad body'))).toBe('bad body');
  });
});

describe('describeRestoreError', () => {
  it('explains 403, 409, 404 and a missing answer', () => {
    expect(describeRestoreError(failure(403))).toContain('ADMIN, POLICY_MANAGER or DIRECTOR');
    expect(describeRestoreError(failure(409, { status: 'NOT_RESTORABLE', reason: 'Record not found, or already in a terminal state.' }))).toBe(
      'Not restorable: Record not found, or already in a terminal state.'
    );
    expect(describeRestoreError(failure(409))).toContain('no longer in its soft-delete window');
    expect(describeRestoreError(failure(404))).toContain('no longer exists');
    expect(describeRestoreError(failure(500))).toContain('HTTP 500');
    expect(describeRestoreError(new Error('Network Error'))).toContain('could not be reached');
  });
});

describe('restore wording (Q-681, Q-696)', () => {
  it.each([
    ['WITHDRAWN', 'The pending hard-delete approval was withdrawn.'],
    [
      'APPROVAL_ALREADY_DECIDED:APPROVED',
      'The pending hard-delete approval had already been decided (APPROVED), so it was not withdrawn. A restored record is never deleted.',
    ],
    [
      'APPROVAL_ALREADY_DECIDED:unknown',
      'The pending hard-delete approval had already been decided, so it was not withdrawn. A restored record is never deleted.',
    ],
    [
      'ENDPOINT_NOT_AVAILABLE:http-404',
      'The policy engine cannot withdraw approvals, so the hard-delete request stays until it is decided or expires. A restored record is never deleted.',
    ],
    ['REQUEST_NOT_FOUND', 'The policy engine does not know the hard-delete request, so nothing waits on it.'],
    [
      'REFUSED:self-approval',
      'The policy engine refused to withdraw the hard-delete approval (self-approval). The restore stands. A restored record is never deleted.',
    ],
    [
      'UNREACHABLE:http-503',
      'The policy engine could not be reached to withdraw the hard-delete approval. The restore stands. A restored record is never deleted.',
    ],
    ['SOMETHING_NEW:x', 'Approval withdrawal: SOMETHING_NEW:x.'],
  ])('words the withdrawal outcome %s as a plain sentence', (outcome, sentence) => {
    expect(describeApprovalWithdrawal(outcome)).toBe(sentence);
  });

  it('says nothing when no withdrawal was attempted', () => {
    expect(describeApprovalWithdrawal(null)).toBeNull();
    expect(describeApprovalWithdrawal('')).toBeNull();
    expect(describeApprovalWithdrawal('NOT_ATTEMPTED')).toBeNull();
    expect(describeApprovalWithdrawal('NOT_ATTEMPTED:no-approval')).toBeNull();
  });

  it('adds the withdrawal sentence and the rule sentence to the success text', () => {
    expect(describeRestoreSuccess('s3://b', { ruleRemoved: true, approvalWithdrawal: 'WITHDRAWN', message: null })).toBe(
      'Restored s3://b. The lifecycle rule was removed. Objects it already expired are gone and are not restored. The pending hard-delete approval was withdrawn.'
    );
    expect(describeRestoreSuccess('gs://x', { ruleRemoved: false, approvalWithdrawal: 'NOT_ATTEMPTED', message: null })).toBe('Restored gs://x.');
  });

  it.each([
    ['record-not-found', 'this soft-delete record does not exist.'],
    ['record-is-HARD_DELETED', 'the asset was already hard-deleted and cannot be taken back.'],
    ['record-is-HARD_DELETE_FAILED', 'the hard delete was attempted and failed, and what it deleted cannot be taken back.'],
    ['record-is-AWAITING_PROOF', 'the delete was applied and is waiting for its proof, so it cannot be taken back.'],
    ['record-is-RULE_ENDED', 'the lifecycle rule already ended, so there is no rule left to remove.'],
    ['record-is-RULE_ENDED_UNPROVEN', 'the lifecycle rule already ended without proof that it fired, so there is no rule left to remove.'],
    ['record-is-RESTORE_FAILED', "an earlier restore could not find DLAP's rule. Check the lifecycle configuration of the bucket."],
    ['record-is-RESTORED', 'the record was already restored.'],
    ['record-is-SOMETHING_NEW', 'the record is SOMETHING_NEW, which cannot be restored.'],
    ['rule-removal-failed', 'the lifecycle rule could not be removed, so nothing changed and objects keep expiring. Try again later.'],
  ])('words the restore reason %s', (code, sentence) => {
    expect(describeRestoreReason(code)).toBe(sentence);
  });

  it('knows no sentence for a reason it was not given', () => {
    expect(describeRestoreReason('something-else')).toBeNull();
    expect(describeRestoreReason('')).toBeNull();
  });

  it.each([
    [
      'record-not-found: No such soft-delete record.',
      'Not restorable: This soft-delete record does not exist. (No such soft-delete record.)',
    ],
    [
      'record-is-HARD_DELETED: The cloud deletion was already applied.',
      'Not restorable: The asset was already hard-deleted and cannot be taken back. (The cloud deletion was already applied.)',
    ],
    [
      'rule-removal-failed: The lifecycle rule could not be removed, so the record is unchanged: no stored rule to remove for record x',
      'Not restorable: The lifecycle rule could not be removed, so nothing changed and objects keep expiring. Try again later. (The lifecycle rule could not be removed, so the record is unchanged: no stored rule to remove for record x)',
    ],
    ['record-is-RULE_ENDED', 'Not restorable: The lifecycle rule already ended, so there is no rule left to remove.'],
    ['an-unknown-code: some sentence', 'Not restorable: an-unknown-code: some sentence'],
    ['Record not found, or already in a terminal state.', 'Not restorable: Record not found, or already in a terminal state.'],
  ])('shows the 409 reason %s in words', (reason, expected) => {
    expect(describeRestoreError(failure(409, { status: 'NOT_RESTORABLE', reason }))).toBe(expected);
  });

  it('words the rule-not-found answer of a restore that ended RESTORE_FAILED', () => {
    const text = describeRestoreError(failure(409, { status: 'RESTORE_FAILED', ruleRemoved: false, reason: "rule-not-found: DLAP's lifecycle rule was not found on the platform." }));
    expect(text).toContain("DLAP's lifecycle rule was not found on the platform, so nothing was removed");
    expect(text).toContain('(DLAP\'s lifecycle rule was not found on the platform.)');
    expect(text).not.toContain('rule-not-found');
  });
});

describe('requests to the approval API', () => {
  beforeEach(() => {
    pe.get.mockReset();
    pe.post.mockReset();
    del.get.mockReset();
    del.post.mockReset();
  });

  it('reads the inbox with paging', async () => {
    pe.get.mockResolvedValue({ data: { content: [view()], totalElements: 1, totalPages: 1, page: 0, size: 25 } });
    const page = await fetchInbox(2, 10);
    expect(pe.get).toHaveBeenCalledWith('/approvals/inbox', { params: { page: 2, size: 10 } });
    expect(page.content).toHaveLength(1);
  });

  it('refuses a body that is not a page', async () => {
    pe.get.mockResolvedValue({ data: { items: [] } });
    await expect(fetchInbox()).rejects.toBeInstanceOf(ApprovalShapeError);
    pe.get.mockResolvedValue({ data: null });
    await expect(fetchApprovals({ status: '', actionClass: '' })).rejects.toBeInstanceOf(ApprovalShapeError);
  });

  it('sends only the filters that carry a value', async () => {
    pe.get.mockResolvedValue({ data: { content: [] } });
    await fetchApprovals({ status: '', actionClass: '' });
    expect(pe.get).toHaveBeenLastCalledWith('/approvals', { params: { page: 0, size: 25 } });
    await fetchApprovals({ status: 'PENDING', actionClass: 'ARCHIVE' }, 1, 5);
    expect(pe.get).toHaveBeenLastCalledWith('/approvals', { params: { page: 1, size: 5, status: 'PENDING', actionClass: 'ARCHIVE' } });
  });

  it('reads one request by an encoded id and refuses a body that is not a request', async () => {
    pe.get.mockResolvedValue({ data: view() });
    expect((await fetchApproval(ID)).id).toBe(ID);
    expect(pe.get).toHaveBeenCalledWith(`/approvals/${ID}`);
    pe.get.mockResolvedValue({ data: { id: 5 } });
    await expect(fetchApproval('a/b')).rejects.toBeInstanceOf(ApprovalShapeError);
    expect(pe.get).toHaveBeenLastCalledWith('/approvals/a%2Fb');
  });

  it('counts pending requests across classes', async () => {
    pe.get.mockImplementation(async (_url: string, config: { params: { actionClass: string } }) => ({
      data: { content: [], totalElements: config.params.actionClass === 'SOFT_DELETE' ? 2 : 3 },
    }));
    expect(await countPending(['SOFT_DELETE', 'HARD_DELETE'])).toBe(5);
    expect(pe.get).toHaveBeenCalledWith('/approvals', { params: { page: 0, size: 1, status: 'PENDING', actionClass: 'HARD_DELETE' } });
  });

  it('posts a decision with a trimmed comment', async () => {
    pe.post.mockResolvedValue({ data: view({ approvals: 1 }) });
    const updated = await submitDecision(ID, 'APPROVE', '  Looks right  ');
    expect(pe.post).toHaveBeenCalledWith(`/approvals/${ID}/decisions`, { decision: 'APPROVE', comment: 'Looks right' });
    expect(updated.approvals).toBe(1);
    await submitDecision(ID, 'REJECT', 'No');
    expect(pe.post).toHaveBeenLastCalledWith(`/approvals/${ID}/decisions`, { decision: 'REJECT', comment: 'No' });
  });

  it('posts break-glass with a trimmed justification', async () => {
    pe.post.mockResolvedValue({ data: view({ status: 'APPROVED_BREAK_GLASS' }) });
    const updated = await submitBreakGlass(ID, '  The vendor deadline is tonight.  ');
    expect(pe.post).toHaveBeenCalledWith(`/approvals/${ID}/break-glass`, { justification: 'The vendor deadline is tonight.' });
    expect(updated.status).toBe('APPROVED_BREAK_GLASS');
  });

  it('lets the transport error through so the page can show the server reason', async () => {
    const refusal = failure(403, { reason: 'self-approval' });
    pe.post.mockRejectedValue(refusal);
    await expect(submitDecision(ID, 'APPROVE', 'x')).rejects.toBe(refusal);
  });
});

describe('soft-delete records and restore', () => {
  beforeEach(() => {
    del.get.mockReset();
    autodel.post.mockReset();
  });

  const task = (overrides: Record<string, unknown> = {}) => ({
    taskId: 'rec-1',
    taskName: 'gs://orders-raw',
    status: 'QUEUED',
    submittedAt: '2026-10-20T10:00:00',
    triggeredBy: 'old-logs',
    justification: 'retention',
    errorMessages: null,
    ...overrides,
  });

  it('lists records and maps the task statuses to soft-delete states', async () => {
    del.get.mockResolvedValue({
      data: {
        tasks: [
          task(),
          task({ taskId: 'rec-2', status: 'COMPLETED' }),
          task({ taskId: 'rec-3', status: 'FAILED', errorMessages: ['boom'] }),
          task({ taskId: 'rec-4', status: 'CANCELLED' }),
          task({ taskId: 'rec-5', status: 'SOMETHING_NEW' }),
          task({ taskId: null }),
          null,
        ],
        pageNumber: 1,
        totalPages: 3,
        totalElements: 25,
      },
    });
    const page = await fetchSoftDeletes(1, 10);
    expect(del.get).toHaveBeenCalledWith('/tasks', { params: { page: 1, size: 10 } });
    expect(page.records.map((r) => [r.recordId, r.state])).toEqual([
      ['rec-1', 'SOFT_DELETED'],
      ['rec-2', 'HARD_DELETED'],
      ['rec-3', 'HARD_DELETE_FAILED'],
      ['rec-4', 'RESTORED'],
      ['rec-5', 'UNKNOWN'],
    ]);
    expect(page.records[0]).toMatchObject({ assetUri: 'gs://orders-raw', policyId: 'old-logs', note: 'retention', scheduledHardDeleteAt: null });
    expect(page.records[2].lastError).toBe('boom');
    expect(page).toMatchObject({ page: 1, totalPages: 3, totalElements: 25 });
  });

  it('shows a dry run as its own state and never as a deletion (Q-636)', async () => {
    del.get.mockResolvedValue({
      data: {
        tasks: [
          task({ taskId: 'rec-dry', status: 'DRY_RUN', errorMessages: null }),
          task({ taskId: 'rec-rule', status: 'RULE_IN_FORCE' }),
        ],
      },
    });
    const page = await fetchSoftDeletes();
    expect(page.records.map((r) => [r.recordId, r.state])).toEqual([
      ['rec-dry', 'DRY_RUN'],
      ['rec-rule', 'RULE_IN_FORCE'],
    ]);
    expect(page.records[0].state).not.toBe('HARD_DELETED');
    expect(page.records[0].lastError).toBeNull();
    expect(SOFT_DELETE_LABELS.DRY_RUN).toBe('Dry run, nothing deleted');
    expect(SOFT_DELETE_LABELS.RULE_IN_FORCE).toBe('Lifecycle rule in force');
    expect(RESTORABLE_STATES).toEqual(['SOFT_DELETED', 'DRY_RUN', 'RULE_IN_FORCE', 'RULE_AWAITING_PROOF', 'HARD_DELETE_REFUSED']);
  });

  it('labels every state the task list can carry, with a distinct label each (Q-696)', async () => {
    del.get.mockResolvedValue({
      data: {
        tasks: [
          task({ taskId: 'a', status: 'RULE_IN_FORCE' }),
          task({ taskId: 'b', status: 'RULE_ENDED' }),
          task({ taskId: 'c', status: 'RULE_ENDED_UNPROVEN' }),
          task({ taskId: 'd', status: 'RESTORE_FAILED' }),
          task({ taskId: 'e', status: 'REJECTED' }),
          task({ taskId: 'f', status: 'IN_PROGRESS' }),
          task({ taskId: 'g', status: 'IN_PROGRESS', ruleAppliedAt: '2026-10-31T09:30:00Z' }),
        ],
      },
    });
    const page = await fetchSoftDeletes();
    expect(page.records.map((r) => r.state)).toEqual([
      'RULE_IN_FORCE',
      'RULE_ENDED',
      'RULE_ENDED_UNPROVEN',
      'RESTORE_FAILED',
      'HARD_DELETE_REFUSED',
      'AWAITING_PROOF',
      'RULE_AWAITING_PROOF',
    ]);
    expect(SOFT_DELETE_LABELS.RULE_IN_FORCE).toBe('Lifecycle rule in force');
    expect(SOFT_DELETE_LABELS.RULE_ENDED).toBe('Lifecycle rule ended');
    expect(SOFT_DELETE_LABELS.RULE_ENDED_UNPROVEN).toBe('Lifecycle rule ended, never proven');
    expect(SOFT_DELETE_LABELS.RESTORE_FAILED).toBe('Restore failed, rule not found');
    expect(SOFT_DELETE_LABELS.RULE_AWAITING_PROOF).toBe('Lifecycle rule applied, waiting for proof');
    expect(SOFT_DELETE_LABELS.AWAITING_PROOF).toBe('Delete applied, waiting for proof');
    expect(SOFT_DELETE_LABELS.HARD_DELETE_REFUSED).toBe('Hard delete refused, can be restored');
    const labels = Object.values(SOFT_DELETE_LABELS);
    expect(new Set(labels).size).toBe(labels.length);
    expect(RULE_STATES).toEqual(['RULE_IN_FORCE', 'RULE_AWAITING_PROOF']);
    // The end states and a delete that cannot be taken back are not offered a restore.
    for (const state of ['RULE_ENDED', 'RULE_ENDED_UNPROVEN', 'RESTORE_FAILED', 'AWAITING_PROOF', 'HARD_DELETED', 'HARD_DELETE_FAILED', 'RESTORED']) {
      expect(RESTORABLE_STATES).not.toContain(state);
    }
  });

  it('reads the rule age fields the task list carries and leaves them null otherwise (Q-696)', async () => {
    del.get.mockResolvedValue({
      data: {
        tasks: [
          task({ taskId: 'a', status: 'RULE_IN_FORCE', ruleAppliedAt: '2026-10-20T08:00:00Z', ruleAgeDays: 12, ruleEndsAt: '2026-11-19T08:00:00Z' }),
          task({ taskId: 'b', ruleAgeDays: 'twelve', ruleAppliedAt: '' }),
        ],
      },
    });
    const page = await fetchSoftDeletes();
    expect(page.records[0]).toMatchObject({ ruleAppliedAt: '2026-10-20T08:00:00Z', ruleAgeDays: 12, ruleEndsAt: '2026-11-19T08:00:00Z' });
    expect(page.records[1]).toMatchObject({ ruleAppliedAt: null, ruleAgeDays: null, ruleEndsAt: null });
  });

  it('words the rule timing from the delivered fields only (Q-696)', () => {
    expect(ruleTimingLines({ ruleAppliedAt: '2026-10-20T08:00:00Z', ruleAgeDays: 12, ruleEndsAt: '2026-11-19T08:00:00Z' })).toEqual([
      'Rule applied 2026-10-20 08:00 UTC, 12 days ago',
      'Rule ends 2026-11-19 08:00 UTC',
    ]);
    expect(ruleTimingLines({ ruleAppliedAt: '2026-10-20T08:00:00Z', ruleAgeDays: 1, ruleEndsAt: null })).toEqual([
      'Rule applied 2026-10-20 08:00 UTC, 1 day ago',
    ]);
    expect(ruleTimingLines({ ruleAppliedAt: '2026-10-20T08:00:00Z', ruleAgeDays: null, ruleEndsAt: null })).toEqual([
      'Rule applied 2026-10-20 08:00 UTC',
    ]);
    expect(ruleTimingLines({ ruleAppliedAt: null, ruleAgeDays: null, ruleEndsAt: null })).toBeNull();
  });

  it('keeps a hard-delete due time when the service sends one', async () => {
    del.get.mockResolvedValue({ data: { tasks: [task({ scheduledHardDeleteAt: '2026-11-19T10:00:00Z' })] } });
    expect((await fetchSoftDeletes()).records[0].scheduledHardDeleteAt).toBe('2026-11-19T10:00:00Z');
  });

  it('keeps the soft-delete window end as the ISO instant the service sends and null when it sends none (Q-623)', async () => {
    del.get.mockResolvedValue({
      data: { tasks: [task({ scheduledHardDeleteAt: '2026-11-09T10:15:30Z' }), task({ taskId: 'rec-2', scheduledHardDeleteAt: null })] },
    });
    const page = await fetchSoftDeletes();
    expect(page.records.map((r) => r.scheduledHardDeleteAt)).toEqual(['2026-11-09T10:15:30Z', null]);
  });

  it('shows a dash for a record without a name', async () => {
    del.get.mockResolvedValue({ data: { tasks: [task({ taskName: null })] } });
    const page = await fetchSoftDeletes();
    expect(page.records[0].assetUri).toBe('-');
    expect(page.totalElements).toBe(1);
  });

  it('refuses a body that is not a task list', async () => {
    del.get.mockResolvedValue({ data: { records: [] } });
    await expect(fetchSoftDeletes()).rejects.toBeInstanceOf(ApprovalShapeError);
  });

  it('restores through the autodelete path with only a note', async () => {
    autodel.post.mockResolvedValue({ data: { status: 'RESTORED' } });
    await restoreSoftDeleted('rec-1', '  mistake  ');
    const [url, body] = autodel.post.mock.calls[0];
    // The path is relative to the autodelete client, whose base is /api/v1/autodelete (utils/api.ts).
    expect(url).toBe('/restores/rec-1');
    expect(del.post).not.toHaveBeenCalled();
    expect(body).toEqual({ notes: 'mistake' });
    expect(Object.keys(body as object)).not.toContain('userId');
  });

  it('reads what the service says about a restore of a rule in force and a withdrawn approval', async () => {
    autodel.post.mockResolvedValue({
      data: { status: 'RESTORED', ruleRemoved: true, approvalWithdrawal: 'WITHDRAWN', message: 'The lifecycle rule was removed.' },
    });
    const result = await restoreSoftDeleted('rec-1', 'mistake');
    expect(result).toEqual({ ruleRemoved: true, approvalWithdrawal: 'WITHDRAWN', message: 'The lifecycle rule was removed.' });
    expect(describeRestoreSuccess('s3://b', result)).toBe(
      'Restored s3://b. The lifecycle rule was removed. Objects it already expired are gone and are not restored. The pending hard-delete approval was withdrawn.'
    );
    autodel.post.mockResolvedValue({ data: { status: 'RESTORED' } });
    const plain = await restoreSoftDeleted('rec-2', 'mistake');
    expect(plain).toEqual({ ruleRemoved: false, approvalWithdrawal: null, message: null });
    expect(describeRestoreSuccess('gs://x', plain)).toBe('Restored gs://x.');
  });
});
