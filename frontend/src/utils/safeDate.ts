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

import { formatDistanceToNow } from 'date-fns';

/**
 * Shared, single source of truth for rendering API-supplied timestamps.
 *
 * API data frequently carries null, empty, or malformed date strings. Passing
 * those straight into `new Date(...).toLocaleString()` yields the literal
 * "Invalid Date", and passing them into date-fns' `formatDistanceToNow` throws
 * - which can blank an entire table or chart. Every date rendered from API data
 * should go through these helpers instead of calling `new Date(...)` inline.
 */

/** Fallback shown for a missing or unparseable date. */
export const DATE_FALLBACK = '-';

/**
 * Parse an arbitrary value into a valid Date, or null.
 *
 * Returns null for null/undefined/empty input and for any value that does not
 * parse to a real date (NaN time). Never throws.
 */
export function safeDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const date =
    value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format a value as a locale date/time string.
 *
 * Mirrors the previous inline `new Date(value).toLocaleString()` /
 * `.toLocaleDateString(...)` call sites, but returns `fallback` instead of
 * "Invalid Date" when the value is missing or unparseable.
 *
 * @param value   the raw timestamp (ISO string, epoch ms, or Date)
 * @param options passed through to Intl.DateTimeFormat via toLocaleString
 * @param locales BCP-47 locale(s); omit for the runtime default
 * @param fallback string returned when the date is invalid (default "-")
 */
export function formatDate(
  value: unknown,
  options?: Intl.DateTimeFormatOptions,
  locales?: string | string[],
  fallback: string = DATE_FALLBACK
): string {
  const date = safeDate(value);
  if (!date) {
    return fallback;
  }
  return date.toLocaleString(locales, options);
}

/**
 * Format a value as a locale date only (no time component). Convenience wrapper
 * matching the previous `new Date(value).toLocaleDateString()` call sites.
 */
export function formatDateOnly(
  value: unknown,
  options?: Intl.DateTimeFormatOptions,
  locales?: string | string[],
  fallback: string = DATE_FALLBACK
): string {
  const date = safeDate(value);
  if (!date) {
    return fallback;
  }
  return date.toLocaleDateString(locales, options);
}

/**
 * Relative-time label, e.g. "5 minutes ago". Guards against invalid input,
 * which would otherwise cause date-fns to throw and blank the surrounding list.
 *
 * @param value    the raw timestamp
 * @param fallback string returned when the date is invalid (default "unknown")
 */
export function formatRelative(
  value: unknown,
  fallback: string = 'unknown'
): string {
  const date = safeDate(value);
  if (!date) {
    return fallback;
  }
  return `${formatDistanceToNow(date)} ago`;
}
