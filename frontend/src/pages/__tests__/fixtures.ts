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

/**
 * JSON bodies exactly as Jackson serializes the Java DTOs the pages consume.
 * Each fixture names its source class. Field names, nesting and nullability are
 * copied from the Java code, not from the TypeScript types, so these catch a
 * TypeScript type that has drifted from the backend.
 */

/** da-reporting GovernanceScoreDTO with every component computed, no benchmark, no history. */
export const governanceScoreDto = {
  overallScore: 71.4,
  scoredComponents: ['POLICY_COMPLIANCE', 'DATA_CLASSIFICATION', 'METADATA_COMPLETENESS', 'LINEAGE_COVERAGE'],
  breakdown: {
    policyComplianceScore: 88.0,
    activePolicies: 4,
    violationsCount: 3,
    complianceRate: 88.0,
    dataClassificationScore: 64.2,
    classifiedAssets: 90,
    totalAssets: 140,
    classificationRate: 64.2,
    metadataCompletenessScore: 72.0,
    assetsWithMetadata: 100,
    assetsWithBusinessContext: 40,
    metadataCompletionRate: 72.0,
    lineageCoverageScore: 50.0,
    assetsWithLineage: 70,
    totalLineageConnections: 120,
    lineageCoverageRate: 50.0,
  },
  historicalTrend: null,
  historyAvailable: false,
  topIssues: [
    {
      category: 'MISSING_LINEAGE',
      description: '70 assets have no lineage',
      severity: 'MEDIUM',
      affectedAssets: 70,
      actionRequired: 'Capture lineage for high-value datasets',
      assignedTeam: 'DATA_ENGINEERING',
    },
  ],
  benchmark: null,
  benchmarkAvailable: false,
  recommendations: ['Raise classification coverage toward 80%.'],
  lastCalculated: '2026-10-18T10:15:00',
  dataFreshnessMinutes: 5,
  dataAvailable: true,
  lastError: null,
};

/** The same DTO as an older backend returns it: a placeholder benchmark and a daily history. */
export const governanceScoreWithLegacyBenchmarkDto = {
  ...governanceScoreDto,
  historicalTrend: [
    { date: '2026-10-16', score: 70.0, period: 'daily' },
    { date: '2026-10-17', score: 70.9, period: 'daily' },
    { date: '2026-10-18', score: 71.4, period: 'daily' },
  ],
  historyAvailable: null,
  benchmark: {
    industryAverage: 72.5,
    peerAverage: 76.8,
    ranking: 'GOOD',
    percentile: 71,
    comparisonNote: 'Industry and peer averages are placeholder estimates.',
    isEstimate: true,
  },
  benchmarkAvailable: null,
};

/** A governance DTO with a real (non-estimate) benchmark and a stored history. */
export const governanceScoreWithBenchmarkDto = {
  ...governanceScoreWithLegacyBenchmarkDto,
  historyAvailable: true,
  benchmark: {
    industryAverage: 68.0,
    peerAverage: 74.5,
    ranking: 'GOOD',
    percentile: 62,
    comparisonNote: 'Peer cohort of 40 organisations.',
    isEstimate: false,
  },
  benchmarkAvailable: true,
};

/** da-reporting CostSavingsDTO while no billing source is connected (UI-01 contract). */
export const costSavingsUnavailableDto = {
  available: false,
  basis: 'No cloud billing source is connected, so dollar savings are not computed.',
  totalSavings: null,
  monthlySavingsRate: null,
  roiPercentage: null,
  breakdown: {
    archivalSavings: null,
    archivedAssetsCount: 12,
    archivalStorageUsed: null,
    deletionSavings: null,
    deletedAssetsCount: 3,
    storageReclaimed: null,
    tierOptimizationSavings: null,
    optimizedAssetsCount: 140,
    computeSavings: null,
    decommissionedResources: null,
    platformCosts: null,
    netSavings: null,
  },
  providerSavings: null,
  savingsOpportunities: null,
  historicalTrend: null,
  recommendations: ['Connect a cloud billing export to compute dollar savings.'],
  lastCalculated: '2026-10-18T10:15:00',
  dataAccuracy: 'UNAVAILABLE',
  isEstimate: null,
  dataAvailable: true,
  lastError: null,
};

