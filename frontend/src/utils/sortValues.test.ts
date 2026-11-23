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

import { describe, expect, it } from 'vitest';
import { compareSortValues } from './sortValues';

describe('compareSortValues', () => {
  it('orders strings ascending and descending', () => {
    const names = ['pear', 'apple', 'fig'];
    expect([...names].sort((a, b) => compareSortValues(a, b, 'asc'))).toEqual(['apple', 'fig', 'pear']);
    expect([...names].sort((a, b) => compareSortValues(a, b, 'desc'))).toEqual(['pear', 'fig', 'apple']);
  });

  it('orders numbers numerically, not as text', () => {
    const sizes = [10, 9, 100];
    expect([...sizes].sort((a, b) => compareSortValues(a, b, 'asc'))).toEqual([9, 10, 100]);
    expect([...sizes].sort((a, b) => compareSortValues(a, b, 'desc'))).toEqual([100, 10, 9]);
  });

  it('treats missing values and mixed types as equal', () => {
    expect(compareSortValues(undefined, 'a', 'asc')).toBe(0);
    expect(compareSortValues('a', 3, 'desc')).toBe(0);
    expect(compareSortValues(null, null, 'asc')).toBe(0);
  });

  it('never returns negative zero for equal values in descending order', () => {
    expect(Object.is(compareSortValues('a', 'a', 'desc'), 0)).toBe(true);
  });
});
