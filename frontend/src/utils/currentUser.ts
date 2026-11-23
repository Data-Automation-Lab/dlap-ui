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

import { useEffect, useState } from 'react';
import keycloak from '../keycloak';

/**
 * The current authenticated user, derived entirely from the Keycloak token.
 * All fields fall back to safe empties when unauthenticated or when a claim is
 * absent — never fabricated. `roles` is the realm_access roles list.
 */
export interface CurrentUser {
  id: string;
  username: string;
  name: string;
  email: string;
  roles: string[];
}

const EMPTY_USER: CurrentUser = {
  id: '',
  username: '',
  name: '',
  email: '',
  roles: [],
};

/**
 * Read the current user from keycloak.tokenParsed. Returns empty fields when
 * the user is not authenticated or the token has not been parsed yet.
 *
 * Standard OIDC claims are used: `sub` (id), `preferred_username`, `name`
 * (falling back to given/family name), `email`, and `realm_access.roles`.
 */
export function getCurrentUser(): CurrentUser {
  if (!keycloak.authenticated || !keycloak.tokenParsed) {
    return EMPTY_USER;
  }

  const parsed = keycloak.tokenParsed as {
    sub?: string;
    preferred_username?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    email?: string;
    realm_access?: { roles?: string[] };
  };

  const derivedName =
    parsed.name ??
    [parsed.given_name, parsed.family_name].filter(Boolean).join(' ').trim();

  return {
    id: parsed.sub ?? '',
    username: parsed.preferred_username ?? '',
    name: derivedName || parsed.preferred_username || '',
    email: parsed.email ?? '',
    roles: parsed.realm_access?.roles ?? [],
  };
}

/**
 * React hook wrapper around getCurrentUser(). Recomputes when authentication
 * state changes: it hooks Keycloak's onAuthSuccess / onAuthRefreshSuccess /
 * onAuthLogout callbacks (without clobbering any already-registered handlers)
 * so components re-render with the fresh identity after login or token refresh.
 */
export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<CurrentUser>(() => getCurrentUser());

  useEffect(() => {
    const refresh = () => setUser(getCurrentUser());

    // Chain onto any existing handlers rather than overwriting them.
    const prevSuccess = keycloak.onAuthSuccess;
    const prevRefresh = keycloak.onAuthRefreshSuccess;
    const prevLogout = keycloak.onAuthLogout;

    keycloak.onAuthSuccess = () => {
      prevSuccess?.();
      refresh();
    };
    keycloak.onAuthRefreshSuccess = () => {
      prevRefresh?.();
      refresh();
    };
    keycloak.onAuthLogout = () => {
      prevLogout?.();
      refresh();
    };

    // Sync once in case auth state settled before this effect ran.
    refresh();

    return () => {
      keycloak.onAuthSuccess = prevSuccess;
      keycloak.onAuthRefreshSuccess = prevRefresh;
      keycloak.onAuthLogout = prevLogout;
    };
  }, []);

  return user;
}

export default getCurrentUser;
