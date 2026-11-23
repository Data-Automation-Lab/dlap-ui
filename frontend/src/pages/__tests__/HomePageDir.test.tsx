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

import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi, policyengineApi, reportingApi } from '../../utils/api';
import HomePageDir from '../HomePageDir';
import {
  REPORTING,
  actionItemsDto,
  actionItemsUpstreamDownDto,
  costSavingsEstimatedDto,
  costSavingsUnavailableDto,
  governanceScoreDto,
  governanceScoreWithLegacyBenchmarkDto,
  jobStatusesDto,
  policiesDto,
} from './fixtures';
import { quietConsole, renderPage, replyTo, tileText, type StubClient } from './testUtils';

vi.mock('../../utils/api', async () => (await import('./testUtils')).makeApiMock());
vi.mock('../../keycloak', async () => (await import('./testUtils')).makeKeycloakMock());

const reporting = reportingApi as unknown as StubClient;
const policyengine = policyengineApi as unknown as StubClient;
const admin = adminApi as unknown as StubClient;

/** da-admin CloudConnectionDTO list. */
const cloudConnectionsDto = [
  {
    id: 'c1',
    name: 'prod-gcp',
    description: 'Production project',
    providerType: 'GCP',
    enabled: true,
    lastConnectionTestAt: '2026-10-18T09:00:00',
    lastConnectionTestStatus: 'SUCCESS',
  },
  {
    id: 'c2',
    name: 'dev-aws',
    description: 'Dev account',
    providerType: 'AWS',
    enabled: true,
    lastConnectionTestAt: null,
    lastConnectionTestStatus: 'FAILED',
  },
];

function serve(tables: { governance?: unknown; cost?: unknown; actions?: unknown } = {}) {
  replyTo(reporting, {
    [REPORTING.governance]: tables.governance ?? governanceScoreDto,
    [REPORTING.cost]: tables.cost ?? costSavingsUnavailableDto,
    [REPORTING.actions]: tables.actions ?? actionItemsDto,
  });
  replyTo(policyengine, { '/policies': policiesDto });
  replyTo(admin, { '/job-statuses': jobStatusesDto, '/cloud-connections': cloudConnectionsDto });
}

describe('HomePageDir (director dashboard)', () => {
  beforeEach(quietConsole);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('derives the KPI tiles from the real DTO shapes', async () => {
    serve();
    renderPage(<HomePageDir />);
    // Policy Config Status is the policy-compliance component of the governance breakdown.
    expect(await screen.findByText('88%')).toBeTruthy();
    // One of the two services has a failed job, so connection health is 50%.
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('2 Alerts')).toBeTruthy();
  });

  it('shows "Not available yet" in the policy config tile when the component could not be computed', async () => {
    serve({ governance: { ...governanceScoreDto, breakdown: { ...governanceScoreDto.breakdown, policyComplianceScore: null } } });
    const { container } = renderPage(<HomePageDir />);
    await screen.findByText('Policy Config Status');
    // The policy config tile, and New Datasets (no service reports datasets of the last 7 days).
    expect(screen.getAllByText('Not available yet').length).toBe(2);
    expect(container.textContent).not.toMatch(/NaN|null/);
  });

  it('shows "-" for policy fields the policy engine does not report, not invented defaults', async () => {
    serve();
    const { container } = renderPage(<HomePageDir />);
    const row = (await screen.findByText('Retain 7 years')).closest('tr') as HTMLElement;
    // A policy record has no category, per-team reach or impact score.
    expect(within(row).queryByText('Compliance')).toBeNull();
    expect(within(row).queryByText('Medium')).toBeNull();
    expect(within(row).queryByText(/teams/)).toBeNull();
    expect(within(row).getAllByText('-').length).toBe(4);
    expect(within(row).getByText('Active')).toBeTruthy();
    // New Datasets has no source either: it reads "Not available yet", not 0.
    expect(tileText('New Datasets')).toContain('Not available yet');
    expect(container.textContent).not.toContain('Last 7 days');
  });

  it('lists connection health with a safely formatted last-check time', async () => {
    serve();
    renderPage(<HomePageDir />);
    fireEvent.click(await screen.findByText('Technical Status'));
    const gcpRow = (await screen.findByText('prod-gcp')).closest('tr') as HTMLElement;
    expect(within(gcpRow).getByText('Healthy')).toBeTruthy();
    expect(within(gcpRow).queryByText('Invalid Date')).toBeNull();
    // A connection that was never tested has no last-check time: the placeholder is a hyphen.
    const awsRow = screen.getByText('dev-aws').closest('tr') as HTMLElement;
    expect(within(awsRow).getByText('Error')).toBeTruthy();
    expect(within(awsRow).getAllByText('-').length).toBeGreaterThan(0);
  });

  it('builds the insight cards from the governance, cost and action-item DTOs', async () => {
    serve({ governance: governanceScoreWithLegacyBenchmarkDto });
    renderPage(<HomePageDir />);
    fireEvent.click(await screen.findByText('Data Insights'));
    expect(await screen.findByText('71.4%')).toBeTruthy();
    // 88% shows on the Policy Config Status tile and on the Policy Compliance insight.
    expect(screen.getAllByText('88%').length).toBe(2);
    expect(screen.getByText('2 items')).toBeTruthy();
    // No billing source: the savings insight says so rather than showing $0. The New Datasets
    // tile above the tabs is the other one.
    expect(screen.getAllByText('Not available yet').length).toBe(2);
  });

  it('shows a dollar insight when the backend has figures', async () => {
    serve({ cost: costSavingsEstimatedDto });
    renderPage(<HomePageDir />);
    fireEvent.click(await screen.findByText('Data Insights'));
    expect(await screen.findByText('$780')).toBeTruthy();
  });

  it('says the action items could not be loaded when the upstream is down', async () => {
    serve({ actions: actionItemsUpstreamDownDto });
    renderPage(<HomePageDir />);
    fireEvent.click(await screen.findByText('0 Alerts'));
    expect(screen.getByText('Could not load action items.')).toBeTruthy();
  });

  it('shows the dashboard error state when a source request fails', async () => {
    serve();
    replyTo(reporting, {
      [REPORTING.governance]: new Error('503'),
      [REPORTING.cost]: costSavingsUnavailableDto,
      [REPORTING.actions]: actionItemsDto,
    });
    renderPage(<HomePageDir />);
    expect(await screen.findByText('Could not load director dashboard metrics.')).toBeTruthy();
  });
});
