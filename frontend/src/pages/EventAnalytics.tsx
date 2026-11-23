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

import { useCallback, useEffect, useState } from 'react';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { Badge } from '../ui/components/Badge';
import { Button } from '../ui/components/Button';
import { DefaultPageLayout } from '../ui/layouts/DefaultPageLayout';
import { NOT_AVAILABLE_YET, isNum } from '../utils/apiServices';
import { EventCenterApiService } from '../utils/eventCenterApi';

/**
 * The analytics payload as da-policyengine EventAnalyticsDTO really sends it.
 * Every metric is optional and can be null: the time-range query the page uses
 * fills in only the event count for the range, so most of this object is empty.
 * The TypeScript type in eventCenterApi lists every field as present, which
 * made this page throw on the first missing one.
 */
interface AnalyticsPayload {
  /** Events in the selected range. The backend returns this in totalEventsThisMonth. */
  totalEventsInRange?: number | null;
  totalEventsToday?: number | null;
  totalEventsThisWeek?: number | null;
  totalEventsThisMonth?: number | null;
  totalActiveSubscriptions?: number | null;
  totalUsersWithSubscriptions?: number | null;
  eventsByType?: Array<{ eventType?: string | null; count?: number | null; percentage?: number | null }> | null;
  eventsBySeverity?: Array<{ severity?: string | null; count?: number | null; percentage?: number | null }> | null;
  topActiveSubscriptions?: Array<{
    subscriptionName?: string | null;
    eventsMatched?: number | null;
    notificationsSent?: number | null;
    ownerName?: string | null;
  }> | null;
  responseMetrics?: {
    averageProcessingTimeMs?: number | null;
    totalProcessedEvents?: number | null;
    successRate?: number | null;
  } | null;
  alertStats?: { totalNotificationsSent?: number | null } | null;
}

