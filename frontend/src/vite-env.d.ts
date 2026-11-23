/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly REACT_APP_API_BASE_URL: string | undefined;
  readonly REACT_APP_API_TIMEOUT: string | undefined;
  readonly REACT_APP_KEYCLOAK_URL: string | undefined;
  readonly REACT_APP_KEYCLOAK_REALM: string | undefined;
  readonly REACT_APP_KEYCLOAK_CLIENT_ID: string | undefined;
  readonly REACT_APP_ENABLE_MOCK_DATA: string | undefined;
  readonly REACT_APP_ENABLE_DEBUG_LOGS: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
