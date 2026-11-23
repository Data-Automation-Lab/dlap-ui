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

import { adminApi, catalogApi, discoveryApi, labelAgentApi, policyengineApi, reportingApi } from './api';
import type { NavigationHelperName } from '../types/window';

// =============================================================================
// Priority 1 Endpoint API Services
// =============================================================================

// ---------------------- Dashboard Services ----------------------

/**
 * Text shown wherever a figure has no data source yet (no billing feed, no
 * benchmark dataset, no stored history). One wording for every page, so a null
 * from the API never renders as "0", "NaN" or an invented number.
 */
export const NOT_AVAILABLE_YET = 'Not available yet';

/** True for a finite number. Null, undefined, NaN and strings are all "no value". */
export const isNum = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Governance score breakdown. Mirrors da-reporting GovernanceScoreDTO.GovernanceBreakdown.
 * Every field can be null: a component whose source service did not answer is
 * left out by the backend instead of being guessed.
 */
export interface GovernanceBreakdown {
  policyComplianceScore?: number | null;
  activePolicies?: number | null;
  violationsCount?: number | null;
  complianceRate?: number | null;
  dataClassificationScore?: number | null;
  classifiedAssets?: number | null;
  totalAssets?: number | null;
  classificationRate?: number | null;
  metadataCompletenessScore?: number | null;
  assetsWithMetadata?: number | null;
  assetsWithBusinessContext?: number | null;
  metadataCompletionRate?: number | null;
  lineageCoverageScore?: number | null;
  assetsWithLineage?: number | null;
  totalLineageConnections?: number | null;
  lineageCoverageRate?: number | null;
}

/** One point of the governance history. Mirrors GovernanceScoreDTO.GovernanceTrendPoint. */
export interface GovernanceTrendPoint {
  date?: string | null;
  score?: number | null;
  period?: string | null;
}

/** One governance issue. Mirrors GovernanceScoreDTO.GovernanceIssue. */
export interface GovernanceIssue {
  category?: string | null;
  description?: string | null;
  severity?: string | null;
  affectedAssets?: number | null;
  actionRequired?: string | null;
  assignedTeam?: string | null;
}

/** Industry benchmark. Mirrors GovernanceScoreDTO.BenchmarkComparison. */
export interface GovernanceBenchmark {
  industryAverage?: number | null;
  peerAverage?: number | null;
  ranking?: string | null;
  percentile?: number | null;
  comparisonNote?: string | null;
  /** True when the averages are placeholder estimates, not a real dataset. */
  isEstimate?: boolean | null;
}

/**
 * Governance Score Dashboard.
 * GET /api/v1/reporting/dashboards/cdo/governance-score
 *
 * Mirrors da-reporting GovernanceScoreDTO field for field. `overallScore` is
 * null when no component could be computed; `benchmarkAvailable` and
 * `historyAvailable` are false until a benchmark dataset and a stored score
 * history exist (the matching `benchmark` and `historicalTrend` are then null).
 */
export interface GovernanceScoreResponse {
  overallScore?: number | null;
  scoredComponents?: string[] | null;
  breakdown?: GovernanceBreakdown | null;
  historicalTrend?: GovernanceTrendPoint[] | null;
  historyAvailable?: boolean | null;
  topIssues?: GovernanceIssue[] | null;
  benchmark?: GovernanceBenchmark | null;
  benchmarkAvailable?: boolean | null;
  recommendations?: string[] | null;
  lastCalculated?: string | null;
  dataFreshnessMinutes?: number | null;
  /** False when every upstream service failed and this is a best-effort shell. */
  dataAvailable?: boolean | null;
  lastError?: string | null;
}

export const getGovernanceScore = async (): Promise<GovernanceScoreResponse> => {
  const response = await reportingApi.get('/dashboards/cdo/governance-score');
  return response.data ?? {};
};

/**
 * True when the response carries a real benchmark. A benchmark flagged as an
 * estimate is a placeholder, so it counts as not available.
 */
export const hasBenchmark = (g: GovernanceScoreResponse | null | undefined): boolean =>
  !!g && g.benchmarkAvailable !== false && !!g.benchmark && g.benchmark.isEstimate !== true;

/** Breakdown of the governance score, or an empty object so callers can read fields safely. */
export const governanceBreakdown = (
  g: GovernanceScoreResponse | null | undefined
): GovernanceBreakdown => g?.breakdown ?? {};

/** Cost breakdown. Mirrors da-reporting CostSavingsDTO.CostSavingsBreakdown. */
export interface CostSavingsBreakdown {
  archivalSavings?: number | null;
  archivedAssetsCount?: number | null;
  archivalStorageUsed?: string | null;
  deletionSavings?: number | null;
  deletedAssetsCount?: number | null;
  storageReclaimed?: string | null;
  tierOptimizationSavings?: number | null;
  optimizedAssetsCount?: number | null;
  computeSavings?: number | null;
  decommissionedResources?: number | null;
  platformCosts?: number | null;
  netSavings?: number | null;
}

/** Savings by cloud. Mirrors CostSavingsDTO.ProviderSavings. */
export interface CostProviderSavings {
  providerName?: string | null;
  savings?: number | null;
  monthlyRate?: number | null;
  primarySavingsSource?: string | null;
  contributionPercentage?: number | null;
}

/** A savings opportunity. Mirrors CostSavingsDTO.SavingsOpportunity. */
export interface CostSavingsOpportunity {
  opportunityType?: string | null;
  description?: string | null;
  potentialSavings?: number | null;
  monthlyImpact?: number | null;
  timeframe?: string | null;
  effortLevel?: string | null;
  affectedAssets?: number | null;
  providerName?: string | null;
  actionRequired?: string | null;
}

/** One month of savings history. Mirrors CostSavingsDTO.SavingsTrendPoint. */
export interface CostSavingsTrendPoint {
  /** "yyyy-MM". */
  month?: string | null;
  cumulativeSavings?: number | null;
  monthlySavings?: number | null;
  platformCosts?: number | null;
  netSavings?: number | null;
  assetsProcessed?: number | null;
}

/**
 * Cost Savings Dashboard.
 * GET /api/v1/reporting/dashboards/cdo/cost-savings
 *
 * Mirrors da-reporting CostSavingsDTO. Dollar figures exist only when
 * `available` is not false, which needs a real billing source. While it is
 * false every dollar figure is null and must render as NOT_AVAILABLE_YET.
 */
export interface CostSavingsResponse {
  available?: boolean | null;
  basis?: string | null;
  totalSavings?: number | null;
  monthlySavingsRate?: number | null;
  roiPercentage?: number | null;
  breakdown?: CostSavingsBreakdown | null;
  providerSavings?: CostProviderSavings[] | null;
  savingsOpportunities?: CostSavingsOpportunity[] | null;
  historicalTrend?: CostSavingsTrendPoint[] | null;
  recommendations?: string[] | null;
  lastCalculated?: string | null;
  dataAccuracy?: string | null;
  /** True when the figures come from placeholder per-asset estimates. */
  isEstimate?: boolean | null;
  /** False when the catalog could not be reached. */
  dataAvailable?: boolean | null;
  lastError?: string | null;
}

export const getCostSavings = async (): Promise<CostSavingsResponse> => {
  const response = await reportingApi.get('/dashboards/cdo/cost-savings');
  return response.data ?? {};
};

/**
 * True when dollar figures in a cost response can be shown. False while no billing
 * source is connected (`available === false`) or while the catalog is down.
 */
export const hasCostFigures = (c: CostSavingsResponse | null | undefined): boolean =>
  !!c && c.available !== false && c.dataAvailable !== false;

/**
 * A single dollar figure from a cost response, or null when it must render as
 * NOT_AVAILABLE_YET. Never returns a stand-in zero.
 */
export const costFigure = (
  c: CostSavingsResponse | null | undefined,
  value: number | null | undefined
): number | null => (hasCostFigures(c) && isNum(value) ? value : null);

/**
 * One action item. Mirrors da-reporting ActionItemsDTO.ActionItem.
 * `severity` is CRITICAL, HIGH, MEDIUM or LOW; `category` names the kind of
 * work (for example POLICY_EVALUATION or COMPLIANCE_VIOLATION).
 */
export interface ActionItem {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  severity?: string | null;
  status?: string | null;
  sourceService?: string | null;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  sourceEntityName?: string | null;
  assignedTo?: string | null;
  assignedTeam?: string | null;
  createdAt?: string | null;
  dueDate?: string | null;
  lastUpdated?: string | null;
  actionRequired?: string | null;
  businessJustification?: string | null;
  estimatedEffort?: string | null;
  businessImpactScore?: number | null;
  tags?: string[] | null;
  /** Link to a service UI. Only http(s) links are ever opened. */
  detailsUrl?: string | null;
}

