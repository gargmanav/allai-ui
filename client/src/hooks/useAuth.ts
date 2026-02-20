import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
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
