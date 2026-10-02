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

export async function validateStoredAccess(_force = false): Promise<AccessValidationResult> {
  const state = await ensureAuthStoreHydrated();
  const { data: identity, error: authError } = await supabase.auth.getUser();
  if (authError || !identity.user) {
    state.logout();
    return { account: null, authorized: false, reason: "NO_SESSION" };
  }
  const { data, error } = await supabase
    .from("users")
    .select("id,nome,email,role,status,avatar_url,created_at")
    .eq("auth_user_id", identity.user.id)
    .maybeSingle();
  if (error) return { account: null, authorized: false, reason: "CONNECTION_ERROR" };
  if (!data) {
    state.logout();
    return { account: null, authorized: false, reason: "REMOVED" };
  }
  const account: User = {
    ...data,
    status: data.status as UserStatus,
    avatar_url: data.avatar_url || undefined,
    created_at: data.created_at || new Date().toISOString(),
  };
  if (account.status !== "ATIVO") {
    state.logout();
    return {
      account,
      authorized: false,
      reason: account.status === "BLOQUEADO" ? "BLOCKED" : "PENDING",
    };
  }
  state.setUser(account);
  state.setRole(account.role);
  return { account, authorized: true, reason: "AUTHORIZED" };
}
