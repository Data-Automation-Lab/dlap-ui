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

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { quietConsole, type StubClient } from '../pages/__tests__/testUtils';
import { autodeleteApi, deletionApi, policyengineApi } from '../utils/api';
import { PendingApprovalsNotice, SoftDeleteRestorePanel } from './ApprovalPanels';

const kc = vi.hoisted(() => ({
  authenticated: true,
  token: 'test-token',
  tokenParsed: undefined as undefined | Record<string, unknown>,
  updateToken: vi.fn(),
  login: vi.fn(),
  onAuthSuccess: undefined,
  onAuthRefreshSuccess: undefined,
  onAuthLogout: undefined,
}));

vi.mock('../keycloak', () => ({ default: kc }));
vi.mock('../utils/api', async () => (await import('../pages/__tests__/testUtils')).makeApiMock());

const pe = policyengineApi as unknown as StubClient;
const del = deletionApi as unknown as StubClient;
const autodel = autodeleteApi as unknown as StubClient;

function setRoles(roles: string[]) {
  kc.tokenParsed = { sub: 'me', realm_access: { roles } };
}

const failure = (status: number, data: Record<string, unknown> = {}) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

function Probe() {
  return <span data-testid="path">{useLocation().pathname}</span>;
}

const renderIn = (ui: React.ReactElement) =>
  render(
    <MemoryRouter initialEntries={['/delete-agent-overview']}>
      {ui}
      <Probe />
    </MemoryRouter>
  );

