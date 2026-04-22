import { create } from "zustand";

// Define the User type based on the preload API
export interface User {
  email: string | null;
  displayName: string | null;
  uid: string;
}

interface GlobalState {
  user: User | null;
  isLoading: boolean;
  platform: string;
  setUser: (user: User | null) => void;
  setPlatform: (platform: string) => void;
  initialize: () => Promise<void>;
}

export const useGlobalStore = create<GlobalState>((set) => ({
  user: null,
  isLoading: true,
  platform: "",
  setUser: (user) => set({ user }),
  setPlatform: (platform) => set({ platform }),
  initialize: async () => {
    try {
      // Listen for auth state changes
      window.api.onAuthStateChanged(async () => {
        const currentUser = await window.api.getCurrentUser();
        set({ user: currentUser });
      });

      const [currentUser, currentPlatform] = await Promise.all([
        window.api.getCurrentUser(),
        window.api.getPlatform(),
      ]);
      set({ user: currentUser, platform: currentPlatform, isLoading: false });
    } catch (error) {
      console.error("Failed to initialize global state:", error);
      set({ isLoading: false });
    }
  },
}));

// Initialize the store immediately
useGlobalStore.getState().initialize();
