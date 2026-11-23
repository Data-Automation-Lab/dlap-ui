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

import { beforeEach, describe, expect, it, vi } from 'vitest';
// Vite ?raw import: the module source as a string, independent of the test environment.
import apiSource from './eventCenterApi.ts?raw';

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    create: () => ({
      ...http,
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    }),
  },
}));

vi.mock('../keycloak', () => ({
  default: { authenticated: false, token: undefined, updateToken: vi.fn() },
}));

import {
  EventCenterApiService,
  parseAssetPrefixes,
  parseLabels,
  type EventSubscriptionInput,
} from './eventCenterApi';

describe('EventCenterApiService (SEC-01: no caller-supplied code is evaluated)', () => {
  beforeEach(() => {
    Object.values(http).forEach((fn) => fn.mockReset());
  });

  it('has no rule-test call, because the backend endpoint that ran MVEL is gone', () => {
    expect((EventCenterApiService as unknown as Record<string, unknown>).testEventRule).toBeUndefined();
  });

  it('never references the removed rule-test endpoint', () => {
    // The path is assembled so that a source grep for the old endpoint stays empty.
    const removedPath = ['test', 'rule'].join('-');
    expect(apiSource).not.toContain(removedPath);
    expect(apiSource).not.toContain('testEventRule');
  });

  it('validateSubscriptionConfiguration only posts the configuration to the structure check', async () => {
    http.post.mockResolvedValue({ data: undefined });
    const subscription: EventSubscriptionInput = {
      name: 's1',
      eventTypes: [],
      severities: [],
      sourceServices: [],
      assetPrefixes: ['s3://finance/'],
      labels: ['PII'],
      notificationConfig: { email: true },
      actionConfig: {},
    };

    await EventCenterApiService.validateSubscriptionConfiguration(subscription);

    expect(http.post).toHaveBeenCalledTimes(1);
    expect(http.post).toHaveBeenCalledWith('/events/config/validate', subscription);
  });
});

describe('typed subscription filters (SEC-04: rule conditions are retired)', () => {
  it('the subscription input type has no rules field', () => {
    // The interface block of EventSubscriptionInput, as written in the source.
    const start = apiSource.indexOf('export interface EventSubscriptionInput {');
    const block = apiSource.slice(start, apiSource.indexOf('}', start));
    expect(start).toBeGreaterThan(-1);
    expect(block).not.toMatch(/\brules\b/);
    expect(block).toContain('assetPrefixes: string[]');
    expect(block).toContain('labels: string[]');
  });

  it('parseAssetPrefixes keeps one trimmed prefix per non-blank line', () => {
    expect(parseAssetPrefixes(' s3://finance/ \r\n\n bq://analytics-prod/sales\n')).toEqual([
      's3://finance/',
      'bq://analytics-prod/sales',
    ]);
    expect(parseAssetPrefixes('')).toEqual([]);
  });

  it('parseLabels splits on commas and drops blanks and case-insensitive repeats', () => {
    expect(parseLabels('PII, pii ,Finance,, ')).toEqual(['PII', 'Finance']);
    expect(parseLabels('')).toEqual([]);
  });
});
