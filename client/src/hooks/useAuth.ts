import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { queryClient, getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: 2,
    retryDelay: 1000,
  });

  const logout = async () => {
    try {
      const response = await fetch("/api/auth/logout", { 
        method: "POST",
        credentials: "include" 
      });
      if (!response.ok) {
        await fetch("/api/logout", { method: "GET", credentials: "include" });
      }
    } catch (error) {
      try {
        await fetch("/api/logout", { method: "GET", credentials: "include" });
      } catch {}
    } finally {
      sessionStorage.removeItem('refreshToken');
      sessionStorage.removeItem('sessionId');
      sessionStorage.removeItem('user');
      queryClient.clear();
      window.location.href = "/";
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
  };
}
