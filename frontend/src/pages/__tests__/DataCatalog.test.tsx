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

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogApi } from '../../utils/api';
import DataCatalog from '../DataCatalog';
import { quietConsole, renderPage, replyTo, type StubClient } from './testUtils';

vi.mock('../../utils/api', async () => (await import('./testUtils')).makeApiMock());
vi.mock('../../keycloak', async () => (await import('./testUtils')).makeKeycloakMock());

const catalog = catalogApi as unknown as StubClient;

/** da-catalog AssetOutputDTO rows, deliberately not in name order. */
const assetPage = {
  content: [
    { assetId: 'a-2', assetName: 'bravo_orders', assetUri: 'gs://b/bravo', cloudProvider: 'GCP', assetType: 'TABLE', ownerInfo: 'Zed Owner' },
    { assetId: 'a-3', assetName: 'charlie_events', assetUri: 'gs://b/charlie', cloudProvider: 'AWS', assetType: 'TABLE', ownerInfo: 'Amy Owner' },
    { assetId: 'a-1', assetName: 'alpha_customers', assetUri: 'gs://b/alpha', cloudProvider: 'GCP', assetType: 'TABLE', ownerInfo: 'Mia Owner' },
  ],
  totalElements: 3,
  totalPages: 1,
  size: 200,
  number: 0,
};

/** The asset names in the order the list shows them. */
const listedNames = (): string[] =>
  screen.getAllByText(/^(alpha_customers|bravo_orders|charlie_events)$/).map((element) => element.textContent ?? '');

describe('DataCatalog list sorting', () => {
  beforeEach(() => {
    quietConsole();
    replyTo(catalog, { '/assets': assetPage, '/filters': { filterCategories: [] } });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('lists the assets by name, ascending, to begin with', async () => {
    renderPage(<DataCatalog />);
    await screen.findByText('alpha_customers');
    expect(listedNames()).toEqual(['alpha_customers', 'bravo_orders', 'charlie_events']);
  });

  it('reverses the list when the Asset Name header is clicked, and restores it on a second click', async () => {
    renderPage(<DataCatalog />);
    await screen.findByText('alpha_customers');

    fireEvent.click(screen.getByRole('button', { name: /Asset Name/ }));
    await waitFor(() => expect(listedNames()).toEqual(['charlie_events', 'bravo_orders', 'alpha_customers']));

    fireEvent.click(screen.getByRole('button', { name: /Asset Name/ }));
    await waitFor(() => expect(listedNames()).toEqual(['alpha_customers', 'bravo_orders', 'charlie_events']));
  });
});
