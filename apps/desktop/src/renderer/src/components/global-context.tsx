import { create } from "zustand";

// Define the User type based on the preload API
export interface User {
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  uid: string;
}

interface GlobalState {
  user: User | null;
  isLoading: boolean;
  platform: string;
  setUser: (user: User | null) => void;
  setPlatform: (platform: string) => void;
  initialize: () => Promise<void>;
  dispose: () => void;
}

let initialization: Promise<void> | null = null;
let unsubscribeAuth: (() => void) | null = null;
let generation = 0;
let authRevision = 0;

export const useGlobalStore = create<GlobalState>((set) => ({
  user: null,
  isLoading: true,
  platform: "",
  setUser: (user) => set({ user }),
  setPlatform: (platform) => set({ platform }),
  // Initialize the store immediately
  initialize: () => {
    if (initialization) return initialization;
    const currentGeneration = ++generation;
    const revision = authRevision;
    initialization = (async () => {
      try {
        // Listen for auth state changes
        unsubscribeAuth = window.api.onAuthStateChanged((displayName) => {
          if (currentGeneration !== generation) return;
          const currentRevision = ++authRevision;
          if (displayName === null) {
            set({ user: null, isLoading: false });
            return;
          }
          window.api
            .getCurrentUser()
            .then((currentUser) => {
              if (
                currentGeneration === generation &&
                currentRevision === authRevision
              ) {
                set({ user: currentUser, isLoading: false });
              }
            })
            .catch(() => {
              if (
                currentGeneration === generation &&
                currentRevision === authRevision
              ) {
                set({ user: null, isLoading: false });
              }
            });
        });

        const [currentUser, currentPlatform] = await Promise.all([
          window.api.getCurrentUser(),
          window.api.getPlatform(),
        ]);
        if (currentGeneration !== generation) return;
        set({
          platform: currentPlatform,
          isLoading: false,
          ...(revision === authRevision ? { user: currentUser } : {}),
        });
      } catch {
        if (currentGeneration === generation) set({ isLoading: false });
      }
    })();
    return initialization;
  },
  dispose: () => {
    generation++;
    authRevision++;
    unsubscribeAuth?.();
    unsubscribeAuth = null;
    initialization = null;
    set({ user: null, isLoading: true });
  },
}));
