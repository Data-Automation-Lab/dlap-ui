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

import { AxiosError } from 'axios';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The page talks to the services through the axios instances in utils/api. Replace them with
// fakes that answer by URL, so the whole chain (page -> discoveryApi.ts -> axios) is exercised.
vi.mock('../utils/api', () => {
  const fake = () => ({ get: vi.fn(), post: vi.fn() });
  return {
    adminApi: fake(),
    catalogApi: fake(),
    discoveryApi: fake(),
    labelAgentApi: fake(),
    policyengineApi: fake(),
    reportingApi: fake(),
  };
});

// The layout needs Keycloak and the router; the page body is what is under test.
vi.mock('../ui/layouts/DefaultPageLayout', () => ({
  DefaultPageLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { adminApi, discoveryApi } from '../utils/api';
import DiscoveryAgentOverview from './DiscoveryAgentOverview';

const discoveryGet = vi.mocked(discoveryApi.get);
const discoveryPost = vi.mocked(discoveryApi.post);

const STATS = {
  totalAssets: 12,
  assetsDiscoveredThisWeek: 3,
  lastScanTime: '2 hours ago',
  averageScanTime: 4,
  totalDataVolume: '1 TB',
  scanSuccessRate: 100,
};

const httpError = (status: number, body: Record<string, unknown> = {}) =>
  new AxiosError('failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: {} as never,
    data: body,
  });

/** Answers the page's data loads, and GET /connections with whatever the test supplies. */
function serve(connections: () => Promise<{ data: unknown }>) {
  discoveryGet.mockImplementation((url: string) => {
    switch (url) {
      case '/connections':
        return connections() as never;
      case '/statistics':
        return Promise.resolve({ data: STATS }) as never;
      default:
        return Promise.resolve({ data: [] }) as never;
    }
  });
  vi.mocked(adminApi.get).mockResolvedValue({ data: {} } as never);
}

async function openPage() {
  render(<DiscoveryAgentOverview />);
  return screen.findByRole('button', { name: /Last scan: 2 hours ago/ });
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  discoveryGet.mockReset();
  discoveryPost.mockReset();
});

describe('DiscoveryAgentOverview scan button', () => {
  it('shows "No cloud connection configured" and starts nothing when there is no connection', async () => {
    serve(() => Promise.resolve({ data: [] }));
    const button = await openPage();

    fireEvent.click(button);

    expect(await screen.findByText('No cloud connection configured')).toBeTruthy();
    expect(discoveryPost).not.toHaveBeenCalled();
    expect(screen.queryByText(/Scan started/)).toBeNull();
  });

  it('starts a scan for the scannable connection and says so', async () => {
    serve(() =>
      Promise.resolve({
        data: [{ id: 'conn-1', name: 'Prod GCP', providerType: 'GCP', enabled: true, scannable: true }],
      }),
    );
    discoveryPost.mockResolvedValue({ data: { scanId: 'scan-1', status: 'PENDING' } } as never);
    const button = await openPage();

    fireEvent.click(button);

    expect(await screen.findByText('Scan started for Prod GCP.')).toBeTruthy();
    expect(discoveryPost).toHaveBeenCalledTimes(1);
    const [url, payload] = discoveryPost.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe('/scans');
    expect(payload).toMatchObject({ cloudConnectionId: 'conn-1', scanType: 'FULL', scope: {} });
    expect(String(payload.scanName)).toMatch(/^manual-scan-\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it('shows the permission message instead of claiming success when the caller may not scan', async () => {
    serve(() => Promise.reject(httpError(403)));
    const button = await openPage();

    fireEvent.click(button);

    expect(await screen.findByText('You do not have permission to run discovery scans.')).toBeTruthy();
    expect(screen.queryByText(/Scan started/)).toBeNull();
    expect(screen.queryByText(/submitted successfully/)).toBeNull();
  });

  it('shows the reason a scan was refused', async () => {
    serve(() =>
      Promise.resolve({
        data: [{ id: 'conn-1', name: 'Prod GCP', providerType: 'GCP', enabled: true, scannable: true }],
      }),
    );
    discoveryPost.mockRejectedValue(httpError(503, { detail: 'da-admin-service is unreachable' }));
    const button = await openPage();

    fireEvent.click(button);

    expect(await screen.findByText('Prod GCP: da-admin-service is unreachable')).toBeTruthy();
  });

  it('disables the button while the scan request is in flight, then re-enables it', async () => {
    let release: (value: { data: unknown }) => void = () => undefined;
    serve(() => new Promise(resolve => (release = resolve)));
    const button = await openPage();

    fireEvent.click(button);

    await waitFor(() => expect((screen.getByRole('button', { name: /Scanning/ }) as HTMLButtonElement).disabled).toBe(true));
    release({ data: [] });
    expect(await screen.findByText('No cloud connection configured')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('button', { name: /Scanning/ })).toBeNull());
  });
});
