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

import * as SubframeCore from "@subframe/core";
import {
  FeatherAlertTriangle,
  FeatherArchive,
  FeatherBell,
  FeatherCheck,
  FeatherDatabase,
  FeatherDollarSign,
  FeatherPieChart,
  FeatherPlus,
  FeatherServer,
  FeatherSettings,
  FeatherShield,
  FeatherTrash,
  FeatherTrendingUp,
} from "@subframe/core";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Avatar } from "../ui/components/Avatar";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { DropdownMenu } from "../ui/components/DropdownMenu";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { Progress } from "../ui/components/Progress";
import { Table } from "../ui/components/Table";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";
import {
  ActionItemsResponse,
  CostSavingsResponse,
  GovernanceScoreResponse,
  IJobStatusResponse,
  NOT_AVAILABLE_YET,
  PolicyRecord,
  PriorityBand,
  actionItemButtonText,
  actionItemTotal,
  actionItemsFailed,
  actionItemsOf,
  costFigure,
  getActionItems,
  getCostSavings,
  getGovernanceScore,
  getJobStatuses,
  governanceBreakdown,
  isNum,
  listPolicies,
  openActionItem,
  priorityBand,
} from "../utils/apiServices";
import { useCurrentUser } from "../utils/currentUser";

/** Up-to-two-letter initials for the signed-in user (no stock photos). */
const initialsOf = (value: string): string =>
  value
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

/** Badge colour for an action item priority band. */
const priorityBadgeVariant = (
  priority: PriorityBand
): "error" | "warning" | "neutral" => {
  switch (priority) {
    case "HIGH":
      return "error";
    case "MEDIUM":
      return "warning";
    default:
      return "neutral";
  }
};

/** Where an item goes when its category has no dedicated view. */
const ACTION_ITEM_FALLBACK = "navigateToReportingInsightsHub";

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);

