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
  FeatherCheck,
  FeatherCloud,
  FeatherInfo,
  FeatherPlus,
  FeatherRefreshCw,
  FeatherShieldAlert,
  FeatherTrash,
} from "@subframe/core";
import React, { useEffect, useState } from "react";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Alert } from "../ui/components/Alert";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { IconButton } from "../ui/components/IconButton";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Table } from "../ui/components/Table";
import { Tabs } from "../ui/components/Tabs";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import { adminApi } from "../utils/api";

/** Provider enum as defined by da-admin-service CloudProviderType. */
type CloudProviderType = "AWS" | "AZURE" | "GCP" | "OTHER";

/**
 * Mirrors da-admin-service CloudConnectionDTO (read shape). The write-only
 * `sensitiveCredentials` field is intentionally absent: the UI never collects
 * or displays raw secrets — credentials are provisioned server-side.
 */
interface CloudConnection {
  id: string;
  name: string;
  description?: string | null;
  providerType: CloudProviderType;
  connectionParameters?: Record<string, string> | null;
  enabled: boolean;
  lastConnectionTestAt?: string | null;
  lastConnectionTestStatus?: string | null;
}

/** Mirrors da-admin-service CloudConnectionTestResultDTO. */
interface CloudConnectionTestResult {
  success: boolean;
  message: string;
  testedAt?: string;
}

const PROVIDER_LABELS: Record<CloudProviderType, string> = {
  AWS: "AWS",
  AZURE: "Azure",
  GCP: "Google Cloud",
  OTHER: "Other",
};

function providerLabel(providerType: CloudProviderType | string): string {
  return PROVIDER_LABELS[providerType as CloudProviderType] ?? String(providerType);
}

function testStatusBadgeVariant(
  status: string | null | undefined
): "success" | "error" | "neutral" {
  switch ((status ?? "").toUpperCase()) {
    case "SUCCESS":
      return "success";
    case "FAILED":
      return "error";
    default:
      return "neutral";
  }
}