/** da-reporting CostSavingsDTO from a backend that still returns per-asset estimates. */
export const costSavingsEstimatedDto = {
  totalSavings: 9360.0,
  monthlySavingsRate: 780.0,
  roiPercentage: 80.0,
  breakdown: {
    archivalSavings: 2340.0,
    archivedAssetsCount: 12,
    archivalStorageUsed: '-',
    deletionSavings: 780.0,
    deletedAssetsCount: 3,
    storageReclaimed: '-',
    tierOptimizationSavings: 1750.0,
    optimizedAssetsCount: 140,
    computeSavings: 0.0,
    decommissionedResources: 0,
    platformCosts: 5200.0,
    netSavings: 4160.0,
  },
  providerSavings: [
    {
      providerName: 'AWS',
      savings: 1053.0,
      monthlyRate: 351.0,
      primarySavingsSource: 'ARCHIVAL',
      contributionPercentage: 45.0,
    },
  ],
  savingsOpportunities: [
    {
      opportunityType: 'ARCHIVAL_CANDIDATE',
      description: 'Assets not yet archived may qualify for colder tiers.',
      potentialSavings: 24960.0,
      monthlyImpact: 2080.0,
      timeframe: '90_DAYS',
      effortLevel: 'MEDIUM',
      affectedAssets: 128,
      providerName: 'MULTI',
      actionRequired: 'Review archival policies.',
    },
  ],
  historicalTrend: [
    {
      month: '2026-09',
      cumulativeSavings: 7956.0,
      monthlySavings: 702.0,
      platformCosts: 5200.0,
      netSavings: 3536.0,
      assetsProcessed: 140,
    },
    {
      month: '2026-10',
      cumulativeSavings: 9360.0,
      monthlySavings: 780.0,
      platformCosts: 5200.0,
      netSavings: 4160.0,
      assetsProcessed: 140,
    },
  ],
  recommendations: ['Tie savings estimates to real storage invoices.'],
  lastCalculated: '2026-10-18T10:15:00',
  dataAccuracy: 'ESTIMATED_FROM_CATALOG_COUNTS',
  isEstimate: true,
  dataAvailable: true,
  lastError: null,
};

/** da-reporting ActionItemsDTO with two policy-evaluation items. */
export const actionItemsDto = {
  totalActionItems: 2,
  summary: {
    criticalCount: 0,
    highCount: 1,
    mediumCount: 1,
    lowCount: 0,
    overdueCount: 0,
    dueTodayCount: 2,
    dueThisWeekCount: 2,
    assignedCount: 0,
    unassignedCount: 2,
    inProgressCount: 0,
    completedCount: 0,
  },
  actionItems: [
    {
      id: 'eval-101',
      title: 'Policy evaluation: orders_raw',
      description: 'Failure recorded for policy retain-7y',
      category: 'POLICY_EVALUATION',
      severity: 'HIGH',
      status: 'OPEN',
      sourceService: 'da-policyengine',
      sourceEntityType: 'ASSET',
      sourceEntityId: 'orders_raw',
      sourceEntityName: 'orders_raw',
      createdAt: '2026-10-18T09:00:00',
      lastUpdated: '2026-10-18T10:00:00',
      actionRequired: 'Review failing policy evaluation and remediate asset or policy.',
      tags: ['POLICY'],
    },
    {
      id: 'eval-102',
      title: 'Policy evaluation: customers',
      description: 'Failure recorded for policy mask-pii',
      category: 'POLICY_EVALUATION',
      severity: 'MEDIUM',
      status: 'OPEN',
      sourceService: 'da-policyengine',
      sourceEntityType: 'ASSET',
      sourceEntityId: 'customers',
      sourceEntityName: 'customers',
      createdAt: '2026-10-18T09:05:00',
      lastUpdated: '2026-10-18T10:00:00',
      actionRequired: 'Review failing policy evaluation and remediate asset or policy.',
      tags: ['POLICY'],
    },
  ],
  slaMetrics: { averageResolutionTimeHours: 24.0, slaComplianceRate: 85.0, breachedSlaCount: 0, nearBreachCount: 2 },
  businessImpact: { highImpactItems: 1, mediumImpactItems: 1, lowImpactItems: 0, averageImpactScore: 6.5 },
  lastAggregated: '2026-10-18T10:15:00',
  includedServices: ['da-policyengine'],
  dataAvailable: true,
  lastError: null,
};

