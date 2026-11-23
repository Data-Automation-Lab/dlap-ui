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
import ArchivalAgentActivitySaving from '../ArchivalAgentActivitySaving';
import {
  archivalActivitiesDto,
  archivalKpisEmptyDto,
  archivalKpisNullDto,
  archivalKpisRealDto,
  archivalKpisZeroedDto,
} from './fixtures';
import { quietConsole, renderPage, replyTo, tileText as tile, type StubClient } from './testUtils';

vi.mock('../../utils/api', async () => (await import('./testUtils')).makeApiMock());
vi.mock('../../keycloak', async () => (await import('./testUtils')).makeKeycloakMock());

const archival = archivalApi as unknown as StubClient;

function serve(kpis: unknown) {
  replyTo(archival, {
    '/overview/kpis': kpis,
    '/overview/recent-activities': archivalActivitiesDto,
    '/overview/trends': [],
  });
}

/** The text of the KPI tile with the given title. */

describe('ArchivalAgentActivitySaving (tiles)', () => {
  beforeEach(quietConsole);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Not available yet" for savings and reclaimed storage when the service reports constant zeros', async () => {
    serve(archivalKpisZeroedDto);
    renderPage(<ArchivalAgentActivitySaving />);
    await screen.findByText('Total Estimated Savings');
    expect(tile('Total Estimated Savings')).toContain('Not available yet');
    expect(tile('Total Estimated Savings')).not.toContain('$0');
    expect(tile('Total Estimated Savings')).not.toContain('/ month');
    expect(tile('Storage Reclaimed')).toContain('Not available yet');
    // Real counts still show.
    expect(tile('Storage Reclaimed')).toContain('9 assets archived');
    expect(tile('Pending Archival')).toContain('3');
  });

  it('shows the figures once the service sends real ones', async () => {
    serve(archivalKpisRealDto);
    renderPage(<ArchivalAgentActivitySaving />);
    await screen.findByText('Total Estimated Savings');
    expect(tile('Total Estimated Savings')).toContain('$8,400');
    expect(tile('Total Estimated Savings')).toContain('$1,200 / month');
    expect(tile('Storage Reclaimed')).toContain('4.2 TB');
  });

  it('shows $0 when nothing has been archived, because then zero is true', async () => {
    serve(archivalKpisEmptyDto);
    renderPage(<ArchivalAgentActivitySaving />);
    await screen.findByText('Total Estimated Savings');
    expect(tile('Total Estimated Savings')).toContain('$0');
  });

  it('does not crash or print NaN when every KPI is null', async () => {
    serve(archivalKpisNullDto);
    const { container } = renderPage(<ArchivalAgentActivitySaving />);
    await screen.findByText('Total Estimated Savings');
    expect(tile('Total Estimated Savings')).toContain('Not available yet');
    expect(container.textContent).not.toMatch(/NaN|null|undefined/);
  });

  it('lists the recent activity rows', async () => {
    serve(archivalKpisRealDto);
    renderPage(<ArchivalAgentActivitySaving />);
    expect(await screen.findByText('orders_2019')).toBeTruthy();
    expect(screen.getByText('Archive cold data')).toBeTruthy();
    expect(screen.getByText('120 GB')).toBeTruthy();
  });

  it('shows the error state when a request fails', async () => {
    replyTo(archival, { '/overview/kpis': new Error('503') });
    renderPage(<ArchivalAgentActivitySaving />);
    expect(await screen.findByText('Could not load archival activity and savings data.')).toBeTruthy();
  });
});
