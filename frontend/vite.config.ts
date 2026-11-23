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

/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Vite configuration for the DLAP UI.
//
// Migrated from Create React App (react-scripts 5.0.1). Key constraints:
//   - build.outDir must remain 'build' so the Docker image + Spring static
//     server keep serving the same directory (the Dockerfile is unchanged).
//   - envPrefix keeps the existing REACT_APP_* variables working via
//     import.meta.env, so no env var had to be renamed to VITE_*.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
  },
  preview: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
  },
  envPrefix: ['VITE_', 'REACT_APP_'],
  resolve: {
    alias: {
      '@/ui': path.resolve(__dirname, 'src/ui'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // Headless test runner (Vitest). Replaces the CRA/react-scripts (jest)
  // setup removed during the Vite migration; `npm run test:ci` -> `vitest run`
  // is what Gradle's :new-ui:frontendTest task invokes.
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
