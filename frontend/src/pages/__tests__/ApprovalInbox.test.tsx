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

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { policyengineApi } from '../../utils/api';
import type { ApprovalRequestView } from '../../utils/approvalApi';
import ApprovalInbox from '../ApprovalInbox';
import { quietConsole, renderPage, type StubClient } from './testUtils';

// The page reads the signed-in subject and roles from the Keycloak singleton; each test sets them.
const kc = vi.hoisted(() => ({
  authenticated: true,
  token: 'test-token',
  tokenParsed: undefined as undefined | Record<string, unknown>,
  logout: vi.fn(),
  updateToken: vi.fn(),
  login: vi.fn(),
  onAuthSuccess: undefined,
  onAuthRefreshSuccess: undefined,
  onAuthLogout: undefined,
}));

vi.mock('../../keycloak', () => ({ default: kc }));
vi.mock('../../utils/api', async () => (await import('./testUtils')).makeApiMock());

const pe = policyengineApi as unknown as StubClient;

const ME = '7d0e6c55-0000-4000-8000-00000000a11c';
const OTHER = 'a41f9b02-0000-4000-8000-0000000000b0';
const ID_ONE = '0d4f9c40-1a2b-3c4d-8e5f-000000000001';
const ID_TWO = '0d4f9c40-1a2b-3c4d-8e5f-000000000002';

function setUser(roles: string[], sub: string | undefined = ME) {
  kc.tokenParsed = { sub, realm_access: { roles } };
}

/** A request as the service sends it. */
function request(overrides: Partial<ApprovalRequestView> = {}): ApprovalRequestView {
  return {
    id: ID_ONE,
    status: 'PENDING',
    actionClass: 'SOFT_DELETE',
    actionType: 'delete',
    assetId: '11111111-1111-4111-8111-111111111111',
    assetUri: 'gs://orders-raw',
    approvals: 0,
    requiredApprovals: 1,
    origin: 'POLICY',
    requestedBy: 'policy:9',
    requesterKind: 'POLICY',
    policyName: 'Delete old logs',
    submittedBy: 'da-policyengine',
    excludedSubjects: ['policy:9', 'da-policyengine'],
    reason: 'No reads for 400 days',
    createdAt: '2026-10-20T10:00:00Z',
    expiresAt: '2026-10-27T10:00:00Z',
    executable: false,
    decisions: [],
    ...overrides,
  };
}

const pageOf = (content: ApprovalRequestView[], extra: { page?: number; totalPages?: number } = {}) => ({
  content,
  page: extra.page ?? 0,
  size: 25,
  totalElements: content.length,
  totalPages: extra.totalPages ?? (content.length === 0 ? 0 : 1),
});

const failure = (status: number, data: Record<string, unknown> = {}) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

interface Served {
  inbox: ApprovalRequestView[];
  all: ApprovalRequestView[];
  detail: Record<string, ApprovalRequestView>;
  calls: Array<{ url: string; params?: Record<string, unknown> }>;
}

/** Routes the policy-engine stub by URL; every GET is recorded. */
function serve(initial: Partial<Pick<Served, 'inbox' | 'all' | 'detail'>> = {}): Served {
  const served: Served = { inbox: [], all: [], detail: {}, calls: [], ...initial };
  pe.get.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
    served.calls.push({ url, params: config?.params });
    if (url === '/approvals/inbox') {
      return { data: pageOf(served.inbox) };
    }
    if (url === '/approvals') {
      return { data: pageOf(served.all) };
    }
    const match = /^\/approvals\/([^/]+)$/.exec(url);
    if (match !== null && served.detail[match[1]] !== undefined) {
      return { data: served.detail[match[1]] };
    }
    throw failure(404, { reason: 'not-found' });
  });
  return served;
}

const listCalls = (served: Served) => served.calls.filter((call) => call.url === '/approvals' || call.url === '/approvals/inbox');

async function openReview(asset = 'gs://orders-raw') {
  fireEvent.click(await screen.findByRole('button', { name: `Review request for ${asset}` }));
  return screen.findByRole('region', { name: 'Request detail' });
}

