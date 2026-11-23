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

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogApi } from '../../utils/api';
import AssetDetailView from '../AssetDetailView';
import { quietConsole, renderPage, replyTo, type StubClient } from './testUtils';

vi.mock('../../utils/api', async () => (await import('./testUtils')).makeApiMock());
vi.mock('../../keycloak', async () => (await import('./testUtils')).makeKeycloakMock());

const catalog = catalogApi as unknown as StubClient;

const ID = '6f1c1b34-8d8e-4a53-9a8b-0d4b6a3f9c11';
const base = `/assets/${ID}`;

/** da-catalog AssetOutputDTO. */
const assetDto = {
  assetId: ID,
  assetName: 'orders_raw',
  cloudConnectionId: '2d0a7a52-5b1f-45d2-b4b5-8f6a0e2b7a10',
  cloudProvider: 'GCP',
  assetType: 'BIGQUERY_TABLE',
  nativeAssetId: 'proj.sales.orders_raw',
  assetUri: 'bq://proj.sales.orders_raw',
  region: 'us-central1',
  detailsJson: {},
  discoveredAt: '2026-09-01T08:00:00Z',
  lastScannedAt: 'not-a-date',
  createdByUserId: null,
  createdAt: '2026-09-01T08:00:00Z',
  updatedAt: '2026-10-01T08:00:00Z',
  labels: ['pii', 'finance'],
  businessMetadataJson: {
    businessName: 'Raw orders',
    businessOwner: { name: 'Olive Owner', email: 'olive@example.org' },
    retentionRequirements: { legalRetention: '7y' },
    complianceClassification: { dataClassification: 'confidential' },
  },
  description: 'Raw order events',
  technicalMetadata: {},
  serviceType: 'BIGQUERY',
};

/** AssetUsageAnalyticsDTO as the catalog returns it when it has no stored usage (UI-01 contract). */
const usageUnavailableDto = {
  available: false,
  basis: 'The catalog has no stored access counts for this asset.',
  usageMetrics: {
    totalAccesses: null,
    uniqueUsers: null,
    avgAccessesPerDay: null,
    lastAccessed: null,
    peakUsageHour: null,
    usageTrend: null,
  },
  userAnalytics: { topUsers: null, departmentBreakdown: null },
  accessPatterns: { hourlyDistribution: null, weeklyDistribution: null, monthlyTrend: null },
  performanceMetrics: { avgQueryTime: null, slowestQuery: null, fastestQuery: null, timeoutRate: null, errorRate: null },
};

/** AssetUsageAnalyticsDTO with the two stored signals the lifecycle listener writes. */
const usageStoredDto = {
  available: true,
  basis: 'Access counter and last access written by the lifecycle listener.',
  usageMetrics: {
    totalAccesses: 1280,
    uniqueUsers: null,
    avgAccessesPerDay: null,
    lastAccessed: '2026-10-17T12:00:00Z',
    peakUsageHour: null,
    usageTrend: null,
  },
  userAnalytics: {
    topUsers: [
      { userId: '9a3c6a8e-0000-4000-8000-000000000001', username: 'alice', accessCount: 40, lastAccess: '2026-10-17T12:00:00Z', accessPattern: 'REGULAR' },
      { userId: '9a3c6a8e-0000-4000-8000-000000000002', username: null, accessCount: null, lastAccess: null, accessPattern: null },
    ],
    departmentBreakdown: null,
  },
};

/** The pre-UI-01 usage DTO, with every number filled in. */
const usageLegacyDto = {
  usageMetrics: {
    totalAccesses: 5200,
    uniqueUsers: 18,
    avgAccessesPerDay: 173.3,
    lastAccessed: '2026-10-17T12:00:00Z',
    peakUsageHour: 14,
    usageTrend: 'STABLE',
  },
  userAnalytics: { topUsers: [], departmentBreakdown: { finance: 60.0 } },
};

const policiesUnavailableDto = {
  assetId: ID,
  assetName: 'orders_raw',
  available: false,
  basis: 'Per-asset policy evaluations live in the policy engine, not the catalog.',
};