function AdminCloudConnections() {
  const [connections, setConnections] = useState<CloudConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [testInfo, setTestInfo] = useState<CloudConnectionTestResult | null>(
    null
  );
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>("all");

  // Fetch cloud connections through the authenticated admin API client
  const fetchConnections = async () => {
    try {
      setLoading(true);
      const response = await adminApi.get<CloudConnection[]>(
        "/cloud-connections"
      );
      setConnections(Array.isArray(response.data) ? response.data : []);
      setLoadError(null);
    } catch (err) {
      setLoadError("Failed to load cloud connections. Please try again.");
      console.error("Error fetching cloud connections:", err);
    } finally {
      setLoading(false);
    }
  };

  // Delete cloud connection
  const deleteConnection = async (id: string) => {
    try {
      setDeletingId(id);
      setActionError(null);
      await adminApi.delete(`/cloud-connections/${id}`);
      await fetchConnections(); // Refresh the list
    } catch (err) {
      setActionError("Failed to delete connection. Please try again.");
      console.error("Error deleting connection:", err);
    } finally {
      setDeletingId(null);
    }
  };

  // Test connection. The backend currently reports NOT_IMPLEMENTED for live
  // testing — we surface its message as information, not as a failure.
  const testConnection = async (id: string) => {
    try {
      setTestingId(id);
      setActionError(null);
      setTestInfo(null);
      const response = await adminApi.post<CloudConnectionTestResult>(
        `/cloud-connections/${id}/test`
      );
      setTestInfo(response.data);
      await fetchConnections(); // Refresh lastConnectionTestAt/Status
    } catch (err) {
      setActionError("Failed to run the connection test. Please try again.");
      console.error("Error testing connection:", err);
    } finally {
      setTestingId(null);
    }
  };

  // Filter connections based on selected provider
  const filteredConnections =
    selectedProvider === "all"
      ? connections
      : connections.filter(
          (conn) => conn.providerType === selectedProvider
        );

  const enabledCount = connections.filter((conn) => conn.enabled).length;

  useEffect(() => {
    fetchConnections();
  }, []);

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start gap-6 bg-default-background px-6 py-6">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-heading-2 font-heading-2 text-default-font">
              Cloud Connections
            </span>
            <Badge variant="warning" icon={<FeatherShieldAlert />}>
              Admin Only
            </Badge>
          </div>
          <Button
            icon={<FeatherPlus />}
            onClick={() =>
              window.navigateToAdminCloudConnectionWizard1?.()
            }
          >
            Add New Connection
          </Button>
        </div>
        <Alert
          variant="neutral"
          icon={<FeatherInfo />}
          title="Credentials are managed server-side"
          description="This page registers and manages named connection references. Cloud credentials are provisioned by an administrator in server-side configuration (secret manager / federated short-lived roles) and are never entered or shown here."
        />
        <Tabs>
          <Tabs.Item
            active={selectedProvider === "all"}
            onClick={() => setSelectedProvider("all")}
          >
            All Connections
          </Tabs.Item>
          <Tabs.Item
            active={selectedProvider === "AWS"}
            onClick={() => setSelectedProvider("AWS")}
          >
            AWS
          </Tabs.Item>
          <Tabs.Item
            active={selectedProvider === "GCP"}
            onClick={() => setSelectedProvider("GCP")}
          >
            Google Cloud
          </Tabs.Item>
          <Tabs.Item
            active={selectedProvider === "AZURE"}
            onClick={() => setSelectedProvider("AZURE")}
          >
            Azure
          </Tabs.Item>
          <Tabs.Item
            active={selectedProvider === "OTHER"}
            onClick={() => setSelectedProvider("OTHER")}
          >
            Other
          </Tabs.Item>
        </Tabs>
        {actionError && (
          <Alert
            variant="error"
            icon={<FeatherAlertCircle />}
            title="Error"
            description={actionError}
          />
        )}
        {testInfo && (
          <Alert
            variant={testInfo.success ? "success" : "brand"}
            icon={testInfo.success ? <FeatherCheck /> : <FeatherInfo />}
            title={
              testInfo.success ? "Connection test passed" : "Connection test"
            }
            description={testInfo.message}
          />
        )}
        <div className="flex w-full items-end justify-end">
          <Button
            variant="neutral-tertiary"
            icon={<FeatherRefreshCw />}
            onClick={fetchConnections}
            disabled={loading}
          >
            Refresh Status
          </Button>
        </div>
        {loadError ? (
          <ErrorState message={loadError} onRetry={fetchConnections} />
        ) : !loading && connections.length === 0 ? (
          <EmptyState
            title="No cloud connections provisioned"
            message="Connections are provisioned server-side — see deployment documentation."
          />
        ) : (
          <div className="flex w-full flex-col items-start rounded-md border border-solid border-neutral-border bg-default-background">
            <Table
              header={
                <Table.HeaderRow>
                  <Table.HeaderCell>Connection</Table.HeaderCell>
                  <Table.HeaderCell>Provider</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Last Test</Table.HeaderCell>
                  <Table.HeaderCell>Actions</Table.HeaderCell>
                </Table.HeaderRow>
              }
            >
              {loading ? (
                <Table.Row>
                  <Table.Cell colSpan={5} className="text-center py-4">
                    Loading connections...
                  </Table.Cell>
                </Table.Row>
              ) : filteredConnections.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={5} className="text-center py-4">
                    No connections registered for this provider
                  </Table.Cell>
                </Table.Row>
              ) : (
                filteredConnections.map((connection) => (
                  <Table.Row key={connection.id}>
                    <Table.Cell>
                      <div className="flex flex-col items-start">
                        <span className="text-body-bold font-body-bold text-default-font">
                          {connection.name}
                        </span>
                        {connection.description ? (
                          <span className="text-caption font-caption text-subtext-color">
                            {connection.description}
                          </span>
                        ) : null}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <IconWithBackground
                          variant={connection.enabled ? "success" : "neutral"}
                          icon={<FeatherCloud />}
                        />
                        <span className="text-body font-body text-default-font">
                          {providerLabel(connection.providerType)}
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        variant={connection.enabled ? "success" : "neutral"}
                      >
                        {connection.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {connection.lastConnectionTestStatus ? (
                        <div className="flex flex-col items-start gap-1">
                          <Badge
                            variant={testStatusBadgeVariant(
                              connection.lastConnectionTestStatus
                            )}
                          >
                            {connection.lastConnectionTestStatus}
                          </Badge>
                          {connection.lastConnectionTestAt ? (
                            <span className="text-caption font-caption text-subtext-color">
                              {connection.lastConnectionTestAt}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-body font-body text-subtext-color">
                          Never tested
                        </span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="neutral-tertiary"
                          size="small"
                          icon={<FeatherRefreshCw />}
                          loading={testingId === connection.id}
                          disabled={testingId !== null}
                          onClick={() => testConnection(connection.id)}
                        >
                          Test
                        </Button>
                        <IconButton
                          variant="destructive-tertiary"
                          icon={<FeatherTrash />}
                          disabled={deletingId !== null}
                          onClick={() => deleteConnection(connection.id)}
                        />
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table>
          </div>
        )}
        <div className="flex w-full flex-col items-start gap-4">
          <span className="text-heading-3 font-heading-3 text-default-font">
            Connection Summary
          </span>
          <div className="flex w-full flex-wrap items-start gap-4">
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground icon={<FeatherCloud />} />
                <span className="text-body-bold font-body-bold text-subtext-color">
                  Registered Connections
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-default-font">
                {connections.length}
              </span>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground
                  variant={
                    connections.length > 0 && enabledCount === connections.length
                      ? "success"
                      : "neutral"
                  }
                  icon={<FeatherCheck />}
                />
                <span className="text-body-bold font-body-bold text-subtext-color">
                  Enabled Connections
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-default-font">
                {enabledCount}/{connections.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default AdminCloudConnections;
