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
    FeatherAlertTriangle,
    FeatherBarChart3,
    FeatherBell,
    FeatherCheck,
    FeatherClock,
    FeatherCloud,
    FeatherDatabase,
    FeatherGitBranch,
    FeatherSettings,
    FeatherUsers,
    FeatherXCircle,
    FeatherZap
} from "@subframe/core";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Avatar } from "../ui/components/Avatar";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Progress } from "../ui/components/Progress";
import { Table } from "../ui/components/Table";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import { adminApi, catalogApi } from "../utils/api";
import {
    ActionItemsResponse,
    ConnectionHealthStatus,
    actionItemBandCounts,
    actionItemTotal,
    actionItemsFailed,
    actionItemsOf,
    getActionItems,
    getConnectionHealthStatus,
    getJobStatuses,
    IJobStatusResponse,
    listPolicies,
    PolicyRecord,
    priorityBand,
} from "../utils/apiServices";
import { useCurrentUser } from "../utils/currentUser";
import { formatDate } from "../utils/safeDate";

type BadgeVariant = "brand" | "neutral" | "warning" | "error" | "success";

/** Row shape mapped 1:1 from da-admin UserDTO (Keycloak-backed). */
interface AdminUserRow {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  enabled: boolean;
  roles: string[];
}

/** Real da-catalog counters (GET /assets/count*). */
interface CatalogCounts {
  total: number;
  withMetadata: number;
  withLineage: number;
}

const mapUserDto = (dto: Partial<AdminUserRow> | null | undefined): AdminUserRow => ({
  id: dto?.id ?? "",
  username: dto?.username ?? "",
  email: dto?.email ?? "",
  firstName: dto?.firstName ?? "",
  lastName: dto?.lastName ?? "",
  enabled: dto?.enabled === true,
  roles: Array.isArray(dto?.roles) ? dto.roles : [],
});

