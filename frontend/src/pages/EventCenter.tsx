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

import { FeatherActivity, FeatherAlertTriangle, FeatherCheckCircle, FeatherClock, FeatherEye, FeatherInfo, FeatherRefreshCw, FeatherSettings, FeatherWifi, FeatherWifiOff, FeatherXCircle } from '@subframe/core';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../ui/components/Badge';
import { Button } from '../ui/components/Button';
import { IconWithBackground } from '../ui/components/IconWithBackground';
import { Select } from '../ui/components/Select';
import { Table } from '../ui/components/Table';
import { TextField } from '../ui/components/TextField';
import { ToggleGroup } from '../ui/components/ToggleGroup';
import { DefaultPageLayout } from '../ui/layouts/DefaultPageLayout';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { EventCenterApiService, EventStreamWebSocketService, type EventStreamData } from '../utils/eventCenterApi';
import { formatRelative } from '../utils/safeDate';

// TypeScript interfaces for Event Center
interface IEventFilters {
  eventType: string;
  eventSource: string;
  severity: string;
  timeRange: string;
  searchQuery: string;
  assetId: string;
  userId: string;
}

interface IEventStats {
  totalEvents: number;
  criticalEvents: number;
  newEvents: number;
  resolvedEvents: number;
}

// Relative-time labels for event timestamps use the shared safeDate helper
// (utils/safeDate.formatRelative), which guards invalid/null values that would
// otherwise cause date-fns to throw and blank the entire event list.

