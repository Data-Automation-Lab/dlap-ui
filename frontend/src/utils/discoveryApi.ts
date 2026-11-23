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

import axios from 'axios';
import { discoveryApi } from './api';

/**
 * Starting a discovery scan from the UI (DISC-01).
 *
 * The Discovery overview used to look for a cloud-connection id in the data-sources list, which
 * never carries one, so the button did nothing and still reported success. The scan runner now
 * asks da-discovery which connections can be scanned (GET /api/v1/discovery/connections, served
 * from da-admin-service over a service-account token, so no admin role is needed) and starts one
 * FULL scan per scannable connection (POST /api/v1/discovery/scans). The server decides what is
 * scannable; this module only presents the outcome.
 */

/** Shown when there is no connection to scan. The first words are the acceptance text. */
export const NO_CONNECTION_MESSAGE = 'No cloud connection configured';

/** One entry of GET /api/v1/discovery/connections (non-secret fields only). */
export interface DiscoveryConnection {
  id: string;
  name: string;
  providerType: string;
  enabled: boolean;
  /** True when the connection is enabled and its provider can be scanned. */
  scannable: boolean;
}

/** A scan the server accepted. */
export interface StartedScan {
  connectionId: string;
  connectionName: string;
  scanId: string;
}

/** A scan that could not be started, with a message fit to show the user. */
export interface FailedScan {
  connectionId: string;
  connectionName: string;
  reason: string;
}

/**
 * What a click on "scan now" achieved.
 * - `started`: every scannable connection has a scan running.
 * - `partial`: some scans started, some did not.
 * - `failed`: nothing started, or the connections could not be loaded.
 * - `no-connection`: there is nothing to scan; {@link NO_CONNECTION_MESSAGE} leads the message.
 */
export interface ScanRunResult {
  kind: 'started' | 'partial' | 'failed' | 'no-connection';
  message: string;
  started: StartedScan[];
  failed: FailedScan[];
}

/** RFC 7807 body da-discovery returns for a refused request (the fields this module reads). */
interface ProblemBody {
  detail?: unknown;
  title?: unknown;
  message?: unknown;
}

/**
 * Turns a failed request into one sentence for the user. Prefers the server's own explanation
 * (`detail`), which the controller writes for the user, then falls back to the HTTP status.
 */
export function describeScanError(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return 'The scan could not be started.';
  }
  const status = error.response?.status;
  if (status === undefined) {
    return 'The discovery service could not be reached.';
  }
  const body = (error.response?.data ?? {}) as ProblemBody;
  const detail = typeof body.detail === 'string' ? body.detail.trim() : '';
  if (status === 403) {
    return 'You do not have permission to run discovery scans.';
  }
  if (status === 401) {
    return 'Your session has expired. Sign in again.';
  }
  if (detail) {
    return detail;
  }
  if (status === 503 || status === 502) {
    return 'The discovery service could not reach the cloud connection service. Try again shortly.';
  }
  return `The scan could not be started (HTTP ${status}).`;
}

/** Lists the connections da-discovery knows about, keeping only those a scan can be started for. */
export async function listScanConnections(): Promise<{ all: DiscoveryConnection[]; scannable: DiscoveryConnection[] }> {
  const response = await discoveryApi.get<DiscoveryConnection[]>('/connections');
  const all = Array.isArray(response.data) ? response.data : [];
  return { all, scannable: all.filter(connection => connection.scannable === true) };
}

/**
 * Starts a FULL scan of one connection.
 * @throws when the server refuses the request or accepts it but reports the job as FAILED.
 */
export async function startDiscoveryScan(connection: DiscoveryConnection, scanName: string): Promise<StartedScan> {
  const response = await discoveryApi.post<{ scanId?: string; status?: string }>('/scans', {
    cloudConnectionId: connection.id,
    scanType: 'FULL',
    scanName,
    // The API requires a scope object; an empty one means "everything the connection reaches".
    scope: {},
  });
  const scanId = response.data?.scanId;
  if (!scanId || response.data?.status === 'FAILED') {
    // 202 with status FAILED: the job row exists but the crawler could not be started.
    throw new Error('The scan was created but could not be started. Check the discovery service log.');
  }
  return { connectionId: connection.id, connectionName: connection.name, scanId };
}

/** Joins names as "A", "A and B" or "A, B and C". */
function joinNames(names: string[]): string {
  if (names.length <= 1) {
    return names.join('');
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Starts a scan for every scannable cloud connection and reports what happened.
 * Never throws: every failure is returned as a {@link ScanRunResult} the page can show.
 *
 * @param now clock for the scan name; injectable for tests
 */
export async function runDiscoveryScans(now: () => Date = () => new Date()): Promise<ScanRunResult> {
  let connections: Awaited<ReturnType<typeof listScanConnections>>;
  try {
    connections = await listScanConnections();
  } catch (error) {
    return { kind: 'failed', message: describeScanError(error), started: [], failed: [] };
  }

  if (connections.scannable.length === 0) {
    const unusable = connections.all.length;
    const message =
      unusable === 0
        ? NO_CONNECTION_MESSAGE
        : `${NO_CONNECTION_MESSAGE} that can be scanned: ${unusable} ${unusable === 1 ? 'connection is' : 'connections are'} disabled or unsupported.`;
    return { kind: 'no-connection', message, started: [], failed: [] };
  }

  const scanName = `manual-scan-${now().toISOString().slice(0, 19)}`;
  const started: StartedScan[] = [];
  const failed: FailedScan[] = [];
  for (const connection of connections.scannable) {
    try {
      started.push(await startDiscoveryScan(connection, scanName));
    } catch (error) {
      const reason = error instanceof Error && !axios.isAxiosError(error) ? error.message : describeScanError(error);
      failed.push({ connectionId: connection.id, connectionName: connection.name, reason });
    }
  }

  if (failed.length === 0) {
    const names = joinNames(started.map(scan => scan.connectionName));
    const message = started.length === 1 ? `Scan started for ${names}.` : `Started ${started.length} scans: ${names}.`;
    return { kind: 'started', message, started, failed };
  }
  const reasons = failed.map(scan => `${scan.connectionName}: ${scan.reason}`).join(' ');
  if (started.length === 0) {
    return { kind: 'failed', message: reasons, started, failed };
  }
  return {
    kind: 'partial',
    message: `Started ${started.length} of ${started.length + failed.length} scans. ${reasons}`,
    started,
    failed,
  };
}
