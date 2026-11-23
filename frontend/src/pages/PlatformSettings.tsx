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

import { FeatherBell, FeatherKey, FeatherRefreshCw, FeatherSave, FeatherServer, FeatherSettings } from '@subframe/core';
import { useEffect, useState } from 'react';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { Button } from '../ui/components/Button';
import { IconWithBackground } from '../ui/components/IconWithBackground';
import { Switch } from '../ui/components/Switch';
import { TextField } from '../ui/components/TextField';
import { DefaultPageLayout } from '../ui/layouts/DefaultPageLayout';
import { adminApi } from '../utils/api';

/**
 * The only platform configuration the backend actually persists is the
 * per-service registry exposed by da-admin's ServiceConfigController
 * (GET/PUT /api/v1/admin/config/services). Its DTO carries exactly:
 *   serviceId, displayName, description, version, endpoint, enabled.
 * There is no backend store for global notification channels, notification
 * types, or platform-wide API keys/secrets — those tabs therefore render an
 * honest "managed server-side" EmptyState instead of the previous hardcoded
 * mock (365-day retention, masked fake keys, Math.random() save).
 */
interface IServiceConfig {
  serviceId: string;
  displayName?: string;
  description?: string;
  version?: string;
  endpoint?: string;
  enabled: boolean;
}

function PlatformSettings() {
  const [services, setServices] = useState<IServiceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'services' | 'notifications' | 'apiKeys'>('services');

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      setError(false);
      const response = await adminApi.get('/config/services');
      const rows: IServiceConfig[] = Array.isArray(response.data) ? response.data : [];
      setServices(
        rows.map((r) => ({
          serviceId: r.serviceId,
          displayName: r.displayName ?? '',
          description: r.description ?? '',
          version: r.version ?? '',
          endpoint: r.endpoint ?? '',
          enabled: r.enabled === true,
        }))
      );
    } catch (err) {
      console.error('Failed to load service configurations:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const updateLocal = (serviceId: string, updates: Partial<IServiceConfig>) => {
    setServices((prev) =>
      prev.map((s) => (s.serviceId === serviceId ? { ...s, ...updates } : s))
    );
  };

  const handleSave = async (service: IServiceConfig) => {
    try {
      setSavingId(service.serviceId);
      const response = await adminApi.put(`/config/services/${service.serviceId}`, {
        serviceId: service.serviceId,
        displayName: service.displayName,
        description: service.description,
        version: service.version,
        endpoint: service.endpoint,
        enabled: service.enabled,
      });
      const saved = response.data ?? service;
      updateLocal(service.serviceId, {
        displayName: saved.displayName ?? service.displayName,
        description: saved.description ?? service.description,
        version: saved.version ?? service.version,
        endpoint: saved.endpoint ?? service.endpoint,
        enabled: saved.enabled === true,
      });
    } catch (err) {
      console.error('Failed to save service configuration:', err);
      setError(true);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col gap-6 px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <IconWithBackground variant="brand" icon={<FeatherSettings />} size="medium" />
          <div>
            <h1 className="text-heading-2 font-heading-2 text-default-font">Platform Settings</h1>
            <p className="text-body font-body text-neutral-600">
              Manage per-service configuration registered with the admin service
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 border-b border-neutral-border">
          <button
            className={`px-4 py-2 text-body font-body border-b-2 transition-colors ${
              activeTab === 'services'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-neutral-600 hover:text-neutral-800'
            }`}
            onClick={() => setActiveTab('services')}
          >
            <div className="flex items-center gap-2">
              <FeatherServer className="h-4 w-4" />
              Services
            </div>
          </button>
          <button
            className={`px-4 py-2 text-body font-body border-b-2 transition-colors ${
              activeTab === 'notifications'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-neutral-600 hover:text-neutral-800'
            }`}
            onClick={() => setActiveTab('notifications')}
          >
            <div className="flex items-center gap-2">
              <FeatherBell className="h-4 w-4" />
              Notifications
            </div>
          </button>
          <button
            className={`px-4 py-2 text-body font-body border-b-2 transition-colors ${
              activeTab === 'apiKeys'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-neutral-600 hover:text-neutral-800'
            }`}
            onClick={() => setActiveTab('apiKeys')}
          >
            <div className="flex items-center gap-2">
              <FeatherKey className="h-4 w-4" />
              API Keys
            </div>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'services' && (
            <div className="space-y-6">
              <div className="flex items-center justify-end">
                <Button
                  variant="neutral-tertiary"
                  icon={<FeatherRefreshCw />}
                  onClick={loadServices}
                >
                  Refresh
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center gap-3 py-12 justify-center">
                  <FeatherRefreshCw className="h-6 w-6 animate-spin text-brand-600" />
                  <span className="text-body font-body text-neutral-700">
                    Loading service configurations…
                  </span>
                </div>
              ) : error ? (
                <ErrorState
                  message="Unable to load service configurations from the admin service."
                  onRetry={loadServices}
                />
              ) : services.length === 0 ? (
                <EmptyState
                  title="No service configurations"
                  message="The admin service has not registered any service configurations yet."
                />
              ) : (
                <div className="space-y-4">
                  {services.map((service) => (
                    <div
                      key={service.serviceId}
                      className="rounded-lg border border-neutral-border bg-default-background p-6"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <span className="text-body-bold font-body-bold text-default-font">
                            {service.displayName || service.serviceId}
                          </span>
                          <p className="text-caption font-caption text-neutral-600">
                            {service.serviceId}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-caption font-caption text-neutral-600">
                            {service.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                          <Switch
                            checked={service.enabled}
                            onCheckedChange={(checked) =>
                              updateLocal(service.serviceId, { enabled: checked })
                            }
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TextField label="Display Name">
                          <TextField.Input
                            value={service.displayName || ''}
                            onChange={(e) =>
                              updateLocal(service.serviceId, { displayName: e.target.value })
                            }
                          />
                        </TextField>
                        <TextField label="Version">
                          <TextField.Input
                            value={service.version || ''}
                            onChange={(e) =>
                              updateLocal(service.serviceId, { version: e.target.value })
                            }
                          />
                        </TextField>
                        <TextField label="Endpoint">
                          <TextField.Input
                            value={service.endpoint || ''}
                            onChange={(e) =>
                              updateLocal(service.serviceId, { endpoint: e.target.value })
                            }
                          />
                        </TextField>
                        <TextField label="Description">
                          <TextField.Input
                            value={service.description || ''}
                            onChange={(e) =>
                              updateLocal(service.serviceId, { description: e.target.value })
                            }
                          />
                        </TextField>
                      </div>
                      <div className="flex justify-end mt-4">
                        <Button
                          variant="brand-primary"
                          icon={<FeatherSave />}
                          loading={savingId === service.serviceId}
                          disabled={savingId === service.serviceId}
                          onClick={() => handleSave(service)}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notifications' && (
            <EmptyState
              title="Managed server-side"
              message="Global notification channels and delivery rules are configured server-side and are not editable from this screen. Per-user notification preferences are available on your profile page."
              icon={<IconWithBackground variant="neutral" size="large" icon={<FeatherBell />} />}
            />
          )}

          {activeTab === 'apiKeys' && (
            <EmptyState
              title="Managed server-side"
              message="Platform API keys and secrets are injected as environment variables at deploy time and are never exposed or editable through the UI."
              icon={<IconWithBackground variant="neutral" size="large" icon={<FeatherKey />} />}
            />
          )}
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default PlatformSettings;
