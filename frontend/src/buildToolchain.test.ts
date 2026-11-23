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

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Q-545: the Gradle build (frontendTest in the sdg repository) and the UI workflow once ran different
// Node releases (22.12.0 and "latest 22.x"). The jsdom/Web Crypto failure that came out of it showed
// only on the older one. This test keeps one release in both places: the node plugin in build.gradle
// and the node-version of the typecheck, test and build job. It reads the two files from the checkout
// (vitest runs in frontend/), so a bump in one file without the other fails the suite on both sides.

const repoFile = (...parts: string[]): string => readFileSync(resolve(process.cwd(), '..', ...parts), 'utf8');

const EXACT_RELEASE = /^22\.\d+\.\d+$/;

function gradleNodeVersion(): string {
  const block = /node\s*\{([^}]*)\}/.exec(repoFile('build.gradle'));
  const version = block && /^\s*version\s*=\s*'([^']+)'/m.exec(block[1]);
  if (!version) {
    throw new Error('build.gradle has no node { version = ... } line');
  }
  return version[1];
}

function nodeVersionsIn(text: string): string[] {
  return [...text.matchAll(/^\s*node-version:\s*'?([^'\s#]+)'?/gm)].map((m) => m[1]);
}

function workflowNodeVersions(): string[] {
  return nodeVersionsIn(repoFile('.github', 'workflows', 'ui-ci.yml'));
}

describe('Node release of the build', () => {
  it('Gradle pins one exact 22.x release', () => {
    expect(gradleNodeVersion()).toMatch(EXACT_RELEASE);
  });

  it('the UI workflow pins exactly the release that Gradle downloads', () => {
    const pins = workflowNodeVersions();
    expect(pins.length).toBeGreaterThan(0);
    for (const pin of pins) {
      expect(pin).toBe(gradleNodeVersion());
    }
  });

  it('a floating pin such as 22 is not an exact release', () => {
    const pins = nodeVersionsIn("      node-version: '22'\n");
    expect(pins).toEqual(['22']);
    expect(pins[0]).not.toMatch(EXACT_RELEASE);
  });
});
