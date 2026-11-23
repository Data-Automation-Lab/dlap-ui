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

"use client";

import {
    FeatherAlertCircle,
    FeatherCloud,
    FeatherDatabase,
    FeatherPieChart,
    FeatherRefreshCw,
    FeatherSave,
    FeatherSearch,
    FeatherSettings
} from "@subframe/core";
import { useEffect, useState } from "react";
import keycloak from "../keycloak";
import { EmptyState } from "../components/EmptyState";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Tabs } from "../ui/components/Tabs";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import { getDataSources } from "../utils/apiServices";

// TypeScript interfaces for Discovery Agent Configuration.
// `id` here is the real cloud-connection id supplied by the data-sources
// endpoint (present only for configured providers). It is used to drive the
// per-source connection test against the admin service; it is never fabricated.
interface IDataSourceConfig {
  id?: string;
  name: string;
  // 'Not configured' matches the shared IDataSource union in
  // utils/apiServices (da-discovery returns it for unconfigured providers).
  status: 'Connected' | 'Warning' | 'Error' | 'Disconnected' | 'Not configured';
  lastScan: string;
  assetsDiscovered: number;
}

function DataDiscoveryAgentConfig() {
  // State management
  const [dataSources, setDataSources] = useState<IDataSourceConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Update initialization effect
  useEffect(() => {
    const initializeKeycloak = async () => {
      try {
        console.log('Initializing Keycloak...');
        if (!keycloak.authenticated) {
          const authenticated = await keycloak.init({
            onLoad: 'login-required',
            silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
            checkLoginIframe: false,
            pkceMethod: 'S256'
          });
          
          console.log('Keycloak initialization result:', authenticated);
          
          if (!authenticated) {
            console.log('Not authenticated, redirecting to login');
            await keycloak.login();
          } else {
            console.log('Successfully authenticated');
          }
        } else {
          console.log('Already authenticated');
        }
      } catch (error) {
        console.error('Failed to initialize Keycloak:', error);
        setError('Authentication failed. Please try again.');
      }
    };

    initializeKeycloak();
  }, []);

  // Load the real Connected Data Sources list from da-discovery
  // (GET /api/v1/discovery/data-sources via getDataSources). Fields not
  // supplied by the backend are not fabricated — the id is passed through
  // as-is and is only present for configured providers.
  const fetchDataSources = async (): Promise<IDataSourceConfig[]> => {
    const dataSourcesResponse = await getDataSources();
    return dataSourcesResponse.map((source) => ({
      id: source.id,
      name: source.name,
      status: source.status,
      lastScan: source.lastScan,
      assetsDiscovered: source.assetsCount,
    }));
  };

  const loadData = async () => {
    if (!keycloak.authenticated || !keycloak.token) {
      setError('Please log in to access this page');
      try {
        await keycloak.login();
      } catch (loginError) {
        console.error('Login failed:', loginError);
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (keycloak.isTokenExpired()) {
        await keycloak.updateToken(70);
      }
      const sourcesData = await fetchDataSources();
      setDataSources(sourcesData);
    } catch (loadError) {
      console.error('Error loading configuration:', loadError);
      setError('Failed to load data sources. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load data after Keycloak initialization
  useEffect(() => {
    if (keycloak.authenticated && keycloak.token) {
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the Keycloak session appears; loadData is recreated on every render
  }, [keycloak.authenticated, keycloak.token]);

  // Helper functions
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Connected': return 'success';
      case 'Warning': return 'warning';
      case 'Error': return 'error';
      case 'Disconnected': return 'neutral';
      default: return 'neutral';
    }
  };

  if (loading) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-body font-body text-subtext-color">Loading configuration...</span>
        </div>
      </DefaultPageLayout>
    );
  }

  if (error) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full flex-col items-center justify-center gap-4">
          <FeatherAlertCircle className="w-12 h-12 text-error-600" />
          <div className="flex flex-col items-center gap-2">
            <span className="text-heading-3 font-heading-3 text-default-font">Error Loading Configuration</span>
            <span className="text-body font-body text-subtext-color text-center">
              {error}
            </span>
          </div>
          <Button onClick={() => window.location.reload()} icon={<FeatherRefreshCw />}>
            Retry
          </Button>
        </div>
      </DefaultPageLayout>
    );
  }

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start bg-default-background">
        {/* Header */}
        <div className="flex w-full flex-wrap items-center gap-2 px-6 pt-6 pb-2">
          <div className="flex grow shrink-0 basis-0 items-center gap-2">
            <FeatherSearch className="text-heading-2 font-heading-2 text-default-font" />
            <span className="text-heading-2 font-heading-2 text-default-font">
              SmartDiscovery Management
            </span>
            <Badge variant="success">Active</Badge>
          </div>
          <Button
            variant="neutral-primary"
            icon={<FeatherRefreshCw />}
            onClick={() => window.location.reload()}
          >
            Refresh
          </Button>
          {/* Discovery configuration persistence is exposed by da-discovery
              (PUT /api/v1/discovery/config/...), but this page does not yet
              collect the fields that endpoint accepts, so there is nothing
              honest to save. The button stays disabled until the config editor
              is wired to the real DTOs rather than re-introducing fabricated
              defaults. */}
          <Button
            icon={<FeatherSave />}
            disabled
            title="Discovery configuration persistence is not yet available"
          >
            Save Configuration
          </Button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex w-full items-end border-b border-solid border-neutral-border">
          <Tabs>
            <Tabs.Item icon={<FeatherPieChart />} onClick={() => window.navigateToDiscoveryAgentOverview?.()}>
              Overview
            </Tabs.Item>
            <Tabs.Item active={true} icon={<FeatherSettings />}>
              Configuration
            </Tabs.Item>
            <Tabs.Item icon={<FeatherDatabase />} onClick={() => window.navigateToDiscoveryAgentAssetLog?.()}>
              Discovered Assets Log
            </Tabs.Item>
          </Tabs>
        </div>

        {/* Main Content */}
        <div className="container max-w-none flex w-full grow shrink-0 basis-0 flex-col items-center gap-6 py-12 overflow-auto">
          <div className="flex w-full max-w-[768px] flex-col items-start gap-12">
            {/* Connected Data Sources */}
            <div className="flex w-full flex-col items-start gap-6">
              <div className="flex w-full flex-col items-start gap-1">
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Connected Data Sources
                </span>
                <span className="text-body font-body text-subtext-color">
                  Cloud provider connections reported by the discovery service
                </span>
              </div>
              {dataSources.length === 0 ? (
                <EmptyState
                  title="No data sources connected"
                  message="Cloud connections are configured server-side. Once a connection is provisioned, its provider and status appear here."
                />
              ) : (
                <div className="grid grid-cols-2 gap-4 w-full">
                  {dataSources.map((source, index) => (
                    <div key={source.id ?? `source-${index}`} className="flex flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                      <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-2">
                          <IconWithBackground
                            variant={getStatusVariant(source.status)}
                            icon={<FeatherCloud />}
                          />
                          <div className="flex flex-col">
                            <span className="text-body-bold font-body-bold text-default-font">
                              {source.name}
                            </span>
                            <span className="text-caption font-caption text-subtext-color">
                              {source.assetsDiscovered} assets discovered
                            </span>
                          </div>
                        </div>
                        {/* Neutral badge for 'Not configured' is handled by
                            getStatusVariant returning 'neutral'. The status is
                            informational only — there is no persist endpoint for
                            an enable/disable toggle here, so no toggle is shown. */}
                        <Badge variant={getStatusVariant(source.status)}>
                          {source.status}
                        </Badge>
                      </div>
                      {/* Read-only status only. Cloud connection configuration is
                          owned server-side (owner decision Q-023); this page shows
                          provider + status and offers no Configure/Test/enable
                          controls. */}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />

            {/* Crawl Scope & Schedule — not yet wired to real config DTOs */}
            <div className="flex w-full flex-col items-start gap-6">
              <div className="flex w-full flex-col items-start gap-1">
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Crawl Scope & Schedule
                </span>
                <span className="text-body font-body text-subtext-color">
                  Per-connection discovery scope and schedule
                </span>
              </div>
              <EmptyState
                title="Not yet configurable"
                message="Per-connection crawl scope and scheduling will be editable here once this section is wired to the discovery configuration service."
              />
            </div>

            <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />

            {/* Audit Log Parser Configuration — no backing endpoint yet */}
            <div className="flex w-full flex-col items-start gap-6">
              <div className="flex w-full flex-col items-start gap-1">
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Audit Log Parser Configuration
                </span>
                <span className="text-body font-body text-subtext-color">
                  Logging and notification settings for the discovery agent
                </span>
              </div>
              <EmptyState
                title="Not yet configurable"
                message="Audit-log notification settings are not yet backed by a configuration endpoint."
              />
            </div>

            <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />

            {/* Agent Settings — no backing endpoint yet */}
            <div className="flex w-full flex-col items-start gap-6">
              <div className="flex w-full flex-col items-start gap-1">
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Agent Settings
                </span>
                <span className="text-body font-body text-subtext-color">
                  Performance and behavior settings for the discovery agent
                </span>
              </div>
              <EmptyState
                title="Not yet configurable"
                message="Agent performance settings are not yet backed by a configuration endpoint."
              />
            </div>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default DataDiscoveryAgentConfig;