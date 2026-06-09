import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  position: string | null;
  avatar: string | null;
  subscriptionStart: string | null;
}

async function fetchSession(): Promise<SessionUser | null> {
  const response = await fetch("/api/me", { credentials: "include" });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.user as SessionUser;
}

async function logoutRequest(): Promise<void> {
  await fetch("/api/logout", { method: "POST", credentials: "include" });
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<SessionUser | null>({
    queryKey: ["/api/me"],
    queryFn: fetchSession,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const logoutMutation = useMutation({
    mutationFn: logoutRequest,
    onSuccess: () => {
      queryClient.setQueryData(["/api/me"], null);
      queryClient.clear();
    },
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