function EventCenter() {
  const [events, setEvents] = useState<EventStreamData[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EventStreamData[]>([]);
  const [stats, setStats] = useState<IEventStats>({
    totalEvents: 0,
    criticalEvents: 0,
    newEvents: 0,
    resolvedEvents: 0
  });
  const [selectedEvent, setSelectedEvent] = useState<EventStreamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const [filters, setFilters] = useState<IEventFilters>({
    eventType: 'all',
    eventSource: 'all',
    severity: 'all',
    timeRange: '24h',
    searchQuery: '',
    assetId: '',
    userId: ''
  });

  // Load initial event stream
  const loadEventStream = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Event Center is a platform-wide monitor: show ALL recorded events
      // (admin-scoped /events/stream/all), not just the current user's subscriptions.
      const eventStream = await EventCenterApiService.getAllEventStream(100);
      setEvents(eventStream);
      
      // Calculate stats from events
      const critical = eventStream.filter(e => e.severity === 'CRITICAL').length;
      const newEvents = eventStream.filter(e => !e.isProcessed).length;
      const processed = eventStream.filter(e => e.isProcessed).length;
      
      setStats({
        totalEvents: eventStream.length,
        criticalEvents: critical,
        newEvents: newEvents,
        resolvedEvents: processed
      });
    } catch (err) {
      console.error('Failed to load event stream:', err);
      setError('Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    const wsService = new EventStreamWebSocketService(
      (newEvent: EventStreamData) => {
        setEvents(prevEvents => [newEvent, ...prevEvents.slice(0, 99)]);
      },
      (connected: boolean) => {
        setIsConnected(connected);
      }
    );

    wsService.connect();

    return () => {
      wsService.disconnect();
    };
  }, []);

  // Load initial data
  useEffect(() => {
    loadEventStream();
  }, [loadEventStream]);

  // Apply filters to events
  useEffect(() => {
    let filtered = events;

    if (filters.eventType && filters.eventType !== 'all') {
      filtered = filtered.filter(event => event.eventType.toLowerCase().includes(filters.eventType.toLowerCase()));
    }

    if (filters.eventSource && filters.eventSource !== 'all') {
      filtered = filtered.filter(event => event.sourceService === filters.eventSource);
    }

    if (filters.severity && filters.severity !== 'all') {
      filtered = filtered.filter(event => event.severity === filters.severity);
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(event => 
        event.title.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query) ||
        event.eventType.toLowerCase().includes(query) ||
        event.sourceService.toLowerCase().includes(query)
      );
    }

    if (filters.assetId) {
      filtered = filtered.filter(event => 
        event.assetId && event.assetId.toLowerCase().includes(filters.assetId.toLowerCase())
      );
    }

    if (filters.userId) {
      filtered = filtered.filter(event => 
        event.userId && event.userId.toLowerCase().includes(filters.userId.toLowerCase())
      );
    }

    setFilteredEvents(filtered);
  }, [events, filters]);

  // Handle filter changes
  const handleFilterChange = (key: keyof IEventFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Refresh event stream
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEventStream();
    setRefreshing(false);
  };

  // Get severity styling
  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'error';
      case 'HIGH': return 'warning';
      case 'MEDIUM': return 'warning';
      case 'LOW': return 'success';
      case 'INFO': return 'neutral';
      default: return 'neutral';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <FeatherXCircle className="h-4 w-4" />;
      case 'HIGH': return <FeatherAlertTriangle className="h-4 w-4" />;
      case 'MEDIUM': return <FeatherInfo className="h-4 w-4" />;
      case 'LOW': return <FeatherCheckCircle className="h-4 w-4" />;
      case 'INFO': return <FeatherInfo className="h-4 w-4" />;
      default: return <FeatherActivity className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <DefaultPageLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <FeatherRefreshCw className="h-6 w-6 animate-spin text-blue-500" />
            <span className="text-lg text-gray-600">Loading event stream...</span>
          </div>
        </div>
      </DefaultPageLayout>
    );
  }

  if (error) {
    return (
      <DefaultPageLayout>
        <div className="py-12">
          <ErrorState message={error} onRetry={handleRefresh} />
        </div>
      </DefaultPageLayout>
    );
  }

  return (
    <DefaultPageLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Event Center</h1>
              <p className="text-gray-600">
                Real-time monitoring and alerting for the DLAP platform
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <div className="flex items-center space-x-1 text-green-600">
                  <FeatherWifi className="h-4 w-4" />
                  <span className="text-sm font-medium">Connected</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-red-600">
                  <FeatherWifiOff className="h-4 w-4" />
                  <span className="text-sm font-medium">Disconnected</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <ToggleGroup
              value={viewMode}
              onValueChange={(value) => setViewMode(value as 'table' | 'cards')}
            >
              <div data-value="table">Table</div>
              <div data-value="cards">Cards</div>
            </ToggleGroup>
            <Button
              variant="neutral-secondary"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <FeatherRefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <FeatherRefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button
              variant="neutral-secondary"
              onClick={() => window.navigateToEventAnalytics?.()}
            >
              <FeatherActivity className="h-4 w-4" />
              Analytics
            </Button>
            <Button
              variant="brand-primary"
              onClick={() => window.navigateToEventSubscriptions?.()}
            >
              <FeatherSettings className="h-4 w-4" />
              Subscriptions
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Events</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalEvents}</p>
              </div>
              <IconWithBackground size="medium" variant="brand">
                <FeatherActivity />
              </IconWithBackground>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Critical</p>
                <p className="text-2xl font-bold text-red-600">{stats.criticalEvents}</p>
              </div>
              <IconWithBackground size="medium" variant="error">
                <FeatherXCircle />
              </IconWithBackground>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">New Events</p>
                <p className="text-2xl font-bold text-orange-600">{stats.newEvents}</p>
              </div>
              <IconWithBackground size="medium" variant="warning">
                <FeatherClock />
              </IconWithBackground>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Processed</p>
                <p className="text-2xl font-bold text-green-600">{stats.resolvedEvents}</p>
              </div>
              <IconWithBackground size="medium" variant="success">
                <FeatherCheckCircle />
              </IconWithBackground>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
              <Select
                value={filters.eventType}
                onValueChange={(value) => handleFilterChange('eventType', value)}
              >
                <Select.Item value="all">All Types</Select.Item>
                <Select.Item value="policy">Policy Events</Select.Item>
                <Select.Item value="compliance">Compliance Events</Select.Item>
                <Select.Item value="discovery">Discovery Events</Select.Item>
                <Select.Item value="system">System Events</Select.Item>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source Service</label>
              <Select
                value={filters.eventSource}
                onValueChange={(value) => handleFilterChange('eventSource', value)}
              >
                <Select.Item value="all">All Services</Select.Item>
                <Select.Item value="da-policyengine">Policy Engine</Select.Item>
                <Select.Item value="da-catalog">Catalog</Select.Item>
                <Select.Item value="da-discovery">Discovery</Select.Item>
                <Select.Item value="da-compliance">Compliance</Select.Item>
                <Select.Item value="da-reporting">Reporting</Select.Item>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
              <Select
                value={filters.severity}
                onValueChange={(value) => handleFilterChange('severity', value)}
              >
                <Select.Item value="all">All Severities</Select.Item>
                <Select.Item value="CRITICAL">Critical</Select.Item>
                <Select.Item value="HIGH">High</Select.Item>
                <Select.Item value="MEDIUM">Medium</Select.Item>
                <Select.Item value="LOW">Low</Select.Item>
                <Select.Item value="INFO">Info</Select.Item>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <TextField>
                <TextField.Input
                  placeholder="Search events..."
                  value={filters.searchQuery}
                  onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                />
              </TextField>
            </div>
          </div>
        </div>

        {/* Events Display */}
        <div className="bg-white rounded-lg border">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Live Events ({filteredEvents.length})
              </h3>
              <div className="text-sm text-gray-500">
                {isConnected && <span className="inline-flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Live updates</span>
                </span>}
              </div>
            </div>
          </div>

          {viewMode === 'table' ? (
            <Table
              header={
                <Table.HeaderRow>
                  <Table.HeaderCell>Severity</Table.HeaderCell>
                  <Table.HeaderCell>Event Type</Table.HeaderCell>
                  <Table.HeaderCell>Source</Table.HeaderCell>
                  <Table.HeaderCell>Title</Table.HeaderCell>
                  <Table.HeaderCell>Asset</Table.HeaderCell>
                  <Table.HeaderCell>Time</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Details</Table.HeaderCell>
                </Table.HeaderRow>
              }
            >
              {filteredEvents.map((event) => (
                <Table.Row key={event.eventId}>
                  <Table.Cell>
                    <Badge variant={getSeverityVariant(event.severity)} icon={getSeverityIcon(event.severity)}>
                      {event.severity}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="font-medium text-gray-900">{event.eventType}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-gray-600">{event.sourceService}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="max-w-xs">
                      <p className="font-medium text-gray-900 truncate">{event.title}</p>
                      <p className="text-sm text-gray-600 truncate">{event.description}</p>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {event.assetName ? (
                      <span className="text-blue-600 hover:underline cursor-pointer">{event.assetName}</span>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-sm text-gray-600">
                      {formatRelative(event.timestamp)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={event.isProcessed ? 'success' : 'warning'}>
                      {event.isProcessed ? 'Processed' : 'New'}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      variant="neutral-secondary"
                      size="small"
                      onClick={() => setSelectedEvent(event)}
                    >
                      <FeatherEye className="h-4 w-4" />
                      View
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
          ) : (
            <div className="p-6 space-y-4">
              {filteredEvents.map((event) => (
                <div key={event.eventId} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant={getSeverityVariant(event.severity)} icon={getSeverityIcon(event.severity)}>
                          {event.severity}
                        </Badge>
                        <Badge variant="neutral">{event.sourceService}</Badge>
                        <Badge variant={event.isProcessed ? 'success' : 'warning'}>
                          {event.isProcessed ? 'Processed' : 'New'}
                        </Badge>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-1">{event.title}</h4>
                      <p className="text-gray-600 mb-2">{event.description}</p>
                      <div className="flex items-center text-sm text-gray-500 space-x-4">
                        <span>Type: {event.eventType}</span>
                        {event.assetName && <span>Asset: {event.assetName}</span>}
                        <span>{formatRelative(event.timestamp)}</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <Button
                        variant="neutral-secondary"
                        size="small"
                        onClick={() => setSelectedEvent(event)}
                      >
                        <FeatherEye className="h-4 w-4" />
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredEvents.length === 0 && (
            <div className="p-6">
              <EmptyState
                title="No Events Found"
                message={
                  events.length === 0
                    ? 'No events have been emitted yet.'
                    : 'No events match your current filters.'
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Event detail modal — renders the real event payload already loaded */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Badge
                  variant={getSeverityVariant(selectedEvent.severity)}
                  icon={getSeverityIcon(selectedEvent.severity)}
                >
                  {selectedEvent.severity}
                </Badge>
                <h2 className="text-xl font-semibold text-gray-900">{selectedEvent.title}</h2>
              </div>
              <Button
                variant="neutral-secondary"
                size="small"
                onClick={() => setSelectedEvent(null)}
              >
                <FeatherXCircle className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700">{selectedEvent.description}</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-gray-500">Event ID</p>
                  <p className="text-gray-900 break-all">{selectedEvent.eventId}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-500">Event Type</p>
                  <p className="text-gray-900">{selectedEvent.eventType}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-500">Source Service</p>
                  <p className="text-gray-900">{selectedEvent.sourceService}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-500">Timestamp</p>
                  <p className="text-gray-900">{formatRelative(selectedEvent.timestamp)}</p>
                </div>
                {selectedEvent.assetName && (
                  <div>
                    <p className="font-medium text-gray-500">Asset</p>
                    <p className="text-gray-900">{selectedEvent.assetName}</p>
                  </div>
                )}
                {selectedEvent.policyName && (
                  <div>
                    <p className="font-medium text-gray-500">Policy</p>
                    <p className="text-gray-900">{selectedEvent.policyName}</p>
                  </div>
                )}
                {selectedEvent.userId && (
                  <div>
                    <p className="font-medium text-gray-500">User</p>
                    <p className="text-gray-900">{selectedEvent.userId}</p>
                  </div>
                )}
                {selectedEvent.userAction && (
                  <div>
                    <p className="font-medium text-gray-500">User Action</p>
                    <p className="text-gray-900">{selectedEvent.userAction}</p>
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-500">Status</p>
                  <Badge variant={selectedEvent.isProcessed ? 'success' : 'warning'}>
                    {selectedEvent.isProcessed ? 'Processed' : 'New'}
                  </Badge>
                </div>
                <div>
                  <p className="font-medium text-gray-500">Notification Sent</p>
                  <p className="text-gray-900">{selectedEvent.notificationSent ? 'Yes' : 'No'}</p>
                </div>
              </div>
              {selectedEvent.eventData && Object.keys(selectedEvent.eventData).length > 0 && (
                <div>
                  <p className="font-medium text-gray-500 text-sm mb-1">Event Data</p>
                  <pre className="bg-gray-50 border rounded p-3 text-xs overflow-auto max-h-48">
                    {JSON.stringify(selectedEvent.eventData, null, 2)}
                  </pre>
                </div>
              )}
              {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                <div>
                  <p className="font-medium text-gray-500 text-sm mb-1">Metadata</p>
                  <pre className="bg-gray-50 border rounded p-3 text-xs overflow-auto max-h-48">
                    {JSON.stringify(selectedEvent.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DefaultPageLayout>
  );
}

export default EventCenter;
