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
  FeatherArchive, FeatherCheck,
  FeatherClock,
  FeatherDatabase,
  FeatherDollarSign,
  FeatherFlag,
  FeatherSearch,
  FeatherTrendingUp
} from "@subframe/core";
import React, { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Badge } from "../ui/components/Badge";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Table } from "../ui/components/Table";
import { Tabs } from "../ui/components/Tabs";
import { TextField } from "../ui/components/TextField";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import { archivalApi } from "../utils/api";
import {
  NOT_AVAILABLE_YET,
  archivalSavingsFigure,
  archivalStorageFigure,
} from "../utils/apiServices";

// -----------------------------------------------------------------------------
// Real da-autoarchival overview shapes (ArchivalOverviewController):
//   GET /api/v1/archival/overview/kpis            -> ArchivalKpisDTO
//   GET /api/v1/archival/overview/recent-activities-> List<RecentActivityDTO>
//   GET /api/v1/archival/overview/trends          -> List<CostSavingsTrendDTO>
// Only fields the backend actually returns are rendered - no fabrication.
// -----------------------------------------------------------------------------
interface ArchivalKpis {
  estimatedMonthlySavings?: number | null;
  totalSavingsToDate?: number | null;
  storageReclaimed?: string | null;
  assetsArchived?: number;
  pendingArchival?: number;
}

interface RecentActivity {
  id?: string;
  event?: string;
  assetName?: string;
  policy?: string;
  storageSize?: string;
  status?: string;
  timestamp?: string;
}

interface CostSavingsTrend {
  date?: string;
  monthlySavings?: number;
  cumulativeSavings?: number;
}

const statusVariant = (status?: string): "success" | "warning" | "error" | "neutral" => {
  switch ((status ?? "").toLowerCase()) {
    case "success":
    case "archived":
    case "completed":
      return "success";
    case "pending":
    case "in progress":
      return "warning";
    case "failed":
    case "error":
      return "error";
    default:
      return "neutral";
  }
};

const formatCurrency = (amount?: number): string =>
  typeof amount === "number"
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)
    : "-";

