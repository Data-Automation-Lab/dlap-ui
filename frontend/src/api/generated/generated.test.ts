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

import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  DeletionTaskListResponse,
  DeletionTaskStatusDTO,
  operations as AutodeleteOperations,
  paths as AutodeletePaths,
  RestoreRequest,
} from './autodelete';
import type { AssetOutputDTO, operations as CatalogOperations, paths as CatalogPaths } from './catalog';
import type { paths as PolicyEnginePaths } from './policyengine';
import type { ActionItemsDTO, paths as ReportingPaths } from './reporting';

// Type-level checks on the types generated from docs/api/openapi (API-01). The assertions below
// are enforced by `npm run typecheck` (tsc includes this file); vitest only runs the trivial
// runtime lines. When a backend contract change breaks one of them, the UI code that uses the
// changed endpoint is the code to review: regenerate with `npm run gen:api` and fix the callers.
describe('generated API types', () => {
  it('catalog: an asset carries its id and URI as strings', () => {
    expectTypeOf<AssetOutputDTO['assetId']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<AssetOutputDTO['assetUri']>().toEqualTypeOf<string | undefined>();
    expect(true).toBe(true);
  });

  it('catalog: fetching an asset takes an asset id path parameter and returns an asset', () => {
    type GetAsset = CatalogOperations['getAssetById'];
    expectTypeOf<GetAsset['parameters']['path']['assetId']>().toEqualTypeOf<string>();
    expectTypeOf<GetAsset['responses'][200]['content']['*/*']>().toEqualTypeOf<AssetOutputDTO>();
    expectTypeOf<CatalogPaths['/api/v1/catalog/assets']>().toHaveProperty('get');
    expect(true).toBe(true);
  });

  it('reporting: the CDO action-items dashboard is a GET that returns ActionItemsDTO', () => {
    type Dashboard = ReportingPaths['/api/v1/reporting/dashboards/cdo/action-items']['get'];
    expectTypeOf<Dashboard>().not.toBeNever();
    expectTypeOf<ActionItemsDTO>().toBeObject();
    expect(true).toBe(true);
  });

  it('policyengine: the AuthZEN evaluation endpoint is a POST', () => {
    expectTypeOf<PolicyEnginePaths['/access/v1/evaluation']>().toHaveProperty('post');
    expect(true).toBe(true);
  });

  it('autodelete: the task list holds task status records whose ids, names and statuses are strings', () => {
    expectTypeOf<DeletionTaskListResponse['tasks']>().toEqualTypeOf<DeletionTaskStatusDTO[] | undefined>();
    expectTypeOf<DeletionTaskStatusDTO['taskId']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<DeletionTaskStatusDTO['taskName']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<DeletionTaskStatusDTO['status']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<DeletionTaskStatusDTO['ruleAgeDays']>().toEqualTypeOf<number | null | undefined>();
    expect(true).toBe(true);
  });

  it('autodelete: a restore is a POST that takes a record id and a note', () => {
    expectTypeOf<AutodeletePaths['/api/v1/autodelete/restores/{softDeleteRecordId}']>().toHaveProperty('post');
    expectTypeOf<AutodeleteOperations['restore']['parameters']['path']['softDeleteRecordId']>().toEqualTypeOf<string>();
    expectTypeOf<RestoreRequest['notes']>().toEqualTypeOf<string | undefined>();
    expect(true).toBe(true);
  });
});
