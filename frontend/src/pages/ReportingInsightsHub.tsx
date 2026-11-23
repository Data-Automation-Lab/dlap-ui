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
    FeatherActivity,
    FeatherAlertTriangle,
    FeatherDatabase,
    FeatherDownload,
    FeatherShield,
    FeatherTrendingDown,
    FeatherTrendingUp,
    FeatherZap,
} from "@subframe/core";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState } from "../components/EmptyState";
import {
    ActionItemsResponse,
    CostSavingsResponse,
    NOT_AVAILABLE_YET,
    actionItemBandCounts,
    actionItemTotal,
    actionItemsFailed,
    actionItemsOf,
    costFigure,
    getActionItems,
    getCostSavings,
    getGovernanceScore,
    GovernanceScoreResponse,
    governanceBreakdown,
    hasBenchmark,
    hasCostFigures,
    isNum,
    priorityBand,
} from "../utils/apiServices";
import { formatDate } from "../utils/safeDate";
import { Badge } from "../ui/components/Badge";
import { Button } from "../ui/components/Button";
import { IconWithBackground } from "../ui/components/IconWithBackground";
import { LineChart } from "../ui/components/LineChart";
import { Progress } from "../ui/components/Progress";
import { Table } from "../ui/components/Table";
import { Tabs } from "../ui/components/Tabs";
import { DefaultPageLayout } from "../ui/layouts/DefaultPageLayout";

type ReportType = "cost-savings" | "governance-score" | "action-items";

