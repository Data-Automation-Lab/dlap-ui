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

import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { archivalApi } from '../../utils/api';
import ArchivalAgentOverview from '../ArchivalAgentOverview';
import {
  archivalActivitiesDto,
  archivalConsumersDto,
  archivalKpisEmptyDto,
  archivalKpisNullDto,
  archivalKpisRealDto,
  archivalKpisZeroedDto,
  archivalStatusDto,
} from './fixtures';
import { quietConsole, renderPage, replyTo, stubResizeObserver, tileText as tile, type StubClient } from './testUtils';

vi.mock('../../utils/api', async () => (await import('./testUtils')).makeApiMock());
vi.mock('../../keycloak', async () => (await import('./testUtils')).makeKeycloakMock());

const archival = archivalApi as unknown as StubClient;

function serve(kpis: unknown) {
  replyTo(archival, {
    '/overview/kpis': kpis,
    '/overview/trends': [],
    '/overview/status-distribution': archivalStatusDto,
    '/overview/recent-activities': archivalActivitiesDto,
    '/overview/storage-consumers': archivalConsumersDto,
  });
}

/** The text of the KPI tile with the given title. */

describe('ArchivalAgentOverview (tiles)', () => {
  beforeEach(() => {
    quietConsole();
    stubResizeObserver();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Not available yet" for savings and reclaimed storage when the service reports constant zeros', async () => {
    serve(archivalKpisZeroedDto);
    renderPage(<ArchivalAgentOverview />);
    await screen.findByText('Monthly Savings');
    // 9 assets are archived, so a $0 / "0 TB" figure means "not computed".
    expect(tile('Monthly Savings')).toContain('Not available yet');
    expect(tile('Monthly Savings')).not.toContain('$0');
    expect(tile('Storage Reclaimed')).toContain('Not available yet');
    expect(tile('Storage Reclaimed')).not.toContain('0 TB');
    // The average archival time is also a constant zero: no "Avg 0min" badge.
    expect(tile('Storage Reclaimed')).not.toContain('Avg');
    // Real counts still show.
    expect(tile('Assets Archived')).toContain('9');
  });

  it('shows the figures once the service sends real ones', async () => {
    serve(archivalKpisRealDto);
    renderPage(<ArchivalAgentOverview />);
    await screen.findByText('Monthly Savings');
    expect(tile('Monthly Savings')).toContain('$1,200');
    expect(tile('Monthly Savings')).toContain('$8,400 total saved');
    expect(tile('Storage Reclaimed')).toContain('4.2 TB');
    expect(tile('Storage Reclaimed')).toContain('Avg 3.5min per asset');
  });

  it('shows $0 when nothing has been archived, because then zero is true', async () => {
    serve(archivalKpisEmptyDto);
    renderPage(<ArchivalAgentOverview />);
    await screen.findByText('Monthly Savings');
    expect(tile('Monthly Savings')).toContain('$0');
    expect(tile('Monthly Savings')).not.toContain('Not available yet');
  });

  it('does not crash or print NaN when every KPI is null', async () => {
    serve(archivalKpisNullDto);
    const { container } = renderPage(<ArchivalAgentOverview />);
    await screen.findByText('Monthly Savings');
    expect(tile('Monthly Savings')).toContain('Not available yet');
    expect(tile('Storage Reclaimed')).toContain('Not available yet');
    expect(container.textContent).not.toMatch(/NaN|null|undefined/);
  });

  it('reports whether archival is enabled instead of a fixed "All operational" claim', async () => {
    serve(archivalKpisZeroedDto);
    const { unmount } = renderPage(<ArchivalAgentOverview />);
    await screen.findByText('Active Policies');
    expect(tile('Active Policies')).toContain('Archival enabled');
    expect(screen.queryByText('All operational')).toBeNull();
    unmount();

    serve({ ...archivalKpisZeroedDto, activePolicies: 0 });
    renderPage(<ArchivalAgentOverview />);
    await screen.findByText('Active Policies');
    expect(tile('Active Policies')).toContain('Archival disabled');
  });

  it('counts pending from pendingArchival, not from identified minus archived (which includes failures)', async () => {
    serve({ ...archivalKpisZeroedDto, assetsIdentified: 12, assetsArchived: 9, pendingArchival: 1, failedArchival: 2 });
    renderPage(<ArchivalAgentOverview />);
    await screen.findByText('Assets Archived');
    expect(tile('Assets Archived')).toContain('1 pending');
  });

  it('shows the error state when the KPIs request fails', async () => {
    replyTo(archival, { '/overview/kpis': new Error('503') });
    renderPage(<ArchivalAgentOverview />);
    expect(await screen.findByText('Failed to load archival agent data. Please try again.')).toBeTruthy();
  });
});