describe('ApprovalInbox page', () => {
  beforeEach(() => {
    quietConsole();
    pe.get.mockReset();
    pe.post.mockReset();
    setUser(['ROLE_CDO']);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('role gate', () => {
    it.each([[[]], [['ROLE_VIEWER']], [['ROLE_DATA_ANALYST']], [['ROLE_SERVICE_ACCOUNT']], [['ROLE_ADMIN', 'ROLE_SERVICE_ACCOUNT']]])(
      'shows a notice and makes no request for roles %j',
      async (roles) => {
        setUser(roles);
        const served = serve({ inbox: [request()] });
        renderPage(<ApprovalInbox />);
        expect(await screen.findByText('Your role cannot read approvals')).toBeTruthy();
        expect(served.calls).toEqual([]);
        expect(screen.queryByRole('table')).toBeNull();
      }
    );

    it.each([['ROLE_ADMIN'], ['ROLE_CDO'], ['ROLE_DIRECTOR'], ['ROLE_POLICY_MANAGER']])('gives %s the inbox as its first tab', async (role) => {
      setUser([role]);
      const served = serve({ inbox: [request()] });
      renderPage(<ApprovalInbox />);
      expect(await screen.findByText('gs://orders-raw')).toBeTruthy();
      expect(screen.getByText('Inbox')).toBeTruthy();
      expect(listCalls(served).map((call) => call.url)).toEqual(['/approvals/inbox']);
    });

    it.each([['ROLE_DATA_ENGINEER'], ['ROLE_DATA_SCIENTIST'], ['ROLE_AUDITOR']])('gives %s the read-only list and no inbox', async (role) => {
      setUser([role]);
      const served = serve({ all: [request()] });
      renderPage(<ApprovalInbox />);
      expect(await screen.findByText('gs://orders-raw')).toBeTruthy();
      expect(screen.queryByText('Inbox')).toBeNull();
      expect(listCalls(served).map((call) => call.url)).toEqual(['/approvals']);
    });
  });

  describe('the inbox', () => {
    it('shows exactly the requests the server returns for the caller', async () => {
      const served = serve({
        inbox: [
          request({ id: ID_ONE, assetUri: 'gs://orders-raw', actionClass: 'SOFT_DELETE' }),
          request({ id: ID_TWO, assetUri: 'gs://clicks', actionClass: 'HARD_DELETE', approvals: 1, requiredApprovals: 2 }),
        ],
      });
      renderPage(<ApprovalInbox />);
      const table = await screen.findByRole('table', { name: 'Requests waiting for you' });
      const rows = within(table).getAllByRole('row');
      expect(rows).toHaveLength(3);
      expect(within(rows[1]).getByText('gs://orders-raw')).toBeTruthy();
      expect(within(rows[2]).getByText('gs://clicks')).toBeTruthy();
      expect(within(rows[2]).getByText('1 of 2')).toBeTruthy();
      expect(within(rows[1]).getByText('Policy Delete old logs')).toBeTruthy();
      expect(served.calls[0]).toEqual({ url: '/approvals/inbox', params: { page: 0, size: 25 } });
    });

    it('shows an empty state when nothing waits', async () => {
      serve({ inbox: [] });
      renderPage(<ApprovalInbox />);
      expect(await screen.findByText('Nothing waits for your decision')).toBeTruthy();
      expect(screen.queryByRole('table')).toBeNull();
    });

    it('shows the failure with a retry, never a partial list', async () => {
      pe.get.mockRejectedValue(failure(500));
      renderPage(<ApprovalInbox />);
      expect(await screen.findByText(/answered an error \(HTTP 500\)/)).toBeTruthy();
      expect(screen.queryByRole('table')).toBeNull();
      pe.get.mockImplementation(async () => ({ data: pageOf([request()]) }));
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(await screen.findByText('gs://orders-raw')).toBeTruthy();
    });

    it('shows a 403 from the list in words', async () => {
      pe.get.mockRejectedValue(failure(403, { reason: 'not-an-approver' }));
      renderPage(<ApprovalInbox />);
      expect(await screen.findByText(/not an approver role/)).toBeTruthy();
    });

    it('pages through the inbox', async () => {
      const served = serve({ inbox: [request()] });
      pe.get.mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
        served.calls.push({ url, params: config?.params });
        return { data: pageOf([request()], { page: Number(config?.params?.page ?? 0), totalPages: 3 }) };
      });
      renderPage(<ApprovalInbox />);
      expect((await screen.findByTestId('page-position')).textContent).toBe('Page 1 of 3');
      expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      await waitFor(() => expect(screen.getByTestId('page-position').textContent).toBe('Page 2 of 3'));
      expect(served.calls.at(-1)?.params).toEqual({ page: 1, size: 25 });
    });
  });

  describe('all requests', () => {
    it('narrows the list by state and class, sending only what is chosen', async () => {
      const served = serve({ inbox: [request()], all: [request()] });
      renderPage(<ApprovalInbox />);
      await screen.findByText('gs://orders-raw');
      fireEvent.click(screen.getByText('All requests'));
      await screen.findByRole('table', { name: 'All approval requests' });
      expect(served.calls.at(-1)).toEqual({ url: '/approvals', params: { page: 0, size: 25 } });
      fireEvent.change(screen.getByLabelText('State'), { target: { value: 'PENDING' } });
      await waitFor(() => expect(served.calls.at(-1)?.params).toEqual({ page: 0, size: 25, status: 'PENDING' }));
      fireEvent.change(screen.getByLabelText('Action class'), { target: { value: 'HARD_DELETE' } });
      await waitFor(() => expect(served.calls.at(-1)?.params).toEqual({ page: 0, size: 25, status: 'PENDING', actionClass: 'HARD_DELETE' }));
    });

    it('explains an empty filtered list', async () => {
      setUser(['ROLE_AUDITOR']);
      serve({ all: [] });
      renderPage(<ApprovalInbox />);
      expect(await screen.findByText('No approval requests yet')).toBeTruthy();
      fireEvent.change(screen.getByLabelText('State'), { target: { value: 'EXPIRED' } });
      expect(await screen.findByText('No request matches these filters')).toBeTruthy();
    });

    it('lets an auditor read a request with its decisions, with no controls', async () => {
      setUser(['ROLE_AUDITOR']);
      serve({
        all: [request({ id: ID_TWO, status: 'APPROVED', approvals: 1, executable: true })],
        detail: {
          [ID_TWO]: request({
            id: ID_TWO,
            status: 'APPROVED',
            approvals: 1,
            executable: true,
            decisions: [{ approverSub: OTHER, approverName: 'bob', decision: 'APPROVE', comment: 'Verified the retention rule', decidedAt: '2026-10-20T11:00:00Z' }],
          }),
        },
      });
      renderPage(<ApprovalInbox />);
      const detail = await openReview();
      expect(await within(detail).findByText('bob: APPROVE')).toBeTruthy();
      expect(within(detail).getByText('Verified the retention rule')).toBeTruthy();
      expect(within(detail).getByText('Approved')).toBeTruthy();
      expect(within(detail).queryByRole('button', { name: 'Approve' })).toBeNull();
      expect(within(detail).queryByLabelText('Comment')).toBeNull();
      expect(within(detail).queryByText('Your role cannot decide approval requests.')).toBeNull();
    });
  });

  describe('approve and reject', () => {
    it('needs a comment before either button works', async () => {
      serve({ inbox: [request()], detail: { [ID_ONE]: request() } });
      renderPage(<ApprovalInbox />);
      const detail = await openReview();
      const approve = await within(detail).findByRole('button', { name: 'Approve' });
      const reject = within(detail).getByRole('button', { name: 'Reject' });
      expect((approve as HTMLButtonElement).disabled).toBe(true);
      expect((reject as HTMLButtonElement).disabled).toBe(true);
      fireEvent.change(within(detail).getByLabelText('Comment'), { target: { value: '   ' } });
      expect((approve as HTMLButtonElement).disabled).toBe(true);
      fireEvent.change(within(detail).getByLabelText('Comment'), { target: { value: 'Checked' } });
      expect((approve as HTMLButtonElement).disabled).toBe(false);
      expect((reject as HTMLButtonElement).disabled).toBe(false);
      expect(pe.post).not.toHaveBeenCalled();
    });

    it('posts an approval with the comment, then shows the new state and refreshes the inbox', async () => {
      const served = serve({ inbox: [request()], detail: { [ID_ONE]: request() } });
      pe.post.mockImplementation(async () => {
        served.inbox = [];
        return { data: request({ status: 'APPROVED', approvals: 1, executable: true, decisions: [{ approverSub: ME, decision: 'APPROVE', comment: 'Checked' }] }) };
      });
      renderPage(<ApprovalInbox />);
      const detail = await openReview();
      fireEvent.change(await within(detail).findByLabelText('Comment'), { target: { value: '  Checked  ' } });
      fireEvent.click(within(detail).getByRole('button', { name: 'Approve' }));
      expect(await within(detail).findByText('Recorded. The request is now: Approved.')).toBeTruthy();
      expect(pe.post).toHaveBeenCalledWith(`/approvals/${ID_ONE}/decisions`, { decision: 'APPROVE', comment: 'Checked' });
      expect(within(detail).queryByRole('button', { name: 'Approve' })).toBeNull();
      expect(await screen.findByText('Nothing waits for your decision')).toBeTruthy();
    });

    it('posts a rejection with the comment', async () => {
      serve({ inbox: [request()], detail: { [ID_ONE]: request() } });
      pe.post.mockResolvedValue({ data: request({ status: 'REJECTED' }) });
      renderPage(<ApprovalInbox />);
      const detail = await openReview();
      fireEvent.change(await within(detail).findByLabelText('Comment'), { target: { value: 'Still needed for audit' } });
      fireEvent.click(within(detail).getByRole('button', { name: 'Reject' }));
      expect(await within(detail).findByText('Recorded. The request is now: Rejected.')).toBeTruthy();
      expect(pe.post).toHaveBeenCalledWith(`/approvals/${ID_ONE}/decisions`, { decision: 'REJECT', comment: 'Still needed for audit' });
    });

    it('shows a first approval of two and then tells the approver they already decided', async () => {
      const hard = request({ actionClass: 'HARD_DELETE', requiredApprovals: 2 });
      const served = serve({ inbox: [hard], detail: { [ID_ONE]: hard } });
      const afterFirst = request({
        actionClass: 'HARD_DELETE',
        requiredApprovals: 2,
        approvals: 1,
        decisions: [{ approverSub: ME, approverName: 'me', decision: 'APPROVE', comment: 'First look' }],
      });
      pe.post.mockImplementation(async () => {
        served.detail[ID_ONE] = afterFirst;
        return { data: afterFirst };
      });
      renderPage(<ApprovalInbox />);
      const detail = await openReview();
      fireEvent.change(await within(detail).findByLabelText('Comment'), { target: { value: 'First look' } });
      fireEvent.click(within(detail).getByRole('button', { name: 'Approve' }));
      expect(await within(detail).findByText('Recorded. The request is now: Waiting for decisions.')).toBeTruthy();
      expect(await within(detail).findByText('You have already decided this request.')).toBeTruthy();
      expect(within(detail).queryByRole('button', { name: 'Approve' })).toBeNull();
      expect(within(detail).getByText('1 of 2')).toBeTruthy();
    });
  });

  describe('no self-approval', () => {
    it.each([
      ['asked for it', { requestedBy: ME, requesterKind: 'USER', excludedSubjects: [ME, 'da-policyengine'] }],
      ['submitted it', { submittedBy: ME, excludedSubjects: ['policy:9', ME] }],
      ['wrote its policy', { excludedSubjects: ['policy:9', 'da-policyengine', ME] }],
    ])('hides approve, reject and break-glass from someone who %s', async (_label, overrides) => {
      setUser(['ROLE_ADMIN']);
      const mine = request(overrides as Partial<ApprovalRequestView>);
      serve({ inbox: [mine], detail: { [ID_ONE]: mine } });
      renderPage(<ApprovalInbox />);
      const detail = await openReview();
      expect(await within(detail).findByText(/you asked for it, submitted it, or wrote its policy/)).toBeTruthy();
      expect(within(detail).queryByRole('button', { name: 'Approve' })).toBeNull();
      expect(within(detail).queryByRole('button', { name: 'Reject' })).toBeNull();
      expect(within(detail).queryByRole('button', { name: 'Break glass' })).toBeNull();
      expect(within(detail).queryByLabelText('Comment')).toBeNull();
      expect(pe.post).not.toHaveBeenCalled();
    });

    it('shows the server 403 clearly when a decision is refused anyway', async () => {
      // The page believes the person may decide (a stale token, or a party the view does not list).
      serve({ inbox: [request()], detail: { [ID_ONE]: request() } });
      pe.post.mockRejectedValue(failure(403, { reason: 'self-approval', message: 'You wrote the policy of this request' }));
      renderPage(<ApprovalInbox />);
      const detail = await openReview();
      fireEvent.change(await within(detail).findByLabelText('Comment'), { target: { value: 'Fine by me' } });
      fireEvent.click(within(detail).getByRole('button', { name: 'Approve' }));
      const alert = await within(detail).findByRole('alert');
      expect(alert.textContent).toContain('you cannot decide a request you asked for, submitted, or whose policy you wrote');
      expect(alert.textContent).toContain('You wrote the policy of this request');
      // A 403 does not close the form: the person can read the reason and leave.
      expect(within(detail).getByRole('button', { name: 'Approve' })).toBeTruthy();
    });

    it('explains an MFA refusal', async () => {
      serve({ inbox: [request()], detail: { [ID_ONE]: request() } });
      pe.post.mockRejectedValue(failure(403, { reason: 'mfa-required' }));
      renderPage(<ApprovalInbox />);
      const detail = await openReview();
      fireEvent.change(await within(detail).findByLabelText('Comment'), { target: { value: 'ok' } });
      fireEvent.click(within(detail).getByRole('button', { name: 'Reject' }));
      expect((await within(detail).findByRole('alert')).textContent).toContain('multi-factor authentication');
    });

    it('reloads the request when the server says it moved on (409 expired)', async () => {
      const served = serve({ inbox: [request()], detail: { [ID_ONE]: request() } });
      pe.post.mockImplementation(async () => {
        served.detail[ID_ONE] = request({ status: 'EXPIRED' });
        served.inbox = [];
        throw failure(409, { reason: 'expired' });
      });
      renderPage(<ApprovalInbox />);
      const detail = await openReview();
      fireEvent.change(await within(detail).findByLabelText('Comment'), { target: { value: 'ok' } });
      fireEvent.click(within(detail).getByRole('button', { name: 'Approve' }));
      await waitFor(() => expect(within(detail).getByText('Expired')).toBeTruthy());
      expect(within(detail).queryByRole('button', { name: 'Approve' })).toBeNull();
      expect(await screen.findByText('Nothing waits for your decision')).toBeTruthy();
    });
  });

  describe('break-glass', () => {
    const openAsAdmin = async () => {
      setUser(['ROLE_ADMIN']);
      serve({ inbox: [request()], detail: { [ID_ONE]: request() } });
      renderPage(<ApprovalInbox />);
      return openReview();
    };

    it.each([['ROLE_CDO'], ['ROLE_DIRECTOR'], ['ROLE_POLICY_MANAGER']])('is not offered to %s', async (role) => {
      setUser([role]);
      serve({ inbox: [request()], detail: { [ID_ONE]: request() } });
      renderPage(<ApprovalInbox />);
      const detail = await openReview();
      await within(detail).findByRole('button', { name: 'Approve' });
      expect(within(detail).queryByRole('button', { name: 'Break glass' })).toBeNull();
      expect(within(detail).queryByLabelText('Justification')).toBeNull();
    });

    it('is not offered to an ADMIN who also holds the machine role', async () => {
      setUser(['ROLE_ADMIN', 'ROLE_SERVICE_ACCOUNT']);
      serve({ inbox: [request()], detail: { [ID_ONE]: request() } });
      renderPage(<ApprovalInbox />);
      // A machine principal has no approvals page at all.
      expect(await screen.findByText('Your role cannot read approvals')).toBeTruthy();
    });

    it('needs 19 characters to be refused and 20 to be offered, counting as you type', async () => {
      const detail = await openAsAdmin();
      const glass = await within(detail).findByRole('button', { name: 'Break glass' });
      const box = within(detail).getByLabelText('Justification');
      expect((glass as HTMLButtonElement).disabled).toBe(true);
      expect(within(detail).getByText('0 of 20 characters')).toBeTruthy();
      fireEvent.change(box, { target: { value: 'x'.repeat(19) } });
      expect((glass as HTMLButtonElement).disabled).toBe(true);
      expect(within(detail).getByText('19 of 20 characters')).toBeTruthy();
      fireEvent.change(box, { target: { value: `   ${'x'.repeat(19)}   ` } });
      expect((glass as HTMLButtonElement).disabled).toBe(true);
      fireEvent.change(box, { target: { value: 'x'.repeat(20) } });
      expect((glass as HTMLButtonElement).disabled).toBe(false);
    });

    it('does nothing when the confirmation is declined', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const detail = await openAsAdmin();
      fireEvent.change(await within(detail).findByLabelText('Justification'), { target: { value: 'The vendor deadline is tonight' } });
      fireEvent.click(within(detail).getByRole('button', { name: 'Break glass' }));
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(String(confirm.mock.calls[0][0])).toContain('logged at ERROR');
      expect(pe.post).not.toHaveBeenCalled();
    });

    it('posts the justification once confirmed and shows the release', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const detail = await openAsAdmin();
      pe.post.mockResolvedValue({ data: request({ status: 'APPROVED_BREAK_GLASS', executable: true }) });
      fireEvent.change(await within(detail).findByLabelText('Justification'), { target: { value: '  The vendor deadline is tonight  ' } });
      fireEvent.click(within(detail).getByRole('button', { name: 'Break glass' }));
      expect(await within(detail).findByText('Recorded. The request is now: Released by break-glass.')).toBeTruthy();
      expect(pe.post).toHaveBeenCalledWith(`/approvals/${ID_ONE}/break-glass`, { justification: 'The vendor deadline is tonight' });
    });

    it('shows the server refusal when break-glass is switched off', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const detail = await openAsAdmin();
      pe.post.mockRejectedValue(failure(403, { reason: 'break-glass-disabled' }));
      fireEvent.change(await within(detail).findByLabelText('Justification'), { target: { value: 'The vendor deadline is tonight' } });
      fireEvent.click(within(detail).getByRole('button', { name: 'Break glass' }));
      expect((await within(detail).findByRole('alert')).textContent).toContain('break-glass is switched off');
    });

    it('is not offered on a request that is already closed', async () => {
      setUser(['ROLE_ADMIN']);
      const closed = request({ status: 'APPROVED', executable: true });
      serve({ all: [closed], detail: { [ID_ONE]: closed } });
      renderPage(<ApprovalInbox />);
      fireEvent.click(await screen.findByText('All requests'));
      const detail = await openReview();
      await within(detail).findByText('Approved');
      expect(within(detail).queryByRole('button', { name: 'Break glass' })).toBeNull();
    });
  });

  it('closes the detail and reports a request that cannot be read', async () => {
    serve({ inbox: [request()], detail: {} });
    renderPage(<ApprovalInbox />);
    const detail = await openReview();
    expect(await within(detail).findByText('This request no longer exists.')).toBeTruthy();
    fireEvent.click(within(detail).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('region', { name: 'Request detail' })).toBeNull();
  });
});