function ArchivalAgentActivitySaving() {
  const [kpis, setKpis] = useState<ArchivalKpis | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [trends, setTrends] = useState<CostSavingsTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const [kpisRes, activitiesRes, trendsRes] = await Promise.all([
        archivalApi.get("/overview/kpis"),
        archivalApi.get("/overview/recent-activities", { params: { limit: 25 } }),
        archivalApi.get("/overview/trends", { params: { weeks: 26 } }),
      ]);
      setKpis(kpisRes.data ?? null);
      setActivities(Array.isArray(activitiesRes.data) ? activitiesRes.data : []);
      setTrends(Array.isArray(trendsRes.data) ? trendsRes.data : []);
    } catch (e) {
      console.error("Error loading archival activity data:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredActivities = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activities;
    return activities.filter(
      (a) =>
        (a.assetName ?? "").toLowerCase().includes(q) ||
        (a.policy ?? "").toLowerCase().includes(q) ||
        (a.event ?? "").toLowerCase().includes(q)
    );
  }, [activities, search]);

  // The backend reports savings and reclaimed storage as constant zeros until it
  // aggregates real data; those render as "Not available yet", not as $0.
  const totalSaved = archivalSavingsFigure(kpis?.totalSavingsToDate, kpis?.assetsArchived);
  const monthlySaved = archivalSavingsFigure(kpis?.estimatedMonthlySavings, kpis?.assetsArchived);
  const storageReclaimed = archivalStorageFigure(kpis?.storageReclaimed, kpis?.assetsArchived);

  return (
    <DefaultPageLayout>
      <div className="container max-w-none flex h-full w-full flex-col items-start gap-8 bg-default-background py-12">
        <div className="flex w-full items-start gap-4">
          <IconWithBackground size="medium" icon={<FeatherArchive />} />
          <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
            <span className="text-heading-2 font-heading-2 text-default-font">
              AutoArchival Management
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="success" icon={<FeatherCheck />}>
                Healthy
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col items-start gap-6">
          <Tabs>
            <Tabs.Item onClick={() => window.navigateToArchivalAgentOverview?.()}>Overview</Tabs.Item>
            <Tabs.Item onClick={() => window.navigateToArchivalAgentPolicyConfiguration?.()}>Policy Configuration</Tabs.Item>
            <Tabs.Item active={true}>Archival Activity &amp; Savings</Tabs.Item>
          </Tabs>

          {loading ? (
            <div className="flex w-full items-center justify-center py-12">
              <span className="text-body font-body text-subtext-color">Loading archival activity…</span>
            </div>
          ) : error ? (
            <ErrorState message="Could not load archival activity and savings data." onRetry={load} />
          ) : (
            <>
              <div className="flex w-full flex-wrap items-start gap-4">
                <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
                  <div className="flex w-full items-center gap-2">
                    <IconWithBackground variant="success" icon={<FeatherDollarSign />} />
                    <span className="text-body-bold font-body-bold text-subtext-color">
                      Total Estimated Savings
                    </span>
                  </div>
                  {totalSaved !== null ? (
                    <span className="text-heading-1 font-heading-1 text-success-700">
                      {formatCurrency(totalSaved)}
                    </span>
                  ) : (
                    <span className="text-heading-3 font-heading-3 text-subtext-color">
                      {NOT_AVAILABLE_YET}
                    </span>
                  )}
                  {monthlySaved !== null ? (
                    <Badge variant="success" icon={<FeatherTrendingUp />}>
                      {formatCurrency(monthlySaved)} / month
                    </Badge>
                  ) : null}
                </div>
                <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
                  <div className="flex w-full items-center gap-2">
                    <IconWithBackground icon={<FeatherDatabase />} />
                    <span className="text-body-bold font-body-bold text-subtext-color">
                      Storage Reclaimed
                    </span>
                  </div>
                  {storageReclaimed !== null ? (
                    <span className="text-heading-1 font-heading-1 text-default-font">
                      {storageReclaimed}
                    </span>
                  ) : (
                    <span className="text-heading-3 font-heading-3 text-subtext-color">
                      {NOT_AVAILABLE_YET}
                    </span>
                  )}
                  {typeof kpis?.assetsArchived === "number" ? (
                    <Badge icon={<FeatherClock />}>{kpis.assetsArchived} assets archived</Badge>
                  ) : null}
                </div>
                <div className="flex min-w-[192px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
                  <div className="flex w-full items-center gap-2">
                    <IconWithBackground variant="warning" icon={<FeatherFlag />} />
                    <span className="text-body-bold font-body-bold text-subtext-color">
                      Pending Archival
                    </span>
                  </div>
                  <span className="text-heading-1 font-heading-1 text-warning-700">
                    {kpis?.pendingArchival ?? 0}
                  </span>
                  <Badge variant="warning" icon={<FeatherAlertCircle />}>
                    Awaiting run
                  </Badge>
                </div>
              </div>

              <div className="flex w-full flex-col items-start gap-4">
                <div className="flex w-full items-center justify-between">
                  <span className="text-heading-3 font-heading-3 text-default-font">
                    Recent Archival Activity
                  </span>
                  <TextField className="w-64" label="" helpText="" icon={<FeatherSearch />}>
                    <TextField.Input
                      placeholder="Search activities..."
                      value={search}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
                    />
                  </TextField>
                </div>
                {filteredActivities.length === 0 ? (
                  <EmptyState
                    title="No archival activity yet"
                    message="Once the archival agent runs, archived assets will appear here."
                  />
                ) : (
                  <div className="flex w-full flex-col items-start rounded-md border border-solid border-neutral-border bg-default-background shadow-sm">
                    <Table
                      header={
                        <Table.HeaderRow>
                          <Table.HeaderCell>Date &amp; Time</Table.HeaderCell>
                          <Table.HeaderCell>Asset Name</Table.HeaderCell>
                          <Table.HeaderCell>Policy</Table.HeaderCell>
                          <Table.HeaderCell>Size</Table.HeaderCell>
                          <Table.HeaderCell>Status</Table.HeaderCell>
                        </Table.HeaderRow>
                      }
                    >
                      {filteredActivities.map((activity, index) => (
                        <Table.Row key={activity.id ?? `activity-${index}`}>
                          <Table.Cell>
                            <span className="text-body font-body text-subtext-color">
                              {activity.timestamp || "-"}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-body-bold font-body-bold text-default-font">
                              {activity.assetName || "-"}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            {activity.policy ? <Badge>{activity.policy}</Badge> : <span className="text-body font-body text-subtext-color">-</span>}
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-body font-body text-default-font">
                              {activity.storageSize || "-"}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <Badge variant={statusVariant(activity.status)}>
                              {activity.status || "Unknown"}
                            </Badge>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table>
                  </div>
                )}
              </div>

              <div className="flex w-full items-center justify-between">
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Monthly Savings Breakdown
                </span>
              </div>
              {trends.length === 0 ? (
                <EmptyState
                  title="No savings trend data yet"
                  message="Cost savings trends will appear once archival runs accumulate history."
                />
              ) : (
                <div className="flex w-full flex-col items-start rounded-md border border-solid border-neutral-border bg-default-background p-6 shadow-sm">
                  <div className="flex w-full flex-wrap items-start gap-4">
                    {trends.map((trend, index) => (
                      <div
                        key={trend.date ?? `trend-${index}`}
                        className="flex min-w-[160px] grow shrink-0 basis-0 flex-col items-start gap-1"
                      >
                        <span className="text-body-bold font-body-bold text-default-font">
                          {trend.date || "-"}
                        </span>
                        <span className="text-heading-3 font-heading-3 text-success-700">
                          {formatCurrency(trend.monthlySavings)}
                        </span>
                        {typeof trend.cumulativeSavings === "number" ? (
                          <span className="text-caption font-caption text-subtext-color">
                            Cumulative {formatCurrency(trend.cumulativeSavings)}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default ArchivalAgentActivitySaving;
