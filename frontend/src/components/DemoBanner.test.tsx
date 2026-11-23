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
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEMO_BANNER_TEXT,
  DemoBanner,
  DemoBannerFrame,
  DemoPageUnavailable,
} from './DemoBanner';

describe('DemoBanner', () => {
  it('shows the required notice word for word', () => {
    render(<DemoBanner />);
    expect(DEMO_BANNER_TEXT).toBe(
      'Demo on synthetic data. No cloud account connected. Not production.'
    );
    const banner = screen.getByTestId('demo-banner');
    expect(banner.textContent).toBe(DEMO_BANNER_TEXT);
  });

  it('is exposed to assistive technology as a labelled note', () => {
    render(<DemoBanner />);
    expect(screen.getByRole('note', { name: 'Demo notice' })).toBeTruthy();
  });
});

describe('DemoPageUnavailable', () => {
  it('explains the page is not part of the demo and offers the start page', () => {
    const onGoHome = vi.fn();
    render(<DemoPageUnavailable onGoHome={onGoHome} />);
    expect(screen.getByText('This page is not part of the demo')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Go to the demo start page' })
    );
    expect(onGoHome).toHaveBeenCalledTimes(1);
  });
});

describe('DemoBannerFrame', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('puts the banner above a page that has no layout in a demo build', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');
    const { container } = render(
      <DemoBannerFrame>
        <div data-testid="sign-in">sign in</div>
      </DemoBannerFrame>
    );

    const banner = screen.getByTestId('demo-banner');
    expect(banner.textContent).toBe(DEMO_BANNER_TEXT);
    expect(container.firstElementChild?.firstElementChild).toBe(banner);
    expect(screen.getByTestId('sign-in')).toBeTruthy();
  });

  it('returns the children untouched when the demo flag is off', () => {
    vi.stubEnv('VITE_DEMO_MODE', '');
    const { container } = render(
      <DemoBannerFrame>
        <div data-testid="sign-in">sign in</div>
      </DemoBannerFrame>
    );

    expect(screen.queryByTestId('demo-banner')).toBeNull();
    expect((container.firstElementChild as HTMLElement).dataset.testid).toBe(
      'sign-in'
    );
  });
});
