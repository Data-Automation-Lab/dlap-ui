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

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ROUTES, type RouteKey, useAppNavigate } from './useAppNavigate';
// Vite ?raw import: App.tsx source as a string, independent of the test environment.
import appSource from '../App.tsx?raw';

function NavProbe({ route }: { route: RouteKey }) {
  const nav = useAppNavigate();
  const location = useLocation();
  return (
    <div>
      <button onClick={() => nav.go(route)}>go</button>
      <span data-testid="path">{location.pathname}</span>
    </div>
  );
}

describe('useAppNavigate', () => {
  it('go(routeKey) navigates to the canonical path', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <NavProbe route="eventCenter" />
      </MemoryRouter>
    );
    expect(screen.getByTestId('path').textContent).toBe('/home');
    fireEvent.click(screen.getByRole('button', { name: 'go' }));
    expect(screen.getByTestId('path').textContent).toBe(ROUTES.eventCenter);
  });

  it('go("approvals") opens the approval inbox from the shared table', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <NavProbe route="approvals" />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'go' }));
    expect(screen.getByTestId('path').textContent).toBe('/approvals');
    expect(ROUTES.approvals).toBe('/approvals');
  });

  it('every ROUTES path is declared as a <Route path> in App.tsx', () => {
    // The sidebar (DefaultPageLayout) navigates through ROUTES; a key whose path
    // has no matching <Route> would silently land on a blank page.
    const declared = new Set<string>();
    const routePath = /<Route\s+path="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = routePath.exec(appSource)) !== null) {
      declared.add(m[1]);
    }
    const missing = Object.entries(ROUTES)
      .filter(([, path]) => !declared.has(path))
      .map(([key, path]) => `${key} -> ${path}`);
    expect(missing).toEqual([]);
  });
});
