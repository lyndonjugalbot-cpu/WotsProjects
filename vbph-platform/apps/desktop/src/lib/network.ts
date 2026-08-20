import { create } from "zustand";

// Connectivity is tracked from two signals: the OS-reported
// navigator.onLine (fast, but only knows about the network interface —
// it can say "online" while the actual internet path is down) and
// real fetch outcomes from apiClient (authoritative — a network-layer
// fetch failure means we genuinely couldn't reach the server, a
// successful response means we genuinely could). apiClient reports
// through markOnline/markOffline below.
interface NetworkState {
  isOnline: boolean;
  setOnline: (online: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: typeof navigator === "undefined" ? true : navigator.onLine,
  setOnline: (online) => set({ isOnline: online }),
}));

if (typeof window !== "undefined") {
  window.addEventListener("online", () => useNetworkStore.getState().setOnline(true));
  window.addEventListener("offline", () => useNetworkStore.getState().setOnline(false));
}

export function markOnline(): void {
  if (!useNetworkStore.getState().isOnline) useNetworkStore.getState().setOnline(true);
}

export function markOffline(): void {
  if (useNetworkStore.getState().isOnline) useNetworkStore.getState().setOnline(false);
}