/**
 * Action Items Aggregation.
 * GET /api/v1/reporting/dashboards/cdo/action-items
 *
 * Mirrors da-reporting ActionItemsDTO. The list is `actionItems` (not `items`);
 * `dataAvailable` is false when the policy engine could not be reached, which
 * is different from an empty list.
 */
export interface ActionItemsResponse {
  totalActionItems?: number | null;
  summary?: {
    criticalCount?: number | null;
    highCount?: number | null;
    mediumCount?: number | null;
    lowCount?: number | null;
    overdueCount?: number | null;
    dueTodayCount?: number | null;
    dueThisWeekCount?: number | null;
    assignedCount?: number | null;
    unassignedCount?: number | null;
    inProgressCount?: number | null;
    completedCount?: number | null;
  } | null;
  actionItems?: ActionItem[] | null;
  slaMetrics?: Record<string, unknown> | null;
  businessImpact?: Record<string, unknown> | null;
  lastAggregated?: string | null;
  includedServices?: string[] | null;
  dataAvailable?: boolean | null;
  lastError?: string | null;
}

export const getActionItems = async (): Promise<ActionItemsResponse> => {
  const response = await reportingApi.get('/dashboards/cdo/action-items');
  return response.data ?? {};
};

/** The action items of a response, never undefined. */
export const actionItemsOf = (r: ActionItemsResponse | null | undefined): ActionItem[] =>
  r && Array.isArray(r.actionItems) ? r.actionItems : [];

/** True when the aggregation could not reach its source, so an empty list means "unknown". */
export const actionItemsFailed = (r: ActionItemsResponse | null | undefined): boolean =>
  !!r && r.dataAvailable === false;

/** Total number of action items: the backend count, else the list length. */
export const actionItemTotal = (r: ActionItemsResponse | null | undefined): number =>
  r && isNum(r.totalActionItems) ? r.totalActionItems : actionItemsOf(r).length;

/** Priority bands the pages colour by. CRITICAL counts as HIGH. */
export type PriorityBand = 'HIGH' | 'MEDIUM' | 'LOW';

/** Band for an item severity. Unknown or missing severities are LOW. */
export const priorityBand = (severity: string | null | undefined): PriorityBand => {
  switch ((severity ?? '').toUpperCase()) {
    case 'CRITICAL':
    case 'HIGH':
      return 'HIGH';
    case 'MEDIUM':
      return 'MEDIUM';
    default:
      return 'LOW';
  }
};

/** Item counts per priority band, computed from the list the page actually shows. */
export const actionItemBandCounts = (
  r: ActionItemsResponse | null | undefined
): Record<PriorityBand, number> => {
  const counts: Record<PriorityBand, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const item of actionItemsOf(r)) {
    counts[priorityBand(item.severity)] += 1;
  }
  return counts;
};

const POLICY_CATEGORIES = new Set(['POLICY_APPROVAL', 'POLICY_EVALUATION', 'POLICY_BREACH']);
const COMPLIANCE_CATEGORIES = new Set(['COMPLIANCE_VIOLATION', 'POLICY_BREACH', 'POLICY_EVALUATION']);
const CONFIG_CATEGORIES = new Set(['CONFIGURATION_REQUIRED', 'METADATA_MISSING', 'DISCOVERY_FAILED']);

/** True for items that count as compliance alerts on the dashboards. */
export const isComplianceItem = (item: ActionItem): boolean =>
  COMPLIANCE_CATEGORIES.has((item.category ?? '').toUpperCase());

/** True for items about missing business metadata. */
export const isMetadataItem = (item: ActionItem): boolean =>
  (item.category ?? '').toUpperCase() === 'METADATA_MISSING' ||
  (item.description ?? '').toLowerCase().includes('metadata');

/** Window navigation shims an action item can route to. */
export type ActionNavTarget =
  | 'navigateToPolicyHub2'
  | 'navigateToComplianceAgent'
  | 'navigateToAdminControlHub'
  | 'navigateToDataDiscoveryAgentConfig';

/** View that owns an item, from its category and status. Null when no view fits. */
export const actionItemTarget = (item: ActionItem): ActionNavTarget | null => {
  const category = (item.category ?? '').toUpperCase();
  if (POLICY_CATEGORIES.has(category) || (item.status ?? '').toUpperCase() === 'PENDING_APPROVAL') {
    return 'navigateToPolicyHub2';
  }
  if (category === 'COMPLIANCE_VIOLATION') return 'navigateToComplianceAgent';
  if (category === 'SYSTEM_ALERT') return 'navigateToAdminControlHub';
  if (CONFIG_CATEGORIES.has(category)) return 'navigateToDataDiscoveryAgentConfig';
  return null;
};

/** Label for the item's action button. */
export const actionItemButtonText = (item: ActionItem): string => {
  const category = (item.category ?? '').toUpperCase();
  if (POLICY_CATEGORIES.has(category)) return 'Review';
  if (category === 'COMPLIANCE_VIOLATION') return 'Resolve';
  if (category === 'SYSTEM_ALERT') return 'Check';
  if (CONFIG_CATEGORIES.has(category)) return 'Configure';
  return 'View';
};

/** The url when it is an absolute http(s) link, else null. Blocks javascript: and data: links. */
export const safeHttpUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
};

/**
 * Open the view that owns an action item: its http(s) detailsUrl in a new tab if it
 * has one, else the matching in-app view, else `fallback` (a window shim name).
 */
export const openActionItem = (item: ActionItem, fallback?: string): void => {
  const external = safeHttpUrl(item.detailsUrl);
  if (external) {
    window.open(external, '_blank', 'noopener,noreferrer');
    return;
  }
  const target: string | undefined = actionItemTarget(item) ?? fallback;
  if (target) {
    window[target as NavigationHelperName]?.();
  }
};

// ---------------------- Policy Services ----------------------

/**
 * Policy Impact Preview - NEW Priority 1 Endpoint
 * POST /api/v1/policyengine/policies/analyze-impact
 */
export interface PolicyImpactRequest {
  policyRules: string;
  analysisType: 'FULL' | 'QUICK' | 'TARGETED';
  targetScope?: {
    assetIds?: string[];
    labels?: string[];
    assetTypes?: string[];
  };
  includePerformanceEstimates?: boolean;
  includeCostImpact?: boolean;
  includeComplianceAnalysis?: boolean;
}

export interface PolicyImpactResponse {
  totalAssetsAffected: number;
  assetBreakdown: Record<string, number>;
  estimatedImpact: {
    high: number;
    medium: number;
    low: number;
  };
  affectedAssets: Array<{
    assetId: string;
    assetName: string;
    assetType: string;
    impactLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    reason: string;
  }>;
  performanceEstimates?: {
    estimatedExecutionTimeMs: number;
    resourceUtilization: string;
  };
  costImpact?: {
    implementationCost: number;
    ongoingCost: number;
    potentialSavings: number;
  };
  complianceAnalysis?: {
    complianceFrameworks: string[];
    potentialViolations: number;
    recommendations: string[];
  };
  recommendedActions: string[];
}

export const analyzePolicyImpact = async (request: PolicyImpactRequest): Promise<PolicyImpactResponse> => {
  const response = await policyengineApi.post('/policies/analyze-impact', request);
  return response.data;
};

/**
 * Policy Draft Management - NEW Priority 1 Endpoints
 */
// C2b-access-apiServices: AccessPolicy authoring shapes shared by the wizard.
/** Subjects an AccessPolicy grants/denies to - at least one of tiers/roles. */
export interface AccessSubjects {
  tiers: string[];
  roles: string[];
}
/** Optional ABAC-style constraints on an AccessPolicy. */
export interface AccessCondition {
  purpose?: string[];
  consent?: boolean;
  region?: string[];
}
/** A post-decision obligation (mask/redact_rows/log_only) over labelled data. */
export interface AccessObligation {
  type: string; // mask | redact_rows | log_only
  labels: string[];
}

export interface PolicyDraftCreateRequest {
  name: string;
  description: string;
  category: 'LABELING' | 'ARCHIVAL' | 'DELETION' | 'COMPLIANCE';
  // C2b: policy kind. Omitted/'Policy' = lifecycle (default); 'AccessPolicy'
  // routes the draft into the AuthZEN AccessPolicy spec on the backend.
  kind?: 'Policy' | 'AccessPolicy';
  // Legacy flattened rules string. Optional and ignored by the backend -
  // kept only for backward compatibility with older callers.
  rules?: string;
  // ADR-0031: structured match conditions the backend translates into the
  // canonical dlap/v1 DSL on publish. This is what actually makes a policy fire.
  // C2b: REUSED as the AccessPolicy spec.match asset selector (label conditions).
  rulesDefinition?: Array<Record<string, unknown>>;
  // A SINGLE action (v1 = one action per policy).
  actions?: Record<string, unknown>;
  conditionLogic?: string;
  priority?: string;
  targetScope: {
    assetTypes?: string[];
    labels?: string[];
    assetIds?: string[];
  };
  // C2b AccessPolicy fields - all optional, only sent when kind==='AccessPolicy'.
  accessSubjects?: AccessSubjects;
  accessActions?: string[]; // subset of read|query|export|write|delete
  accessCondition?: AccessCondition;
  accessEffect?: 'allow' | 'deny';
  accessObligations?: AccessObligation[];
}

