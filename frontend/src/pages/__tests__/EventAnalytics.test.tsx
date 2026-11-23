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
import EventAnalytics from '../EventAnalytics';
import { quietConsole, renderPage } from './testUtils';

vi.mock('../../utils/api', async () => (await import('./testUtils')).makeApiMock());
vi.mock('../../keycloak', async () => (await import('./testUtils')).makeKeycloakMock());
// eventCenterApi builds its own axios client, so the service itself is replaced.
vi.mock('../../utils/eventCenterApi', () => ({
  EventCenterApiService: { getEventAnalytics: vi.fn() },
}));

const getEventAnalytics = EventCenterApiService.getEventAnalytics as unknown as ReturnType<typeof vi.fn>;

/**
 * da-policyengine EventAnalyticsDTO as GET /events/analytics?fromTime&toTime returns it:
 * getEventAnalyticsForTimeRange fills in only the event count for the range (in
 * totalEventsThisMonth) and the time window. Every other field is null.
 */
const rangeOnlyDto = {
  totalEventsToday: null,
  totalEventsThisWeek: null,
  totalEventsThisMonth: 42,
  totalActiveSubscriptions: null,
  totalUsersWithSubscriptions: null,
  eventsByType: null,
  eventsBySeverity: null,
  eventsBySourceService: null,
  topActiveSubscriptions: null,
  recentTrends: null,
  responseMetrics: null,
  alertStats: null,
  fromTime: '2026-10-11T10:00:00Z',
  toTime: '2026-10-18T10:00:00Z',
  generatedAt: '2026-10-18T10:00:01Z',
};

/** The same DTO with every section filled in. */
const fullDto = {
  totalEventsToday: 5,
  totalEventsThisWeek: 30,
  totalEventsThisMonth: 120,
  totalActiveSubscriptions: 7,
  totalUsersWithSubscriptions: 3,
  eventsByType: [
    { eventType: 'POLICY_VIOLATION', count: 80, percentage: 66.7 },
    { eventType: 'ASSET_DISCOVERED', count: 40, percentage: 33.3 },
  ],
  eventsBySeverity: [
    { severity: 'HIGH', count: 20, percentage: 16.7 },
    { severity: 'LOW', count: 100, percentage: 83.3 },
  ],
  eventsBySourceService: [{ sourceService: 'da-catalog', count: 120, percentage: 100.0 }],
  topActiveSubscriptions: [
    {
      subscriptionName: 'PII violations',
      eventsMatched: 55,
      notificationsSent: 51,
      ownerName: 'Olive Owner',
      lastActivity: '2026-10-18T09:00:00Z',
    },
  ],
  recentTrends: [],
  responseMetrics: {
    averageProcessingTimeMs: 12.5,
    averageNotificationTimeMs: 30.0,
    totalProcessedEvents: 118,
    failedNotifications: 2,
    successRate: 98.3,
  },
  alertStats: { totalAlertsTriggered: 9, totalNotificationsSent: 51, totalActionsExecuted: 4, alertsByChannel: { email: 40 } },
  fromTime: '2026-10-11T10:00:00Z',
  toTime: '2026-10-18T10:00:00Z',
  generatedAt: '2026-10-18T10:00:01Z',
};

/** Elements showing a text, leaving out the <option> of the range dropdown. */
const shown = (text: string) => screen.queryAllByText(text).filter((el) => el.tagName !== 'OPTION');

describe('EventAnalytics', () => {
  beforeEach(() => {
    quietConsole();
    getEventAnalytics.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not crash on the range-only DTO the backend returns; missing metrics read "Not available yet"', async () => {
    getEventAnalytics.mockResolvedValue(rangeOnlyDto);
    const { container } = renderPage(<EventAnalytics />);
    // The old code read responseMetrics.successRate and eventsByType.slice on null.
    expect(await screen.findByText('Events in Range')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    // The range label is on the tile badge and on the volume row (the dropdown option is the third).
    expect(shown('Last 7 days').length).toBe(2);
    expect(screen.getAllByText('Not available yet').length).toBeGreaterThan(6);
    expect(container.textContent).not.toMatch(/NaN|undefined|null/);
  });

  it('asks for the selected window and relabels the tile when the range changes', async () => {
    getEventAnalytics.mockResolvedValue(rangeOnlyDto);
    renderPage(<EventAnalytics />);
    await screen.findByText('Events in Range');
    expect(getEventAnalytics).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '30d' } });
    await waitFor(() => expect(getEventAnalytics).toHaveBeenCalledTimes(2));
    const [fromTime, toTime] = getEventAnalytics.mock.calls[1];
    const days = (Date.parse(toTime) - Date.parse(fromTime)) / (24 * 60 * 60 * 1000);
    expect(Math.round(days)).toBe(30);
    await waitFor(() => expect(shown('Last 30 days').length).toBe(2));
  });

  it('renders every section of a fully populated DTO', async () => {
    getEventAnalytics.mockResolvedValue(fullDto);
    const { container } = renderPage(<EventAnalytics />);
    expect(await screen.findByText('120 events', { selector: 'span' })).toBeTruthy();
    expect(screen.getByText('5 today')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('3 users')).toBeTruthy();
    expect(screen.getAllByText('98.3%').length).toBe(2);
    expect(screen.getAllByText('12.5ms').length).toBe(2);
    expect(screen.getByText('118 processed')).toBeTruthy();
    expect(screen.getByText('POLICY_VIOLATION')).toBeTruthy();
    expect(screen.getByText('66.7%')).toBeTruthy();
    expect(screen.getByText('PII violations')).toBeTruthy();
    expect(screen.getByText('Owner: Olive Owner')).toBeTruthy();
    expect(screen.getByText('55 events')).toBeTruthy();
    expect(screen.getByText('51')).toBeTruthy();
    expect(container.textContent).not.toMatch(/NaN|undefined|null/);
  });

  it('shows an error when the request fails', async () => {
    getEventAnalytics.mockRejectedValue(new Error('403'));
    renderPage(<EventAnalytics />);
    expect(await screen.findByText('Failed to load analytics data')).toBeTruthy();
  });

  it('shows the empty state when the backend returns nothing', async () => {
    getEventAnalytics.mockResolvedValue(null);
    renderPage(<EventAnalytics />);
    expect(await screen.findByText('No Analytics Available')).toBeTruthy();
  });
});
