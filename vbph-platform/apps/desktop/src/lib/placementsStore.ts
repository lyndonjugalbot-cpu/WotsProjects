import { create } from "zustand";
import { timeApi, ApiError } from "./apiClient";
import { getLastPlacementId, setLastPlacementId } from "./localStore";
import type { VaPlacementSummary } from "./types";

interface PlacementsState {
  placements: VaPlacementSummary[];
  loading: boolean;
  error: string | null;
  selectedPlacementId: string | null;
  fetch: () => Promise<void>;
  select: (placementId: string) => Promise<void>;
  clearSelection: () => Promise<void>;
  /** Re-selects the last-used placement, but only if it's still ACTIVE — never trusts stale local state on its own. */
  restoreLastSelection: () => Promise<void>;
}

export const usePlacementsStore = create<PlacementsState>((set, get) => ({
  placements: [],
  loading: false,
  error: null,
  selectedPlacementId: null,

  async fetch() {
    set({ loading: true, error: null });
    try {
      const { placements } = await timeApi.activePlacements();
      set({ placements, loading: false });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't load your projects.";
      set({ loading: false, error: message });
    }
  },

  async select(placementId) {
    set({ selectedPlacementId: placementId });
    await setLastPlacementId(placementId);
  },

  async clearSelection() {
    set({ selectedPlacementId: null });
    await setLastPlacementId(null);
  },

  async restoreLastSelection() {
    const lastId = await getLastPlacementId();
    if (!lastId) return;
    const stillActive = get().placements.some((p) => p.id === lastId);
    if (stillActive) {
      set({ selectedPlacementId: lastId });
    } else {
      await setLastPlacementId(null);
    }
  },
}));