function HomePageExec() {
  const currentUser = useCurrentUser();

  const [governance, setGovernance] = useState<GovernanceScoreResponse | null>(null);
  const [governanceError, setGovernanceError] = useState(false);
  const [costSavings, setCostSavings] = useState<CostSavingsResponse | null>(null);
  const [costError, setCostError] = useState(false);
  const [policies, setPolicies] = useState<PolicyRecord[] | null>(null);
  const [policiesError, setPoliciesError] = useState(false);
  const [jobStatuses, setJobStatuses] = useState<IJobStatusResponse | null>(null);
  const [actionItems, setActionItems] = useState<ActionItemsResponse | null>(null);
  const [actionItemsError, setActionItemsError] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setGovernanceError(false);
    setCostError(false);
    setPoliciesError(false);
    setActionItemsError(false);

    const [governanceRes, costRes, policiesRes, jobsRes, actionsRes] =
      await Promise.allSettled([
        getGovernanceScore(),
        getCostSavings(),
        listPolicies(),
        getJobStatuses(),
        getActionItems(),
      ]);

    if (governanceRes.status === "fulfilled") setGovernance(governanceRes.value);
    else {
      console.error("Executive dashboard: governance score failed:", governanceRes.reason);
      setGovernanceError(true);
    }
    if (costRes.status === "fulfilled") setCostSavings(costRes.value);
    else {
      console.error("Executive dashboard: cost savings failed:", costRes.reason);
      setCostError(true);
    }
    if (policiesRes.status === "fulfilled") setPolicies(policiesRes.value);
    else {
      console.error("Executive dashboard: policy list failed:", policiesRes.reason);
      setPoliciesError(true);
    }
    if (jobsRes.status === "fulfilled") setJobStatuses(jobsRes.value);
    else console.error("Executive dashboard: job statuses failed:", jobsRes.reason);
    if (actionsRes.status === "fulfilled") setActionItems(actionsRes.value);
    else {
      console.error("Executive dashboard: action items failed:", actionsRes.reason);
      setActionItemsError(true);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <DefaultPageLayout>
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-body font-body text-subtext-color">
            Loading dashboard...
          </div>
        </div>
      </DefaultPageLayout>
    );
  }

  const activePolicyCount =
    policies?.filter((p) => p.status === "ENABLED").length ?? null;

  const overallScoreRaw = governance?.overallScore;
  const overallScore = isNum(overallScoreRaw) ? Math.round(overallScoreRaw) : null;

  // Dollar figures are null until a billing source is connected.
  const monthlySavings = costFigure(costSavings, costSavings?.monthlySavingsRate);
  const archivalSavings = costFigure(costSavings, costSavings?.breakdown?.archivalSavings);
  const deletionSavings = costFigure(costSavings, costSavings?.breakdown?.deletionSavings);
  const breakdown = governanceBreakdown(governance);
  const items = actionItemsOf(actionItems);

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start">
        <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border px-12 py-4">
          <div className="flex grow shrink-0 basis-0 items-center gap-4">
            <Avatar size="large">
              {initialsOf(currentUser.name || currentUser.username)}
            </Avatar>
            <div className="flex flex-col items-start">
              <span className="text-heading-2 font-heading-2 text-default-font">
                Welcome
                {currentUser.name ? `, ${currentUser.name}` : ""}
              </span>
              <span className="text-body font-body text-subtext-color">
                Executive Dashboard
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SubframeCore.DropdownMenu.Root>
              <SubframeCore.DropdownMenu.Trigger asChild={true}>
                <Button variant="neutral-tertiary" icon={<FeatherBell />}>
                  {actionItems
                    ? `Notifications (${actionItemTotal(actionItems)})`
                    : "Notifications"}
                </Button>
              </SubframeCore.DropdownMenu.Trigger>
              <SubframeCore.DropdownMenu.Portal>
                <SubframeCore.DropdownMenu.Content
                  side="bottom"
                  align="end"
                  sideOffset={4}
                  asChild={true}
                >
                  <DropdownMenu>
                    {actionItemsError || actionItemsFailed(actionItems) ? (
                      <DropdownMenu.DropdownItem icon={<FeatherAlertTriangle />}>
                        Could not load action items
                      </DropdownMenu.DropdownItem>
                    ) : items.length === 0 ? (
                      <DropdownMenu.DropdownItem icon={<FeatherCheck />}>
                        No pending action items
                      </DropdownMenu.DropdownItem>
                    ) : (
                      items.slice(0, 8).map((item, index) => (
                        <DropdownMenu.DropdownItem
                          key={`${item.id ?? "item"}-${index}`}
                          icon={<FeatherBell />}
                          onClick={() => openActionItem(item, ACTION_ITEM_FALLBACK)}
                        >
                          {item.title || "Untitled action item"}
                        </DropdownMenu.DropdownItem>
                      ))
                    )}
                  </DropdownMenu>
                </SubframeCore.DropdownMenu.Content>
              </SubframeCore.DropdownMenu.Portal>
            </SubframeCore.DropdownMenu.Root>
            <Button
              variant="neutral-tertiary"
              icon={<FeatherSettings />}
              onClick={() => window.navigateToPlatformSettings?.()}
            >
              Settings
            </Button>
          </div>
        </div>
        <div className="flex w-full grow shrink-0 basis-0 flex-col items-start gap-8 bg-default-background px-12 py-8 overflow-auto">
          <div className="flex w-full flex-wrap items-start gap-6">
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <span className="text-caption-bold font-caption-bold text-subtext-color">
                Overall Data Governance Score
              </span>
              <div className="flex items-center gap-2">
                <span className="text-heading-1 font-heading-1 text-default-font">
                  {overallScore !== null ? `${overallScore}%` : "-"}
                </span>
                {governanceError ? (
                  <Badge variant="error">Load failed</Badge>
                ) : null}
              </div>
              <Progress value={overallScore ?? 0} />
              {governance && overallScore === null ? (
                <span className="text-caption font-caption text-subtext-color">
                  {NOT_AVAILABLE_YET}
                </span>
              ) : null}
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <span className="text-caption-bold font-caption-bold text-subtext-color">
                Active Automated Policies
              </span>
              <div className="flex items-center gap-2">
                <span className="text-heading-1 font-heading-1 text-default-font">
                  {activePolicyCount ?? "-"}
                </span>
                {policiesError ? (
                  <Badge variant="error">Load failed</Badge>
                ) : (
                  <Badge icon={<FeatherShield />}>Active</Badge>
                )}
              </div>
              {jobStatuses ? (
                <>
                  <div className="flex w-full items-center gap-2">
                    <IconWithBackground icon={<FeatherServer />} />
                    <span className="text-body font-body text-subtext-color">
                      {jobStatuses.overall.healthyServices} of{" "}
                      {jobStatuses.overall.totalServices} services healthy
                    </span>
                  </div>
                  <div className="flex w-full items-center gap-2">
                    <IconWithBackground icon={<FeatherArchive />} />
                    <span className="text-body font-body text-subtext-color">
                      {jobStatuses.overall.activeJobs} active jobs
                    </span>
                  </div>
                  <div className="flex w-full items-center gap-2">
                    <IconWithBackground
                      variant={
                        jobStatuses.overall.failedJobs > 0 ? "error" : "neutral"
                      }
                      icon={<FeatherTrash />}
                    />
                    <span className="text-body font-body text-subtext-color">
                      {jobStatuses.overall.failedJobs} failed jobs
                    </span>
                  </div>
                </>
              ) : null}
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
              <span className="text-caption-bold font-caption-bold text-subtext-color">
                Monthly Cost Savings
              </span>
              <div className="flex items-center gap-2">
                {monthlySavings !== null ? (
                  <span className="text-heading-1 font-heading-1 text-default-font">
                    {formatCurrency(monthlySavings)}
                  </span>
                ) : (
                  <span className="text-heading-3 font-heading-3 text-subtext-color">
                    {costSavings ? NOT_AVAILABLE_YET : "-"}
                  </span>
                )}
                {costError ? <Badge variant="error">Load failed</Badge> : null}
              </div>
              {costSavings ? (
                <>
                  <div className="flex w-full items-center gap-2">
                    <IconWithBackground icon={<FeatherArchive />} />
                    <span className="text-body font-body text-subtext-color">
                      {archivalSavings !== null
                        ? `${formatCurrency(archivalSavings)} from Archival`
                        : `Archival: ${NOT_AVAILABLE_YET}`}
                    </span>
                  </div>
                  <div className="flex w-full items-center gap-2">
                    <IconWithBackground icon={<FeatherDollarSign />} />
                    <span className="text-body font-body text-subtext-color">
                      {deletionSavings !== null
                        ? `${formatCurrency(deletionSavings)} from Deletion`
                        : `Deletion: ${NOT_AVAILABLE_YET}`}
                    </span>
                  </div>
                  {monthlySavings === null && costSavings.basis ? (
                    <span className="text-caption font-caption text-subtext-color">
                      {costSavings.basis}
                    </span>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
          <div className="flex w-full flex-col items-start gap-4">
            <span className="text-heading-2 font-heading-2 text-default-font">
              Action Items
            </span>
            {actionItemsError || actionItemsFailed(actionItems) ? (
              <ErrorState
                message="Could not load action items from the reporting service."
                onRetry={() => void loadDashboard()}
              />
            ) : items.length === 0 ? (
              <EmptyState
                title="No action items"
                message="There are no pending approvals, violations, or alerts right now."
              />
            ) : (
              <Table
                header={
                  <Table.HeaderRow>
                    <Table.HeaderCell>Item</Table.HeaderCell>
                    <Table.HeaderCell>Priority</Table.HeaderCell>
                    <Table.HeaderCell>Service</Table.HeaderCell>
                    <Table.HeaderCell>Action</Table.HeaderCell>
                  </Table.HeaderRow>
                }
              >
                {items.slice(0, 10).map((item, index) => (
                  <Table.Row key={`${item.id ?? "item"}-${index}`}>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <IconWithBackground
                          variant={priorityBadgeVariant(priorityBand(item.severity))}
                          icon={<FeatherShield />}
                        />
                        <span className="text-body-bold font-body-bold text-default-font">
                          {item.title || "Untitled action item"}
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={priorityBadgeVariant(priorityBand(item.severity))}>
                        {item.severity || "-"}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-body font-body text-default-font">
                        {item.sourceService || "-"}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        variant="brand-tertiary"
                        size="small"
                        onClick={() => openActionItem(item, ACTION_ITEM_FALLBACK)}
                      >
                        {actionItemButtonText(item)}
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table>
            )}
          </div>
          <div className="flex w-full flex-col items-start gap-4">
            <span className="text-heading-2 font-heading-2 text-default-font">
              Governance Breakdown
            </span>
            {governanceError ? (
              <ErrorState
                message="Couldn't load the governance breakdown from the reporting service."
                onRetry={() => void loadDashboard()}
              />
            ) : governance ? (
              <div className="flex w-full flex-wrap items-start gap-6">
                {[
                  { label: "Policy Compliance", value: breakdown.policyComplianceScore },
                  {
                    label: "Data Classification",
                    value: breakdown.dataClassificationScore,
                  },
                  {
                    label: "Metadata Completeness",
                    value: breakdown.metadataCompletenessScore,
                  },
                  { label: "Lineage Coverage", value: breakdown.lineageCoverageScore },
                ].map((entry) => (
                  <div
                    key={entry.label}
                    className="flex min-w-[240px] grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6"
                  >
                    <span className="text-body-bold font-body-bold text-default-font">
                      {entry.label}
                    </span>
                    {isNum(entry.value) ? (
                      <>
                        <span className="text-heading-2 font-heading-2 text-brand-700">
                          {Math.round(entry.value)}%
                        </span>
                        <Progress value={Math.round(entry.value)} />
                      </>
                    ) : (
                      <span className="text-body font-body text-subtext-color">
                        {NOT_AVAILABLE_YET}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No governance data"
                message="The reporting service returned no governance breakdown."
              />
            )}
          </div>
          <div className="flex w-full flex-col items-start gap-4">
            <span className="text-heading-2 font-heading-2 text-default-font">
              Quick Actions
            </span>
            <div className="flex items-center gap-2">
              <Button
                icon={<FeatherPlus />}
                onClick={() => window.navigateToPolicyWizardFlow?.()}
              >
                Define New Policy
              </Button>
              <Button
                variant="neutral-secondary"
                icon={<FeatherPieChart />}
                onClick={() => window.navigateToComplianceAgent?.()}
              >
                View Compliance
              </Button>
              <Button
                variant="neutral-secondary"
                icon={<FeatherDatabase />}
                onClick={() => window.navigateToDataCatalog?.()}
              >
                Data Estate
              </Button>
              <Button
                variant="neutral-secondary"
                icon={<FeatherTrendingUp />}
                onClick={() =>
                  window.navigateToReportingInsightsHub?.()
                }
              >
                Cost Analysis
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default HomePageExec;
