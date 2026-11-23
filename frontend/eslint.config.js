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

// ESLint flat config. Replaces the CRA-era .eslintrc.js (react-app presets),
// which needed packages this app no longer installs. CommonJS on purpose:
// package.json has no "type": "module".
//
// Lint is blocking (QA-02): "npm run lint" runs eslint with --max-warnings 0 and the
// ui-ci.yml Lint step has no continue-on-error. Every rule below is an error, so a finding
// fails the build instead of piling up as a warning. An exception is an inline
// "eslint-disable-next-line <rule> -- <reason>" comment; an unused directive fails too.

const js = require('@eslint/js');
const { defineConfig, globalIgnores } = require('eslint/config');
const reactHooks = require('eslint-plugin-react-hooks');
const tseslint = require('typescript-eslint');

module.exports = defineConfig([
  globalIgnores(['build/**', 'dist/**', 'coverage/**', 'node_modules/**', 'src/ui/tailwind.config.js']),
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // The two classic hook rules only; the React Compiler rules in newer plugin
      // versions are not adopted here.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      // The single native confirmation lives in src/utils/confirm.ts, with a documented disable.
      'no-alert': 'error',
      'no-console': 'off',
    },
  },
  {
    // Subframe library code. "directory": "./src/ui" in .subframe/sync.json means `subframe sync`
    // regenerates these files, so a fix here is overwritten by the next sync and the finding comes
    // back. Every finding in them is one of two things the generator emits: `ref={ref as any}` and
    // an unused `import * as SubframeUtils`. Only those two rules are off, only here. The
    // hand-maintained layout src/ui/layouts/DefaultPageLayout.tsx is linted like the rest.
    files: ['src/ui/components/**/*.{ts,tsx}', 'src/ui/layouts/DialogLayout.tsx', 'src/ui/layouts/DrawerLayout.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]);
