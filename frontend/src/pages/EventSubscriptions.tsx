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

import { FeatherBell, FeatherEdit, FeatherPlus, FeatherSave, FeatherSettings, FeatherTrash2, FeatherX } from '@subframe/core';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../ui/components/Badge';
import { Button } from '../ui/components/Button';
import { Select } from '../ui/components/Select';
import { Switch } from '../ui/components/Switch';
import { Table } from '../ui/components/Table';
import { TextField } from '../ui/components/TextField';
import { DefaultPageLayout } from '../ui/layouts/DefaultPageLayout';
import {
  EventCenterApiService,
  parseAssetPrefixes,
  parseLabels,
  type EventSubscriptionInput,
  type EventSubscriptionOutput,
} from '../utils/eventCenterApi';
import { formatRelative } from '../utils/safeDate';
import { confirmAction } from '../utils/confirm';

// Relative-time labels for subscription timestamps use the shared safeDate
// helper (utils/safeDate.formatRelative), which guards invalid/null values that
// would otherwise cause date-fns to throw and blank the subscriptions table.

// SEC-04 (ADR-0057): a subscription narrows its events with typed filters only. Rule
// conditions were MVEL (executable code) and are retired; this page never sends them.

const emptyForm = (): EventSubscriptionInput => ({
  name: '',
  description: '',
  eventTypes: [],
  severities: [],
  sourceServices: [],
  assetPrefixes: [],
  labels: [],
  // The backend requires at least one notification entry; default to in-app.
  notificationConfig: { inApp: true } as Record<string, unknown>,
  actionConfig: {},
});

function EventSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<EventSubscriptionOutput[]>([]);
  const [availableEventTypes, setAvailableEventTypes] = useState<string[]>([]);
  const [availableSourceServices, setAvailableSourceServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<EventSubscriptionOutput | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [createForm, setCreateForm] = useState<EventSubscriptionInput>(emptyForm);
  // Free text for the two list filters, parsed on save so typing a new line or comma works.
  const [assetPrefixText, setAssetPrefixText] = useState('');
  const [labelText, setLabelText] = useState('');

  // Load subscriptions data
  const loadSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [subscriptionsResult, eventTypes, sourceServices] = await Promise.all([
        EventCenterApiService.getSubscriptions(0, 100, statusFilter !== 'all' ? statusFilter : undefined, searchQuery || undefined),
        EventCenterApiService.getAvailableEventTypes(),
        EventCenterApiService.getAvailableSourceServices()
      ]);
      
      setSubscriptions(subscriptionsResult.content);
      setAvailableEventTypes(eventTypes);
      setAvailableSourceServices(sourceServices);
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
      setError('Failed to load subscriptions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  // Load data on component mount and filter changes
  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  // Open the modal in "edit" mode with the selected subscription's real values
  // pre-loaded into the form. The same form drives both create and update.
  const handleStartEdit = (subscription: EventSubscriptionOutput) => {
    setEditingSubscription(subscription);
    setCreateForm({
      name: subscription.name,
      description: subscription.description || '',
      eventTypes: subscription.eventTypes || [],
      severities: subscription.severities || [],
      sourceServices: subscription.sourceServices || [],
      assetPrefixes: subscription.assetPrefixes || [],
      labels: subscription.labels || [],
      notificationConfig: subscription.notificationConfig || {},
      actionConfig: subscription.actionConfig || {},
    });
    setAssetPrefixText((subscription.assetPrefixes || []).join('\n'));
    setLabelText((subscription.labels || []).join(', '));
    setShowCreateModal(true);
  };

  // Handle subscription creation OR update depending on modal mode.
  const handleSaveSubscription = async () => {
    const payload: EventSubscriptionInput = {
      ...createForm,
      assetPrefixes: parseAssetPrefixes(assetPrefixText),
      labels: parseLabels(labelText),
    };
    try {
      await EventCenterApiService.validateSubscriptionConfiguration(payload);
      if (editingSubscription) {
        const updated = await EventCenterApiService.updateSubscription(editingSubscription.id, payload);
        setSubscriptions(prev => prev.map(sub => sub.id === editingSubscription.id ? updated : sub));
      } else {
        const newSubscription = await EventCenterApiService.createSubscription(payload);
        setSubscriptions(prev => [newSubscription, ...prev]);
      }
      closeModal();
    } catch (err) {
      console.error('Failed to save subscription:', err);
      setError(
        editingSubscription
          ? 'Failed to update subscription. Please check your configuration.'
          : 'Failed to create subscription. Please check your configuration.'
      );
    }
  };

  // Close modal and clear both create and edit state.
  const closeModal = () => {
    setShowCreateModal(false);
    setEditingSubscription(null);
    resetCreateForm();
  };

  // Handle subscription status toggle
  const handleToggleSubscription = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      const updatedSubscription = await EventCenterApiService.updateSubscriptionStatus(id, newStatus);
      setSubscriptions(prev => prev.map(sub => sub.id === id ? updatedSubscription : sub));
    } catch (err) {
      console.error('Failed to toggle subscription:', err);
      setError('Failed to update subscription status.');
    }
  };

  // Handle subscription deletion
  const handleDeleteSubscription = async (id: string) => {
    if (!confirmAction('Are you sure you want to delete this subscription?')) {
      return;
    }

    try {
      await EventCenterApiService.deleteSubscription(id);
      setSubscriptions(prev => prev.filter(sub => sub.id !== id));
    } catch (err) {
      console.error('Failed to delete subscription:', err);
      setError('Failed to delete subscription.');
    }
  };

  // Reset create form
  const resetCreateForm = () => {
    setCreateForm(emptyForm());
    setAssetPrefixText('');
    setLabelText('');
  };

  // Get status variant for badges
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'PAUSED': return 'warning';
      case 'DISABLED': return 'error';
      case 'ARCHIVED': return 'neutral';
      default: return 'neutral';
    }
  };

  if (loading) {
    return (
      <DefaultPageLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            <span className="text-lg text-gray-600">Loading subscriptions...</span>
          </div>
        </div>
      </DefaultPageLayout>
    );
  }

  return (
    <DefaultPageLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Event Subscriptions</h1>
            <p className="text-gray-600">
              Manage your event subscriptions and notification preferences
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="neutral-secondary"
              onClick={() => window.navigateToEventCenter?.()}
            >
              <FeatherSettings className="h-4 w-4" />
              Event Center
            </Button>
            <Button
              variant="neutral-secondary"
              onClick={() => window.navigateToEventAnalytics?.()}
            >
              Analytics
            </Button>
            <Button
              variant="brand-primary"
              onClick={() => {
                setEditingSubscription(null);
                resetCreateForm();
                setShowCreateModal(true);
              }}
            >
              <FeatherPlus className="h-4 w-4" />
              New Subscription
            </Button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <Button
              variant="neutral-secondary"
              size="small"
              onClick={() => setError(null)}
              className="mt-2"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <TextField>
                <TextField.Input
                  placeholder="Search subscriptions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </TextField>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <Select.Item value="all">All Statuses</Select.Item>
                <Select.Item value="ACTIVE">Active</Select.Item>
                <Select.Item value="PAUSED">Paused</Select.Item>
                <Select.Item value="DISABLED">Disabled</Select.Item>
                <Select.Item value="ARCHIVED">Archived</Select.Item>
              </Select>
            </div>
          </div>
        </div>

        {/* Subscriptions Table */}
        <div className="bg-white rounded-lg border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">
              Your Subscriptions ({subscriptions.length})
            </h3>
          </div>

          {subscriptions.length > 0 ? (
            <Table>
              <Table.HeaderRow>
                <Table.HeaderCell>Name</Table.HeaderCell>
                <Table.HeaderCell>Event Types</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Events Matched</Table.HeaderCell>
                <Table.HeaderCell>Last Updated</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.HeaderRow>
              {subscriptions.map((subscription) => (
                <Table.Row key={subscription.id}>
                  <Table.Cell>
                    <div>
                      <h4 className="font-medium text-gray-900">{subscription.name}</h4>
                      {subscription.description && (
                        <p className="text-sm text-gray-600">{subscription.description}</p>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-wrap gap-1">
                      {subscription.eventTypes.slice(0, 3).map((type, index) => (
                        <Badge key={index} variant="neutral">
                          {type}
                        </Badge>
                      ))}
                      {subscription.eventTypes.length > 3 && (
                        <Badge variant="neutral">
                          +{subscription.eventTypes.length - 3} more
                        </Badge>
                      )}
                    </div>
                    {subscription.labels?.length || subscription.assetPrefixes?.length ? (
                      <p className="mt-1 text-xs text-gray-600">
                        {subscription.labels?.length ? `Labels: ${subscription.labels.join(', ')}` : ''}
                        {subscription.labels?.length && subscription.assetPrefixes?.length ? '; ' : ''}
                        {subscription.assetPrefixes?.length
                          ? `Asset prefixes: ${subscription.assetPrefixes.length}`
                          : ''}
                      </p>
                    ) : null}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={getStatusVariant(subscription.status)}>
                      {subscription.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="font-medium text-blue-600">
                      {subscription.eventsMatchedCount || 0}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-sm text-gray-600">
                      {formatRelative(subscription.updatedAt)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={subscription.status === 'ACTIVE'}
                        onCheckedChange={() => handleToggleSubscription(subscription.id, subscription.status)}
                      />
                      <Button
                        variant="neutral-secondary"
                        size="small"
                        aria-label={`Edit ${subscription.name}`}
                        onClick={() => handleStartEdit(subscription)}
                      >
                        <FeatherEdit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive-secondary"
                        size="small"
                        aria-label={`Delete ${subscription.name}`}
                        onClick={() => handleDeleteSubscription(subscription.id)}
                      >
                        <FeatherTrash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
          ) : (
            <div className="p-12 text-center">
              <FeatherBell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Subscriptions</h3>
              <p className="text-gray-600 mb-4">
                You haven't created any event subscriptions yet.
              </p>
              <Button
                variant="brand-primary"
                onClick={() => {
                  setEditingSubscription(null);
                  resetCreateForm();
                  setShowCreateModal(true);
                }}
              >
                Create Your First Subscription
              </Button>
            </div>
          )}
        </div>

        {/* Create Subscription Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {editingSubscription ? 'Edit Event Subscription' : 'Create Event Subscription'}
                  </h2>
                  <Button
                    variant="neutral-secondary"
                    size="small"
                    onClick={closeModal}
                  >
                    <FeatherX className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                      <TextField>
                        <TextField.Input
                          value={createForm.name}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Enter subscription name"
                        />
                      </TextField>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <TextField>
                        <TextField.Input
                          value={createForm.description || ''}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Enter description (optional)"
                        />
                      </TextField>
                    </div>
                  </div>
                </div>

                {/* Event Types */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Event Types</h3>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                    {availableEventTypes.map((eventType) => (
                      <label key={eventType} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={createForm.eventTypes.includes(eventType)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateForm(prev => ({
                                ...prev,
                                eventTypes: [...prev.eventTypes, eventType]
                              }));
                            } else {
                              setCreateForm(prev => ({
                                ...prev,
                                eventTypes: prev.eventTypes.filter(t => t !== eventType)
                              }));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{eventType}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Severity Levels */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Severity Levels</h3>
                  <div className="flex flex-wrap gap-2">
                    {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map((severity) => (
                      <label key={severity} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={createForm.severities.includes(severity)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateForm(prev => ({
                                ...prev,
                                severities: [...prev.severities, severity]
                              }));
                            } else {
                              setCreateForm(prev => ({
                                ...prev,
                                severities: prev.severities.filter(s => s !== severity)
                              }));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <Badge variant={severity === 'CRITICAL' ? 'error' : severity === 'HIGH' ? 'warning' : 'neutral'}>
                          {severity}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Source Services */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Source Services</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {availableSourceServices.map((service) => (
                      <label key={service} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={createForm.sourceServices.includes(service)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateForm(prev => ({
                                ...prev,
                                sourceServices: [...prev.sourceServices, service]
                              }));
                            } else {
                              setCreateForm(prev => ({
                                ...prev,
                                sourceServices: prev.sourceServices.filter(s => s !== service)
                              }));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{service}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Asset prefixes and labels: the typed filters that replaced rule conditions (SEC-04) */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Assets and Labels</h3>
                  <p className="text-sm text-gray-500">
                    Optional. Leave empty to match every asset. An event matches when its asset ID starts with
                    one of the prefixes and it names at least one of the labels.
                  </p>
                  <div>
                    <label htmlFor="subscription-asset-prefixes" className="block text-sm font-medium text-gray-700 mb-1">
                      Asset prefixes (one per line)
                    </label>
                    <textarea
                      id="subscription-asset-prefixes"
                      value={assetPrefixText}
                      onChange={(e) => setAssetPrefixText(e.target.value)}
                      placeholder={'s3://finance-bucket/reports/\nbq://my-project/sales'}
                      rows={3}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="subscription-labels" className="block text-sm font-medium text-gray-700 mb-1">
                      Labels (comma-separated)
                    </label>
                    <input
                      id="subscription-labels"
                      type="text"
                      value={labelText}
                      onChange={(e) => setLabelText(e.target.value)}
                      placeholder="PII, Finance"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Notifications: at least one channel is required by the backend */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
                  <p className="text-sm text-gray-500">
                    Choose how you want to be notified when a matching event occurs. At least one channel is required.
                  </p>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={!!createForm.notificationConfig.inApp}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setCreateForm(prev => {
                          const nc: Record<string, unknown> = { ...prev.notificationConfig };
                          if (checked) { nc.inApp = true; } else { delete nc.inApp; }
                          return { ...prev, notificationConfig: nc };
                        });
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">In-app notifications</span>
                  </label>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email recipients (optional, comma-separated)
                    </label>
                    <input
                      type="text"
                      value={(createForm.notificationConfig.email as string) || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCreateForm(prev => {
                          const nc: Record<string, unknown> = { ...prev.notificationConfig };
                          if (value.trim()) { nc.email = value; } else { delete nc.email; }
                          return { ...prev, notificationConfig: nc };
                        });
                      }}
                      placeholder="ops@example.com, dpo@example.com"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t bg-gray-50 flex items-center justify-end space-x-3">
                <Button
                  variant="neutral-secondary"
                  onClick={closeModal}
                >
                  Cancel
                </Button>
                <Button
                  variant="brand-primary"
                  onClick={handleSaveSubscription}
                  disabled={!createForm.name || createForm.eventTypes.length === 0 || Object.keys(createForm.notificationConfig).length === 0}
                >
                  <FeatherSave className="h-4 w-4" />
                  {editingSubscription ? 'Save Changes' : 'Create Subscription'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DefaultPageLayout>
  );
}

export default EventSubscriptions; 