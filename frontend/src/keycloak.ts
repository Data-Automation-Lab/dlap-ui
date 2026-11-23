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

import Keycloak from 'keycloak-js';

// Keycloak configuration with environment variable support
// Port 8180 standardized across development and production environments
const keycloakConfig = {
  url: import.meta.env.REACT_APP_KEYCLOAK_URL || 'http://localhost:8180',
  realm: import.meta.env.REACT_APP_KEYCLOAK_REALM || 'dlap',
  clientId: import.meta.env.REACT_APP_KEYCLOAK_CLIENT_ID || 'dlap-ui',
};

console.log('🔐 Keycloak configuration:', keycloakConfig);

const keycloak = new Keycloak(keycloakConfig);

export default keycloak; 