/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_MICROSOFT_CLIENT_ID?: string
  readonly VITE_MICROSOFT_TENANT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
