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

import axios, { type AxiosError, type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import keycloak from '../keycloak';

// API Base URLs for different microservices
const API_BASE_URL = import.meta.env.REACT_APP_API_BASE_URL || 'http://localhost:8081';
const CATALOG_API_URL = `${API_BASE_URL}/api/v1/catalog`;
const POLICYENGINE_API_URL = `${API_BASE_URL}/api/v1/policyengine`;
const REPORTING_API_URL = `${API_BASE_URL}/api/v1/reporting`;
const DISCOVERY_API_URL = `${API_BASE_URL}/api/v1/discovery`;
const LABELING_API_URL = `${API_BASE_URL}/api/v1/labeling`;
const ARCHIVAL_API_URL = `${API_BASE_URL}/api/v1/archival`;
const DELETION_API_URL = `${API_BASE_URL}/api/v1/deletion`;
const AUTODELETE_API_URL = `${API_BASE_URL}/api/v1/autodelete`;
const COMPLIANCE_API_URL = `${API_BASE_URL}/api/v1/compliance`;
const ADMIN_API_URL = `${API_BASE_URL}/api/v1/admin`;
const LABEL_AGENT_API_URL = `${API_BASE_URL}/api/v1/label-agent`;
const DELETE_AGENT_API_URL = `${API_BASE_URL}/api/v1/delete-agent`;

// Development feature flags
const ENABLE_MOCK_DATA = import.meta.env.REACT_APP_ENABLE_MOCK_DATA === 'true';
const ENABLE_DEBUG_LOGS = import.meta.env.REACT_APP_ENABLE_DEBUG_LOGS === 'true';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: parseInt(import.meta.env.REACT_APP_API_TIMEOUT || '10000'),
});

