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

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

// Smoke test for the frontend test harness itself: proves that Vitest can
// transform TSX, render a React component into jsdom, and query the DOM.
// This is what Gradle's :new-ui:frontendTest runs headlessly in CI via
// `npm run test:ci` (vitest run). Real component/page tests can be added
// alongside it as `*.test.tsx` files under src/.
function Banner() {
  return <h1>DLAP UI</h1>;
}

describe('frontend test harness (vitest + jsdom)', () => {
  it('renders a React component into the DOM', () => {
    render(<Banner />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('DLAP UI');
  });
});
