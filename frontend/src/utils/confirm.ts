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

/**
 * Asks the user to confirm a destructive action (deleting a policy, a subscription or a user).
 * This is the one place that calls the browser's native confirmation, so the lint rule against
 * alert, confirm and prompt has a single, documented exception. Returns true when the user agrees.
 */
export const confirmAction = (message: string): boolean => {
  // eslint-disable-next-line no-alert -- the single sanctioned native confirmation, see above
  return window.confirm(message);
};
