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
import HomePageExec from '../HomePageExec';
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

describe('HomePageExec (executive dashboard)', () => {
  beforeEach(quietConsole);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the real action-items shape (actionItems, severity, sourceService) without crashing', async () => {
    serve();
    renderPage(<HomePageExec />);
    // The old code read actionItems.items.length and threw on the real DTO.
    expect(await screen.findByText('Policy evaluation: orders_raw')).toBeTruthy();
    expect(screen.getByText('Policy evaluation: customers')).toBeTruthy();
    expect(screen.getByText('HIGH')).toBeTruthy();
    expect(screen.getByText('MEDIUM')).toBeTruthy();
    expect(screen.getAllByText('da-policyengine').length).toBe(2);
    expect(screen.getByText('Notifications (2)')).toBeTruthy();
  });

  it('shows the governance score and the four real breakdown components', async () => {
    serve();
    renderPage(<HomePageExec />);
    expect(await screen.findByText('71%')).toBeTruthy();
    expect(screen.getByText('Policy Compliance')).toBeTruthy();
    expect(screen.getByText('88%')).toBeTruthy();
    expect(screen.getByText('Data Classification')).toBeTruthy();
    expect(screen.getByText('64%')).toBeTruthy();
    expect(screen.getByText('Metadata Completeness')).toBeTruthy();
    expect(screen.getByText('72%')).toBeTruthy();
    expect(screen.getByText('Lineage Coverage')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
  });

  it('shows "Not available yet" for cost tiles when there is no billing source, never $0 or NaN', async () => {
    serve();
    const { container } = renderPage(<HomePageExec />);
    await screen.findByText('Policy evaluation: orders_raw');
    expect(screen.getByText('Not available yet')).toBeTruthy();
    expect(screen.getByText('Archival: Not available yet')).toBeTruthy();
    expect(screen.getByText('Deletion: Not available yet')).toBeTruthy();
    expect(screen.getByText(costSavingsUnavailableDto.basis)).toBeTruthy();
    expect(container.textContent).not.toMatch(/NaN|\$0\b/);
  });

  it('still shows dollar figures from a backend that returns them', async () => {
    serve({ cost: costSavingsEstimatedDto });
    renderPage(<HomePageExec />);
    expect(await screen.findByText('$780')).toBeTruthy();
    expect(screen.getByText('$2,340 from Archival')).toBeTruthy();
    expect(screen.getByText('$780 from Deletion')).toBeTruthy();
  });

  it('shows an error state, not "No action items", when the upstream is down', async () => {
    serve({ actions: actionItemsUpstreamDownDto });
    renderPage(<HomePageExec />);
    expect(await screen.findByText('Could not load action items from the reporting service.')).toBeTruthy();
    expect(screen.queryByText('No action items')).toBeNull();
  });

  it('survives an action-items request that fails outright', async () => {
    serve();
    replyTo(reporting, {
      [REPORTING.governance]: governanceScoreDto,
      [REPORTING.cost]: costSavingsUnavailableDto,
      [REPORTING.actions]: new Error('503'),
    });
    renderPage(<HomePageExec />);
    expect(await screen.findByText('Could not load action items from the reporting service.')).toBeTruthy();
    // The rest of the page still renders.
    expect(screen.getByText('71%')).toBeTruthy();
  });

  it('routes an item to its owning view by category', async () => {
    serve();
    const navigateToPolicyHub2 = vi.fn();
    window.navigateToPolicyHub2 = navigateToPolicyHub2;
    renderPage(<HomePageExec />);
    await screen.findByText('Policy evaluation: orders_raw');
    const [first] = screen.getAllByText('Review');
    fireEvent.click(first);
    await waitFor(() => expect(navigateToPolicyHub2).toHaveBeenCalledTimes(1));
    delete window.navigateToPolicyHub2;
  });
});
