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

import axios, { AxiosResponse } from 'axios';
import keycloak from '../keycloak';

// API Base Configuration
// Point at the gateway origin (8081), same convention as utils/api.ts. The
// previous 8083 default hit da-policyengine directly, bypassing the gateway
// and the JWT it forwards — Event Center views failed to load as a result.
const API_BASE_URL = import.meta.env.REACT_APP_API_BASE_URL || 'http://localhost:8081';
const API_PREFIX = '/api/v1/policyengine';

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL + API_PREFIX,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add the Keycloak JWT to every request. The old code read
// localStorage.getItem('access_token'), which is never set anywhere in the app,
// so all Event Center calls went out unauthenticated and were rejected (401).
// Mirror utils/api.ts: refresh the token if near expiry, then attach it.
apiClient.interceptors.request.use(async (config) => {
  if (keycloak.authenticated) {
    try {
      await keycloak.updateToken(30);
    } catch (error) {
      console.error('Failed to refresh Keycloak token for Event Center request:', error);
    }
    if (keycloak.token) {
      config.headers['Authorization'] = `Bearer ${keycloak.token}`;
    }
  }
  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// TypeScript Interfaces

/**
 * A subscription and its typed filter (SEC-04, ADR-0057). Each list narrows the events the
 * subscription matches; an empty list does not constrain. There are no rule conditions: the
 * backend retired them (they were MVEL, which is executable code) and answers HTTP 400 to any
 * request that still carries `rules`.
 */
export interface EventSubscriptionInput {
  name: string;
  description?: string;
  eventTypes: string[];
  severities: string[];
  sourceServices: string[];
  /** Canonical asset URI prefixes, for example `s3://finance-bucket/` or `bq://my-project/sales`. */
  assetPrefixes: string[];
  /** Label names; an event matches when it names at least one of them (case-insensitive). */
  labels: string[];
  notificationConfig: Record<string, unknown>;
  actionConfig: Record<string, unknown>;
}

/** One canonical asset URI prefix per line; blank lines are dropped. */
export function parseAssetPrefixes(text: string): string[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
}

/** Comma-separated label names; blanks and case-insensitive repeats are dropped. */
export function parseLabels(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(',')) {
    const label = part.trim();
    if (label && !seen.has(label.toLowerCase())) {
      seen.add(label.toLowerCase());
      out.push(label);
    }
  }
  return out;
}

export interface EventSubscriptionOutput {
  id: string;
  name: string;
  description?: string;
  userId: string;
  status: 'ACTIVE' | 'PAUSED' | 'DISABLED' | 'ARCHIVED';
  eventTypes: string[];
  severities: string[];
  sourceServices: string[];
  assetPrefixes?: string[];
  labels?: string[];
  /** Retired MVEL rules (SEC-04): always empty. */
  rules?: EventRuleOutput[];
  notificationConfig: Record<string, unknown>;
  actionConfig: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  updatedByUserId: string;
  totalRulesCount: number;
  enabledRulesCount: number;
  eventsMatchedCount: number;
  lastEventMatchedAt?: string;
}

/** A retired subscription rule (SEC-04). The backend no longer stores or returns any. */
export interface EventRuleOutput {
  id: string;
  name: string;
  description?: string;
  condition: string;
  priority: number;
  enabled: boolean;
  parameters?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  updatedByUserId: string;
}

export interface EventStreamData {
  eventId: string;
  eventType: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  sourceService: string;
  title: string;
  description: string;
  assetId?: string;
  assetName?: string;
  policyId?: string;
  policyName?: string;
  eventData: Record<string, unknown>;
  metadata: Record<string, unknown>;
  timestamp: string;
  userId?: string;
  userAction?: string;
  isProcessed: boolean;
  matchingSubscriptionsCount: number;
  notificationSent: boolean;
  actionTriggered: boolean;
}

export interface EventAnalytics {
  totalEventsToday: number;
  totalEventsThisWeek: number;
  totalEventsThisMonth: number;
  totalActiveSubscriptions: number;
  totalUsersWithSubscriptions: number;
  eventsByType: Array<{ eventType: string; count: number; percentage: number }>;
  eventsBySeverity: Array<{ severity: string; count: number; percentage: number }>;
  eventsBySourceService: Array<{ sourceService: string; count: number; percentage: number }>;
  topActiveSubscriptions: Array<{
    subscriptionName: string;
    eventsMatched: number;
    notificationsSent: number;
    ownerName: string;
    lastActivity: string;
  }>;
  recentTrends: Array<{
    timestamp: string;
    eventCount: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  }>;
  responseMetrics: {
    averageProcessingTimeMs: number;
    averageNotificationTimeMs: number;
    totalProcessedEvents: number;
    failedNotifications: number;
    successRate: number;
  };
  alertStats: {
    totalAlertsTriggered: number;
    totalNotificationsSent: number;
    totalActionsExecuted: number;
    alertsByChannel: Record<string, number>;
  };
  fromTime: string;
  toTime: string;
  generatedAt: string;
}

export interface PageResult<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

// API Service Class
export class EventCenterApiService {
  
  // Subscription Management APIs
  static async createSubscription(subscription: EventSubscriptionInput): Promise<EventSubscriptionOutput> {
    const response: AxiosResponse<EventSubscriptionOutput> = await apiClient.post('/events/subscriptions', subscription);
    return response.data;
  }

  static async getSubscriptions(page = 0, size = 20, status?: string, nameContains?: string): Promise<PageResult<EventSubscriptionOutput>> {
    const params: Record<string, unknown> = { page, size };
    if (status) params.status = status;
    if (nameContains) params.nameContains = nameContains;
    
    const response: AxiosResponse<PageResult<EventSubscriptionOutput>> = await apiClient.get('/events/subscriptions', { params });
    return response.data;
  }

  static async getSubscriptionById(subscriptionId: string): Promise<EventSubscriptionOutput> {
    const response: AxiosResponse<EventSubscriptionOutput> = await apiClient.get(`/events/subscriptions/${subscriptionId}`);
    return response.data;
  }

  static async updateSubscription(subscriptionId: string, subscription: EventSubscriptionInput): Promise<EventSubscriptionOutput> {
    const response: AxiosResponse<EventSubscriptionOutput> = await apiClient.put(`/events/subscriptions/${subscriptionId}`, subscription);
    return response.data;
  }

  static async deleteSubscription(subscriptionId: string): Promise<void> {
    await apiClient.delete(`/events/subscriptions/${subscriptionId}`);
  }

  static async updateSubscriptionStatus(subscriptionId: string, status: string): Promise<EventSubscriptionOutput> {
    const response: AxiosResponse<EventSubscriptionOutput> = await apiClient.put(`/events/subscriptions/${subscriptionId}/status`, null, {
      params: { status }
    });
    return response.data;
  }

  // Event Streaming APIs
  static async getEventStream(limit = 50): Promise<EventStreamData[]> {
    const response: AxiosResponse<EventStreamData[]> = await apiClient.get('/events/stream', {
      params: { limit }
    });
    return response.data;
  }

  static async getAllEventStream(limit = 100): Promise<EventStreamData[]> {
    const response: AxiosResponse<EventStreamData[]> = await apiClient.get('/events/stream/all', {
      params: { limit }
    });
    return response.data;
  }

  static async getHistoricalEvents(subscriptionId: string, page = 0, size = 50): Promise<PageResult<EventStreamData>> {
    const response: AxiosResponse<PageResult<EventStreamData>> = await apiClient.get(`/events/subscriptions/${subscriptionId}/history`, {
      params: { page, size }
    });
    return response.data;
  }

  // Analytics APIs
  static async getEventAnalytics(fromTime?: string, toTime?: string): Promise<EventAnalytics> {
    const params: Record<string, string> = {};
    if (fromTime) params.fromTime = fromTime;
    if (toTime) params.toTime = toTime;
    
    const response: AxiosResponse<EventAnalytics> = await apiClient.get('/events/analytics', { params });
    return response.data;
  }

  static async getSystemEventAnalytics(): Promise<EventAnalytics> {
    const response: AxiosResponse<EventAnalytics> = await apiClient.get('/events/analytics/system');
    return response.data;
  }

  // Configuration APIs.
  // There is no rule-test call: the backend endpoint that ran a caller-supplied MVEL
  // condition was removed (SEC-01), and rule conditions are retired altogether (SEC-04).
  static async getAvailableEventTypes(): Promise<string[]> {
    const response: AxiosResponse<string[]> = await apiClient.get('/events/config/event-types');
    return response.data;
  }

  static async getAvailableSourceServices(): Promise<string[]> {
    const response: AxiosResponse<string[]> = await apiClient.get('/events/config/source-services');
    return response.data;
  }

  static async validateSubscriptionConfiguration(subscription: EventSubscriptionInput): Promise<void> {
    await apiClient.post('/events/config/validate', subscription);
  }
}

/**
 * Polling client for the Event Center stream.
 *
 * The backend /events/stream endpoint returns a plain JSON array (not an SSE /
 * text/event-stream), so this intentionally polls over REST rather than opening
 * an EventSource/WebSocket. "Connected" reflects whether the most recent poll
 * actually succeeded — it is no longer set to true unconditionally.
 */
export class EventStreamWebSocketService {
  private isConnected = false;
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly pollMs = 5000;

  constructor(
    private onEventReceived: (event: EventStreamData) => void,
    private onConnectionStatusChanged: (connected: boolean) => void
  ) {}

  connect(): void {
    // Guard against double-connect leaving an orphaned interval.
    if (this.pollIntervalId !== null) {
      return;
    }
    // Do one immediate poll, then poll on an interval. Connection status is
    // driven by poll outcomes inside pollOnce().
    void this.pollOnce();
    this.pollIntervalId = setInterval(() => {
      void this.pollOnce();
    }, this.pollMs);
  }

  private async pollOnce(): Promise<void> {
    try {
      const events = await EventCenterApiService.getAllEventStream(10);
      events.forEach((event) => this.onEventReceived(event));
      this.setConnected(true);
    } catch (error) {
      console.error('Error polling for events:', error);
      this.setConnected(false);
    }
  }

  private setConnected(connected: boolean): void {
    if (this.isConnected !== connected) {
      this.isConnected = connected;
      this.onConnectionStatusChanged(connected);
    }
  }

  disconnect(): void {
    if (this.pollIntervalId !== null) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    this.setConnected(false);
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export default EventCenterApiService; 