const policiesDto = {
  assetId: ID,
  assetName: 'orders_raw',
  available: true,
  applicablePolicies: [
    {
      policyId: 'b6d1b0f2-1111-4111-8111-000000000001',
      policyName: 'Mask PII',
      policyType: 'SECURITY',
      policyVersion: '1',
      applicabilityReason: 'LABEL_BASED',
      complianceStatus: 'NON_COMPLIANT',
      complianceScore: 40.0,
      lastEvaluated: '2026-10-17T12:00:00Z',
    },
  ],
  inheritedPolicies: [
    {
      policyId: 'b6d1b0f2-1111-4111-8111-000000000002',
      policyName: 'Retain 7 years',
      policyType: 'RETENTION',
      applicabilityReason: 'INHERITED',
      complianceStatus: 'COMPLIANT',
      lastEvaluated: null,
    },
  ],
  riskAssessment: [{ riskType: 'COMPLIANCE', riskLevel: 'HIGH', description: 'PII is unmasked' }],
  lastEvaluated: '2026-10-17T12:00:00Z',
  evaluationStatus: 'COMPLETED',
};

const complianceUnavailableDto = {
  assetId: ID,
  assetName: 'orders_raw',
  available: false,
  basis: 'Compliance is evaluated by da-autocompliance and is not stored in the catalog.',
  overallComplianceStatus: 'UNKNOWN',
};

const complianceDto = {
  assetId: ID,
  assetName: 'orders_raw',
  available: true,
  overallComplianceStatus: 'NON_COMPLIANT',
  overallComplianceScore: 62.5,
  frameworkCompliance: [
    { frameworkName: 'GDPR', frameworkVersion: '2016/679', complianceStatus: 'PARTIALLY_COMPLIANT', complianceScore: 70.0 },
  ],
  violations: [
    {
      violationId: 'v1',
      violationType: 'DATA_RETENTION',
      severity: 'HIGH',
      description: 'Retention exceeds policy',
      framework: 'GDPR',
      status: 'OPEN',
      detectedAt: '2026-10-16T08:00:00Z',
    },
  ],
  riskAssessment: { overallRiskLevel: 'HIGH', riskScore: 71.0, riskFactors: ['unmasked PII'] },
};

/** Enhanced lineage with the optional sections omitted, as NON_NULL serialization does. */
const lineageEmptyDto = { assetId: ID, assetName: 'orders_raw' };

function serve(parts: { usage?: unknown; policies?: unknown; compliance?: unknown; lineage?: unknown; asset?: unknown } = {}) {
  replyTo(catalog, {
    [base]: parts.asset ?? assetDto,
    [`${base}/usage`]: parts.usage ?? usageUnavailableDto,
    [`${base}/lineage/enhanced`]: parts.lineage ?? lineageEmptyDto,
    [`${base}/policies`]: parts.policies ?? policiesUnavailableDto,
    [`${base}/compliance`]: parts.compliance ?? complianceUnavailableDto,
  });
}

async function openTab(name: string) {
  fireEvent.click(await screen.findByText(name));
}

