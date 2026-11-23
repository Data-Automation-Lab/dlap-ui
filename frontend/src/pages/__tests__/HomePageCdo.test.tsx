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

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi, policyengineApi, reportingApi } from '../../utils/api';
import HomePageCdo from '../HomePageCdo';
import {
  REPORTING,
  actionItemsDto,
  actionItemsUpstreamDownDto,
  costSavingsEstimatedDto,
  costSavingsUnavailableDto,
  governanceScoreDto,
  jobStatusesDto,
  policiesDto,
} from './fixtures';
import { quietConsole, renderPage, replyTo, type StubClient } from './testUtils';

vi.mock('../../utils/api', async () => (await import('./testUtils')).makeApiMock());
vi.mock('../../keycloak', async () => (await import('./testUtils')).makeKeycloakMock());

const reporting = reportingApi as unknown as StubClient;
const policyengine = policyengineApi as unknown as StubClient;
const admin = adminApi as unknown as StubClient;

function serve(tables: { governance?: unknown; cost?: unknown; actions?: unknown } = {}) {
  replyTo(reporting, {
    [REPORTING.governance]: tables.governance ?? governanceScoreDto,
    [REPORTING.cost]: tables.cost ?? costSavingsUnavailableDto,
    [REPORTING.actions]: tables.actions ?? actionItemsDto,
  });
  replyTo(policyengine, { '/policies': policiesDto });
  replyTo(admin, { '/job-statuses': jobStatusesDto });
}

describe('HomePageCdo (CDO dashboard)', () => {
  beforeEach(quietConsole);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('computes the KPIs from the real DTO shapes', async () => {
    serve();
    renderPage(<HomePageCdo />);
    // Governance score and lineage coverage come from overallScore and breakdown.lineageCoverageScore.
    expect(await screen.findByText('71.4%')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
    // Two policies are ENABLED.
    expect(screen.getByText('Active Policies').parentElement?.parentElement?.textContent).toContain('2');
    // Both POLICY_EVALUATION items count as compliance alerts; one is HIGH.
    expect(screen.getByText('1 high priority')).toBeTruthy();
    expect(screen.getByText('2 Notifications')).toBeTruthy();
  });

  it('lists the real action items with their title, description and category button', async () => {
    serve();
    renderPage(<HomePageCdo />);
    expect(await screen.findByText('Policy evaluation: orders_raw')).toBeTruthy();
    expect(screen.getByText('Failure recorded for policy retain-7y')).toBeTruthy();
    expect(screen.getByText('2 pending')).toBeTruthy();
    expect(screen.getAllByText('Review').length).toBe(2);
  });

  it('shows "Not available yet" for the cost tile when there is no billing source', async () => {
    serve();
    const { container } = renderPage(<HomePageCdo />);
    await screen.findByText('71.4%');
    expect(screen.getByText('Not available yet')).toBeTruthy();
    expect(container.textContent).not.toMatch(/NaN|\$0\b/);
  });

  it('shows the monthly figure and its share of the total when the backend has dollar figures', async () => {
    serve({ cost: costSavingsEstimatedDto });
    renderPage(<HomePageCdo />);
    expect(await screen.findByText('$780.0')).toBeTruthy();
    expect(screen.getByText('8.3% of total savings')).toBeTruthy();
  });

  it('does not crash when scores are null; those tiles read "Not available yet"', async () => {
    serve({ governance: { ...governanceScoreDto, overallScore: null, breakdown: null } });
    renderPage(<HomePageCdo />);
    await screen.findByText('Governance Score');
    // governance score, cost and lineage tiles.
    expect(screen.getAllByText('Not available yet').length).toBe(3);
  });

  it('shows an error inside the widget when the action-items upstream is down, keeping the KPIs', async () => {
    serve({ actions: actionItemsUpstreamDownDto });
    renderPage(<HomePageCdo />);
    expect(await screen.findByText('Could not load action items from the reporting service.')).toBeTruthy();
    expect(screen.getByText('71.4%')).toBeTruthy();
  });

  it('shows the dashboard error state when a source request fails', async () => {
    serve();
    replyTo(reporting, {
      [REPORTING.governance]: governanceScoreDto,
      [REPORTING.cost]: costSavingsUnavailableDto,
      [REPORTING.actions]: new Error('503'),
    });
    renderPage(<HomePageCdo />);
    expect(await screen.findByText('Could not load CDO dashboard metrics.')).toBeTruthy();
  });

  it('opens the notification list and routes an item', async () => {
    serve();
    const navigateToPolicyHub2 = vi.fn();
    window.navigateToPolicyHub2 = navigateToPolicyHub2;
    renderPage(<HomePageCdo />);
    fireEvent.click(await screen.findByText('2 Notifications'));
    // Each item appears in the menu (first in the page) and in the widget.
    const titles = screen.getAllByText('Policy evaluation: customers');
    expect(titles.length).toBe(2);
    fireEvent.click(titles[0]);
    await waitFor(() => expect(navigateToPolicyHub2).toHaveBeenCalledTimes(1));
    delete window.navigateToPolicyHub2;
  });
});
