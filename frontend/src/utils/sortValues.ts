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

/** Sort direction of a table column. */
export type SortDirection = 'asc' | 'desc';

/**
 * Orders two cell values of one column. Strings compare with localeCompare, numbers numerically;
 * anything else (missing values, mixed types) compares equal, so the sort is stable and never
 * throws on a half-filled row. Used by the Data Catalog list.
 */
export const compareSortValues = (a: unknown, b: unknown, direction: SortDirection): number => {
  let result = 0;
  if (typeof a === 'string' && typeof b === 'string') {
    result = a.localeCompare(b);
  } else if (typeof a === 'number' && typeof b === 'number') {
    result = a - b;
  }
  if (result === 0) return 0;
  return direction === 'asc' ? result : -result;
};