describe('AssetDetailView', () => {
  beforeEach(() => {
    quietConsole();
    sessionStorage.setItem('dlap.selectedAssetId', ID);
    catalog.put.mockReset();
  });
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows the asset, with a malformed date rendered as Unknown rather than Invalid Date', async () => {
    serve();
    const { container } = renderPage(<AssetDetailView />);
    expect(await screen.findByText('orders_raw')).toBeTruthy();
    expect(screen.getByText('bq://proj.sales.orders_raw')).toBeTruthy();
    expect(screen.getByText('us-central1')).toBeTruthy();
    expect(screen.getByText('pii')).toBeTruthy();
    expect(screen.getByText('Last Scanned').nextElementSibling?.textContent).toBe('Unknown');
    expect(container.textContent).not.toContain('Invalid Date');
  });

  it('tells the user when no asset is selected', async () => {
    sessionStorage.clear();
    serve();
    renderPage(<AssetDetailView />);
    expect(await screen.findByText('No asset selected.')).toBeTruthy();
  });

  it('shows an error when the asset cannot be loaded', async () => {
    replyTo(catalog, { [base]: new Error('404') });
    renderPage(<AssetDetailView />);
    expect(await screen.findByText('Failed to load asset details.')).toBeTruthy();
  });

  describe('Usage Metrics tab', () => {
    it('shows "Not available yet" for null usage numbers instead of crashing', async () => {
      serve();
      const { container } = renderPage(<AssetDetailView />);
      await openTab('Usage Metrics');
      // The old code called usageMetrics.totalAccesses.toLocaleString() on null.
      expect(await screen.findByText('No usage has been recorded for this asset yet')).toBeTruthy();
      expect(screen.getByText(usageUnavailableDto.basis)).toBeTruthy();
      // Total, unique users, average per day and last access.
      expect(screen.getAllByText('Not available yet').length).toBe(4);
      expect(container.textContent).not.toMatch(/NaN|null/);
    });

    it('shows the stored signals and leaves the missing ones as "Not available yet"', async () => {
      serve({ usage: usageStoredDto });
      renderPage(<AssetDetailView />);
      await openTab('Usage Metrics');
      expect(await screen.findByText('1,280')).toBeTruthy();
      // unique users and average per day have no stored source, and neither has the second
      // top user's access count.
      expect(screen.getAllByText('Not available yet').length).toBe(3);
      expect(screen.getByText('alice')).toBeTruthy();
      expect(screen.getByText('40')).toBeTruthy();
      // A top user with no username falls back to the user id; a null count is not 0.
      expect(screen.getByText('9a3c6a8e-0000-4000-8000-000000000002')).toBeTruthy();
    });

    it('still renders a complete legacy usage response', async () => {
      serve({ usage: usageLegacyDto });
      renderPage(<AssetDetailView />);
      await openTab('Usage Metrics');
      expect(await screen.findByText('5,200')).toBeTruthy();
      expect(screen.getByText('18')).toBeTruthy();
      expect(screen.getByText('173.3')).toBeTruthy();
    });

    it('shows an error when the usage request fails', async () => {
      serve();
      replyTo(catalog, { [base]: assetDto, [`${base}/usage`]: new Error('500'), [`${base}/lineage/enhanced`]: lineageEmptyDto, [`${base}/policies`]: policiesUnavailableDto, [`${base}/compliance`]: complianceUnavailableDto });
      renderPage(<AssetDetailView />);
      await openTab('Usage Metrics');
      expect(await screen.findByText('Failed to load usage analytics for this asset.')).toBeTruthy();
    });
  });

  describe('Applied Policies tab', () => {
    it('says "Not available yet" when the catalog has no policy mapping', async () => {
      serve();
      renderPage(<AssetDetailView />);
      await openTab('Applied Policies');
      expect(await screen.findByText('Not available yet')).toBeTruthy();
      expect(screen.getByText(policiesUnavailableDto.basis)).toBeTruthy();
    });

    it('lists applicable and inherited policies with their real fields', async () => {
      serve({ policies: policiesDto });
      const navigateToPolicyDetailView = vi.fn();
      window.navigateToPolicyDetailView = navigateToPolicyDetailView;
      renderPage(<AssetDetailView />);
      await openTab('Applied Policies');
      expect(await screen.findByText('Mask PII')).toBeTruthy();
      expect(screen.getByText('Retain 7 years')).toBeTruthy();
      expect(screen.getByText('SECURITY')).toBeTruthy();
      expect(screen.getByText('LABEL BASED')).toBeTruthy();
      expect(screen.getByText('NON COMPLIANT')).toBeTruthy();
      fireEvent.click(screen.getByText('Mask PII'));
      expect(navigateToPolicyDetailView).toHaveBeenCalledWith('b6d1b0f2-1111-4111-8111-000000000001');
      delete window.navigateToPolicyDetailView;
    });
  });

  describe('Compliance tab', () => {
    it('says "Not available yet" instead of crashing when there is no evaluation', async () => {
      serve();
      renderPage(<AssetDetailView />);
      await openTab('Compliance');
      // The old code read riskAssessment.riskLevel and frameworkCompliance.length on a missing section.
      expect(await screen.findByText('Not available yet')).toBeTruthy();
      expect(screen.getByText(complianceUnavailableDto.basis)).toBeTruthy();
      expect(screen.queryByText('Compliance Overview')).toBeNull();
    });

    it('renders the score, risk, frameworks and violations with the real field names', async () => {
      serve({ compliance: complianceDto });
      renderPage(<AssetDetailView />);
      await openTab('Compliance');
      expect(await screen.findByText('Compliance Overview')).toBeTruthy();
      expect(screen.getByText('63')).toBeTruthy();
      // The risk level and the violation severity.
      expect(screen.getAllByText('HIGH').length).toBe(2);
      expect(screen.getByText('GDPR')).toBeTruthy();
      expect(screen.getByText('DATA RETENTION')).toBeTruthy();
      expect(screen.getByText('Retention exceeds policy')).toBeTruthy();
      expect(screen.getByText('OPEN')).toBeTruthy();
    });

    it('does not crash when an evaluated response omits its sections', async () => {
      serve({ compliance: { assetId: ID, available: true, overallComplianceStatus: 'MONITORING' } });
      const { container } = renderPage(<AssetDetailView />);
      await openTab('Compliance');
      expect(await screen.findByText('Compliance Overview')).toBeTruthy();
      expect(screen.getByText('No violations')).toBeTruthy();
      expect(container.textContent).not.toMatch(/NaN|undefined/);
    });
  });

  describe('Lineage tab', () => {
    it('does not crash when the lineage graph and statistics are omitted', async () => {
      serve();
      renderPage(<AssetDetailView />);
      await openTab('Lineage');
      expect(await screen.findByText('No lineage available')).toBeTruthy();
    });
  });

  describe('Business context save', () => {
    async function editPurpose(text: string) {
      await openTab('Business Context');
      fireEvent.click(await screen.findByText('Edit Context'));
      fireEvent.change(screen.getByPlaceholderText('Describe the business purpose...'), {
        target: { value: text },
      });
      fireEvent.click(screen.getByText('Save Changes'));
    }

    it('merges the edit into the stored document, so nothing else is wiped', async () => {
      serve();
      catalog.put.mockResolvedValue({ data: {} });
      renderPage(<AssetDetailView />);
      await editPurpose('Order analytics');
      await waitFor(() => expect(catalog.put).toHaveBeenCalledTimes(1));
      const [url, body] = catalog.put.mock.calls[0];
      // Not the business-context endpoint: that one replaces the document with an empty object.
      expect(url).toBe(`${base}/metadata/business`);
      expect(body).toEqual({
        ...assetDto.businessMetadataJson,
        businessPurpose: 'Order analytics',
        dataClassification: 'CONFIDENTIAL',
      });
      // Every key that was stored is still in the body.
      for (const key of Object.keys(assetDto.businessMetadataJson)) {
        expect(body).toHaveProperty(key);
      }
    });

    it('merges into the latest stored document, not the copy loaded earlier', async () => {
      let reads = 0;
      catalog.get.mockImplementation(async (url: string) => {
        if (url === base) {
          reads += 1;
          // The second read of the asset sees a key another user added meanwhile.
          return {
            data:
              reads === 1
                ? assetDto
                : { ...assetDto, businessMetadataJson: { ...assetDto.businessMetadataJson, addedByColleague: true } },
          };
        }
        if (url === `${base}/usage`) return { data: usageUnavailableDto };
        if (url === `${base}/lineage/enhanced`) return { data: lineageEmptyDto };
        if (url === `${base}/policies`) return { data: policiesUnavailableDto };
        if (url === `${base}/compliance`) return { data: complianceUnavailableDto };
        throw new Error(`unexpected GET ${url}`);
      });
      catalog.put.mockResolvedValue({ data: {} });
      renderPage(<AssetDetailView />);
      await editPurpose('Order analytics');
      await waitFor(() => expect(catalog.put).toHaveBeenCalledTimes(1));
      expect(catalog.put.mock.calls[0][1]).toHaveProperty('addedByColleague', true);
    });

    it('does not write at all when the latest document cannot be read', async () => {
      let reads = 0;
      catalog.get.mockImplementation(async (url: string) => {
        if (url === base) {
          reads += 1;
          if (reads > 1) throw new Error('503');
          return { data: assetDto };
        }
        if (url === `${base}/usage`) return { data: usageUnavailableDto };
        if (url === `${base}/lineage/enhanced`) return { data: lineageEmptyDto };
        if (url === `${base}/policies`) return { data: policiesUnavailableDto };
        if (url === `${base}/compliance`) return { data: complianceUnavailableDto };
        throw new Error(`unexpected GET ${url}`);
      });
      renderPage(<AssetDetailView />);
      await editPurpose('Order analytics');
      expect(await screen.findByText('Failed to save business context. Please try again.')).toBeTruthy();
      expect(catalog.put).not.toHaveBeenCalled();
    });

    it('reads the classification the structured endpoint stored under complianceClassification', async () => {
      serve();
      renderPage(<AssetDetailView />);
      await openTab('Business Context');
      expect(await screen.findByText('CONFIDENTIAL')).toBeTruthy();
    });
  });
});
