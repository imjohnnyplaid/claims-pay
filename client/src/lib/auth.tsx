import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, Provider, Bank, Permission } from "@shared/schema";

type AuthContextType = {
  user: User | null;
  provider: Provider | null;
  bank: Bank | null;
  permissions: Permission[];
  impersonating: boolean;
  impersonateId: string | null;
  impersonatedRole: string | null;
  entityName: string | null;
  hasPermission: (action: string, resource: string) => boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [bank, setBank] = useState<Bank | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [impersonating, setImpersonating] = useState<boolean>(false);
  const [impersonateId, setImpersonateId] = useState<string | null>(null);
  const [impersonatedRole, setImpersonatedRole] = useState<string | null>(null);
  const [entityName, setEntityName] = useState<string | null>(null);

  const { data: authData, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  useEffect(() => {
    if (authData && typeof authData === 'object' && 'user' in authData) {
      const data = authData as any;
      setUser(data.user);
      setProvider(data.provider || null);
      setBank(data.bank || null);
      setPermissions(data.permissions || []);
      setImpersonating(data.impersonating || false);
      setImpersonateId(data.impersonateId || null);
      setImpersonatedRole(data.impersonatedRole || null);
      setEntityName(data.entityName || null);
    }
  }, [authData]);

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", { username, password });
      return res.json();
    },
    onSuccess: (data) => {
      setUser(data.user);
      setProvider(data.provider || null);
      setBank(data.bank || null);
      setPermissions(data.permissions || []);
      setImpersonating(data.impersonating || false);
      setImpersonateId(data.impersonateId || null);
      setImpersonatedRole(data.impersonatedRole || null);
      setEntityName(data.entityName || null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ username, password, email, role }: { username: string; password: string; email: string; role: string }) => {
      const res = await apiRequest("POST", "/api/auth/register", { username, password, email, role });
      return res.json();
    },
    onSuccess: (data) => {
      setUser(data.user);
      setProvider(data.provider || null);
      setBank(data.bank || null);
      setPermissions(data.permissions || []);
      setImpersonating(data.impersonating || false);
      setImpersonateId(data.impersonateId || null);
      setImpersonatedRole(data.impersonatedRole || null);
      setEntityName(data.entityName || null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout", {});
    },
    onSuccess: () => {
      setUser(null);
      setProvider(null);
      setBank(null);
      setPermissions([]);
      setImpersonating(false);
      setImpersonateId(null);
      setImpersonatedRole(null);
      setEntityName(null);
      queryClient.clear();
      // Force full page reload to landing page to ensure clean state
      window.location.href = "/";
    },
  });

  const login = async (username: string, password: string) => {
    await loginMutation.mutateAsync({ username, password });
  };

  const register = async (username: string, password: string, email: string, role: string) => {
    await registerMutation.mutateAsync({ username, password, email, role });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const hasPermission = (action: string, resource: string) => {
    const permissionName = `${action}:${resource}`;
    return permissions.some((p) => p.name.startsWith(permissionName));
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      provider, 
      bank, 
      permissions, 
      impersonating, 
      impersonateId, 
      impersonatedRole, 
      entityName, 
      hasPermission, 
      login, 
      register, 
      logout, 
      isLoading 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