const displayName = (u: AdminUserRow): string =>
  [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.username;

function AdminControlHub() {
  const currentUser = useCurrentUser();

  const [jobs, setJobs] = useState<IJobStatusResponse | null>(null);
  const [jobsError, setJobsError] = useState(false);
  const [actionItems, setActionItems] = useState<ActionItemsResponse | null>(null);
  const [actionItemsError, setActionItemsError] = useState(false);
  const [connections, setConnections] = useState<ConnectionHealthStatus[] | null>(null);
  const [connectionsError, setConnectionsError] = useState(false);
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [usersError, setUsersError] = useState(false);
  const [policies, setPolicies] = useState<PolicyRecord[] | null>(null);
  const [policiesError, setPoliciesError] = useState(false);
  const [catalogCounts, setCatalogCounts] = useState<CatalogCounts | null>(null);
  const [countsError, setCountsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAlerts, setShowAlerts] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setJobsError(false);
    setActionItemsError(false);
    setConnectionsError(false);
    setUsersError(false);
    setPoliciesError(false);
    setCountsError(false);

    // Every widget is backed by its own real endpoint; load them independently
    // so one failing service degrades only its own section.
    await Promise.allSettled([
      getJobStatuses()
        .then(setJobs)
        .catch((e) => {
          console.error("Admin hub: job statuses failed:", e);
          setJobs(null);
          setJobsError(true);
        }),
      getActionItems()
        .then(setActionItems)
        .catch((e) => {
          console.error("Admin hub: action items failed:", e);
          setActionItems(null);
          setActionItemsError(true);
        }),
      getConnectionHealthStatus()
        .then(setConnections)
        .catch((e) => {
          console.error("Admin hub: connection health failed:", e);
          setConnections(null);
          setConnectionsError(true);
        }),
      adminApi
        .get("/users", { params: { maxResults: 200 } })
        .then((r) => setUsers((Array.isArray(r.data) ? r.data : []).map(mapUserDto)))
        .catch((e) => {
          console.error("Admin hub: users failed:", e);
          setUsers(null);
          setUsersError(true);
        }),
      listPolicies()
        .then(setPolicies)
        .catch((e) => {
          console.error("Admin hub: policies failed:", e);
          setPolicies(null);
          setPoliciesError(true);
        }),
      Promise.all([
        catalogApi.get<number>("/assets/count"),
        catalogApi.get<number>("/assets/count/with-metadata"),
        catalogApi.get<number>("/assets/count/with-lineage"),
      ])
        .then(([total, withMetadata, withLineage]) =>
          setCatalogCounts({
            total: total.data ?? 0,
            withMetadata: withMetadata.data ?? 0,
            withLineage: withLineage.data ?? 0,
          })
        )
        .catch((e) => {
          console.error("Admin hub: catalog counts failed:", e);
          setCatalogCounts(null);
          setCountsError(true);
        }),
    ]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const serviceStatusVariant = (status: string): BadgeVariant => {
    switch (status) {
      case "HEALTHY":
        return "success";
      case "WARNING":
        return "warning";
      case "ERROR":
        return "error";
      default:
        return "neutral";
    }
  };

  const policyStatusVariant = (status: PolicyRecord["status"]): BadgeVariant => {
    switch (status) {
      case "ENABLED":
        return "success";
      case "DISABLED":
        return "warning";
      default:
        return "neutral";
    }
  };

  const priorityVariant = (priority: string): BadgeVariant => {
    switch (priority) {
      case "HIGH":
        return "error";
      case "MEDIUM":
        return "warning";
      case "LOW":
        return "neutral";
      default:
        return "neutral";
    }
  };

  const percent = (part: number, total: number): number =>
    total > 0 ? Math.round((part / total) * 100) : 0;

  const actionList = actionItemsOf(actionItems);
  const highPriorityCount = actionItemBandCounts(actionItems).HIGH;
  const actionItemsUnavailable = actionItemsError || actionItemsFailed(actionItems);
  const healthyConnections = (connections ?? []).filter((c) => c.status === "HEALTHY").length;
  const totalConnections = (connections ?? []).length;
  const enabledUsers = (users ?? []).filter((u) => u.enabled).length;
  const metricsFailed = countsError || connectionsError;
  // getConnectionHealthStatus() absorbs its own failures and returns an empty list, so
  // connectionsError cannot signal an outage and is left out of this check.
  const allFailed = jobsError && actionItemsError && usersError && policiesError && countsError;

  if (loading) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-body font-body text-subtext-color">Loading dashboard...</div>
        </div>
      </DefaultPageLayout>
    );
  }

  if (allFailed) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full flex-col items-start bg-default-background px-6 py-6">
          <ErrorState
            message="The administration dashboard could not be loaded. All backing services are unreachable."
            onRetry={loadDashboard}
          />
        </div>
      </DefaultPageLayout>
    );
  }

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start bg-default-background">
        <div className="flex w-full items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-2">
            <Avatar size="large">
              {(currentUser.name || currentUser.username || "?").charAt(0).toUpperCase()}
            </Avatar>
            <div className="flex flex-col items-start">
              <span className="text-heading-2 font-heading-2 text-default-font">
                Welcome{currentUser.name || currentUser.username ? `, ${currentUser.name || currentUser.username}` : ""}
              </span>
              <span className="text-body font-body text-subtext-color">
                Platform Administration Dashboard
              </span>
            </div>
          </div>
          {/* Notification bell backed by the real reporting action-items feed. */}
          <div className="relative">
            <Button icon={<FeatherBell />} onClick={() => setShowAlerts((open) => !open)}>
              {actionItems && !actionItemsUnavailable
                ? `${actionItemTotal(actionItems)} Action Items`
                : "Action Items"}
            </Button>
            {showAlerts && (
              <div className="absolute right-0 top-full z-50 mt-2 flex w-96 flex-col gap-2 rounded-md border border-solid border-neutral-border bg-default-background p-4 shadow-lg">
                <span className="text-body-bold font-body-bold text-default-font">
                  Open action items
                </span>
                {actionItemsUnavailable ? (
                  <ErrorState
                    message="Action items could not be loaded."
                    onRetry={loadDashboard}
                  />
                ) : actionList.length === 0 ? (
                  <EmptyState
                    title="No open action items"
                    message="Nothing requires administrator attention right now."
                  />
                ) : (
                  actionList.slice(0, 8).map((item, index) => (
                    <div
                      key={`${item.id ?? "item"}-${index}`}
                      className="flex w-full items-start gap-2 rounded-md bg-neutral-50 px-3 py-2"
                    >
                      <div className="flex grow flex-col items-start">
                        <span className="text-body-bold font-body-bold text-default-font">
                          {item.title || "Untitled action item"}
                        </span>
                        <span className="text-caption font-caption text-subtext-color">
                          {item.sourceService || "-"}
                        </span>
                      </div>
                      <Badge variant={priorityVariant(priorityBand(item.severity))}>
                        {item.severity || "-"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex w-full flex-col items-start gap-6 px-6 py-6 overflow-auto">
          {/* Lifecycle service status - real da-admin aggregated job statuses. */}
          <div className="flex w-full flex-col items-start gap-4">
            <span className="text-body-bold font-body-bold text-default-font">
              Lifecycle Service Status
            </span>
            {jobsError ? (
              <ErrorState
                message="Service job statuses could not be loaded from da-admin."
                onRetry={loadDashboard}
              />
            ) : !jobs || jobs.services.length === 0 ? (
              <EmptyState
                title="No job telemetry yet"
                message="No lifecycle service has reported job runs. Statuses appear after the first discovery, labeling, archival or deletion job."
              />
            ) : (
              <div className="flex w-full flex-wrap items-start gap-4">
                {jobs.services.map((service) => (
                  <div
                    key={service.serviceName}
                    className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-1 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6"
                  >
                    <div className="flex w-full items-center gap-2">
                      <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
                        {service.serviceName}
                      </span>
                      <IconWithBackground
                        variant={serviceStatusVariant(service.status)}
                        icon={<FeatherZap />}
                      />
                    </div>
                    <span className="text-heading-1 font-heading-1 text-brand-700">
                      {service.status === "HEALTHY"
                        ? "OK"
                        : service.status === "WARNING"
                          ? "Warning"
                          : "Error"}
                    </span>
                    <Badge
                      variant={serviceStatusVariant(service.status)}
                      icon={
                        service.status === "HEALTHY" ? (
                          <FeatherCheck />
                        ) : service.status === "WARNING" ? (
                          <FeatherAlertTriangle />
                        ) : (
                          <FeatherXCircle />
                        )
                      }
                    >
                      {service.lastJobTime
                        ? `Last job ${formatDate(service.lastJobTime)}`
                        : "No completed jobs"}
                    </Badge>
                    <span className="text-caption font-caption text-subtext-color">
                      {service.jobCount.success} succeeded / {service.jobCount.failed} failed /{" "}
                      {service.jobCount.running} running
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Platform metrics - cloud connections, catalog capture rates, users. */}
          <div className="flex w-full flex-col items-start gap-4">
            <span className="text-body-bold font-body-bold text-default-font">
              Platform Metrics
            </span>
            {metricsFailed && (
              <ErrorState
                message={
                  countsError && connectionsError
                    ? "Cloud connection health and catalog capture metrics could not be loaded."
                    : countsError
                      ? "Catalog capture metrics could not be loaded from da-catalog."
                      : "Cloud connection health could not be loaded from da-admin."
                }
                onRetry={loadDashboard}
              />
            )}
            <div className="flex w-full flex-wrap items-start gap-4">
              {connections !== null && (
                <div className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-1 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                  <div className="flex w-full items-center gap-2">
                    <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
                      Cloud Connections
                    </span>
                    <IconWithBackground
                      variant={
                        totalConnections > 0 && healthyConnections === totalConnections
                          ? "success"
                          : "warning"
                      }
                      icon={<FeatherCloud />}
                    />
                  </div>
                  <span className="text-heading-1 font-heading-1 text-brand-700">
                    {healthyConnections}/{totalConnections}
                  </span>
                  <Badge
                    variant={
                      totalConnections === 0
                        ? "neutral"
                        : healthyConnections === totalConnections
                          ? "success"
                          : "warning"
                    }
                    icon={
                      totalConnections > 0 && healthyConnections === totalConnections ? (
                        <FeatherCheck />
                      ) : (
                        <FeatherAlertTriangle />
                      )
                    }
                  >
                    {totalConnections === 0
                      ? "No connections configured"
                      : healthyConnections === totalConnections
                        ? "All healthy"
                        : `${totalConnections - healthyConnections} need attention`}
                  </Badge>
                </div>
              )}

              {catalogCounts !== null && (
                <div className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-1 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                  <div className="flex w-full items-center gap-2">
                    <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
                      Metadata Capture
                    </span>
                    <IconWithBackground variant="brand" icon={<FeatherDatabase />} />
                  </div>
                  <span className="text-heading-1 font-heading-1 text-brand-700">
                    {percent(catalogCounts.withMetadata, catalogCounts.total)}%
                  </span>
                  <Progress value={percent(catalogCounts.withMetadata, catalogCounts.total)} />
                  <span className="text-caption font-caption text-subtext-color">
                    {catalogCounts.withMetadata} of {catalogCounts.total} cataloged assets
                  </span>
                </div>
              )}

              {catalogCounts !== null && (
                <div className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-1 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                  <div className="flex w-full items-center gap-2">
                    <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
                      Lineage Capture
                    </span>
                    <IconWithBackground variant="success" icon={<FeatherGitBranch />} />
                  </div>
                  <span className="text-heading-1 font-heading-1 text-brand-700">
                    {percent(catalogCounts.withLineage, catalogCounts.total)}%
                  </span>
                  <Progress value={percent(catalogCounts.withLineage, catalogCounts.total)} />
                  <span className="text-caption font-caption text-subtext-color">
                    {catalogCounts.withLineage} of {catalogCounts.total} cataloged assets
                  </span>
                </div>
              )}

              {users !== null && (
                <div className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-1 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                  <div className="flex w-full items-center gap-2">
                    <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
                      Enabled Users
                    </span>
                    <IconWithBackground variant="success" icon={<FeatherUsers />} />
                  </div>
                  <span className="text-heading-1 font-heading-1 text-brand-700">
                    {enabledUsers}
                  </span>
                  <span className="text-caption font-caption text-subtext-color">
                    of {users.length} accounts in Keycloak
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action items feed - real da-reporting aggregation. */}
          <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background p-6 shadow-sm">
            <div className="flex w-full items-center justify-between">
              <span className="text-body-bold font-body-bold text-default-font">
                Action Items
              </span>
              {actionItems && !actionItemsUnavailable && (
                <Badge variant={highPriorityCount > 0 ? "warning" : "neutral"}>
                  {highPriorityCount} high priority
                </Badge>
              )}
            </div>
            {actionItemsUnavailable ? (
              <ErrorState
                message="Action items could not be loaded from da-reporting."
                onRetry={loadDashboard}
              />
            ) : actionList.length === 0 ? (
              <EmptyState
                title="No open action items"
                message="Policy approvals, compliance violations and system alerts will appear here."
              />
            ) : (
              <div className="flex w-full flex-col items-start gap-3">
                {actionList.slice(0, 10).map((item, index) => (
                  <div
                    key={`${item.id ?? "item"}-${index}`}
                    className="flex w-full items-center gap-3 rounded-md bg-neutral-50 px-4 py-3"
                  >
                    <IconWithBackground
                      variant={priorityVariant(priorityBand(item.severity))}
                      icon={
                        priorityBand(item.severity) === "HIGH" ? <FeatherAlertTriangle /> : <FeatherClock />
                      }
                    />
                    <div className="flex grow flex-col items-start">
                      <span className="text-body-bold font-body-bold text-default-font">
                        {item.title || "Untitled action item"}
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        {item.description}
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        {item.sourceService || "-"} • {(item.category ?? "").replace(/_/g, " ").toLowerCase() || "-"}
                      </span>
                    </div>
                    <Badge variant={priorityVariant(priorityBand(item.severity))}>
                      {item.severity || "-"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Policy overview - real da-policyengine policy list. */}
          <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center justify-between">
              <span className="text-body-bold font-body-bold text-default-font">
                Policy Overview
              </span>
              <Button
                variant="neutral-tertiary"
                onClick={() => window.navigateToPolicyHub2?.()}
              >
                Open Policy Hub
              </Button>
            </div>
            {policiesError ? (
              <ErrorState
                message="Policies could not be loaded from da-policyengine."
                onRetry={loadDashboard}
              />
            ) : !policies || policies.length === 0 ? (
              <EmptyState
                title="No policies defined"
                message="Create lifecycle policies from the Policy Hub to see them here."
              />
            ) : (
              <div className="flex w-full flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background shadow-sm">
                <Table
                  header={
                    <Table.HeaderRow>
                      <Table.HeaderCell>Policy Name</Table.HeaderCell>
                      <Table.HeaderCell>Status</Table.HeaderCell>
                      <Table.HeaderCell>Description</Table.HeaderCell>
                    </Table.HeaderRow>
                  }
                >
                  {policies.slice(0, 8).map((policy) => (
                    <Table.Row key={policy.id}>
                      <Table.Cell>
                        <span className="text-body-bold font-body-bold text-default-font">
                          {policy.name}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge variant={policyStatusVariant(policy.status)}>
                          {policy.status}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-body font-body text-subtext-color">
                          {policy.description}
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table>
              </div>
            )}
          </div>

          {/* User management overview - real Keycloak users via da-admin. */}
          <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center justify-between">
              <span className="text-body-bold font-body-bold text-default-font">
                User Management Overview
              </span>
              <Button
                variant="neutral-tertiary"
                onClick={() => window.navigateToUserManagement?.()}
              >
                Manage All Users
              </Button>
            </div>
            {usersError ? (
              <ErrorState
                message="Users could not be loaded from da-admin."
                onRetry={loadDashboard}
              />
            ) : !users || users.length === 0 ? (
              <EmptyState
                title="No users found"
                message="No user accounts exist in the Keycloak realm yet."
              />
            ) : (
              <div className="flex w-full flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background shadow-sm">
                <Table
                  header={
                    <Table.HeaderRow>
                      <Table.HeaderCell>User</Table.HeaderCell>
                      <Table.HeaderCell>Roles</Table.HeaderCell>
                      <Table.HeaderCell>Status</Table.HeaderCell>
                      <Table.HeaderCell>Actions</Table.HeaderCell>
                    </Table.HeaderRow>
                  }
                >
                  {users.slice(0, 8).map((user) => (
                    <Table.Row key={user.id || user.username}>
                      <Table.Cell>
                        <div className="flex flex-col items-start">
                          <span className="text-body-bold font-body-bold text-default-font">
                            {displayName(user)}
                          </span>
                          <span className="text-caption font-caption text-subtext-color">
                            {user.email || `@${user.username}`}
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex flex-wrap items-center gap-1">
                          {user.roles.slice(0, 3).map((role) => (
                            <Badge key={role} variant="neutral">
                              {role}
                            </Badge>
                          ))}
                          {user.roles.length > 3 && (
                            <Badge variant="neutral">+{user.roles.length - 3}</Badge>
                          )}
                          {user.roles.length === 0 && (
                            <span className="text-caption font-caption text-subtext-color">
                              No roles
                            </span>
                          )}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge
                          variant={user.enabled ? "success" : "error"}
                          icon={user.enabled ? <FeatherCheck /> : <FeatherXCircle />}
                        >
                          {user.enabled ? "enabled" : "disabled"}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Button
                          variant="neutral-tertiary"
                          size="small"
                          onClick={() => window.navigateToUserManagement?.()}
                        >
                          Manage
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table>
              </div>
            )}
          </div>

          {/* Admin quick actions - every target is a wired route. */}
          <div className="flex w-full items-center gap-4">
            <Button
              variant="neutral-secondary"
              icon={<FeatherSettings />}
              onClick={() => window.navigateToPolicyHub2?.()}
            >
              Configure Policies
            </Button>
            <Button
              variant="neutral-secondary"
              icon={<FeatherUsers />}
              onClick={() => window.navigateToUserManagement?.()}
            >
              Manage Users
            </Button>
            <Button
              variant="neutral-secondary"
              icon={<FeatherBarChart3 />}
              onClick={() => window.navigateToReportingInsightsHub?.()}
            >
              View Reports
            </Button>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default AdminControlHub;