export interface PolicyDraftResponse {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';
  rules: string;
  targetScope: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  comments?: string;
  version: number;
  // C2b: present only on AccessPolicy drafts; carried through for the detail view.
  kind?: 'Policy' | 'AccessPolicy';
  accessSubjects?: AccessSubjects;
  accessActions?: string[];
  accessCondition?: AccessCondition;
  accessEffect?: 'allow' | 'deny';
  accessObligations?: AccessObligation[];
}

export const createPolicyDraft = async (request: PolicyDraftCreateRequest): Promise<PolicyDraftResponse> => {
  const response = await policyengineApi.post('/drafts', request);
  return response.data;
};

export const getPolicyDrafts = async (): Promise<PolicyDraftResponse[]> => {
  const response = await policyengineApi.get('/drafts');
  return response.data;
};

// The draft-workflow endpoints bind PolicyDraftActionDTO, whose `actionType`
// is @NotBlank - omitting it 400s ("Action type is required"). Send the
// transition verb explicitly so submit → approve → publish succeed.
export const submitPolicyDraft = async (draftId: string, comment?: string): Promise<PolicyDraftResponse> => {
  const response = await policyengineApi.post(`/drafts/${draftId}/submit`, { actionType: 'SUBMIT', comment });
  return response.data;
};

export const approvePolicyDraft = async (draftId: string, comment?: string): Promise<PolicyDraftResponse> => {
  const response = await policyengineApi.post(`/drafts/${draftId}/approve`, { actionType: 'APPROVE', comment });
  return response.data;
};

export const publishPolicyDraft = async (draftId: string, comment?: string): Promise<unknown> => {
  const response = await policyengineApi.post(`/drafts/${draftId}/publish`, { actionType: 'PUBLISH', comment });
  return response.data;
};

// ---------------------- Catalog Services ----------------------

/**
 * Asset Usage Analytics.
 * GET /api/v1/catalog/assets/{assetId}/usage
 *
 * Mirrors da-catalog AssetUsageAnalyticsDTO. Every value comes from usage the
 * catalog stored for the asset. A field with no stored source is null (or the
 * whole section is missing), and must render as "not available", never as 0.
 * `available` is false when the catalog holds no usage signal for the asset.
 */
export interface AssetUsageAnalyticsResponse {
  available?: boolean | null;
  basis?: string | null;
  usageMetrics?: {
    totalAccesses?: number | null;
    uniqueUsers?: number | null;
    avgAccessesPerDay?: number | null;
    lastAccessed?: string | null;
    peakUsageHour?: number | null;
    /** INCREASING, DECREASING or STABLE. */
    usageTrend?: string | null;
  } | null;
  userAnalytics?: {
    topUsers?: Array<{
      userId?: string | null;
      username?: string | null;
      accessCount?: number | null;
      lastAccess?: string | null;
      accessPattern?: string | null;
    }> | null;
    departmentBreakdown?: Record<string, number> | null;
  } | null;
  accessPatterns?: {
    hourlyDistribution?: number[] | null;
    weeklyDistribution?: number[] | null;
    monthlyTrend?: Array<{
      month?: string | null;
      totalAccesses?: number | null;
      uniqueUsers?: number | null;
    }> | null;
  } | null;
  performanceMetrics?: {
    avgQueryTime?: string | null;
    slowestQuery?: string | null;
    fastestQuery?: string | null;
    timeoutRate?: number | null;
    errorRate?: number | null;
  } | null;
  popularQueries?: Array<{
    queryPattern?: string | null;
    frequency?: number | null;
    avgExecutionTime?: string | null;
  }> | null;
  recommendations?: Array<{
    type?: string | null;
    priority?: string | null;
    description?: string | null;
    potentialImpact?: string | null;
  }> | null;
}

export const getAssetUsageAnalytics = async (assetId: string): Promise<AssetUsageAnalyticsResponse> => {
  const response = await catalogApi.get(`/assets/${assetId}/usage`);
  return response.data ?? {};
};

/**
 * Business Metadata Management.
 * PUT /api/v1/catalog/assets/{assetId}/business-context
 *
 * @deprecated Do not call. These types do not match da-catalog
 * BusinessMetadataInputDTO ({ businessMetadata, complianceClassification }), and the
 * endpoint REPLACES the stored business metadata with whatever the body converts to.
 * A body in this shape stores an empty object and wipes the asset's metadata.
 * AssetDetailView saves through PUT /assets/{id}/metadata/business with a merged
 * document instead. A merging endpoint is planned in CAT-02.
 */
export interface BusinessMetadataRequest {
  businessOwner: {
    name: string;
    email: string;
    department: string;
  };
  dataStewart: {
    name: string;
    email: string;
    department: string;
  };
  businessPurpose: string;
  dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  complianceClassification: {
    containsPii: boolean;
    containsPhi: boolean;
    gdprApplicable: boolean;
    soxRelevant: boolean;
  };
  retentionRequirements: {
    legalRetentionYears?: number;
    businessRetentionYears?: number;
    retentionReason: string;
  };
  businessGlossaryTerms: string[];
  customProperties: Record<string, string>;
}

export interface BusinessMetadataResponse {
  assetId: string;
  businessContext: BusinessMetadataRequest;
  lastUpdated: string;
  updatedBy: string;
  validationStatus: 'VALID' | 'INCOMPLETE' | 'NEEDS_REVIEW';
  auditTrail: Array<{
    field: string;
    oldValue: string;
    newValue: string;
    updatedBy: string;
    updatedAt: string;
  }>;
}

export const updateBusinessMetadata = async (assetId: string, metadata: BusinessMetadataRequest): Promise<BusinessMetadataResponse> => {
  const response = await catalogApi.put(`/assets/${assetId}/business-context`, metadata);
  return response.data;
};

export const getBusinessMetadata = async (assetId: string): Promise<BusinessMetadataResponse> => {
  const response = await catalogApi.get(`/assets/${assetId}/business-metadata`);
  return response.data;
};

// =============================================================================
// Priority 2 Endpoint API Services  
// =============================================================================

/**
 * Enhanced Lineage Visualization - NEW Priority 2 Endpoint
 * GET /api/v1/catalog/assets/{assetId}/lineage/enhanced
 */
export interface LineageNode {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  assetType?: string;
  status?: string;
  layer?: number;
  // Flattened asset + log-harvested context (owner/team/region/provider/uri).
  metadata?: Record<string, unknown>;
}

export interface LineageEdge {
  edgeId?: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType?: string;
  transformationLogic?: Record<string, unknown>;
  createdAt?: string;
}

export interface EnhancedLineageResponse {
  assetId: string;
  assetName?: string;
  lineageVersion?: string;
  maxDepth?: number;
  lineageGraph: {
    nodes: LineageNode[];
    edges: LineageEdge[];
    totalNodes?: number;
    totalEdges?: number;
    maxDepth?: number;
  };
  statistics: {
    totalUpstreamAssets: number;
    totalDownstreamAssets: number;
    totalTransformations?: number;
    directDependencies?: number;
    indirectDependencies?: number;
    lineageHealth?: string;
    assetTypeBreakdown?: Record<string, number>;
  };
}

export const getEnhancedLineage = async (assetId: string): Promise<EnhancedLineageResponse> => {
  const response = await catalogApi.get(`/assets/${assetId}/lineage/enhanced`);
  return response.data;
};

/**
 * Asset-Policy Mapping.
 * GET /api/v1/catalog/assets/{assetId}/policies
 *
 * Mirrors da-catalog AssetPolicyMappingDTO. The catalog does not store per-asset
 * policy evaluations (the policy engine owns them), so until a mapping source is
 * wired `available` is false and every other field is null or missing.
 * Consumers treat an absent field as "not available".
 */
