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
import { reportingApi } from '../../utils/api';
import ReportingInsightsHub from '../ReportingInsightsHub';
import {
  REPORTING,
  actionItemsDto,
  actionItemsUpstreamDownDto,
  costSavingsEstimatedDto,
  costSavingsUnavailableDto,
  governanceScoreDto,
  governanceScoreWithBenchmarkDto,
  governanceScoreWithLegacyBenchmarkDto,
} from './fixtures';
import { quietConsole, renderPage, replyTo, stubResizeObserver, tileText, type StubClient } from './testUtils';

vi.mock('../../utils/api', async () => (await import('./testUtils')).makeApiMock());
vi.mock('../../keycloak', async () => (await import('./testUtils')).makeKeycloakMock());

const reporting = reportingApi as unknown as StubClient;

function serve(tables: { governance?: unknown; cost?: unknown; actions?: unknown } = {}) {
  replyTo(reporting, {
    [REPORTING.governance]: tables.governance ?? governanceScoreDto,
    [REPORTING.cost]: tables.cost ?? costSavingsUnavailableDto,
    [REPORTING.actions]: tables.actions ?? actionItemsDto,
  });
}

describe('ReportingInsightsHub (reporting center)', () => {
  beforeEach(() => {
    quietConsole();
    stubResizeObserver();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('cost savings report', () => {
    it('does not crash on the real CostSavingsDTO (no trends, no topSavingOpportunities)', async () => {
      serve();
      renderPage(<ReportingInsightsHub />);
      // The old code read costData.trends.last12Months and threw on this DTO.
      expect(await screen.findByText('Dollar savings are not available yet')).toBeTruthy();
      expect(screen.getByText(costSavingsUnavailableDto.basis)).toBeTruthy();
    });

    it('shows "Not available yet" in every cost tile when there is no billing source', async () => {
      serve();
      const { container } = renderPage(<ReportingInsightsHub />);
      await screen.findByText('Total Savings');
      // Total, monthly, ROI, four breakdown rows, the trend panel and the opportunities panel.
      expect(screen.getAllByText('Not available yet').length).toBeGreaterThanOrEqual(9);
      expect(container.textContent).not.toMatch(/NaN|\$0\b/);
    });

    it('renders figures, the trend and opportunities from a backend that returns dollars', async () => {
      serve({ cost: costSavingsEstimatedDto });
      renderPage(<ReportingInsightsHub />);
      expect(await screen.findByText('$9,360')).toBeTruthy();
      expect(screen.getAllByText('$780').length).toBeGreaterThan(0);
      expect(screen.getByText('80%')).toBeTruthy();
      expect(screen.getByText('$2,340')).toBeTruthy();
      expect(screen.getByText('ARCHIVAL CANDIDATE')).toBeTruthy();
      expect(screen.getByText('$24,960')).toBeTruthy();
      expect(screen.queryByText('Dollar savings are not available yet')).toBeNull();
    });

    it('exports "Not available yet" rather than zeros', async () => {
      serve();
      let csv = '';
      const OriginalBlob = globalThis.Blob;
      vi.spyOn(globalThis, 'Blob').mockImplementation(function (parts?: BlobPart[]) {
        csv = String((parts ?? [])[0]);
        return new OriginalBlob(parts);
      } as unknown as typeof Blob);
      URL.createObjectURL = vi.fn(() => 'blob:test');
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      renderPage(<ReportingInsightsHub />);
      await screen.findByText('Total Savings');
      fireEvent.click(screen.getByText('Export CSV'));
      expect(csv).toContain('Total Savings,Not available yet');
      expect(csv).not.toMatch(/NaN|\$0\b/);
    });
  });

  describe('governance report', () => {
    it('renders the score, the four real breakdown components and recommendations', async () => {
      serve();
      renderPage(<ReportingInsightsHub />);
      fireEvent.click(await screen.findByText('Governance Score'));
      expect(await screen.findByText('71.4')).toBeTruthy();
      expect(screen.getByText('Policy Compliance')).toBeTruthy();
      expect(screen.getByText('88')).toBeTruthy();
      expect(screen.getByText('64.2')).toBeTruthy();
      expect(screen.getByText('72')).toBeTruthy();
      expect(screen.getByText('50')).toBeTruthy();
      expect(screen.getByText('Raise classification coverage toward 80%.')).toBeTruthy();
    });

    it('shows "Not available yet" for the benchmark tile and the trend when neither exists', async () => {
      serve();
      renderPage(<ReportingInsightsHub />);
      fireEvent.click(await screen.findByText('Governance Score'));
      await screen.findByText('Industry Benchmark');
      expect(screen.getByText('No benchmark dataset is connected, so there is nothing to compare your score with.')).toBeTruthy();
      expect(screen.getByText('No score history is stored yet.')).toBeTruthy();
      expect(screen.getAllByText('Not available yet').length).toBe(2);
    });

    it('treats a placeholder (estimate) benchmark as not available', async () => {
      serve({ governance: governanceScoreWithLegacyBenchmarkDto });
      renderPage(<ReportingInsightsHub />);
      fireEvent.click(await screen.findByText('Governance Score'));
      await screen.findByText('Industry Benchmark');
      expect(screen.queryByText('72.5')).toBeNull();
      expect(screen.queryByText('76.8')).toBeNull();
      expect(screen.getByText('No benchmark dataset is connected, so there is nothing to compare your score with.')).toBeTruthy();
    });

    it('shows a real benchmark when one exists', async () => {
      serve({ governance: governanceScoreWithBenchmarkDto });
      renderPage(<ReportingInsightsHub />);
      fireEvent.click(await screen.findByText('Governance Score'));
      expect(await screen.findByText('68')).toBeTruthy();
      expect(screen.getByText('74.5')).toBeTruthy();
      expect(screen.getByText('Peer cohort of 40 organisations.')).toBeTruthy();
      expect(screen.queryByText('No score history is stored yet.')).toBeNull();
    });

    it('does not crash when every component is null', async () => {
      serve({ governance: { ...governanceScoreDto, overallScore: null, breakdown: null, recommendations: null } });
      renderPage(<ReportingInsightsHub />);
      fireEvent.click(await screen.findByText('Governance Score'));
      await screen.findByText('Industry Benchmark');
      expect(screen.getByText('No recommendations')).toBeTruthy();
    });
  });

  describe('action items report', () => {
    it('lists the real items with severity, category, service and a safe due date', async () => {
      serve();
      renderPage(<ReportingInsightsHub />);
      fireEvent.click(await screen.findByText('Action Items'));
      expect(await screen.findByText('Policy evaluation: orders_raw')).toBeTruthy();
      expect(screen.getAllByText('POLICY EVALUATION').length).toBe(2);
      expect(screen.getAllByText('da-policyengine').length).toBe(2);
      // No dueDate in the DTO: the placeholder is a hyphen, not "Invalid Date" or an em-dash.
      expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(2);
      expect(screen.queryByText('Invalid Date')).toBeNull();
    });

    it('counts items per priority band from the list', async () => {
      serve();
      renderPage(<ReportingInsightsHub />);
      fireEvent.click(await screen.findByText('Action Items'));
      await screen.findByText('Total Items');
      expect(tileText('Total Items')).toContain('2');
      expect(tileText('High Priority')).toContain('1');
      expect(tileText('Medium Priority')).toContain('1');
      expect(tileText('Low Priority')).toContain('0');
    });

    it('shows an error, not an empty list, when the policy engine was unreachable', async () => {
      serve({ actions: actionItemsUpstreamDownDto });
      renderPage(<ReportingInsightsHub />);
      fireEvent.click(await screen.findByText('Action Items'));
      await waitFor(() =>
        expect(
          screen.getByText('The reporting service could not reach the policy engine, so action items are unknown.')
        ).toBeTruthy()
      );
    });
  });

  it('shows the error state when the request fails', async () => {
    replyTo(reporting, { [REPORTING.cost]: new Error('503') });
    renderPage(<ReportingInsightsHub />);
    expect(await screen.findByText('Could not load report data from the reporting service.')).toBeTruthy();
  });
});
