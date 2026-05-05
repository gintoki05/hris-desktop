/// <reference types="vite/client" />

type TauriInternals = {
  invoke: unknown;
};

interface Window {
  __TAURI_INTERNALS__?: TauriInternals;
}