export interface AssetPolicyMappingResponse {
  assetId?: string | null;
  assetName?: string | null;
  available?: boolean | null;
  basis?: string | null;
  applicablePolicies?: AssetPolicyMapping[] | null;
  inheritedPolicies?: AssetPolicyMapping[] | null;
  complianceSummary?: {
    totalPolicies?: number | null;
    compliantPolicies?: number | null;
    nonCompliantPolicies?: number | null;
    partiallyCompliantPolicies?: number | null;
    overallComplianceScore?: number | null;
    overallStatus?: string | null;
    criticalIssues?: string[] | null;
    lastFullEvaluation?: string | null;
  } | null;
  /** A list of risks (not a single object). */
  riskAssessment?: Array<{
    riskType?: string | null;
    riskLevel?: string | null;
    description?: string | null;
    impact?: string | null;
    likelihood?: string | null;
    mitigationActions?: string[] | null;
  }> | null;
  recommendations?: Array<{
    recommendationType?: string | null;
    priority?: string | null;
    title?: string | null;
    description?: string | null;
    actionRequired?: string | null;
  }> | null;
  lastEvaluated?: string | null;
  evaluationStatus?: string | null;
}

/** One policy that applies to an asset. Mirrors AssetPolicyMappingDTO.PolicyMappingDTO. */
export interface AssetPolicyMapping {
  policyId?: string | null;
  policyName?: string | null;
  /** DATA_GOVERNANCE, SECURITY, COMPLIANCE, RETENTION and so on. */
  policyType?: string | null;
  policyVersion?: string | null;
  /** DIRECT, INHERITED, LABEL_BASED or TYPE_BASED. */
  applicabilityReason?: string | null;
  /** COMPLIANT, NON_COMPLIANT, PARTIALLY_COMPLIANT or UNKNOWN. */
  complianceStatus?: string | null;
  complianceScore?: number | null;
  lastEvaluated?: string | null;
  evaluatedBy?: string | null;
}

export const getAssetPolicyMapping = async (assetId: string): Promise<AssetPolicyMappingResponse> => {
  const response = await catalogApi.get(`/assets/${assetId}/policies`);
  return response.data ?? {};
};

/**
 * Faceted Search Filters - NEW Priority 2 Endpoint
 * GET /api/v1/catalog/filters
 */
export interface CatalogFiltersResponse {
  filterCategories: Array<{
    name: string;
    displayName: string;
    filterType: 'CHECKBOX' | 'RADIO' | 'RANGE' | 'TEXT';
    options: Array<{
      value: string;
      label: string;
      count: number;
    }>;
  }>;
  searchSuggestions: {
    recentSearches: string[];
    popularSearches: string[];
    suggestedTerms: string[];
  };
  quickFilters: Array<{
    name: string;
    label: string;
    filter: Record<string, unknown>;
    count: number;
  }>;
  sortOptions: Array<{
    field: string;
    label: string;
    direction: 'ASC' | 'DESC';
  }>;
}

export const getCatalogFilters = async (): Promise<CatalogFiltersResponse> => {
  const response = await catalogApi.get('/filters');
  return response.data;
};

/**
 * Asset Compliance Status.
 * GET /api/v1/catalog/assets/{assetId}/compliance
 *
 * Mirrors da-catalog AssetComplianceStatusDTO. The catalog does not store
 * compliance evaluations (da-autocompliance owns them), so until an evaluation
 * source is wired `available` is false, `overallComplianceStatus` is UNKNOWN and
 * every other field is null or missing. An absent field means "not available",
 * never "compliant".
 */
export interface AssetComplianceStatusResponse {
  assetId?: string | null;
  assetName?: string | null;
  available?: boolean | null;
  basis?: string | null;
  /** COMPLIANT, NON_COMPLIANT, PARTIALLY_COMPLIANT, UNKNOWN or MONITORING. */
  overallComplianceStatus?: string | null;
  overallComplianceScore?: number | null;
  frameworkCompliance?: Array<{
    /** GDPR, SOX, HIPAA, PCI_DSS, ISO_27001 and so on. */
    frameworkName?: string | null;
    frameworkVersion?: string | null;
    complianceStatus?: string | null;
    complianceScore?: number | null;
  }> | null;
  violations?: Array<{
    violationId?: string | null;
    violationType?: string | null;
    severity?: string | null;
    description?: string | null;
    framework?: string | null;
    controlId?: string | null;
    detectedAt?: string | null;
    /** OPEN, IN_PROGRESS, RESOLVED or ACCEPTED_RISK. */
    status?: string | null;
  }> | null;
  controls?: Array<{
    controlId?: string | null;
    controlName?: string | null;
    status?: string | null;
    lastTested?: string | null;
  }> | null;
  riskAssessment?: {
    overallRiskLevel?: string | null;
    riskScore?: number | null;
    riskFactors?: string[] | null;
  } | null;
  lastEvaluated?: string | null;
  evaluatedBy?: string | null;
  nextEvaluation?: string | null;
}

export const getAssetComplianceStatus = async (assetId: string): Promise<AssetComplianceStatusResponse> => {
  const response = await catalogApi.get(`/assets/${assetId}/compliance`);
  return response.data ?? {};
};

// =============================================================================
// Existing Endpoint API Services
// =============================================================================

/**
 * Job Status Aggregation - Existing Endpoint
 * GET /api/v1/admin/job-statuses
 */
export interface IJobStatusResponse {
  services: Array<{
    serviceName: string;
    status: 'HEALTHY' | 'WARNING' | 'ERROR';
    lastJobStatus: 'SUCCESS' | 'FAILED' | 'RUNNING' | 'PENDING' | 'UNKNOWN';
    lastJobTime: string;
    jobCount: {
      success: number;
      failed: number;
      running: number;
    };
  }>;
  overall: {
    healthyServices: number;
    totalServices: number;
    activeJobs: number;
    failedJobs: number;
  };
}

/** One job of da-admin's AggregatedJobStatusDTO. Every field may be absent. */
interface RawJobStatus {
  serviceName?: string;
  status?: string;
  completedAt?: string;
  startedAt?: string;
  submittedAt?: string;
}

/**
 * AggregatedJobStatusDTO as the endpoint returns it, or the already normalized {services} view.
 * A service error is a plain service name or an object carrying it, depending on the DTO version.
 */
interface RawJobStatuses {
  jobs?: RawJobStatus[];
  services?: ServiceJobSummary[];
  serviceErrors?: Array<string | { serviceName?: string; service?: string }>;
  runningJobs?: number;
  pendingJobs?: number;
  completedFailedJobs?: number;
}

export const getJobStatuses = async (): Promise<IJobStatusResponse> => {
  try {
    // The real da-admin endpoint returns AggregatedJobStatusDTO:
    //   { jobs[], totalJobs, pendingJobs, runningJobs,
    //     completedSuccessJobs, completedFailedJobs, serviceErrors[] }
    // Normalize it here into the per-service {services, overall} view the
    // frontend consumes, so no page has to know the raw backend shape.
    const response = await adminApi.get('/job-statuses');
    const raw: RawJobStatuses = response.data ?? {};

    const services = deriveServiceSummaries(raw);

    // Services the aggregator could not reach are down - surface them as ERROR
    // entries rather than silently dropping them. Entries may be plain strings
    // or {serviceName, error} objects depending on the DTO version.
    const serviceErrors = Array.isArray(raw.serviceErrors) ? raw.serviceErrors : [];
    for (const err of serviceErrors) {
      const name =
        typeof err === 'string' ? err : err?.serviceName ?? err?.service ?? 'unknown';
      if (!services.some((s) => s.serviceName.toLowerCase() === String(name).toLowerCase())) {
        services.push({
          serviceName: String(name),
          status: 'ERROR',
          lastJobStatus: 'UNKNOWN',
          lastJobTime: '',
          jobCount: { success: 0, failed: 0, running: 0 },
        });
      }
    }

    return {
      services,
      overall: {
        healthyServices: services.filter((s) => s.status === 'HEALTHY').length,
        totalServices: services.length,
        activeJobs: (raw.runningJobs ?? 0) + (raw.pendingJobs ?? 0),
        failedJobs: raw.completedFailedJobs ?? 0,
      },
    };
  } catch (error) {
    console.error('Error fetching job statuses:', error);
    throw error;
  }
};

/**
 * Discovery Statistics - Existing Endpoint
 * GET /api/v1/discovery/statistics
 */
export interface IDiscoveryStatsResponse {
  totalDataVolume: string;
  averageScanTime: number;
  lastScanTime: string;
  totalAssets: number;
  assetsDiscoveredToday: number;
  assetsDiscoveredThisWeek: number;
  assetsDiscoveredThisMonth: number;
  connectionHealth: Array<{
    connectionId: string;
    connectionName: string;
    status: 'HEALTHY' | 'WARNING' | 'ERROR';
    lastScan: string;
    assetsFound: number;
  }>;
  discoveryTrends: {
    last30Days: number[];
    labels: string[];
  };
}

