import { useState, createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const HubMayaContext = createContext(false);
export const useIsInsideHubMaya = () => useContext(HubMayaContext);

type MayaChatMessage = {
  role: "user" | "maya";
  content: string;
  timestamp: Date;
};

type MayaSidebarPanelProps = {
  context: string;
  placeholder?: string;
  description?: string;
  suggestions?: string[];
  children: React.ReactNode;
};

export function MayaSidebarPanel({
  context,
  placeholder,
  description,
  suggestions = [],
  children,
}: MayaSidebarPanelProps) {
  const [messages, setMessages] = useState<MayaChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleChat = async () => {
    if (!input.trim()) return;
    const question = input.trim();
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question, timestamp: new Date() },
    ]);
    setInput("");
    setIsTyping(true);

    try {
      const res = await apiRequest("POST", "/api/maya/chat", {
        message: question,
        context,
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "maya",
          content:
            data.response ||
            "I can help you manage your properties. What would you like to know?",
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "maya",
          content:
            "I'm here to help! Ask me anything about your properties, tenants, or finances.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      <div className="hidden lg:flex flex-col w-64 border-r p-4 overflow-y-auto">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold">Maya AI Advisor</p>
            <p className="text-[10px] text-muted-foreground">
              Your intelligent assistant
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 mb-3">
          {messages.length === 0 && (
            <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/50">
              {description ||
                `Ask Maya about your ${context}, priorities, or property management questions.`}
            </div>
          )}
          {messages.length === 0 && suggestions.length > 0 && (
            <div className="space-y-1.5 mt-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Try asking:
              </p>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(s)}
                  className="w-full text-left text-[11px] p-2 rounded-md bg-muted/30 hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300 transition-colors cursor-pointer border border-transparent hover:border-violet-200 dark:hover:border-violet-800"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`text-xs p-2 rounded-lg ${
                msg.role === "user"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 ml-4"
                  : "bg-muted/50 mr-4"
              }`}
            >
              {msg.content}
            </div>
          ))}
          {isTyping && (
            <div className="text-xs p-2 rounded-lg bg-muted/50 mr-4 animate-pulse">
              Maya is thinking...
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder={placeholder || `Ask Maya about ${context}...`}
            className="h-8 text-xs"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleChat()}
          />
          <Button
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleChat}
            disabled={!input.trim() || isTyping}
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 hub-themed-content">
        <HubMayaContext.Provider value={true}>
          {children}
        </HubMayaContext.Provider>
      </div>
    </div>
  );
}