/** Trigger a browser download of a CSV string built from real loaded data. */
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const escape = (cell: string | number) => {
    const s = String(cell ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function ReportingInsightsHub() {
  const [activeReport, setActiveReport] = useState<ReportType>("cost-savings");

  const [costData, setCostData] = useState<CostSavingsResponse | null>(null);
  const [governanceData, setGovernanceData] = useState<GovernanceScoreResponse | null>(null);
  const [actionData, setActionData] = useState<ActionItemsResponse | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  const loadReportData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      switch (activeReport) {
        case "cost-savings": {
          const data = await getCostSavings();
          setCostData(data);
          break;
        }
        case "governance-score": {
          const data = await getGovernanceScore();
          setGovernanceData(data);
          break;
        }
        case "action-items": {
          const data = await getActionItems();
          setActionData(data);
          break;
        }
      }
    } catch (err) {
      console.error("Error loading report data:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [activeReport]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "HIGH":
        return "error";
      case "MEDIUM":
        return "warning";
      case "LOW":
        return "success";
      default:
        return "neutral";
    }
  };

  const formatCurrency = (value: number) =>
    `$${Math.round(value).toLocaleString()}`;

  /** A dollar figure, or NOT_AVAILABLE_YET when the backend has none. */
  const money = (value: number | null): string =>
    value === null ? NOT_AVAILABLE_YET : formatCurrency(value);

  /** A score rounded to one decimal, or NOT_AVAILABLE_YET. */
  const score = (value: number | null | undefined): string =>
    isNum(value) ? String(Math.round(value * 10) / 10) : NOT_AVAILABLE_YET;

  const handleExportReport = () => {
    if (activeReport === "cost-savings" && costData) {
      const figure = (value: number | null | undefined) => money(costFigure(costData, value));
      const breakdown = costData.breakdown ?? {};
      const rows: (string | number)[][] = [
        ["Metric", "Value"],
        ["Total Savings", figure(costData.totalSavings)],
        ["Monthly Savings", figure(costData.monthlySavingsRate)],
        ["Return on Investment", isNum(costData.roiPercentage) && hasCostFigures(costData) ? `${Math.round(costData.roiPercentage)}%` : NOT_AVAILABLE_YET],
        ["Archival Savings", figure(breakdown.archivalSavings)],
        ["Deletion Savings", figure(breakdown.deletionSavings)],
        ["Tier Optimization Savings", figure(breakdown.tierOptimizationSavings)],
        ["Net Savings", figure(breakdown.netSavings)],
        [],
        ["Opportunity Type", "Description", "Potential Savings"],
        ...(costData.savingsOpportunities ?? []).map((o) => [
          o.opportunityType ?? "",
          o.description ?? "",
          figure(o.potentialSavings),
        ]),
      ];
      downloadCsv("cost-savings-report.csv", rows);
    } else if (activeReport === "governance-score" && governanceData) {
      const breakdown = governanceBreakdown(governanceData);
      const rows: (string | number)[][] = [
        ["Metric", "Score"],
        ["Overall Score", score(governanceData.overallScore)],
        ["Policy Compliance", score(breakdown.policyComplianceScore)],
        ["Data Classification", score(breakdown.dataClassificationScore)],
        ["Metadata Completeness", score(breakdown.metadataCompletenessScore)],
        ["Lineage Coverage", score(breakdown.lineageCoverageScore)],
        [],
        ["Recommendations"],
        ...(governanceData.recommendations ?? []).map((r) => [r]),
      ];
      downloadCsv("governance-score-report.csv", rows);
    } else if (activeReport === "action-items" && actionData) {
      const rows: (string | number)[][] = [
        ["Title", "Severity", "Category", "Service", "Due Date"],
        ...actionItemsOf(actionData).map((i) => [
          i.title ?? "",
          i.severity ?? "",
          i.category ?? "",
          i.sourceService ?? "",
          i.dueDate ?? "",
        ]),
      ];
      downloadCsv("action-items-report.csv", rows);
    }
  };

  const exportDisabled =
    (activeReport === "cost-savings" && !costData) ||
    (activeReport === "governance-score" && !governanceData) ||
    (activeReport === "action-items" && !actionData);

  const renderCostSavingsReport = () => {
    if (!costData) {
      return (
        <EmptyState
          title="No cost savings data"
          message="The reporting service returned no cost savings figures yet."
        />
      );
    }
    const figuresAvailable = hasCostFigures(costData);
    const total = costFigure(costData, costData.totalSavings);
    const monthly = costFigure(costData, costData.monthlySavingsRate);
    const roi = figuresAvailable && isNum(costData.roiPercentage) ? costData.roiPercentage : null;
    const breakdown = costData.breakdown ?? {};
    const opportunities = figuresAvailable ? (costData.savingsOpportunities ?? []) : [];
    const trendData = figuresAvailable
      ? (costData.historicalTrend ?? [])
          .filter((point) => isNum(point.monthlySavings))
          .map((point, index) => ({
            category: point.month ?? `M${index + 1}`,
            "Savings": point.monthlySavings as number,
          }))
      : [];
    const estimateBadge = costData.isEstimate === true ? "Estimated" : null;
    const valueClass = (value: number | null) =>
      value === null
        ? "text-heading-3 font-heading-3 text-subtext-color"
        : "text-heading-1 font-heading-1 text-default-font";
    return (
      <div className="flex w-full flex-col gap-6">
        {!figuresAvailable ? (
          <div className="flex w-full flex-col gap-1 rounded-md border border-solid border-neutral-border bg-neutral-50 px-6 py-4">
            <span className="text-body-bold font-body-bold text-default-font">
              Dollar savings are not available yet
            </span>
            <span className="text-body font-body text-subtext-color">
              {costData.basis ||
                (costData.dataAvailable === false
                  ? "The catalog could not be reached, so savings were not computed."
                  : "No cloud billing source is connected, so dollar savings are not computed.")}
            </span>
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-4 w-full">
          <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground icon={<FeatherTrendingUp />} variant="success" />
              <span className="text-body-bold font-body-bold text-subtext-color">
                Total Savings
              </span>
            </div>
            <span className={valueClass(total)}>{money(total)}</span>
            {total !== null && estimateBadge ? <Badge variant="neutral">{estimateBadge}</Badge> : null}
          </div>

          <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground icon={<FeatherTrendingDown />} variant="brand" />
              <span className="text-body-bold font-body-bold text-subtext-color">
                Monthly Savings
              </span>
            </div>
            <span className={valueClass(monthly)}>{money(monthly)}</span>
            {monthly !== null ? <Badge variant="neutral">Monthly rate</Badge> : null}
          </div>

          <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground icon={<FeatherZap />} variant="warning" />
              <span className="text-body-bold font-body-bold text-subtext-color">
                Return on Investment
              </span>
            </div>
            <span className={valueClass(roi)}>
              {roi !== null ? `${Math.round(roi)}%` : NOT_AVAILABLE_YET}
            </span>
            {roi !== null && estimateBadge ? <Badge variant="neutral">{estimateBadge}</Badge> : null}
          </div>
        </div>

        <div className="flex w-full gap-6">
          <div className="flex w-2/3 flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex items-center justify-between w-full">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Savings Trend
              </span>
              <Badge variant="neutral">Last 12 months</Badge>
            </div>
            {trendData.length > 0 ? (
              <LineChart
                className="h-64 w-full flex-none"
                data={trendData}
                index="category"
                categories={["Savings"]}
              />
            ) : (
              <EmptyState
                title={NOT_AVAILABLE_YET}
                message="No savings history is stored yet."
              />
            )}
          </div>

          <div className="flex w-1/3 flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <span className="text-heading-3 font-heading-3 text-default-font">
              Savings Breakdown
            </span>
            <div className="flex flex-col gap-3 w-full">
              {[
                { label: "Archival", value: breakdown.archivalSavings },
                { label: "Deletion", value: breakdown.deletionSavings },
                { label: "Tier optimization", value: breakdown.tierOptimizationSavings },
                { label: "Net savings", value: breakdown.netSavings },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-body font-body text-subtext-color">{row.label}</span>
                  <span className="text-body-bold font-body-bold text-default-font">
                    {money(costFigure(costData, row.value))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col items-start gap-4">
          <span className="text-heading-3 font-heading-3 text-default-font">
            Top Saving Opportunities
          </span>
          {opportunities.length > 0 ? (
            <Table
              header={
                <Table.HeaderRow>
                  <Table.HeaderCell>Type</Table.HeaderCell>
                  <Table.HeaderCell>Description</Table.HeaderCell>
                  <Table.HeaderCell>Potential Savings</Table.HeaderCell>
                </Table.HeaderRow>
              }
            >
              {opportunities.map((opp, index) => (
                <Table.Row key={index}>
                  <Table.Cell>
                    <Badge variant="brand">{(opp.opportunityType ?? "").replace(/_/g, " ") || "-"}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-default-font">
                      {opp.description}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body-bold font-body-bold text-success-600">
                      {money(costFigure(costData, opp.potentialSavings))}
                    </span>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
          ) : (
            <EmptyState
              title={figuresAvailable ? "No saving opportunities" : NOT_AVAILABLE_YET}
              message={
                figuresAvailable
                  ? "No optimization opportunities have been identified yet."
                  : "Opportunities are sized in dollars, which needs a billing source."
              }
            />
          )}
        </div>
      </div>
    );
  };

  const renderGovernanceScoreReport = () => {
    if (!governanceData) {
      return (
        <EmptyState
          title="No governance score data"
          message="The reporting service returned no governance metrics yet."
        />
      );
    }
    const history = governanceData.historyAvailable === false
      ? []
      : (governanceData.historicalTrend ?? []).filter((point) => isNum(point.score));
    const trendData = history.map((point, index) => ({
      category: point.date ?? `D${index + 1}`,
      "Overall Score": point.score as number,
    }));
    const b = governanceBreakdown(governanceData);
    const overall = isNum(governanceData.overallScore) ? governanceData.overallScore : null;
    const breakdown = [
      { label: "Policy Compliance", value: b.policyComplianceScore },
      { label: "Data Classification", value: b.dataClassificationScore },
      { label: "Metadata Completeness", value: b.metadataCompletenessScore },
      { label: "Lineage Coverage", value: b.lineageCoverageScore },
    ];
    const benchmark = hasBenchmark(governanceData) ? governanceData.benchmark : null;
    const recommendations = governanceData.recommendations ?? [];
    return (
      <div className="flex w-full flex-col gap-6">
        <div className="grid grid-cols-4 gap-4 w-full">
          <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground icon={<FeatherShield />} variant="success" />
              <span className="text-body-bold font-body-bold text-subtext-color">
                Overall Score
              </span>
            </div>
            <span
              className={
                overall !== null
                  ? "text-heading-1 font-heading-1 text-default-font"
                  : "text-heading-3 font-heading-3 text-subtext-color"
              }
            >
              {score(overall)}
            </span>
            <Progress value={overall ?? 0} className="w-full" />
          </div>
          {breakdown.map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6"
            >
              <span className="text-body-bold font-body-bold text-subtext-color">
                {item.label}
              </span>
              <span
                className={
                  isNum(item.value)
                    ? "text-heading-1 font-heading-1 text-default-font"
                    : "text-heading-3 font-heading-3 text-subtext-color"
                }
              >
                {score(item.value)}
              </span>
              <Progress value={isNum(item.value) ? item.value : 0} className="w-full" />
            </div>
          ))}
        </div>

        <div className="flex w-full flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
          <div className="flex w-full items-center gap-2">
            <IconWithBackground icon={<FeatherActivity />} variant="brand" />
            <span className="text-body-bold font-body-bold text-subtext-color">
              Industry Benchmark
            </span>
          </div>
          {benchmark ? (
            <div className="flex w-full flex-wrap items-center gap-6">
              <div className="flex flex-col">
                <span className="text-caption font-caption text-subtext-color">Industry average</span>
                <span className="text-heading-2 font-heading-2 text-default-font">
                  {score(benchmark.industryAverage)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-caption font-caption text-subtext-color">Peer average</span>
                <span className="text-heading-2 font-heading-2 text-default-font">
                  {score(benchmark.peerAverage)}
                </span>
              </div>
              {benchmark.ranking ? <Badge variant="neutral">{benchmark.ranking}</Badge> : null}
              {benchmark.comparisonNote ? (
                <span className="text-caption font-caption text-subtext-color">
                  {benchmark.comparisonNote}
                </span>
              ) : null}
            </div>
          ) : (
            <>
              <span className="text-heading-3 font-heading-3 text-subtext-color">
                {NOT_AVAILABLE_YET}
              </span>
              <span className="text-caption font-caption text-subtext-color">
                No benchmark dataset is connected, so there is nothing to compare your score with.
              </span>
            </>
          )}
        </div>

        <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
          <div className="flex items-center justify-between w-full">
            <span className="text-heading-3 font-heading-3 text-default-font">
              Governance Score Trend
            </span>
            <Badge variant="neutral">Last 30 days</Badge>
          </div>
          {trendData.length > 0 ? (
            <LineChart
              className="h-64 w-full flex-none"
              data={trendData}
              index="category"
              categories={["Overall Score"]}
            />
          ) : (
            <EmptyState
              title={NOT_AVAILABLE_YET}
              message="No score history is stored yet."
            />
          )}
        </div>

        <div className="flex w-full flex-col items-start gap-4">
          <span className="text-heading-3 font-heading-3 text-default-font">
            Recommendations
          </span>
          {recommendations.length > 0 ? (
            <div className="flex w-full flex-col gap-2">
              {recommendations.map((rec, index) => (
                <div
                  key={index}
                  className="flex w-full items-start gap-3 rounded-md border border-solid border-neutral-border bg-default-background px-4 py-3"
                >
                  <IconWithBackground icon={<FeatherActivity />} variant="brand" size="small" />
                  <span className="text-body font-body text-default-font">{rec}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No recommendations"
              message="No governance recommendations are available at this time."
            />
          )}
        </div>
      </div>
    );
  };

  const renderActionItemsReport = () => {
    if (!actionData) {
      return (
        <EmptyState
          title="No action items data"
          message="The reporting service returned no action items yet."
        />
      );
    }
    if (actionItemsFailed(actionData)) {
      return (
        <ErrorState
          message="The reporting service could not reach the policy engine, so action items are unknown."
          onRetry={loadReportData}
        />
      );
    }
    const items = actionItemsOf(actionData);
    const bands = actionItemBandCounts(actionData);
    return (
      <div className="flex w-full flex-col gap-6">
        <div className="grid grid-cols-4 gap-4 w-full">
          <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground icon={<FeatherActivity />} variant="brand" />
              <span className="text-body-bold font-body-bold text-subtext-color">
                Total Items
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              {actionItemTotal(actionData)}
            </span>
          </div>
          <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground icon={<FeatherAlertTriangle />} variant="error" />
              <span className="text-body-bold font-body-bold text-subtext-color">
                High Priority
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              {bands.HIGH}
            </span>
          </div>
          <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground icon={<FeatherZap />} variant="warning" />
              <span className="text-body-bold font-body-bold text-subtext-color">
                Medium Priority
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              {bands.MEDIUM}
            </span>
          </div>
          <div className="flex flex-col items-start gap-2 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground icon={<FeatherDatabase />} variant="success" />
              <span className="text-body-bold font-body-bold text-subtext-color">
                Low Priority
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              {bands.LOW}
            </span>
          </div>
        </div>

        <div className="flex w-full flex-col items-start gap-4">
          <span className="text-heading-3 font-heading-3 text-default-font">
            Action Items
          </span>
          {items.length > 0 ? (
            <Table
              header={
                <Table.HeaderRow>
                  <Table.HeaderCell>Title</Table.HeaderCell>
                  <Table.HeaderCell>Severity</Table.HeaderCell>
                  <Table.HeaderCell>Category</Table.HeaderCell>
                  <Table.HeaderCell>Service</Table.HeaderCell>
                  <Table.HeaderCell>Due Date</Table.HeaderCell>
                </Table.HeaderRow>
              }
            >
              {items.map((item, index) => (
                <Table.Row key={`${item.id ?? "item"}-${index}`}>
                  <Table.Cell>
                    <div className="flex flex-col gap-1">
                      <span className="text-body-bold font-body-bold text-default-font">
                        {item.title || "Untitled action item"}
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        {item.description}
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={getPriorityVariant(priorityBand(item.severity))}>
                      {item.severity || "-"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-subtext-color">
                      {(item.category ?? "").replace(/_/g, " ") || "-"}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="neutral">{item.sourceService || "-"}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-subtext-color">
                      {formatDate(item.dueDate)}
                    </span>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
          ) : (
            <EmptyState
              title="No action items"
              message="There are no outstanding action items across DLAP services."
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start bg-default-background">
        <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border px-12 py-4">
          <span className="grow shrink-0 basis-0 text-heading-2 font-heading-2 text-default-font">
            Reporting Center
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="neutral-tertiary"
              icon={<FeatherDownload />}
              disabled={exportDisabled}
              onClick={handleExportReport}
            >
              Export CSV
            </Button>
          </div>
        </div>

        <div className="flex w-full flex-col items-start gap-8 px-12 py-8">
          <Tabs>
            <Tabs.Item
              active={activeReport === "cost-savings"}
              icon={<FeatherTrendingUp />}
              onClick={() => setActiveReport("cost-savings")}
            >
              Cost Savings
            </Tabs.Item>
            <Tabs.Item
              active={activeReport === "governance-score"}
              icon={<FeatherShield />}
              onClick={() => setActiveReport("governance-score")}
            >
              Governance Score
            </Tabs.Item>
            <Tabs.Item
              active={activeReport === "action-items"}
              icon={<FeatherActivity />}
              onClick={() => setActiveReport("action-items")}
            >
              Action Items
            </Tabs.Item>
          </Tabs>

          {loading ? (
            <div className="flex w-full items-center justify-center py-12">
              <span className="text-body font-body text-subtext-color">
                Loading report data…
              </span>
            </div>
          ) : error ? (
            <ErrorState
              message="Could not load report data from the reporting service."
              onRetry={loadReportData}
            />
          ) : (
            <>
              {activeReport === "cost-savings" && renderCostSavingsReport()}
              {activeReport === "governance-score" && renderGovernanceScoreReport()}
              {activeReport === "action-items" && renderActionItemsReport()}
            </>
          )}
        </div>
      </div>
    </DefaultPageLayout>
  );
}

export default ReportingInsightsHub;