export const getDiscoveryStats = async (): Promise<IDiscoveryStatsResponse> => {
  try {
    const response = await discoveryApi.get('/statistics');
    return response.data;
  } catch (error) {
    console.error('Error fetching discovery stats:', error);
    throw error;
  }
};

// Missing interface definitions for discovery services
export interface IDiscoveryActivity {
  id: string;
  event: string;
  source: string;
  assetsNew: number;
  assetsUpdated: number;
  status: 'Success' | 'Partial' | 'Failed';
  timestamp: string;
  duration?: string;
  details?: string;
}

export interface IDiscoveryTrend {
  date: string;
  totalAssets: number;
  newAssets: number;
  updatedAssets: number;
  dataVolume: number;
}

export interface IDataSource {
  id?: string;               // cloud-connection id (present when the backend supplies it)
  name: string;
  // 'Not configured' added: da-discovery now returns it for unconfigured providers.
  status: 'Connected' | 'Warning' | 'Error' | 'Not configured';
  assetsCount: number;
  lastScan: string;
}

export const getDiscoveryActivities = async (): Promise<IDiscoveryActivity[]> => {
  try {
    const response = await discoveryApi.get('/activities');
    return response.data;
  } catch (error) {
    console.error('Error fetching discovery activities:', error);
    throw error;
  }
};

export const getDiscoveryTrends = async (): Promise<IDiscoveryTrend[]> => {
  try {
    const response = await discoveryApi.get('/trends');
    return response.data;
  } catch (error) {
    console.error('Error fetching discovery trends:', error);
    throw error;
  }
};

export const getDataSources = async (): Promise<IDataSource[]> => {
  try {
    const response = await discoveryApi.get('/data-sources');
    return response.data;
  } catch (error) {
    console.error('Error fetching data sources:', error);
    throw error;
  }
};

/**
 * Paginated list of catalog assets. P0-N replacement for the
 * leftover Unity-Catalog endpoint in DataCatalog.tsx that pointed at
 * http://localhost:8080/api/2.1/unity-catalog/volumes - wrong system
 * entirely. Hits da-catalog's own paginated /assets endpoint via the
 * shared catalogApi axios instance (Keycloak JWT propagated).
 */
