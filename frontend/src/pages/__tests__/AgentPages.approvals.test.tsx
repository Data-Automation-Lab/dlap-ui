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

import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { archivalApi, deleteAgentApi, deletionApi, policyengineApi } from '../../utils/api';
import ArchivalAgentOverview from '../ArchivalAgentOverview';
import DeleteAgentOverview from '../DeleteAgentOverview';
import {
  archivalActivitiesDto,
  archivalConsumersDto,
  archivalKpisRealDto,
  archivalStatusDto,
} from './fixtures';
import { quietConsole, renderPage, replyTo, stubResizeObserver, type StubClient } from './testUtils';

// The two agent pages carry the approval notice (and the delete page the restore list) of APPR-02.
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

const archival = archivalApi as unknown as StubClient;
const deleteAgent = deleteAgentApi as unknown as StubClient;
const deletion = deletionApi as unknown as StubClient;
const policyengine = policyengineApi as unknown as StubClient;

const setRoles = (roles: string[]) => {
  kc.tokenParsed = { sub: 'me', realm_access: { roles } };
};

const pendingByClass = (perClass: Record<string, number>) =>
  policyengine.get.mockImplementation(async (_url: string, config: { params: { actionClass: string } }) => ({
    data: { content: [], totalElements: perClass[config.params.actionClass] ?? 0 },
  }));

function serveDelete() {
  replyTo(deleteAgent, {
    '/dashboard/kpis': { activePolicies: 2, assetsDeleted: 5, pendingDeletion: 1, storageReclaimed: '1 GB' },
    '/dashboard/trends/storage-reclaimed': [],
    '/dashboard/policies/deletion-stats': [],
    '/dashboard/activities/recent': [],
    '/dashboard/assets/risk': [],
  });
  deletion.get.mockResolvedValue({
    data: {
      tasks: [{ taskId: 'rec-1', taskName: 'gs://orders-raw', status: 'QUEUED', submittedAt: '2026-10-20T10:00:00' }],
      pageNumber: 0,
      totalPages: 1,
      totalElements: 1,
    },
  });
}

function serveArchival() {
  replyTo(archival, {
    '/overview/kpis': archivalKpisRealDto,
    '/overview/trends': [],
    '/overview/status-distribution': archivalStatusDto,
    '/overview/recent-activities': archivalActivitiesDto,
    '/overview/storage-consumers': archivalConsumersDto,
  });
}

describe('Smart Deletion page: approvals and restore', () => {
  beforeEach(() => {
    quietConsole();
    stubResizeObserver();
    policyengine.get.mockReset();
    deletion.get.mockReset();
    serveDelete();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tells an approver how many delete requests wait, counting soft and hard deletes', async () => {
    setRoles(['ROLE_CDO']);
    pendingByClass({ SOFT_DELETE: 1, HARD_DELETE: 2 });
    renderPage(<DeleteAgentOverview />);
    expect(await screen.findByText('3 requests are waiting for approval before anything runs.')).toBeTruthy();
    expect(policyengine.get).toHaveBeenCalledTimes(2);
  });

  it('lists the soft-deleted assets with a Restore action for an administrator', async () => {
    setRoles(['ROLE_ADMIN']);
    pendingByClass({});
    renderPage(<DeleteAgentOverview />);
    expect(await screen.findByRole('table', { name: 'Soft-deleted assets' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restore gs://orders-raw' })).toBeTruthy();
  });

  it('does not ask for approvals or the restore list when the role may do neither', async () => {
    setRoles(['ROLE_VIEWER']);
    pendingByClass({ SOFT_DELETE: 4 });
    renderPage(<DeleteAgentOverview />);
    expect(await screen.findByText('SmartDelete Management')).toBeTruthy();
    expect(policyengine.get).not.toHaveBeenCalled();
    expect(deletion.get).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Restore soft-deleted assets' })).toBeNull();
  });

  it('keeps the dashboard when the restore list fails', async () => {
    setRoles(['ROLE_ADMIN']);
    pendingByClass({});
    deletion.get.mockRejectedValue(Object.assign(new Error('HTTP 500'), { response: { status: 500, data: {} } }));
    renderPage(<DeleteAgentOverview />);
    expect(await screen.findByText(/answered an error \(HTTP 500\)/)).toBeTruthy();
    expect(screen.getByText('SmartDelete Management')).toBeTruthy();
  });
});

describe('Smart Archival page: approvals', () => {
  beforeEach(() => {
    quietConsole();
    stubResizeObserver();
    policyengine.get.mockReset();
    serveArchival();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tells an approver how many archive requests wait, asking for the archive class only', async () => {
    setRoles(['ROLE_POLICY_MANAGER']);
    pendingByClass({ ARCHIVE: 1 });
    renderPage(<ArchivalAgentOverview />);
    expect(await screen.findByText('1 request is waiting for approval before anything runs.')).toBeTruthy();
    expect(policyengine.get).toHaveBeenCalledTimes(1);
    expect(policyengine.get).toHaveBeenCalledWith('/approvals', { params: { page: 0, size: 1, status: 'PENDING', actionClass: 'ARCHIVE' } });
  });

  it('shows no notice and asks nothing for a role that cannot read approvals', async () => {
    setRoles(['ROLE_VIEWER']);
    pendingByClass({ ARCHIVE: 3 });
    renderPage(<ArchivalAgentOverview />);
    await waitFor(() => expect(archival.get).toHaveBeenCalled());
    expect(await screen.findByText('SmartArchival Management')).toBeTruthy();
    expect(policyengine.get).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Pending approvals')).toBeNull();
  });
});
