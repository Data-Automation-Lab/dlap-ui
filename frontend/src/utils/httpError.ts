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
 * Reads the HTTP status and the server's message out of whatever a failed request threw.
 *
 * A catch clause receives unknown. The services answer errors as { message: string } with the
 * right status code, and axios attaches that as error.response, so the shape is checked here
 * once instead of with an any in every catch block. The check is structural, not
 * axios.isAxiosError: tests and mocks reject with plain { response: { status } } objects.
 */
interface HttpErrorShape {
  response?: {
    status?: unknown;
    data?: { message?: unknown } | null;
  };
}

const asHttpError = (error: unknown): HttpErrorShape =>
  typeof error === 'object' && error !== null ? (error as HttpErrorShape) : {};

/** The HTTP status of a failed request, or undefined when there was no response (network error). */
export const httpStatus = (error: unknown): number | undefined => {
  const status = asHttpError(error).response?.status;
  return typeof status === 'number' ? status : undefined;
};

/** The message the service put in the error body, or undefined when it sent none. */
export const serverMessage = (error: unknown): string | undefined => {
  const message = asHttpError(error).response?.data?.message;
  return typeof message === 'string' && message.length > 0 ? message : undefined;
};