/** Labels for the time-range selector. */
const RANGE_LABELS: Record<string, string> = {
  '1d': 'Last 24h',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

// Map the time-range selector to an ISO fromTime window the backend accepts.
// toTime is left as "now" (omitted → server default), fromTime is derived here.
const RANGE_TO_MS: Record<string, number> = {
  '1d': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
};

function EventAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const windowMs = RANGE_TO_MS[timeRange] ?? RANGE_TO_MS['7d'];
      const fromTime = new Date(Date.now() - windowMs).toISOString();
      const toTime = new Date().toISOString();
      const data = await EventCenterApiService.getEventAnalytics(fromTime, toTime);
      setAnalytics(data ? { ...data, totalEventsInRange: data.totalEventsThisMonth } : null);
      setError(null);
    } catch (err) {
      setError('Failed to load analytics data');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  /** A count for display; NOT_AVAILABLE_YET when the backend sent none. */
  const formatNumber = (num: number | null | undefined) =>
    isNum(num) ? new Intl.NumberFormat().format(num) : NOT_AVAILABLE_YET;

  /** Class for a headline number, small and grey when it is the placeholder. */
  const metricClass = (value: number | null | undefined, color = '') =>
    isNum(value) ? `text-2xl font-bold ${color}`.trim() : 'text-sm text-gray-500';

  // Client-side export of the real analytics payload already loaded. No
  // fabricated data - serializes exactly what the backend returned.
  const handleExportData = () => {
    if (!analytics) return;
    const blob = new Blob([JSON.stringify(analytics, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-analytics-${timeRange}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <DefaultPageLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Event Analytics</h1>
              <p className="text-gray-600">Loading analytics data...</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </DefaultPageLayout>
    );
  }

  if (error) {
    return (
      <DefaultPageLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Event Analytics</h1>
          </div>
          <ErrorState message={error} onRetry={fetchAnalytics} />
        </div>
      </DefaultPageLayout>
    );
  }

  // Every section can be missing from the response; read them safely.
  const responseMetrics = analytics?.responseMetrics ?? {};
  const eventsByType = analytics?.eventsByType ?? [];
  const eventsBySeverity = analytics?.eventsBySeverity ?? [];
  const topSubscriptions = analytics?.topActiveSubscriptions ?? [];

  return (
    <DefaultPageLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Event Analytics</h1>
            <p className="text-gray-600">
              Comprehensive analytics dashboard for event monitoring and insights
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1d">Last 24h</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            <Button onClick={fetchAnalytics} variant="neutral-secondary">
              Refresh
            </Button>
          </div>
        </div>

        {analytics && (
          <>
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Events in Range</h3>
                  <Badge variant="neutral">{RANGE_LABELS[timeRange] ?? timeRange}</Badge>
                </div>
                <div className={metricClass(analytics.totalEventsInRange)}>{formatNumber(analytics.totalEventsInRange)}</div>
                {isNum(analytics.totalEventsToday) ? (
                  <p className="text-xs text-gray-500">
                    {formatNumber(analytics.totalEventsToday)} today
                  </p>
                ) : null}
              </div>

              <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Active Subscriptions</h3>
                  <Badge variant="success">Active</Badge>
                </div>
                <div className={metricClass(analytics.totalActiveSubscriptions)}>{formatNumber(analytics.totalActiveSubscriptions)}</div>
                {isNum(analytics.totalUsersWithSubscriptions) ? (
                  <p className="text-xs text-gray-500">
                    {formatNumber(analytics.totalUsersWithSubscriptions)} users
                  </p>
                ) : null}
              </div>

              <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Success Rate</h3>
                  <Badge variant="success">Processing</Badge>
                </div>
                <div className={metricClass(responseMetrics.successRate, "text-green-600")}>
                  {isNum(responseMetrics.successRate) ? `${responseMetrics.successRate}%` : NOT_AVAILABLE_YET}
                </div>
                {isNum(responseMetrics.totalProcessedEvents) ? (
                  <p className="text-xs text-gray-500">
                    {formatNumber(responseMetrics.totalProcessedEvents)} processed
                  </p>
                ) : null}
              </div>

              <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Avg Response Time</h3>
                  <Badge variant="warning">Performance</Badge>
                </div>
                <div className={metricClass(responseMetrics.averageProcessingTimeMs)}>
                  {isNum(responseMetrics.averageProcessingTimeMs)
                    ? `${responseMetrics.averageProcessingTimeMs}ms`
                    : NOT_AVAILABLE_YET}
                </div>
                <p className="text-xs text-gray-500">
                  Processing time
                </p>
              </div>
            </div>

            {/* Detailed Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Event Volume */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-2">Event Volume</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Events matched by your subscriptions
                </p>
                <div className="space-y-4">
                  {[
                    { label: RANGE_LABELS[timeRange] ?? "Selected range", value: analytics.totalEventsInRange },
                    { label: "This Week", value: analytics.totalEventsThisWeek },
                    { label: "Today", value: analytics.totalEventsToday },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{row.label}</span>
                      <span className="text-sm text-gray-500">
                        {isNum(row.value) ? `${formatNumber(row.value)} events` : NOT_AVAILABLE_YET}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Simple bar chart visualization, drawn only when both counts exist */}
                {isNum(analytics.totalEventsToday) && isNum(analytics.totalEventsThisWeek) ? (
                  <div className="mt-6 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span>Today</span>
                      <span>{analytics.totalEventsToday}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min((analytics.totalEventsToday / Math.max(analytics.totalEventsThisWeek, 1)) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Events by Type */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-2">Events by Type</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Distribution of events by type
                </p>
                {eventsByType.length > 0 ? (
                  <div className="space-y-3">
                    {eventsByType.slice(0, 5).map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.eventType || "-"}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">{formatNumber(item.count)}</span>
                          {isNum(item.percentage) ? <Badge variant="neutral">{item.percentage}%</Badge> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">{NOT_AVAILABLE_YET}</p>
                )}
              </div>
            </div>

            {/* Events by Severity */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-2">Events by Severity</h3>
              <p className="text-sm text-gray-600 mb-4">
                Distribution of events by severity level
              </p>
              {eventsBySeverity.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {eventsBySeverity.map((item, index) => (
                    <div key={index} className="text-center">
                      <div className="text-2xl font-bold">
                        {formatNumber(item.count)}
                      </div>
                      <p className="text-sm text-gray-500">{item.severity || "-"}</p>
                      {isNum(item.percentage) ? <Badge variant="neutral">{item.percentage}%</Badge> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">{NOT_AVAILABLE_YET}</p>
              )}
            </div>

            {/* Top Active Subscriptions */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-2">Top Active Subscriptions</h3>
              <p className="text-sm text-gray-600 mb-4">
                Most active event subscriptions
              </p>
              {topSubscriptions.length > 0 ? (
                <div className="space-y-3">
                  {topSubscriptions.slice(0, 5).map((subscription, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div>
                        <div className="font-medium">{subscription.subscriptionName || "Unnamed subscription"}</div>
                        <div className="text-sm text-gray-500">Owner: {subscription.ownerName || "-"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatNumber(subscription.eventsMatched)} events</div>
                        <div className="text-xs text-gray-500">{formatNumber(subscription.notificationsSent)} notifications</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">{NOT_AVAILABLE_YET}</p>
              )}
            </div>

            {/* Performance Metrics */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-2">Performance Metrics</h3>
              <p className="text-sm text-gray-600 mb-4">
                System performance and event processing statistics
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className={metricClass(responseMetrics.averageProcessingTimeMs, "text-blue-600")}>
                    {isNum(responseMetrics.averageProcessingTimeMs)
                      ? `${responseMetrics.averageProcessingTimeMs}ms`
                      : NOT_AVAILABLE_YET}
                  </div>
                  <p className="text-sm text-gray-500">Avg Processing Time</p>
                </div>
                <div className="text-center">
                  <div className={metricClass(responseMetrics.successRate, "text-green-600")}>
                    {isNum(responseMetrics.successRate) ? `${responseMetrics.successRate}%` : NOT_AVAILABLE_YET}
                  </div>
                  <p className="text-sm text-gray-500">Success Rate</p>
                </div>
                <div className="text-center">
                  <div className={metricClass(analytics.alertStats?.totalNotificationsSent, "text-orange-600")}>
                    {formatNumber(analytics.alertStats?.totalNotificationsSent)}
                  </div>
                  <p className="text-sm text-gray-500">Notifications Sent</p>
                </div>
              </div>
            </div>

            {/* Export the real analytics payload as JSON (client-side). */}
            <div className="flex justify-end space-x-4">
              <Button variant="neutral-secondary" onClick={handleExportData}>
                Export Data
              </Button>
            </div>
          </>
        )}

        {!analytics && (
          <EmptyState
            title="No Analytics Available"
            message="No event analytics are available for the selected time range yet."
          />
        )}
      </div>
    </DefaultPageLayout>
  );
}

export default EventAnalytics; 