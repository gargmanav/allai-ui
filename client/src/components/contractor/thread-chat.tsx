import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ThreadChatProps {
  caseId: string;
  homeownerUserId?: string;
  contractorUserId?: string;
  orgId?: string;
  subject?: string;
  compact?: boolean;
}

export function ThreadChat({ caseId, homeownerUserId, contractorUserId, orgId, subject, compact = false }: ThreadChatProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const resolvedContractor = contractorUserId || (user?.role === "contractor" ? user?.id : undefined);
  const resolvedHomeowner = homeownerUserId || (user?.role !== "contractor" ? user?.id : undefined);

  const threadQuery = useQuery({
    queryKey: ["/api/messaging/conversations/find-or-create", caseId, resolvedHomeowner, resolvedContractor],
    queryFn: async () => {
      if (!resolvedHomeowner || !resolvedContractor) return null;
      const res = await apiRequest("POST", "/api/messaging/conversations/find-or-create", {
        caseId,
        homeownerUserId: resolvedHomeowner,
        contractorUserId: resolvedContractor,
        orgId,
        subject,
      });
      return res.json();
    },
    enabled: !!resolvedHomeowner && !!resolvedContractor && !!caseId,
    staleTime: 30000,
  });

  const threadId = threadQuery.data?.id;

  const messagesQuery = useQuery({
    queryKey: ["/api/messaging/conversations", threadId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/messaging/conversations/${threadId}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!threadId,
    refetchInterval: 10000,
  });

  const sendMutation = useMutation({
    mutationFn: async (body: string) => {
      const res = await apiRequest("POST", `/api/messaging/conversations/${threadId}/messages`, { body });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messaging/conversations", threadId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messaging/unread-counts"] });
      setMessage("");
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messagesQuery.data]);

  const handleSend = () => {
    if (!message.trim() || !threadId) return;
    sendMutation.mutate(message.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const messages = messagesQuery.data || [];

  if (!resolvedHomeowner || !resolvedContractor) {
    return null;
  }

  return (
    <div className={`border rounded-lg bg-white ${compact ? "" : "mt-4"}`}>
      <div className="px-3 py-2 border-b bg-slate-50/80 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-violet-500" />
        <span className="text-sm font-medium text-slate-700">Messages</span>
        {messages.length > 0 && (
          <span className="text-xs text-slate-400 ml-auto">{messages.length}</span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="px-3 py-2 space-y-2 overflow-y-auto"
        style={{ maxHeight: compact ? "160px" : "240px", minHeight: "60px" }}
      >
        {threadQuery.isLoading || messagesQuery.isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-3">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((msg: any) => {
            const isMe = msg.senderId === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-sm ${
                    isMe
                      ? "bg-violet-500 text-white rounded-br-sm"
                      : "bg-slate-100 text-slate-800 rounded-bl-sm"
                  }`}
                >
                  <p className="break-words">{msg.body}</p>
                  <p className={`text-[10px] mt-0.5 ${isMe ? "text-violet-200" : "text-slate-400"}`}>
                    {msg.createdAt ? formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true }) : ""}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="px-3 py-2 border-t flex gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="h-9 text-sm"
          disabled={!threadId || sendMutation.isPending}
        />
        <Button
          size="sm"
          className="h-9 px-3 bg-violet-500 hover:bg-violet-600"
          onClick={handleSend}
          disabled={!message.trim() || !threadId || sendMutation.isPending}
        >
          {sendMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