/** ActionItemsDTO when the policy engine could not be reached: empty list, dataAvailable false. */
export const actionItemsUpstreamDownDto = {
  totalActionItems: 0,
  summary: {},
  actionItems: [],
  slaMetrics: null,
  businessImpact: null,
  lastAggregated: '2026-10-18T10:15:00',
  includedServices: ['da-policyengine'],
  dataAvailable: false,
  lastError: 'policyengine: Connection refused',
};

/** da-policyengine PolicyOutputDTO list. */
export const policiesDto = [
  { id: 'p1', name: 'Retain 7 years', description: 'Keep finance data seven years', status: 'ENABLED' },
  { id: 'p2', name: 'Mask PII', description: 'Mask personal data', status: 'ENABLED' },
  { id: 'p3', name: 'Archive cold data', description: 'Archive after 180 days', status: 'DISABLED' },
];

/** da-admin AggregatedJobStatusDTO. */
export const jobStatusesDto = {
  jobs: [
    {
      jobId: 'j1',
      serviceName: 'da-discovery',
      jobType: 'DISCOVERY_SCAN',
      status: 'COMPLETED_SUCCESS',
      submittedAt: '2026-10-18T08:00:00',
      startedAt: '2026-10-18T08:00:05',
      completedAt: '2026-10-18T08:05:00',
      details: {},
      errorDetails: null,
    },
    {
      jobId: 'j2',
      serviceName: 'da-autolabel',
      jobType: 'AUTOLABEL_TASK',
      status: 'COMPLETED_FAILED',
      submittedAt: '2026-10-18T08:10:00',
      startedAt: '2026-10-18T08:10:05',
      completedAt: '2026-10-18T08:11:00',
      details: {},
      errorDetails: 'model timeout',
    },
  ],
  totalJobs: 2,
  pendingJobs: 0,
  runningJobs: 0,
  completedSuccessJobs: 1,
  completedFailedJobs: 1,
  serviceErrors: [],
};

/** Reporting endpoint paths, relative to the reportingApi base URL. */
export const REPORTING = {
  governance: '/dashboards/cdo/governance-score',
  cost: '/dashboards/cdo/cost-savings',
  actions: '/dashboards/cdo/action-items',
};

/** da-autoarchival ArchivalKpisDTO as the service returns it today: savings and storage are constants. */
export const archivalKpisZeroedDto = {
  activePolicies: 1,
  assetsIdentified: 12,
  assetsArchived: 9,
  estimatedMonthlySavings: 0.0,
  totalSavingsToDate: 0.0,
  storageReclaimed: '0 TB',
  pendingArchival: 3,
  failedArchival: 0,
  averageArchivalTime: 0.0,
  lastPolicyRun: '2 hours ago',
};

/** ArchivalKpisDTO once the service aggregates real savings and storage. */
export const archivalKpisRealDto = {
  ...archivalKpisZeroedDto,
  estimatedMonthlySavings: 1200.0,
  totalSavingsToDate: 8400.0,
  storageReclaimed: '4.2 TB',
  averageArchivalTime: 3.5,
};

/** ArchivalKpisDTO for a fresh install: nothing archived, so zero is a true figure. */
export const archivalKpisEmptyDto = {
  ...archivalKpisZeroedDto,
  assetsIdentified: 0,
  assetsArchived: 0,
  pendingArchival: 0,
};

/** ArchivalKpisDTO with every figure missing. */
export const archivalKpisNullDto = {
  activePolicies: null,
  assetsIdentified: null,
  assetsArchived: null,
  estimatedMonthlySavings: null,
  totalSavingsToDate: null,
  storageReclaimed: null,
  pendingArchival: null,
  failedArchival: null,
  averageArchivalTime: null,
  lastPolicyRun: null,
};

/** RecentActivityDTO list. */
export const archivalActivitiesDto = [
  {
    id: 'act-1',
    event: 'Asset archived',
    assetName: 'orders_2019',
    policy: 'Archive cold data',
    storageSize: '120 GB',
    savingsAmount: 0.0,
    status: 'Success',
    timestamp: '2026-10-17 14:02',
    details: null,
  },
];

/** ArchivalStatusDataDTO list. */
export const archivalStatusDto = [
  { name: 'Archived', value: 9, color: '#16a34a' },
  { name: 'Pending', value: 3, color: '#f59e0b' },
];

/** StorageConsumerDTO list. */
export const archivalConsumersDto = [
  {
    name: 'events_raw',
    currentSize: '2.1 TB',
    lastAccessed: '2025-11-02',
    cost: 48.0,
    recommendation: 'Archive Now',
    priority: 'High',
  },
];
