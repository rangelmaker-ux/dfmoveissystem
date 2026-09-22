import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UserRole, User, UserStatus } from "@/types/database";
import { supabase } from "@/integrations/supabase/client";

interface AuthState {
  hydrated: boolean;
  user: User | null;
  role: UserRole;
  setHydrated: (hydrated: boolean) => void;
  setRole: (role: UserRole) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      hydrated: false,
      user: null,
      role: "PROJETISTA",
      setHydrated: (hydrated) => set({ hydrated }),
      setRole: (role) => set({ role }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, role: "PROJETISTA" }),
    }),
    {
      name: "df-auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, role: state.role }),
      onRehydrateStorage: () => (state, error) => {
        if (!error) {
          state?.setHydrated(true);
        }
      },
    },
  ),
);

export async function ensureAuthStoreHydrated() {
  if (typeof window === "undefined") {
    return useAuthStore.getState();
  }

  if (!useAuthStore.persist.hasHydrated()) {
    await useAuthStore.persist.rehydrate();
  }

  return useAuthStore.getState();
}

export type AccessValidationReason =
  "AUTHORIZED" | "NO_SESSION" | "PENDING" | "BLOCKED" | "REMOVED" | "CONNECTION_ERROR";

export interface AccessValidationResult {
  account: User | null;
  authorized: boolean;
  reason: AccessValidationReason;
}

let lastValidatedTime = 0;
let lastValidationResult: AccessValidationResult | null = null;

export async function validateStoredAccess(force = false): Promise<AccessValidationResult> {
  const state = await ensureAuthStoreHydrated();
  if (!state.user?.id) {
    lastValidationResult = null;
    return { account: null, authorized: false, reason: "NO_SESSION" };
  }

  const now = Date.now();
  if (!force && lastValidationResult && now - lastValidatedTime < 30_000) {
    return lastValidationResult;
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, nome, email, role, status, avatar_url, created_at")
    .eq("id", state.user.id)
    .maybeSingle();

  if (error) {
    if (lastValidationResult?.authorized) {
      return lastValidationResult;
    }
    state.logout();
    return { account: null, authorized: false, reason: "CONNECTION_ERROR" };
  }

  if (!data) {
    state.logout();
    lastValidationResult = null;
    return { account: null, authorized: false, reason: "REMOVED" };
  }

  const account: User = {
    id: data.id,
    nome: data.nome,
    email: data.email,
    role: data.role,
    status: data.status as UserStatus,
    avatar_url: data.avatar_url ?? undefined,
    created_at: data.created_at ?? new Date().toISOString(),
  };

  if (account.status !== "ATIVO") {
    state.logout();
    lastValidationResult = null;
    return {
      account,
      authorized: false,
      reason: account.status === "BLOQUEADO" ? "BLOCKED" : "PENDING",
    };
  }

  state.setUser(account);
  state.setRole(account.role);
  lastValidatedTime = now;
  lastValidationResult = { account, authorized: true, reason: "AUTHORIZED" };
  return lastValidationResult;
}
