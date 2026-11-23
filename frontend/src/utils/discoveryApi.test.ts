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
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({ discoveryApi: { get: vi.fn(), post: vi.fn() } }));

import { discoveryApi } from './api';
import {
  NO_CONNECTION_MESSAGE,
  describeScanError,
  runDiscoveryScans,
  type DiscoveryConnection,
} from './discoveryApi';

const get = vi.mocked(discoveryApi.get);
const post = vi.mocked(discoveryApi.post);

const conn = (id: string, name: string, over: Partial<DiscoveryConnection> = {}): DiscoveryConnection => ({
  id,
  name,
  providerType: 'GCP',
  enabled: true,
  scannable: true,
  ...over,
});

/** An axios failure shaped like a da-discovery problem response. */
const httpError = (status: number, body: Record<string, unknown> = {}) =>
  new AxiosError('failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: {} as never,
    data: body,
  });

const NOW = () => new Date('2026-10-19T10:00:00.123Z');

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('runDiscoveryScans: nothing to scan', () => {
  it('says "No cloud connection configured" when there are no connections, and starts nothing', async () => {
    get.mockResolvedValue({ data: [] });

    const result = await runDiscoveryScans(NOW);

    expect(result.kind).toBe('no-connection');
    expect(result.message).toBe(NO_CONNECTION_MESSAGE);
    expect(result.message).toBe('No cloud connection configured');
    expect(post).not.toHaveBeenCalled();
  });

  it('explains when connections exist but none can be scanned, and starts nothing', async () => {
    get.mockResolvedValue({
      data: [conn('c1', 'Old', { enabled: false, scannable: false }), conn('c2', 'Misc', { providerType: 'OTHER', scannable: false })],
    });

    const result = await runDiscoveryScans(NOW);

    expect(result.kind).toBe('no-connection');
    expect(result.message.startsWith(NO_CONNECTION_MESSAGE)).toBe(true);
    expect(result.message).toContain('2 connections are disabled or unsupported');
    expect(post).not.toHaveBeenCalled();
  });

  it('treats a malformed list as no connections', async () => {
    get.mockResolvedValue({ data: { not: 'an array' } });

    expect((await runDiscoveryScans(NOW)).kind).toBe('no-connection');
  });
});

describe('runDiscoveryScans: starting scans', () => {
  it('starts one FULL scan with the scope the API requires', async () => {
    get.mockResolvedValue({ data: [conn('c1', 'Prod GCP')] });
    post.mockResolvedValue({ data: { scanId: 'scan-1', status: 'PENDING' } });

    const result = await runDiscoveryScans(NOW);

    expect(get).toHaveBeenCalledWith('/connections');
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/scans', {
      cloudConnectionId: 'c1',
      scanType: 'FULL',
      scanName: 'manual-scan-2026-10-19T10:00:00',
      scope: {},
    });
    expect(result).toEqual({
      kind: 'started',
      message: 'Scan started for Prod GCP.',
      started: [{ connectionId: 'c1', connectionName: 'Prod GCP', scanId: 'scan-1' }],
      failed: [],
    });
  });

  it('starts a scan per scannable connection and skips the others', async () => {
    get.mockResolvedValue({
      data: [conn('c1', 'Prod GCP'), conn('c2', 'Off', { enabled: false, scannable: false }), conn('c3', 'Prod AWS', { providerType: 'AWS' })],
    });
    post.mockImplementation(async (_url: string, body: unknown) => ({
      data: { scanId: `scan-${(body as { cloudConnectionId: string }).cloudConnectionId}`, status: 'PENDING' },
    }));

    const result = await runDiscoveryScans(NOW);

    expect(post).toHaveBeenCalledTimes(2);
    expect(result.kind).toBe('started');
    expect(result.message).toBe('Started 2 scans: Prod GCP and Prod AWS.');
    expect(result.started.map(s => s.scanId)).toEqual(['scan-c1', 'scan-c3']);
  });

  it('reports a partial start with the reason the server gave for the failure', async () => {
    get.mockResolvedValue({ data: [conn('c1', 'Prod GCP'), conn('c2', 'Prod AWS', { providerType: 'AWS' })] });
    post
      .mockResolvedValueOnce({ data: { scanId: 'scan-1', status: 'PENDING' } })
      .mockRejectedValueOnce(httpError(409, { detail: "Cloud connection 'Prod AWS' is disabled" }));

    const result = await runDiscoveryScans(NOW);

    expect(result.kind).toBe('partial');
    expect(result.message).toBe("Started 1 of 2 scans. Prod AWS: Cloud connection 'Prod AWS' is disabled");
    expect(result.started).toHaveLength(1);
    expect(result.failed).toEqual([
      { connectionId: 'c2', connectionName: 'Prod AWS', reason: "Cloud connection 'Prod AWS' is disabled" },
    ]);
  });

  it('reports failure when every scan is refused', async () => {
    get.mockResolvedValue({ data: [conn('c1', 'Prod GCP')] });
    post.mockRejectedValue(httpError(503, { detail: 'da-admin-service is unreachable' }));

    const result = await runDiscoveryScans(NOW);

    expect(result.kind).toBe('failed');
    expect(result.message).toBe('Prod GCP: da-admin-service is unreachable');
  });

  it('does not call a 202 with status FAILED a success', async () => {
    get.mockResolvedValue({ data: [conn('c1', 'Prod GCP')] });
    post.mockResolvedValue({ data: { scanId: 'scan-1', status: 'FAILED' } });

    const result = await runDiscoveryScans(NOW);

    expect(result.kind).toBe('failed');
    expect(result.started).toEqual([]);
    expect(result.message).toContain('could not be started');
  });
});

describe('runDiscoveryScans: the connection list fails', () => {
  it('tells a user without the right role that they lack permission', async () => {
    get.mockRejectedValue(httpError(403));

    const result = await runDiscoveryScans(NOW);

    expect(result.kind).toBe('failed');
    expect(result.message).toBe('You do not have permission to run discovery scans.');
    expect(post).not.toHaveBeenCalled();
  });

  it('shows the server explanation when the admin service is down', async () => {
    get.mockRejectedValue(httpError(503, { detail: 'da-admin-service is unreachable' }));

    expect((await runDiscoveryScans(NOW)).message).toBe('da-admin-service is unreachable');
  });

  it('says the service could not be reached on a network error, and never throws', async () => {
    get.mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));

    const result = await runDiscoveryScans(NOW);

    expect(result.kind).toBe('failed');
    expect(result.message).toBe('The discovery service could not be reached.');
  });
});

describe('describeScanError', () => {
  it('prefers the server detail, then the status', () => {
    expect(describeScanError(httpError(404, { detail: 'Cloud connection not found' }))).toBe('Cloud connection not found');
    expect(describeScanError(httpError(502))).toContain('could not reach the cloud connection service');
    expect(describeScanError(httpError(500))).toBe('The scan could not be started (HTTP 500).');
    expect(describeScanError(httpError(401))).toBe('Your session has expired. Sign in again.');
  });

  it('ignores a blank or non-string detail', () => {
    expect(describeScanError(httpError(500, { detail: '   ' }))).toBe('The scan could not be started (HTTP 500).');
    expect(describeScanError(httpError(500, { detail: { nested: true } }))).toBe('The scan could not be started (HTTP 500).');
  });

  it('handles values that are not axios errors', () => {
    expect(describeScanError(new Error('boom'))).toBe('The scan could not be started.');
    expect(describeScanError(undefined)).toBe('The scan could not be started.');
  });
});
