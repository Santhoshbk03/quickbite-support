/**
 * The signed-in customer, persisted to localStorage.
 *
 * Sign-in is by email only. The email identifies the customer to the API (it is sent with every
 * request) but does not prove who they are, which suits a demo that the main QuickBite app links
 * into. docs/API.md describes how to move to a signed token.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Customer } from "@/lib/api/types";

interface SessionState {
  /** False until localStorage has been read. */
  hydrated: boolean;
  customer: Customer | null;
  setCustomer: (customer: Customer) => void;
  clear: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      hydrated: false,
      customer: null,
      setCustomer: (customer) => set({ customer }),
      clear: () => set({ customer: null }),
    }),
    {
      name: "quickbite.session",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ customer: state.customer }),
      onRehydrateStorage: () => () => useSession.setState({ hydrated: true }),
    },
  ),
);

export function rehydrateSession(): void {
  if (!useSession.getState().hydrated) void useSession.persist.rehydrate();
}

export function getCustomerEmail(): string | null {
  return useSession.getState().customer?.email ?? null;
}

export function signOut(): void {
  useSession.getState().clear();
}
