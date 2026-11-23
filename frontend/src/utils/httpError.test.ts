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
import { httpStatus, serverMessage } from './httpError';

describe('httpStatus', () => {
  it('reads the status of an error with a response', () => {
    expect(httpStatus({ response: { status: 403 } })).toBe(403);
  });

  it('is undefined when the request got no response', () => {
    expect(httpStatus(new Error('Network Error'))).toBeUndefined();
  });

  it('is undefined for values that are not errors', () => {
    expect(httpStatus(undefined)).toBeUndefined();
    expect(httpStatus(null)).toBeUndefined();
    expect(httpStatus('boom')).toBeUndefined();
  });

  it('ignores a status that is not a number', () => {
    expect(httpStatus({ response: { status: '404' } })).toBeUndefined();
  });
});

describe('serverMessage', () => {
  it('returns the message of the error body', () => {
    expect(serverMessage({ response: { status: 400, data: { message: 'rule is empty' } } })).toBe('rule is empty');
  });

  it('is undefined when the body has no message', () => {
    expect(serverMessage({ response: { status: 500, data: {} } })).toBeUndefined();
    expect(serverMessage({ response: { status: 500, data: null } })).toBeUndefined();
    expect(serverMessage({ response: { status: 500 } })).toBeUndefined();
  });

  it('is undefined for an empty or non-string message, so the caller falls back', () => {
    expect(serverMessage({ response: { data: { message: '' } } })).toBeUndefined();
    expect(serverMessage({ response: { data: { message: 42 } } })).toBeUndefined();
  });

  it('is undefined for a plain Error and for non-objects', () => {
    expect(serverMessage(new Error('x'))).toBeUndefined();
    expect(serverMessage(undefined)).toBeUndefined();
    expect(serverMessage('boom')).toBeUndefined();
  });
});