describe('PendingApprovalsNotice', () => {
  beforeEach(() => {
    quietConsole();
    pe.get.mockReset();
    setRoles(['ROLE_CDO']);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const counting = (perClass: Record<string, number>) =>
    pe.get.mockImplementation(async (_url: string, config: { params: { actionClass: string } }) => ({
      data: { content: [], totalElements: perClass[config.params.actionClass] ?? 0 },
    }));

  it('asks for the pending requests of each class the page cares about and shows the sum', async () => {
    counting({ SOFT_DELETE: 2, HARD_DELETE: 1 });
    renderIn(<PendingApprovalsNotice actionClasses={['SOFT_DELETE', 'HARD_DELETE']} />);
    expect(await screen.findByText('3 requests are waiting for approval before anything runs.')).toBeTruthy();
    expect(pe.get).toHaveBeenCalledWith('/approvals', { params: { page: 0, size: 1, status: 'PENDING', actionClass: 'SOFT_DELETE' } });
    expect(pe.get).toHaveBeenCalledWith('/approvals', { params: { page: 0, size: 1, status: 'PENDING', actionClass: 'HARD_DELETE' } });
  });

  it('uses the singular for one request and opens the inbox on click', async () => {
    counting({ ARCHIVE: 1 });
    renderIn(<PendingApprovalsNotice actionClasses={['ARCHIVE']} />);
    expect(await screen.findByText('1 request is waiting for approval before anything runs.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open approvals' }));
    expect(screen.getByTestId('path').textContent).toBe('/approvals');
  });

  it('shows nothing while nothing waits', async () => {
    counting({});
    renderIn(<PendingApprovalsNotice actionClasses={['ARCHIVE']} />);
    await waitFor(() => expect(pe.get).toHaveBeenCalled());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each([[[]], [['ROLE_VIEWER']], [['ROLE_SERVICE_ACCOUNT']]])('makes no request for roles %j', (roles) => {
    setRoles(roles);
    counting({ ARCHIVE: 5 });
    renderIn(<PendingApprovalsNotice actionClasses={['ARCHIVE']} />);
    expect(pe.get).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('stays out of the way when the count cannot be read', async () => {
    pe.get.mockRejectedValue(failure(500));
    renderIn(<PendingApprovalsNotice actionClasses={['ARCHIVE']} />);
    await waitFor(() => expect(console.warn).toHaveBeenCalled());
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('SoftDeleteRestorePanel', () => {
  beforeEach(() => {
    quietConsole();
    del.get.mockReset();
    autodel.post.mockReset();
    setRoles(['ROLE_ADMIN']);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const task = (overrides: Record<string, unknown> = {}) => ({
    taskId: 'rec-1',
    taskName: 'gs://orders-raw',
    status: 'QUEUED',
    submittedAt: '2026-10-20T10:00:00',
    ...overrides,
  });
  const listOf = (tasks: unknown[], extra: Record<string, unknown> = {}) => ({
    tasks,
    pageNumber: 0,
    totalPages: 1,
    totalElements: tasks.length,
    ...extra,
  });

  it.each([['ROLE_AUDITOR'], ['ROLE_VIEWER'], ['ROLE_SERVICE_ACCOUNT']])(
    'renders nothing and asks nothing for %s, which cannot list soft-delete records',
    (role) => {
      setRoles([role]);
      del.get.mockResolvedValue({ data: listOf([task()]) });
      renderIn(<SoftDeleteRestorePanel />);
      expect(del.get).not.toHaveBeenCalled();
      expect(screen.queryByRole('region', { name: 'Restore soft-deleted assets' })).toBeNull();
    }
  );

  it('lists the records and offers Restore only for the soft-deleted state', async () => {
    del.get.mockResolvedValue({
      data: listOf([
        task(),
        task({ taskId: 'rec-2', taskName: 'gs://clicks', status: 'COMPLETED' }),
        task({ taskId: 'rec-3', taskName: 'gs://logs', status: 'FAILED' }),
        task({ taskId: 'rec-4', taskName: 'gs://tmp', status: 'CANCELLED' }),
      ]),
    });
    renderIn(<SoftDeleteRestorePanel />);
    const table = await screen.findByRole('table', { name: 'Soft-deleted assets' });
    expect(del.get).toHaveBeenCalledWith('/tasks', { params: { page: 0, size: 10 } });
    expect(within(table).getByText('Soft-deleted, can be restored')).toBeTruthy();
    expect(within(table).getByText('Hard-deleted')).toBeTruthy();
    expect(within(table).getByText('Hard delete failed')).toBeTruthy();
    expect(within(table).getByText('Restored')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Restore / })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Restore gs://orders-raw' })).toBeTruthy();
  });

  it.each([['ROLE_DIRECTOR'], ['ROLE_POLICY_MANAGER']])(
    'lets %s find what to restore and restore it (Q-624)',
    async (role) => {
      setRoles([role]);
      del.get.mockResolvedValue({ data: listOf([task()]) });
      renderIn(<SoftDeleteRestorePanel />);
      await screen.findByRole('table', { name: 'Soft-deleted assets' });
      expect(del.get).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Restore gs://orders-raw' })).toBeTruthy();
    }
  );

  it('shows a dry run with its own badge, not as a deletion, and without an error (Q-636)', async () => {
    del.get.mockResolvedValue({
      data: listOf([task({ taskId: 'rec-dry', taskName: 'gs://dry-bucket', status: 'DRY_RUN', errorMessages: null })]),
    });
    renderIn(<SoftDeleteRestorePanel />);
    const table = await screen.findByRole('table', { name: 'Soft-deleted assets' });
    expect(within(table).getByText('Dry run, nothing deleted')).toBeTruthy();
    expect(within(table).queryByText('Hard-deleted')).toBeNull();
    expect(within(table).queryByText(/DRY-RUN: no cloud call/)).toBeNull();
  });

  it('offers Restore for a lifecycle rule in force and warns that expired objects are gone (Q-631)', async () => {
    del.get.mockResolvedValueOnce({
      data: listOf([task({ taskId: 'rec-rule', taskName: 's3://orders-bucket', status: 'RULE_IN_FORCE' })]),
    });
    renderIn(<SoftDeleteRestorePanel />);
    const table = await screen.findByRole('table', { name: 'Soft-deleted assets' });
    expect(within(table).getByText('Lifecycle rule in force')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restore s3://orders-bucket' }));
    const form = screen.getByRole('form', { name: 'Restore this asset' });
    expect(within(form).getByRole('note').textContent).toContain('already expired are gone');
    fireEvent.change(within(form).getByLabelText('Restore note'), { target: { value: 'Kept by mistake' } });
    autodel.post.mockResolvedValue({
      data: { status: 'RESTORED', ruleRemoved: true, message: 'The lifecycle rule was removed.' },
    });
    del.get.mockResolvedValue({ data: listOf([task({ taskId: 'rec-rule', taskName: 's3://orders-bucket', status: 'CANCELLED' })]) });
    fireEvent.click(within(form).getByRole('button', { name: 'Confirm restore' }));
    expect(await screen.findByText(/The lifecycle rule was removed\. Objects it already expired are gone/)).toBeTruthy();
  });

  it('does not warn about a rule when the record is only soft-deleted', async () => {
    del.get.mockResolvedValueOnce({ data: listOf([task()]) });
    renderIn(<SoftDeleteRestorePanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Restore gs://orders-raw' }));
    expect(within(screen.getByRole('form', { name: 'Restore this asset' })).queryByRole('note')).toBeNull();
  });

  it('shows the hard-delete due time when the service delivers one, and a dash when it does not', async () => {
    del.get.mockResolvedValue({
      data: listOf([task({ scheduledHardDeleteAt: '2026-11-19T10:00:00Z' }), task({ taskId: 'rec-2', taskName: 'gs://clicks' })]),
    });
    renderIn(<SoftDeleteRestorePanel />);
    const table = await screen.findByRole('table', { name: 'Soft-deleted assets' });
    expect(within(table).getByText('2026-11-19 10:00 UTC')).toBeTruthy();
    expect(within(table).getAllByText('-').length).toBeGreaterThanOrEqual(1);
  });

  it('shows when the soft-delete window closes under its own heading (Q-623)', async () => {
    del.get.mockResolvedValue({
      data: listOf([task({ scheduledHardDeleteAt: '2026-11-09T10:15:30Z' })]),
    });
    renderIn(<SoftDeleteRestorePanel />);
    const table = await screen.findByRole('table', { name: 'Soft-deleted assets' });
    expect(within(table).getByRole('columnheader', { name: 'Window closes' })).toBeTruthy();
    expect(within(table).getByText('2026-11-09 10:15 UTC')).toBeTruthy();
  });

  it('labels the end states of a rule and a failed restore, and offers no Restore for them (Q-696)', async () => {
    del.get.mockResolvedValue({
      data: listOf([
        task({ taskId: 'r1', taskName: 's3://ended', status: 'RULE_ENDED' }),
        task({ taskId: 'r2', taskName: 's3://unproven', status: 'RULE_ENDED_UNPROVEN' }),
        task({ taskId: 'r3', taskName: 'gs://lost', status: 'RESTORE_FAILED' }),
        task({ taskId: 'r4', taskName: 'gs://engine', status: 'IN_PROGRESS' }),
      ]),
    });
    renderIn(<SoftDeleteRestorePanel />);
    const table = await screen.findByRole('table', { name: 'Soft-deleted assets' });
    expect(within(table).getByText('Lifecycle rule ended')).toBeTruthy();
    expect(within(table).getByText('Lifecycle rule ended, never proven')).toBeTruthy();
    expect(within(table).getByText('Restore failed, rule not found')).toBeTruthy();
    expect(within(table).getByText('Delete applied, waiting for proof')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Restore / })).toBeNull();
  });

  it('shows the age and end of a rule in force, and of an applied rule waiting for proof (Q-696, Q-746)', async () => {
    del.get.mockResolvedValue({
      data: listOf([
        task({
          taskId: 'r1',
          taskName: 's3://in-force',
          status: 'RULE_IN_FORCE',
          ruleAppliedAt: '2026-10-20T08:00:00Z',
          ruleAgeDays: 12,
          ruleEndsAt: '2026-11-19T08:00:00Z',
        }),
        task({
          taskId: 'r2',
          taskName: 'gs://waiting',
          status: 'IN_PROGRESS',
          ruleAppliedAt: '2026-10-31T09:30:00Z',
          ruleAgeDays: 1,
          ruleEndsAt: '2026-11-30T09:30:00Z',
        }),
      ]),
    });
    renderIn(<SoftDeleteRestorePanel />);
    const table = await screen.findByRole('table', { name: 'Soft-deleted assets' });
    expect(within(table).getByText('Rule applied 2026-10-20 08:00 UTC, 12 days ago')).toBeTruthy();
    expect(within(table).getByText('Rule ends 2026-11-19 08:00 UTC')).toBeTruthy();
    expect(within(table).getByText('Lifecycle rule applied, waiting for proof')).toBeTruthy();
    expect(within(table).getByText('Rule applied 2026-10-31 09:30 UTC, 1 day ago')).toBeTruthy();
    expect(within(table).getByText('Rule ends 2026-11-30 09:30 UTC')).toBeTruthy();
    // Both hold a rule on the platform, so both can be restored.
    expect(screen.getByRole('button', { name: 'Restore s3://in-force' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restore gs://waiting' })).toBeTruthy();
  });

  it('warns about expired objects before restoring an applied rule that waits for proof (Q-696)', async () => {
    del.get.mockResolvedValueOnce({
      data: listOf([task({ taskId: 'r2', taskName: 'gs://waiting', status: 'IN_PROGRESS', ruleAppliedAt: '2026-10-31T09:30:00Z' })]),
    });
    renderIn(<SoftDeleteRestorePanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Restore gs://waiting' }));
    const form = screen.getByRole('form', { name: 'Restore this asset' });
    expect(within(form).getByRole('note').textContent).toContain('already expired are gone');
  });

  it('offers Restore for a refused hard delete, which the service can restore (Q-681)', async () => {
    del.get.mockResolvedValue({ data: listOf([task({ status: 'REJECTED' })]) });
    renderIn(<SoftDeleteRestorePanel />);
    const table = await screen.findByRole('table', { name: 'Soft-deleted assets' });
    expect(within(table).getByText('Hard delete refused, can be restored')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restore gs://orders-raw' })).toBeTruthy();
  });

  it('says in plain words why a restore is refused and keeps the server sentence as detail (Q-681)', async () => {
    del.get.mockResolvedValueOnce({ data: listOf([task()]) });
    renderIn(<SoftDeleteRestorePanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Restore gs://orders-raw' }));
    fireEvent.change(screen.getByLabelText('Restore note'), { target: { value: 'Too late?' } });
    autodel.post.mockRejectedValue(
      failure(409, { status: 'NOT_RESTORABLE', reason: 'record-is-HARD_DELETED: The cloud deletion was already applied.' })
    );
    del.get.mockResolvedValue({ data: listOf([task({ status: 'COMPLETED' })]) });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm restore' }));
    const alert = await screen.findByText(/Not restorable: The asset was already hard-deleted and cannot be taken back\./);
    expect(alert.textContent).toContain('(The cloud deletion was already applied.)');
    expect(alert.textContent).not.toContain('record-is-HARD_DELETED');
  });

  it('says what became of the pending hard-delete approval after a restore (Q-696)', async () => {
    del.get.mockResolvedValueOnce({ data: listOf([task()]) });
    renderIn(<SoftDeleteRestorePanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Restore gs://orders-raw' }));
    fireEvent.change(screen.getByLabelText('Restore note'), { target: { value: 'Mistake' } });
    autodel.post.mockResolvedValue({ data: { status: 'RESTORED', ruleRemoved: false, approvalWithdrawal: 'REQUEST_NOT_FOUND' } });
    del.get.mockResolvedValue({ data: listOf([task({ status: 'CANCELLED' })]) });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm restore' }));
    expect(
      await screen.findByText('Restored gs://orders-raw. The policy engine does not know the hard-delete request, so nothing waits on it.')
    ).toBeTruthy();
  });

  it.each([['ROLE_CDO'], ['ROLE_DATA_ENGINEER']])('lets %s see the list but not restore from it', async (role) => {
    setRoles([role]);
    del.get.mockResolvedValue({ data: listOf([task()]) });
    renderIn(<SoftDeleteRestorePanel />);
    await screen.findByRole('table', { name: 'Soft-deleted assets' });
    expect(screen.queryByRole('button', { name: /^Restore / })).toBeNull();
    expect(screen.getByText(/Your role can see this list but cannot restore/)).toBeTruthy();
  });

  it('restores with a required note and refreshes the list', async () => {
    del.get.mockResolvedValueOnce({ data: listOf([task()]) });
    renderIn(<SoftDeleteRestorePanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Restore gs://orders-raw' }));
    const form = screen.getByRole('form', { name: 'Restore this asset' });
    const confirm = within(form).getByRole('button', { name: 'Confirm restore' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(form).getByLabelText('Restore note'), { target: { value: '   ' } });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(form).getByLabelText('Restore note'), { target: { value: '  Deleted by mistake  ' } });
    expect(confirm.disabled).toBe(false);

    autodel.post.mockResolvedValue({ data: { status: 'RESTORED' } });
    del.get.mockResolvedValue({ data: listOf([task({ status: 'CANCELLED' })]) });
    fireEvent.click(confirm);

    expect(await screen.findByText('Restored gs://orders-raw.')).toBeTruthy();
    const [url, body] = autodel.post.mock.calls[0];
    expect(url).toBe('/restores/rec-1');
    expect(body).toEqual({ notes: 'Deleted by mistake' });
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Restore / })).toBeNull());
    expect(screen.queryByRole('form', { name: 'Restore this asset' })).toBeNull();
    expect(del.get).toHaveBeenCalledTimes(2);
  });

  it('shows the server answer when the window has passed (409) and refreshes the list', async () => {
    del.get.mockResolvedValueOnce({ data: listOf([task()]) });
    renderIn(<SoftDeleteRestorePanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Restore gs://orders-raw' }));
    fireEvent.change(screen.getByLabelText('Restore note'), { target: { value: 'Too late?' } });
    autodel.post.mockRejectedValue(failure(409, { status: 'NOT_RESTORABLE', reason: 'Record not found, or already in a terminal state (RESTORED / HARD_DELETED).' }));
    del.get.mockResolvedValue({ data: listOf([task({ status: 'COMPLETED' })]) });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm restore' }));
    const alert = await screen.findByText(/Not restorable: Record not found/);
    expect(alert.getAttribute('role')).toBe('alert');
    await waitFor(() => expect(screen.getByText('Hard-deleted')).toBeTruthy());
  });

  it('shows a 403 in words', async () => {
    del.get.mockResolvedValue({ data: listOf([task()]) });
    renderIn(<SoftDeleteRestorePanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Restore gs://orders-raw' }));
    fireEvent.change(screen.getByLabelText('Restore note'), { target: { value: 'Mistake' } });
    autodel.post.mockRejectedValue(failure(403));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm restore' }));
    expect(await screen.findByText(/your role may not restore deleted assets/)).toBeTruthy();
  });

  it('cancels the form without a request', async () => {
    del.get.mockResolvedValue({ data: listOf([task()]) });
    renderIn(<SoftDeleteRestorePanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Restore gs://orders-raw' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('form', { name: 'Restore this asset' })).toBeNull();
    expect(autodel.post).not.toHaveBeenCalled();
  });

  it('says so when no asset is in the window', async () => {
    del.get.mockResolvedValue({ data: listOf([]) });
    renderIn(<SoftDeleteRestorePanel />);
    expect(await screen.findByText('No asset is in the soft-delete window.')).toBeTruthy();
  });

  it('shows a list failure in words and no table', async () => {
    del.get.mockRejectedValue(failure(500));
    renderIn(<SoftDeleteRestorePanel />);
    expect(await screen.findByText(/answered an error \(HTTP 500\)/)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('pages through the records', async () => {
    del.get.mockImplementation(async (_url: string, config: { params: { page: number } }) => ({
      data: listOf([task({ taskId: `rec-${config.params.page}`, taskName: `gs://bucket-${config.params.page}` })], {
        pageNumber: config.params.page,
        totalPages: 2,
      }),
    }));
    renderIn(<SoftDeleteRestorePanel />);
    expect(await screen.findByText('gs://bucket-0')).toBeTruthy();
    expect(screen.getByText('Page 1 of 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('gs://bucket-1')).toBeTruthy();
    expect(screen.getByText('Page 2 of 2')).toBeTruthy();
  });
});
