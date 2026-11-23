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

import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi, catalogApi, policyengineApi, reportingApi } from '../../utils/api';
import AdminControlHub from '../AdminControlHub';
import { REPORTING, actionItemsDto, actionItemsUpstreamDownDto, jobStatusesDto, policiesDto } from './fixtures';
import { quietConsole, renderPage, replyTo, type StubClient } from './testUtils';

vi.mock('../../utils/api', async () => (await import('./testUtils')).makeApiMock());
vi.mock('../../keycloak', async () => (await import('./testUtils')).makeKeycloakMock());

const admin = adminApi as unknown as StubClient;
const catalog = catalogApi as unknown as StubClient;
const policyengine = policyengineApi as unknown as StubClient;
const reporting = reportingApi as unknown as StubClient;

/** da-admin UserDTO list (the password field is never populated on reads). */
const usersDto = [
  {
    id: 'u1',
    username: 'alice',
    email: 'alice@example.org',
    firstName: 'Alice',
    lastName: 'Admin',
    password: null,
    enabled: true,
    roles: ['ROLE_ADMIN', 'ROLE_CDO'],
  },
  {
    id: 'u2',
    username: 'bob',
    email: null,
    firstName: null,
    lastName: null,
    password: null,
    enabled: false,
    roles: null,
  },
];

/** da-admin CloudConnectionDTO list. */
const cloudConnectionsDto = [
  {
    id: 'c1',
    name: 'prod-gcp',
    providerType: 'GCP',
    enabled: true,
    lastConnectionTestAt: '2026-10-18T09:00:00',
    lastConnectionTestStatus: 'SUCCESS',
  },
  {
    id: 'c2',
    name: 'dev-aws',
    providerType: 'AWS',
    enabled: true,
    lastConnectionTestAt: null,
    lastConnectionTestStatus: 'FAILED',
  },
];

function serve(overrides: { actions?: unknown; jobs?: unknown } = {}) {
  replyTo(admin, {
    '/job-statuses': overrides.jobs ?? jobStatusesDto,
    '/users': usersDto,
    '/cloud-connections': cloudConnectionsDto,
  });
  replyTo(catalog, {
    '/assets/count': 140,
    '/assets/count/with-metadata': 100,
    '/assets/count/with-lineage': 70,
  });
  replyTo(policyengine, { '/policies': policiesDto });
  replyTo(reporting, { [REPORTING.actions]: overrides.actions ?? actionItemsDto });
}

describe('AdminControlHub (platform administration dashboard)', () => {
  beforeEach(quietConsole);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders every section from the real DTO shapes', async () => {
    serve();
    renderPage(<AdminControlHub />);
    // Lifecycle services, folded from AggregatedJobStatusDTO.jobs[].
    expect(await screen.findByText('da-discovery')).toBeTruthy();
    expect(screen.getByText('da-autolabel')).toBeTruthy();
    // Platform metrics: one of two connections is healthy; 100 and 70 of 140 assets.
    expect(screen.getByText('1/2')).toBeTruthy();
    expect(screen.getByText('71%')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('100 of 140 cataloged assets')).toBeTruthy();
    // Users: a null name falls back to the username, null roles to "No roles".
    expect(screen.getByText('Alice Admin')).toBeTruthy();
    expect(screen.getByText('bob')).toBeTruthy();
    expect(screen.getByText('No roles')).toBeTruthy();
    expect(screen.getByText('of 2 accounts in Keycloak')).toBeTruthy();
    // Policies.
    expect(screen.getByText('Retain 7 years')).toBeTruthy();
  });

  it('renders the real action items (actionItems, severity, sourceService, category)', async () => {
    serve();
    renderPage(<AdminControlHub />);
    // The old code read actionItems.items and threw on the real DTO.
    expect(await screen.findByText('Policy evaluation: orders_raw')).toBeTruthy();
    expect(screen.getByText('1 high priority')).toBeTruthy();
    expect(screen.getAllByText('da-policyengine • policy evaluation').length).toBe(2);
    expect(screen.getByText('2 Action Items')).toBeTruthy();
  });

  it('lists the action items in the bell menu', async () => {
    serve();
    renderPage(<AdminControlHub />);
    fireEvent.click(await screen.findByText('2 Action Items'));
    expect(screen.getByText('Open action items')).toBeTruthy();
    expect(screen.getAllByText('Policy evaluation: customers').length).toBe(2);
  });

  it('never prints "Invalid Date" for a job whose timestamp is malformed', async () => {
    const jobs = {
      ...jobStatusesDto,
      jobs: [{ ...jobStatusesDto.jobs[0], completedAt: 'not-a-date', startedAt: null, submittedAt: null }],
    };
    serve({ jobs });
    const { container } = renderPage(<AdminControlHub />);
    expect(await screen.findByText('Last job -')).toBeTruthy();
    expect(container.textContent).not.toContain('Invalid Date');
  });

  it('shows an error, not "No open action items", when the policy engine was unreachable', async () => {
    serve({ actions: actionItemsUpstreamDownDto });
    renderPage(<AdminControlHub />);
    expect(await screen.findByText('Action items could not be loaded from da-reporting.')).toBeTruthy();
    expect(screen.queryByText('No open action items')).toBeNull();
    // The other sections are unaffected.
    expect(screen.getByText('da-discovery')).toBeTruthy();
  });

  it('degrades only the failing section when one service is down', async () => {
    serve();
    replyTo(admin, { '/job-statuses': jobStatusesDto, '/users': new Error('403'), '/cloud-connections': cloudConnectionsDto });
    renderPage(<AdminControlHub />);
    expect(await screen.findByText('Users could not be loaded from da-admin.')).toBeTruthy();
    expect(screen.getByText('da-discovery')).toBeTruthy();
    expect(screen.getByText('Retain 7 years')).toBeTruthy();
  });

  it('shows one error when every backing service is down', async () => {
    const down = new Error('503');
    replyTo(admin, { '/job-statuses': down, '/users': down, '/cloud-connections': down });
    replyTo(catalog, { '/assets/count': down, '/assets/count/with-metadata': down, '/assets/count/with-lineage': down });
    replyTo(policyengine, { '/policies': down });
    replyTo(reporting, { [REPORTING.actions]: down });
    renderPage(<AdminControlHub />);
    expect(
      await screen.findByText('The administration dashboard could not be loaded. All backing services are unreachable.')
    ).toBeTruthy();
  });
});