// Request interceptor to add the Keycloak token to the Authorization header
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (ENABLE_DEBUG_LOGS) {
      console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    }
    
    if (keycloak.authenticated && keycloak.token) {
      try {
        // Ensure token is up-to-date before making the request
        const refreshed = await keycloak.updateToken(5); // Update if less than 5s validity
        if (refreshed && ENABLE_DEBUG_LOGS) {
          console.log('🔐 Token was refreshed prior to API call.');
        }
        config.headers.Authorization = `Bearer ${keycloak.token}`;
      } catch (error) {
        console.error('❌ Failed to refresh token or attach it to request:', error);
        // Optionally, you could redirect to login or show an error
        // For now, let the request proceed without the token if refresh fails catastrophically
        // or handle it based on your app's error handling strategy
      }
    }
    return config;
  },
  (error) => {
    console.error('❌ API Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for global error handling
apiClient.interceptors.response.use(
  response => {
    if (ENABLE_DEBUG_LOGS) {
      console.log(`✅ API Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
    }
    return response;
  },
  error => {
    const isNetworkError = !error.response;
    const isAuthError = error.response && error.response.status === 401;
    
    if (ENABLE_DEBUG_LOGS) {
      console.error(`❌ API Error: ${error.response?.status || 'NETWORK'} ${error.config?.method?.toUpperCase()} ${error.config?.url}`, error.message);
    }
    
    if (isNetworkError && ENABLE_MOCK_DATA) {
      console.warn('🔄 Network error detected, but mock data is enabled for development');
    } else if (isAuthError) {
      // Handle unauthorized errors, e.g., redirect to login
      console.error('🚨 Unauthorized request, redirecting to login.');
      keycloak.login();
    }
    return Promise.reject(error);
  }
);

// Service-specific API clients
export const catalogApi = axios.create({ 
  baseURL: CATALOG_API_URL,
  timeout: parseInt(import.meta.env.REACT_APP_API_TIMEOUT || '10000'),
});
export const policyengineApi = axios.create({ 
  baseURL: POLICYENGINE_API_URL,
  timeout: parseInt(import.meta.env.REACT_APP_API_TIMEOUT || '10000'),
});
export const reportingApi = axios.create({ 
  baseURL: REPORTING_API_URL,
  timeout: parseInt(import.meta.env.REACT_APP_API_TIMEOUT || '10000'),
});
export const discoveryApi = axios.create({ 
  baseURL: DISCOVERY_API_URL,
  timeout: parseInt(import.meta.env.REACT_APP_API_TIMEOUT || '10000'),
});
export const labelingApi = axios.create({ 
  baseURL: LABELING_API_URL,
  timeout: parseInt(import.meta.env.REACT_APP_API_TIMEOUT || '10000'),
});
export const archivalApi = axios.create({ 
  baseURL: ARCHIVAL_API_URL,
  timeout: parseInt(import.meta.env.REACT_APP_API_TIMEOUT || '10000'),
});
export const deletionApi = axios.create({ 
  baseURL: DELETION_API_URL,
  timeout: parseInt(import.meta.env.REACT_APP_API_TIMEOUT || '10000'),
});
/**
 * Client for the restore and would-delete endpoints of da-autodelete, which the gateway serves at
 * /api/v1/autodelete. The task list and the config are served at /api/v1/deletion and use deletionApi.
 */
export const autodeleteApi = axios.create({
  baseURL: AUTODELETE_API_URL,
  timeout: parseInt(import.meta.env.REACT_APP_API_TIMEOUT || '10000'),
});
export const complianceApi = axios.create({ 
  baseURL: COMPLIANCE_API_URL,
  timeout: parseInt(import.meta.env.REACT_APP_API_TIMEOUT || '10000'),
});
export const adminApi = axios.create({
  baseURL: ADMIN_API_URL,
  timeout: parseInt(import.meta.env.REACT_APP_API_TIMEOUT || '10000'),
});
export const labelAgentApi = axios.create({
  baseURL: LABEL_AGENT_API_URL,
  timeout: parseInt(import.meta.env.REACT_APP_API_TIMEOUT || '10000'),
});
export const deleteAgentApi = axios.create({
  baseURL: DELETE_AGENT_API_URL,
  timeout: parseInt(import.meta.env.REACT_APP_API_TIMEOUT || '10000'),
});

// Apply the same interceptors to all service-specific clients
const applyInterceptors = (client: AxiosInstance) => {
  // Request interceptor for authentication and logging
  client.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      // Add JWT token from Keycloak if available
      if (keycloak.authenticated && keycloak.token) {
        try {
          const refreshed = await keycloak.updateToken(5);
          if (refreshed && ENABLE_DEBUG_LOGS) {
            console.log('🔐 Token was refreshed prior to service API call.');
          }
          config.headers.Authorization = `Bearer ${keycloak.token}`;
        } catch (error) {
          console.error('❌ Failed to refresh token or attach it to service request:', error);
        }
      }

      if (ENABLE_DEBUG_LOGS) {
        console.log(`🚀 Service API Request: ${config.method?.toUpperCase()} ${config.url}`);
      }

      return config;
    },
    (error: unknown) => {
      console.error('❌ Service API Request interceptor error:', error);
      return Promise.reject(error);
    }
  );

  client.interceptors.response.use(
    (response: AxiosResponse) => {
      if (ENABLE_DEBUG_LOGS) {
        console.log(`✅ Service API Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
      }

      return response;
    },
    (error: AxiosError) => {
      const isNetworkError = !error.response;
      const isAuthError = error.response && error.response.status === 401;
      
      if (ENABLE_DEBUG_LOGS) {
        console.error(`❌ Service API Error: ${error.response?.status || 'Network'} ${error.config?.method?.toUpperCase()} ${error.config?.url}`, error.message);
      }

      // Handle authentication errors
      if (isAuthError) {
        console.warn('🔒 Authentication error - redirecting to login');
        keycloak.login();
      }

      // Handle network errors
      if (isNetworkError && ENABLE_MOCK_DATA) {
        console.warn('🌐 Network error - falling back to mock data where available');
      }

      return Promise.reject(error);
    }
  );
};

// Apply interceptors to all service clients
[catalogApi, policyengineApi, reportingApi, discoveryApi, labelingApi,
 archivalApi, deletionApi, autodeleteApi, complianceApi, adminApi,
 labelAgentApi, deleteAgentApi].forEach(applyInterceptors);

// Export configuration for use in services
export { ENABLE_DEBUG_LOGS, ENABLE_MOCK_DATA };

export default apiClient; 