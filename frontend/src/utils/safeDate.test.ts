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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DATE_FALLBACK, formatDate, formatDateOnly, formatRelative, safeDate } from './safeDate';

describe('safeDate', () => {
  it('returns null for missing or unparseable input', () => {
    expect(safeDate(null)).toBeNull();
    expect(safeDate(undefined)).toBeNull();
    expect(safeDate('')).toBeNull();
    expect(safeDate('not-a-date')).toBeNull();
    expect(safeDate(new Date('garbage'))).toBeNull();
  });

  it('parses ISO strings, epoch millis and Date instances', () => {
    const iso = '2026-10-18T12:00:00Z';
    const ms = Date.parse(iso);
    expect(safeDate(iso)?.getTime()).toBe(ms);
    expect(safeDate(ms)?.getTime()).toBe(ms);
    const d = new Date(ms);
    expect(safeDate(d)).toBe(d);
  });
});

describe('DATE_FALLBACK', () => {
  it('is a plain hyphen and never an em-dash or en-dash (decision D13)', () => {
    expect(DATE_FALLBACK).toBe('-');
    expect(DATE_FALLBACK).not.toMatch(/[\u2013\u2014]/);
  });

  it('is what a missing date renders as by default', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDateOnly('')).toBe('-');
    expect(formatDate(undefined)).toBe('-');
  });
});

describe('formatDate / formatDateOnly', () => {
  it('return the fallback instead of "Invalid Date"', () => {
    expect(formatDate('bogus')).toBe(DATE_FALLBACK);
    expect(formatDateOnly(null)).toBe(DATE_FALLBACK);
    // DiscoveryAgentOverview passes '' so a bad trend date leaves an empty axis label.
    expect(formatDateOnly(undefined, { month: '2-digit', day: '2-digit' }, 'en-US', '')).toBe('');
  });

  it('format a valid value with the given options', () => {
    const value = '2026-10-18T12:00:00Z';
    const opts: Intl.DateTimeFormatOptions = { month: '2-digit', day: '2-digit', timeZone: 'UTC' };
    expect(formatDateOnly(value, opts, 'en-US')).toBe('10/18');
    expect(formatDate(value, opts, 'en-US')).toBe(new Date(value).toLocaleString('en-US', opts));
  });
});

describe('formatRelative (EventCenter / EventSubscriptions timestamps)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "unknown" for missing or invalid timestamps instead of throwing', () => {
    expect(formatRelative(null)).toBe('unknown');
    expect(formatRelative('')).toBe('unknown');
    expect(formatRelative('not-a-date')).toBe('unknown');
    expect(formatRelative(undefined, 'n/a')).toBe('n/a');
  });

  it('renders a relative label with an "ago" suffix', () => {
    expect(formatRelative('2026-10-18T11:55:00Z')).toBe('5 minutes ago');
  });
});