export interface CatalogAssetPage {
  content: CatalogAssetRow[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface CatalogAssetRow {
  assetId: string;
  assetName: string;
  assetUri: string;
  cloudProvider: string;
  serviceType?: string;
  assetType?: string;
  region?: string;
  description?: string;
  status?: string;
  ownerInfo?: string;
  discoveredAt?: string;
  lastScannedAt?: string;
  businessMetadataJson?: Record<string, unknown>;
  technicalMetadata?: Record<string, unknown>;
  detailsJson?: Record<string, unknown>;
  labels?: string[];
}

/**
 * Minimal policy CRUD client for the P0-J Policy DSL editor. Backed by
 * the existing endpoints on da-policyengine's PolicyController:
 *   GET    /api/v1/policyengine/policies
 *   GET    /api/v1/policyengine/policies/{id}
 *   POST   /api/v1/policyengine/policies
 *   PUT    /api/v1/policyengine/policies/{id}
 *   DELETE /api/v1/policyengine/policies/{id}
 * The DSL YAML body lives in the `description` field per the temporary
 * storage convention in da-policyengine/dsl/LifecyclePolicyConsumer.
 */
export interface PolicyRecord {
  id: string;
  name: string;
  description: string;
  // The backend PolicyStatus enum only has ENABLED and DISABLED. A "draft"
  // is a separate PolicyDraft entity (see PolicyDraftResponse), NOT a policy
  // status - sending 'DRAFT' to create/update fails Jackson binding (HTTP 500).
  status: 'ENABLED' | 'DISABLED';
  // ADR-0031: raw dlap/v1 YAML document (PolicyOutputDTO.policyDocument).
  // Present on GET /policies/{id}; may be absent on legacy records.
  policyDocument?: string;
  // PolicyOutputDTO also carries these; the list view shows them when present.
  updatedAt?: string;
  ruleCount?: number;
}

export const listPolicies = async (): Promise<PolicyRecord[]> => {
  const response = await policyengineApi.get('/policies', {
    params: { size: 200, sort: 'name' },
  });
  const data = response.data;
  // Spring Page or List shape - handle both.
  if (Array.isArray(data)) return data;
  if (data?.content && Array.isArray(data.content)) return data.content;
  return [];
};

export const getPolicy = async (id: string): Promise<PolicyRecord> => {
  const response = await policyengineApi.get(`/policies/${id}`);
  return response.data;
};

export const createPolicy = async (policy: Omit<PolicyRecord, 'id'>): Promise<PolicyRecord> => {
  const response = await policyengineApi.post('/policies', policy);
  return response.data;
};

export const updatePolicy = async (id: string, policy: Partial<PolicyRecord>): Promise<PolicyRecord> => {
  const response = await policyengineApi.put(`/policies/${id}`, policy);
  return response.data;
};

export const deletePolicy = async (id: string): Promise<void> => {
  await policyengineApi.delete(`/policies/${id}`);
};

/**
 * ADR-0031: toggle a published policy's status via the dedicated endpoint
 * PATCH /api/v1/policyengine/policies/{id}/status?status=ENABLED|DISABLED.
 * Returns the updated policy. The backend returns 400 if enabling a policy
 * whose DSL document is invalid; callers should surface response.data.message.
 */
export const setPolicyStatus = async (
  id: string,
  status: 'ENABLED' | 'DISABLED'
): Promise<PolicyRecord> => {
  const r = await policyengineApi.patch(`/policies/${id}/status`, null, {
    params: { status },
  });
  return r.data;
};

export const getAllCatalogAssets = async (
  page: number = 0,
  size: number = 50,
  filters?: { cloudProvider?: string; assetType?: string }
): Promise<CatalogAssetPage> => {
  const params: Record<string, string | number> = { page, size };
  if (filters?.cloudProvider) params.cloudProvider = filters.cloudProvider;
  if (filters?.assetType) params.assetType = filters.assetType;
  const response = await catalogApi.get('/assets', { params });
  return response.data;
};

/**
 * Trigger a discovery scan. M8 gap-fix: previously a 2-second
 * setTimeout placeholder in DiscoveryAgentOverview.tsx - nothing
 * actually crawled. POST /api/v1/discovery/scans accepts a
 * DiscoveryScanRequest { cloudConnectionId, scanType, ... } and
 * returns 202 Accepted with the new job id.
 */
export interface TriggerScanRequest {
  cloudConnectionId: string;
  scanType?: 'FULL' | 'INCREMENTAL';
  scanName?: string;
  scope?: Record<string, unknown>;
  configuration?: Record<string, unknown>;
}

export interface TriggerScanResponse {
  jobId: string;
  status?: string;
}

export const triggerDiscoveryScan = async (
  request: TriggerScanRequest
): Promise<TriggerScanResponse> => {
  const payload = {
    scanType: 'FULL',
    ...request
  };
  const response = await discoveryApi.post('/scans', payload);
  return response.data;
};

// =============================================================================
// DIRECTOR DASHBOARD SPECIFIC ENDPOINTS
// =============================================================================

export interface DirectorDashboardKpis {
  teamId?: string;
  activePolicies: number;
  /** Null: no service reports datasets discovered in the last 7 days. */
  recentDatasets: number | null;
  missingMetadata: number;
  qualityIssues: number;
  /** Policy-compliance score, or null when it could not be computed. */
  policyConfigStatus: number | null;
  connectionHealth: number;
  activePoliciesGrowth: string;
  qualityIssuesLevel: 'critical' | 'warning' | 'low';
}

export interface TeamPolicyOverview {
  id: string;
  name: string;
  /** Null: a policy record carries no category. */
  type: 'LABELING' | 'ARCHIVAL' | 'DELETION' | 'COMPLIANCE' | null;
  status: 'ACTIVE' | 'PENDING' | 'DRAFT' | 'ERROR';
  /** Null: the policy engine does not report per-team reach. */
  teamsAffected: number | null;
  lastUpdated: string;
  /** Null: the policy engine does not score impact. */
  impactLevel: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  teamSpecificData?: {
    affectedAssets: number;
    compliance: number;
  };
}

export interface ConnectionHealthStatus {
  connectionId: string;
  connectionName: string;
  // 'OTHER' added: da-admin CloudProviderType emits AWS|AZURE|GCP|OTHER (no OCI).
  type: 'GCP' | 'AWS' | 'AZURE' | 'OCI' | 'OTHER';
  status: 'HEALTHY' | 'WARNING' | 'ERROR';
  uptime: string;
  lastCheck: string;
  actionRequired: boolean;
  metrics: {
    assetsScanned: number;
    errorRate: number;
    avgResponseTime: number;
  };
}

export const getDirectorDashboardKpis = async (teamId?: string): Promise<DirectorDashboardKpis> => {
  // Composed from real endpoints: reporting governance-score, admin
  // job-statuses (normalized), reporting action-items, and policyengine
  // policies. Fields with no backing value are 0/'' + TODO or null; never fabricated.
  const governanceData = await getGovernanceScore();
  const jobStatuses = await getJobStatuses();
  const actionItems = await getActionItems();
  const policies = await listPolicies();

  const summaries = deriveServiceSummaries(jobStatuses);
  const healthyServices = summaries.filter((s) => s.status === 'HEALTHY').length;
  const connectionHealth =
    summaries.length > 0
      ? Math.round((healthyServices / summaries.length) * 100)
      : 0;

  const activePolicies = policies.filter((p) => p.status === 'ENABLED').length;
  const items = actionItemsOf(actionItems);
  const bands = actionItemBandCounts(actionItems);
  const policyScore = governanceData.breakdown?.policyComplianceScore;

  return {
    teamId,
    activePolicies,
    // TODO(no-backend): no "recent datasets" metric exists on catalog/reporting.
    recentDatasets: null,
    missingMetadata: items.filter(isMetadataItem).length,
    qualityIssues: items.filter(
      (item) => isComplianceItem(item) && priorityBand(item.severity) === 'HIGH'
    ).length,
    // Null when the policy-compliance component could not be computed.
    policyConfigStatus: isNum(policyScore) ? Math.round(policyScore) : null,
    connectionHealth,
    // TODO(no-backend): no historical policy-count series to compute growth.
    activePoliciesGrowth: '',
    qualityIssuesLevel:
      bands.HIGH > 5
        ? 'critical'
        : bands.HIGH > 2
          ? 'warning'
          : 'low',
  };
};

export const getTeamPolicyOverview = async (_teamId?: string): Promise<TeamPolicyOverview[]> => {
  // Mapped from the real policyengine policy list (listPolicies). PolicyRecord
  // only carries id/name/description/status, so category (`type`),
  // teamsAffected, lastUpdated, impactLevel and teamSpecificData have no
  // backing value, so they are null (shown as "-") rather than a default that
  // reads as data.
  try {
    const policies = await listPolicies();
    return policies.map((p) => ({
      id: p.id,
      // TODO(no-backend): PolicyRecord has no category.
      type: null,
      name: p.name,
      // Published policies are only ENABLED or DISABLED (no DRAFT status -
      // drafts are a separate entity). ENABLED->ACTIVE, DISABLED->PENDING.
      status: p.status === 'ENABLED' ? 'ACTIVE' : 'PENDING',
      // TODO(no-backend): no per-team affected count on policyengine.
      teamsAffected: null,
      // TODO(no-backend): policy list carries no updated-at timestamp.
      lastUpdated: '',
      // TODO(no-backend): no impact scoring exposed by policyengine.
      impactLevel: null,
    }));
  } catch (error) {
    console.error('Team Policy Overview Error:', error);
    return [];
  }
};

/**
 * Cloud connection health.
 * Primary source: real da-admin GET /api/v1/admin/cloud-connections
 * (List<CloudConnectionDTO>). That DTO exposes id/name/providerType/enabled/
 * lastConnectionTestAt/lastConnectionTestStatus only - it has no asset counts,
 * error rate, uptime or response time, so those metrics are 0/'' + TODO.
 * If the connections endpoint is unavailable we fall back to deriving coarse
 * status from the normalized job-statuses. On total failure return [].
 */
/** The fields of da-admin's CloudConnectionDTO that the health view reads; any may be absent. */
interface CloudConnectionRow {
  id?: string;
  name?: string;
  providerType?: string;
  lastConnectionTestStatus?: string;
  lastConnectionTestAt?: string;
}

export const getConnectionHealthStatus = async (): Promise<ConnectionHealthStatus[]> => {
  try {
    const response = await adminApi.get('/cloud-connections');
    const rows: CloudConnectionRow[] = Array.isArray(response.data) ? response.data : [];
    return rows.map((c, index) => {
      const testStatus: string = (c.lastConnectionTestStatus ?? '').toString().toUpperCase();
      const status: ConnectionHealthStatus['status'] =
        testStatus === 'SUCCESS'
          ? 'HEALTHY'
          : testStatus === 'FAILED'
            ? 'ERROR'
            : 'WARNING';
      return {
        connectionId: c.id ?? `conn-${index + 1}`,
        connectionName: c.name ?? '',
        type: mapProviderType(c.providerType),
        status,
        // TODO(no-backend): CloudConnectionDTO exposes no uptime metric.
        uptime: '',
        lastCheck: c.lastConnectionTestAt ?? '',
        actionRequired: status === 'ERROR',
        metrics: {
          // TODO(no-backend): connection DTO carries no assets-scanned count.
          assetsScanned: 0,
          // TODO(no-backend): connection DTO carries no error-rate metric.
          errorRate: 0,
          // TODO(no-backend): connection DTO carries no response-time metric.
          avgResponseTime: 0,
        },
      };
    });
  } catch (error) {
    console.error('Connection Health Status Error (cloud-connections); deriving from job-statuses:', error);
    // Fallback: coarse health per lifecycle service from the real job-statuses.
    try {
      const jobStatuses = await getJobStatuses();
      const summaries = deriveServiceSummaries(jobStatuses);
      return summaries.map((service, index) => ({
        connectionId: `conn-${index + 1}`,
        connectionName: service.serviceName,
        // TODO(no-backend): job-statuses carries no cloud provider; default OTHER.
        type: 'OTHER',
        status: service.status,
        // TODO(no-backend): job-statuses carries no uptime metric.
        uptime: '',
        lastCheck: service.lastJobTime,
        actionRequired: service.status === 'ERROR',
        metrics: {
          // TODO(no-backend): job-statuses carries no assets-scanned count.
          assetsScanned: 0,
          errorRate:
            (service.jobCount.failed /
              Math.max(1, service.jobCount.success + service.jobCount.failed)) *
            100,
          // TODO(no-backend): job-statuses carries no response-time metric.
          avgResponseTime: 0,
        },
      }));
    } catch (fallbackError) {
      console.error('Connection Health Status fallback Error:', fallbackError);
      return [];
    }
  }
};

/**
 * Map da-admin CloudProviderType (AWS|AZURE|GCP|OTHER) onto the frontend
 * ConnectionHealthStatus.type union. The union additionally allows 'OCI', but
 * the backend never emits it; anything non-canonical (incl. OTHER) is surfaced
 * as 'OTHER'.
 */
const mapProviderType = (providerType: unknown): ConnectionHealthStatus['type'] => {
  const p = String(providerType ?? '').toUpperCase();
  if (p === 'GCP' || p === 'AWS' || p === 'AZURE' || p === 'OCI') {
    return p as ConnectionHealthStatus['type'];
  }
  return 'OTHER';
};

// =============================================================================
// DATA ENGINEER DASHBOARD SPECIFIC ENDPOINTS
// =============================================================================

export interface DataEngineerKpis {
  userId?: string;
  newRelevantDatasets: number;
  recentlyLabeled: number;
  flaggedForArchival: number;
  newRelevantDatasetsGrowth: string;
  recentlyLabeledPeriod: string;
  archivalImpactLevel: 'high' | 'medium' | 'low';
  personalTasks: number;
  watchedAssets: number;
}

export interface WatchedDataset {
  id: string;
  name: string;
  description: string;
  labels: string[];
  lastAccessed: string;
  lineageStatus: 'VALIDATED' | 'NEEDS_REVIEW' | 'MISSING' | 'PROCESSING';
  dataType: 'STRUCTURED' | 'SEMI_STRUCTURED' | 'UNSTRUCTURED';
  size: string;
  usage: 'high' | 'medium' | 'low';
  isWatched?: boolean;
}

export interface DataTask {
  id: string;
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  dueDate: string;
  type: 'quality' | 'lineage' | 'pipeline' | 'governance';
  assignee?: string;
  progress: number;
  assetId?: string;
}

export interface PolicyNotification {
  id: string;
  policyName: string;
  type: 'new' | 'updated' | 'violation' | 'impact';
  message: string;
  affectedDatasets: string[];
  severity: 'critical' | 'warning' | 'info';
  timestamp: string;
  actionRequired: boolean;
}

/** Task priority for an action item severity. CRITICAL is the only urgent one. */
const taskPriority = (severity: string | null | undefined): DataTask['priority'] => {
  switch ((severity ?? '').toUpperCase()) {
    case 'CRITICAL':
      return 'urgent';
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    default:
      return 'low';
  }
};

export const getDataEngineerKpis = async (userId?: string): Promise<DataEngineerKpis> => {
  // Composed from real discovery statistics + reporting action-items.
  // recentlyLabeled and watchedAssets have no real backing metric and are
  // returned as 0 + TODO rather than estimated from discovery counts.
  const discoveryStats = await getDiscoveryStats();
  const actionItems = await getActionItems();
  const items = actionItemsOf(actionItems);
  const bands = actionItemBandCounts(actionItems);

  return {
    userId,
    newRelevantDatasets: discoveryStats.assetsDiscoveredThisWeek,
    // TODO(no-backend): no per-user "recently labeled" metric exists.
    recentlyLabeled: 0,
    flaggedForArchival: items.filter(
      (item) => item.sourceService === 'da-autoarchival' && priorityBand(item.severity) !== 'LOW'
    ).length,
    newRelevantDatasetsGrowth: 'Matching your interests',
    recentlyLabeledPeriod: 'Last 7 days',
    archivalImpactLevel:
      bands.HIGH > 3
        ? 'high'
        : bands.MEDIUM > 5
          ? 'medium'
          : 'low',
    personalTasks: items.filter(
      (item) =>
        (!!userId && item.assignedTo === userId) ||
        actionItemTarget(item) === 'navigateToDataDiscoveryAgentConfig'
    ).length,
    // TODO(no-backend): no "watched assets" concept exists on the backend.
    watchedAssets: 0,
  };
};

export const getWatchedDatasets = async (_userId?: string): Promise<WatchedDataset[]> => {
  // TODO(no-backend): there is no "watched datasets" endpoint or per-user
  // watch relationship on any DLAP service. Return empty; the page should
  // render an EmptyState rather than fabricated rows.
  return [];
};

export const getDataTasks = async (userId?: string): Promise<DataTask[]> => {
  // Mapped from real reporting action-items. `progress` has no backing value
  // (action-items carries no completion percentage) so it is 0 + TODO; dueDate
  // is the real item.dueDate or '' - never a fabricated "Due in N days".
  try {
    const actionItems = await getActionItems();
    return actionItemsOf(actionItems).map((item, index): DataTask => ({
      id: item.id ?? `task-${index + 1}`,
      title: item.title ?? '',
      description: item.description ?? '',
      priority: taskPriority(item.severity),
      dueDate: item.dueDate || '',
      type:
        item.category === 'POLICY_APPROVAL' || item.category === 'POLICY_EVALUATION'
          ? 'governance'
          : item.category === 'COMPLIANCE_VIOLATION'
            ? 'quality'
            : item.category === 'SYSTEM_ALERT'
              ? 'pipeline'
              : 'lineage',
      assignee: item.assignedTo || userId,
      // TODO(no-backend): action-items carries no task completion percentage.
      progress: 0,
      // TODO(no-backend): action-items carries no associated assetId.
    }));
  } catch (error) {
    console.error('Data Tasks Error:', error);
    return [];
  }
};

export const getPolicyNotifications = async (_userId?: string): Promise<PolicyNotification[]> => {
  // Mapped from real reporting action-items filtered to policy-related items.
  // affectedDatasets has no backing value on action-items, so it is [] rather
  // than a fabricated dataset id.
  try {
    const actionItems = await getActionItems();
    return actionItemsOf(actionItems)
      .filter(
        (item) => item.category === 'POLICY_APPROVAL' || item.sourceService === 'da-policyengine'
      )
      .map((item, index): PolicyNotification => ({
        id: item.id ?? `policy-notification-${index + 1}`,
        policyName: item.title ?? '',
        type: item.category === 'POLICY_APPROVAL' ? 'new' : 'violation',
        message: item.description ?? '',
        // TODO(no-backend): action-items exposes no affected-datasets list.
        affectedDatasets: [],
        severity:
          priorityBand(item.severity) === 'HIGH'
            ? 'critical'
            : priorityBand(item.severity) === 'MEDIUM'
              ? 'warning'
              : 'info',
        // The item's own timestamps; empty when the backend sent none.
        timestamp: item.lastUpdated || item.createdAt || '',
        actionRequired: priorityBand(item.severity) === 'HIGH',
      }));
  } catch (error) {
    console.error('Policy Notifications Error:', error);
    return [];
  }
};

// =============================================================================
// SMART AGENTS INTEGRATION - PRIORITY 3 ENDPOINTS
// =============================================================================

// SmartLabel Agent (AutoLabel) Endpoints
export interface LabelAgentKpis {
  activeModels: number;
  appliedLabelsTotal: number;
  appliedLabelsLast24h: number;
  modelAccuracy: number;
  rulePoliciesActive: number;
  mlPoliciesActive: number;
  assetsProcessed: number;
  assetsProcessedLast24h: number;
  averageProcessingTime: number;
  errorRate: number;
}

export interface TopAppliedLabel {
  name: string;
  value: number;
  category: string;
  color?: string;
}

export interface RuleActivity {
  ruleName: string;
  category: string;
  hitCount: number;
  successRate: number;
  lastTriggered: string;
  assetsAffected: number;
}

export interface RecentLabelActivity {
  id: string;
  event: string;
  assetName: string;
  labelsApplied: string[];
  method: 'ML Model' | 'Rule-Based' | 'Manual';
  confidence?: number;
  status: 'Success' | 'Warning' | 'Failed';
  timestamp: string;
  details?: string;
}

export interface SmartAgentKpis {
  agentName: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'MAINTENANCE';
  lastActivity: string;
  tasksProcessed24h: number;
  totalTasksProcessed: number;
  successRate: number;
  averageProcessingTime: number;
  nextScheduledRun?: string;
}

/**
 * Get Label Agent KPIs and Statistics
 * Integrates with da-autolabel service
 */
export const getLabelAgentKpis = async (): Promise<LabelAgentKpis> => {
  // Real da-autolabel endpoint: GET /api/v1/label-agent/kpis -> LabelAgentKpis.
  // Field names line up 1:1 with the backend DTO; map defensively so a
  // missing numeric field becomes 0 rather than undefined.
  const response = await labelAgentApi.get('/kpis');
  const d = response.data ?? {};
  return {
    activeModels: d.activeModels ?? 0,
    appliedLabelsTotal: d.appliedLabelsTotal ?? 0,
    appliedLabelsLast24h: d.appliedLabelsLast24h ?? 0,
    modelAccuracy: d.modelAccuracy ?? 0,
    rulePoliciesActive: d.rulePoliciesActive ?? 0,
    mlPoliciesActive: d.mlPoliciesActive ?? 0,
    assetsProcessed: d.assetsProcessed ?? 0,
    assetsProcessedLast24h: d.assetsProcessedLast24h ?? 0,
    averageProcessingTime: d.averageProcessingTime ?? 0,
    errorRate: d.errorRate ?? 0,
  };
};

/**
 * Get Top Applied Labels Statistics
 */
export const getTopAppliedLabels = async (): Promise<TopAppliedLabel[]> => {
  // Real da-autolabel endpoint: GET /api/v1/label-agent/top-labels -> List<TopAppliedLabel>.
  const response = await labelAgentApi.get('/top-labels');
  const rows: Array<Partial<TopAppliedLabel>> = Array.isArray(response.data) ? response.data : [];
  return rows.map((r) => ({
    name: r.name ?? '',
    value: r.value ?? 0,
    category: r.category ?? '',
    color: r.color ?? undefined,
  }));
};

/**
 * Get Rule Activities for Label Agent
 */
export const getRuleActivities = async (): Promise<RuleActivity[]> => {
  // Real da-autolabel endpoint: GET /api/v1/label-agent/rule-activities -> List<RuleActivity>.
  const response = await labelAgentApi.get('/rule-activities');
  const rows: Array<Partial<RuleActivity>> = Array.isArray(response.data) ? response.data : [];
  return rows.map((r) => ({
    ruleName: r.ruleName ?? '',
    category: r.category ?? '',
    hitCount: r.hitCount ?? 0,
    successRate: r.successRate ?? 0,
    lastTriggered: r.lastTriggered ?? '',
    assetsAffected: r.assetsAffected ?? 0,
  }));
};

/**
 * Get Recent Label Activities
 */
export const getRecentLabelActivities = async (): Promise<RecentLabelActivity[]> => {
  // Real da-autolabel endpoint: GET /api/v1/label-agent/recent-activities
  // -> List<RecentLabelActivity>. Backend field names line up 1:1; `method`
  // and `status` are free-form strings server-side, so coerce them into the
  // narrower TS unions with sensible fallbacks.
  const response = await labelAgentApi.get('/recent-activities');
  const rows: Array<Partial<RecentLabelActivity>> = Array.isArray(response.data) ? response.data : [];
  return rows.map((r, i) => ({
    id: r.id ?? `label-activity-${i + 1}`,
    event: r.event ?? '',
    assetName: r.assetName ?? '',
    labelsApplied: Array.isArray(r.labelsApplied) ? r.labelsApplied : [],
    method: (r.method as RecentLabelActivity['method']) ?? 'Rule-Based',
    confidence: r.confidence ?? undefined,
    status: (r.status as RecentLabelActivity['status']) ?? 'Success',
    timestamp: r.timestamp ?? '',
    details: r.details ?? undefined,
  }));
};

/**
 * Trigger Smart Agent Labeling Run.
 * Real da-autolabel endpoint: POST /api/v1/label-agent/trigger-labeling
 * (no request body) -> { success, message, timestamp }. Return the boolean
 * `success` flag; surface a false on any transport error.
 */
export const triggerLabelingRun = async (): Promise<boolean> => {
  try {
    const response = await labelAgentApi.post('/trigger-labeling');
    return response.data?.success === true;
  } catch (error) {
    console.error('Error triggering labeling run:', error);
    return false;
  }
};

/**
 * Get All Smart Agents Status.
 *
 * Derived ONLY from the real da-admin aggregated job-statuses endpoint
 * (getJobStatuses). The backend groups jobs by `serviceName`; we fold those
 * into one summary row per lifecycle agent. Only the fields that job-statuses
 * actually carries are populated:
 *   - status: HEALTHY-if-no-failed → ACTIVE, otherwise ERROR (no jobs → INACTIVE)
 *   - lastActivity: most recent completedAt/startedAt/submittedAt for the service
 *   - tasksProcessed24h: count of successful jobs for that service
 * The remaining SmartAgentKpis fields have no backing value in job-statuses;
 * per no-backend policy they are returned as 0/'' rather than fabricated.
 */
export const getAllSmartAgentsStatus = async (): Promise<SmartAgentKpis[]> => {
  const jobStatuses = await getJobStatuses();
  const summaries = deriveServiceSummaries(jobStatuses);

  // Map lifecycle agent display names to the serviceName values emitted by
  // da-admin's JobStatusServiceImpl (casing is inconsistent server-side, so
  // matching is case-insensitive inside findSummary).
  const agentDefs: Array<{ agentName: string; serviceKey: string }> = [
    { agentName: 'SmartDiscovery', serviceKey: 'Discovery' },
    { agentName: 'SmartLabel', serviceKey: 'AUTOLABEL' },
    { agentName: 'SmartArchival', serviceKey: 'AUTOARCHIVAL' },
    { agentName: 'SmartDeletion', serviceKey: 'AUTODELETE' },
    { agentName: 'SmartCompliance', serviceKey: 'Autocompliance' },
  ];

  return agentDefs.map(({ agentName, serviceKey }) => {
    const summary = findSummary(summaries, serviceKey);
    return {
      agentName,
      status: !summary
        ? 'INACTIVE'
        : summary.status === 'HEALTHY'
          ? 'ACTIVE'
          : 'ERROR',
      lastActivity: summary?.lastJobTime ?? '',
      tasksProcessed24h: summary?.jobCount.success ?? 0,
      // TODO(no-backend): da-admin job-statuses exposes no lifetime task total.
      totalTasksProcessed: 0,
      // TODO(no-backend): job-statuses exposes no success-rate aggregate.
      successRate: 0,
      // TODO(no-backend): job-statuses exposes no average processing time.
      averageProcessingTime: 0,
      // TODO(no-backend): no scheduler metadata is exposed by job-statuses.
      nextScheduledRun: '',
    };
  });
};

// =============================================================================
// Archival KPI tiles
// =============================================================================

/**
 * da-autoarchival reports `estimatedMonthlySavings`, `totalSavingsToDate` and
 * `storageReclaimed` as constants (0.0 and "0 TB") until it aggregates real byte
 * and billing data (ArchivalOverviewServiceImpl.getKpis). A zero is a true figure
 * only while nothing has been archived; once assets are archived a zero means "not
 * computed". Returns the dollar figure to show, or null when it must render as
 * NOT_AVAILABLE_YET.
 */
export const archivalSavingsFigure = (
  value: number | null | undefined,
  assetsArchived: number | null | undefined
): number | null => {
  if (!isNum(value)) return null;
  return value === 0 && isNum(assetsArchived) && assetsArchived > 0 ? null : value;
};

/** Reclaimed-storage text to show, or null when it must render as NOT_AVAILABLE_YET. Same rule as above. */
export const archivalStorageFigure = (
  value: string | null | undefined,
  assetsArchived: number | null | undefined
): string | null => {
  const text = (value ?? '').trim();
  if (!text) return null;
  const isZero = /^0+(\.0+)?\s*[A-Za-z]*$/.test(text);
  return isZero && isNum(assetsArchived) && assetsArchived > 0 ? null : text;
};

// =============================================================================
// Internal helpers - job-statuses normalization
// =============================================================================

/**
 * Per-service rollup of the real da-admin AggregatedJobStatusDTO. This is the
 * shape the older frontend code assumed job-statuses returned directly
 * (`{ services, overall }`); the actual backend returns a flat `jobs[]` list
 * (see da-admin AggregatedJobStatusDTO / JobStatusDTO). We reconstruct the
 * per-service view here so owned functions consume real data without inventing
 * anything. getJobStatuses() itself now normalizes into {services, overall},
 * so this helper passes already-normalized input through untouched.
 */
interface ServiceJobSummary {
  serviceName: string;
  status: 'HEALTHY' | 'WARNING' | 'ERROR';
  lastJobStatus: 'SUCCESS' | 'FAILED' | 'RUNNING' | 'PENDING' | 'UNKNOWN';
  lastJobTime: string;
  jobCount: { success: number; failed: number; running: number };
}

const SUCCESS_STATES = new Set(['COMPLETED_SUCCESS', 'COMPLETED', 'SUCCESS']);
const FAILED_STATES = new Set(['COMPLETED_FAILED', 'FAILED', 'ERROR']);
const RUNNING_STATES = new Set(['RUNNING', 'IN_PROGRESS']);

/**
 * Fold the real AggregatedJobStatusDTO.jobs[] into one summary per serviceName.
 * Accepts the loosely-typed response so it works whether getJobStatuses returns
 * the raw backend object (jobs[]) or, defensively, an already-summarized shape.
 */
const deriveServiceSummaries = (jobStatuses: RawJobStatuses | null | undefined): ServiceJobSummary[] => {
  // Already normalized ({services, overall} from getJobStatuses)? Pass through.
  if (jobStatuses && Array.isArray(jobStatuses.services)) {
    return jobStatuses.services;
  }
  const jobs: RawJobStatus[] = Array.isArray(jobStatuses?.jobs) ? jobStatuses.jobs : [];
  const byService = new Map<string, ServiceJobSummary>();

  for (const job of jobs) {
    const serviceName: string = job?.serviceName ?? 'unknown';
    const rawStatus: string = (job?.status ?? '').toString().toUpperCase();
    const jobTime: string =
      job?.completedAt ?? job?.startedAt ?? job?.submittedAt ?? '';

    let entry = byService.get(serviceName);
    if (!entry) {
      entry = {
        serviceName,
        status: 'HEALTHY',
        lastJobStatus: 'UNKNOWN',
        lastJobTime: '',
        jobCount: { success: 0, failed: 0, running: 0 },
      };
      byService.set(serviceName, entry);
    }

    if (SUCCESS_STATES.has(rawStatus)) entry.jobCount.success += 1;
    else if (FAILED_STATES.has(rawStatus)) entry.jobCount.failed += 1;
    else if (RUNNING_STATES.has(rawStatus)) entry.jobCount.running += 1;

    // Track the most recent job as the service's "last" job.
    if (jobTime && jobTime > entry.lastJobTime) {
      entry.lastJobTime = jobTime;
      entry.lastJobStatus = SUCCESS_STATES.has(rawStatus)
        ? 'SUCCESS'
        : FAILED_STATES.has(rawStatus)
          ? 'FAILED'
          : RUNNING_STATES.has(rawStatus)
            ? 'RUNNING'
            : rawStatus === 'PENDING'
              ? 'PENDING'
              : 'UNKNOWN';
    }
  }

  // A service with any failed job is degraded; otherwise healthy.
  for (const entry of byService.values()) {
    entry.status = entry.jobCount.failed > 0 ? 'ERROR' : 'HEALTHY';
  }

  return Array.from(byService.values());
};

/** Case-insensitive lookup of a service summary by serviceName. */
const findSummary = (
  summaries: ServiceJobSummary[],
  serviceKey: string
): ServiceJobSummary | undefined =>
  summaries.find(
    (s) => s.serviceName.toLowerCase() === serviceKey.toLowerCase()
  ); 