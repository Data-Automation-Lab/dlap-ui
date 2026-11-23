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
import { EventCenterApiService } from '../../utils/eventCenterApi';
import EventSubscriptions from '../EventSubscriptions';
import { quietConsole, renderPage } from './testUtils';

vi.mock('../../utils/api', async () => (await import('./testUtils')).makeApiMock());
vi.mock('../../keycloak', async () => (await import('./testUtils')).makeKeycloakMock());
// Keep the real parse helpers; replace only the HTTP service.
vi.mock('../../utils/eventCenterApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/eventCenterApi')>();
  return {
    ...actual,
    EventCenterApiService: {
      getSubscriptions: vi.fn(),
      getAvailableEventTypes: vi.fn(),
      getAvailableSourceServices: vi.fn(),
      validateSubscriptionConfiguration: vi.fn(),
      createSubscription: vi.fn(),
      updateSubscription: vi.fn(),
      updateSubscriptionStatus: vi.fn(),
      deleteSubscription: vi.fn(),
    },
  };
});

const api = EventCenterApiService as unknown as Record<string, ReturnType<typeof vi.fn>>;

/** A subscription as GET /events/subscriptions returns it after SEC-04: no rules. */
const existing = {
  id: 'sub-1',
  name: 'Finance PII',
  description: 'PII changes in the finance bucket',
  userId: 'u1',
  status: 'ACTIVE',
  eventTypes: ['ASSET_CLASSIFICATION_CHANGED'],
  severities: [],
  sourceServices: ['da-catalog'],
  assetPrefixes: ['s3://finance/'],
  labels: ['PII'],
  rules: [],
  notificationConfig: { inApp: true },
  actionConfig: {},
  createdAt: '2026-10-18T10:00:00Z',
  updatedAt: '2026-10-18T10:00:00Z',
  createdByUserId: 'u1',
  updatedByUserId: 'u1',
  totalRulesCount: 0,
  enabledRulesCount: 0,
  eventsMatchedCount: 3,
};

describe('EventSubscriptions (SEC-04: typed filters, no rule conditions)', () => {
  beforeEach(() => {
    quietConsole();
    Object.values(api).forEach((fn) => fn.mockReset());
    api.getSubscriptions.mockResolvedValue({ content: [existing], totalElements: 1, totalPages: 1, size: 100, number: 0 });
    api.getAvailableEventTypes.mockResolvedValue(['ASSET_DISCOVERED', 'ASSET_CLASSIFICATION_CHANGED']);
    api.getAvailableSourceServices.mockResolvedValue(['da-catalog', 'da-discovery']);
    api.validateSubscriptionConfiguration.mockResolvedValue(undefined);
    api.createSubscription.mockImplementation(async (input: Record<string, unknown>) => ({ ...existing, ...input, id: 'sub-2' }));
    api.updateSubscription.mockImplementation(async (_id: string, input: Record<string, unknown>) => ({ ...existing, ...input }));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the stored label and prefix filter of a subscription', async () => {
    renderPage(<EventSubscriptions />);
    expect(await screen.findByText('Finance PII')).toBeTruthy();
    expect(screen.getByText('Labels: PII; Asset prefixes: 1')).toBeTruthy();
  });

  it('creates a subscription with asset prefixes and labels and never sends rules', async () => {
    renderPage(<EventSubscriptions />);
    await screen.findByText('Finance PII');

    fireEvent.click(screen.getByText('New Subscription'));
    fireEvent.change(screen.getByPlaceholderText('Enter subscription name'), { target: { value: 'Landing zone' } });
    fireEvent.click(screen.getByLabelText('ASSET_DISCOVERED'));
    fireEvent.change(screen.getByLabelText('Asset prefixes (one per line)'), {
      target: { value: ' gs://landing/\n\nbq://analytics-prod/sales \n' },
    });
    fireEvent.change(screen.getByLabelText('Labels (comma-separated)'), { target: { value: 'PII, pii, Finance,' } });
    fireEvent.click(screen.getByText('Create Subscription'));

    await waitFor(() => expect(api.createSubscription).toHaveBeenCalledTimes(1));
    const sent = api.createSubscription.mock.calls[0][0];
    expect(sent.assetPrefixes).toEqual(['gs://landing/', 'bq://analytics-prod/sales']);
    expect(sent.labels).toEqual(['PII', 'Finance']);
    expect(sent.eventTypes).toEqual(['ASSET_DISCOVERED']);
    expect(sent).not.toHaveProperty('rules');
    expect(api.validateSubscriptionConfiguration).toHaveBeenCalledWith(sent);
  });

  it('edits a subscription with its stored filters pre-filled and sends no rules', async () => {
    renderPage(<EventSubscriptions />);
    await screen.findByText('Finance PII');

    fireEvent.click(screen.getByLabelText('Edit Finance PII'));

    expect((screen.getByLabelText('Asset prefixes (one per line)') as HTMLTextAreaElement).value).toBe('s3://finance/');
    expect((screen.getByLabelText('Labels (comma-separated)') as HTMLInputElement).value).toBe('PII');
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(api.updateSubscription).toHaveBeenCalledTimes(1));
    const [id, sent] = api.updateSubscription.mock.calls[0];
    expect(id).toBe('sub-1');
    expect(sent.assetPrefixes).toEqual(['s3://finance/']);
    expect(sent.labels).toEqual(['PII']);
    expect(sent).not.toHaveProperty('rules');
  });
});
