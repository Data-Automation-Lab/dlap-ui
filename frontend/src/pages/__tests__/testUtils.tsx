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

import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

/**
 * Shared helpers for the page tests. The pages are rendered for real, and only
 * the network boundary is replaced: every axios client exported by utils/api is
 * a stub whose responses the test supplies as raw JSON in the exact shape the
 * Java DTOs serialize to. That keeps the data layer (utils/apiServices) and the
 * page under test, so a field-name mismatch between them fails the test.
 */

/** A stand-in for one axios instance. */
export interface StubClient {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

const stubClient = (): StubClient => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
});

/** Factory for vi.mock('../../utils/api'): every exported client becomes a stub. */
export function makeApiMock() {
  return {
    catalogApi: stubClient(),
    policyengineApi: stubClient(),
    reportingApi: stubClient(),
    discoveryApi: stubClient(),
    labelingApi: stubClient(),
    archivalApi: stubClient(),
    deletionApi: stubClient(),
    autodeleteApi: stubClient(),
    complianceApi: stubClient(),
    adminApi: stubClient(),
    labelAgentApi: stubClient(),
    deleteAgentApi: stubClient(),
    ENABLE_DEBUG_LOGS: false,
    ENABLE_MOCK_DATA: false,
  };
}

/** Factory for vi.mock('../../keycloak'): a signed-out Keycloak singleton. */
export function makeKeycloakMock() {
  return {
    default: {
      authenticated: false,
      token: undefined,
      tokenParsed: undefined,
      onAuthSuccess: undefined,
      onAuthRefreshSuccess: undefined,
      onAuthLogout: undefined,
      updateToken: vi.fn().mockResolvedValue(false),
      login: vi.fn(),
    },
  };
}

/** What a stub client answers for one URL: a JSON body, or an Error to reject with. */
export type Reply = unknown | Error;

/**
 * Make a stub answer GET requests from a URL table. A URL missing from the table
 * rejects, so a page that calls an endpoint the test did not plan for fails loudly.
 */
export function replyTo(client: StubClient, table: Record<string, Reply>): void {
  client.get.mockImplementation(async (url: string) => {
    if (!(url in table)) {
      throw new Error(`unexpected GET ${url}`);
    }
    const reply = table[url];
    if (reply instanceof Error) {
      throw reply;
    }
    return { data: reply };
  });
}

/** Render a page inside the router the sidebar layout needs. */
export function renderPage(page: ReactElement) {
  return render(<MemoryRouter>{page}</MemoryRouter>);
}

/** Silence console noise from expected failures while keeping the spy for assertions. */
export function quietConsole() {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
}

/**
 * jsdom has no ResizeObserver, which the chart components (recharts) construct.
 * This stub lets them mount; they draw nothing without a layout engine.
 */
export function stubResizeObserver() {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.assign(globalThis, { ResizeObserver: ResizeObserverStub });
}

/**
 * The text of the stat tile a label sits in (the label's enclosing div, one level up). Throws a
 * readable error when the markup no longer has that shape, instead of a null dereference.
 */
export function tileText(label: string): string {
  const tile = screen.getByText(label).closest('div')?.parentElement;
  if (!tile) throw new Error('No stat tile found around "' + label + '"');
  return tile.textContent ?? '';
}
