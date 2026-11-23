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
import { useState } from 'react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteErrorBoundary } from '../../components/RouteErrorBoundary';

function Bomb({ explode }: { explode: boolean }) {
  if (explode) {
    throw new TypeError("Cannot read properties of undefined (reading 'length')");
  }
  return <p>page content</p>;
}

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    // React logs every caught render error; keep the test output readable.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders its children when nothing throws', () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <Bomb explode={false} />
        </RouteErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByText('page content')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a fallback instead of a blank screen when a page throws, and leaves siblings alone', () => {
    render(
      <MemoryRouter>
        <nav>app shell</nav>
        <RouteErrorBoundary>
          <Bomb explode={true} />
        </RouteErrorBoundary>
      </MemoryRouter>
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('This page ran into a problem');
    // The thrown message and stack are not shown to the user.
    expect(alert.textContent).not.toContain('Cannot read properties');
    // The shell outside the boundary still renders.
    expect(screen.getByText('app shell')).toBeTruthy();
  });

  it('"Try again" re-renders the page', () => {
    function Harness() {
      const [explode, setExplode] = useState(true);
      return (
        <MemoryRouter>
          <button onClick={() => setExplode(false)}>fix the data</button>
          <RouteErrorBoundary>
            <Bomb explode={explode} />
          </RouteErrorBoundary>
        </MemoryRouter>
      );
    }
    render(<Harness />);
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByText('fix the data'));
    fireEvent.click(screen.getByText('Try again'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('page content')).toBeTruthy();
  });

  it('clears the error when the route changes', () => {
    render(
      <MemoryRouter initialEntries={['/broken']}>
        <Link to="/fine">go to fine page</Link>
        <Routes>
          <Route
            path="/broken"
            element={
              <RouteErrorBoundary>
                <Bomb explode={true} />
              </RouteErrorBoundary>
            }
          />
          <Route
            path="/fine"
            element={
              <RouteErrorBoundary>
                <Bomb explode={false} />
              </RouteErrorBoundary>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByText('go to fine page'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('page content')).toBeTruthy();
  });

  it('"Go to home" calls the navigateToHome shim', () => {
    const navigateToHome = vi.fn();
    window.navigateToHome = navigateToHome;
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <Bomb explode={true} />
        </RouteErrorBoundary>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('Go to home'));
    expect(navigateToHome).toHaveBeenCalledTimes(1);
    delete window.navigateToHome;
  });
});
