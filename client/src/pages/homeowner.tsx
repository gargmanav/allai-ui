import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Menu, 
  Send, 
  Mic, 
  Droplets, 
  Zap, 
  Snowflake, 
  Wrench,
  Camera,
  ArrowLeft,
  Star,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle,
  MessageCircle,
  Home,
  FileText,
  Settings,
  LogOut,
  ChevronRight,
  Sparkles
} from "lucide-react";

type ViewState = "landing" | "triage" | "contractors" | "chat";

interface TriageResult {
  urgency: string;
  rootCause: string;
  estimatedCost: string;
  estimatedTime: string;
  suggestedActions: string[];
  category: string;
}

interface Contractor {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  availability: string;
  priceRange: string;
}

export default function Homeowner() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [view, setView] = useState<ViewState>("landing");
  const [problemDescription, setProblemDescription] = useState("");
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const firstName = user?.firstName || user?.email?.split("@")[0] || "there";

  const categories = [
    { id: "plumbing", label: "Plumbing", icon: Droplets, color: "text-blue-500" },
    { id: "electrical", label: "Electrical", icon: Zap, color: "text-yellow-500" },
    { id: "hvac", label: "HVAC", icon: Snowflake, color: "text-cyan-500" },
    { id: "other", label: "Other", icon: Wrench, color: "text-gray-500" },
  ];

  const { data: pastRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/property-owner/cases"],
    enabled: !!user,
  });

  const triageMutation = useMutation({
    mutationFn: async (data: { description: string; category?: string }) => {
      const response = await apiRequest("POST", "/api/ai/triage", {
        description: data.description,
        category: data.category,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setTriageResult(data);
      setView("triage");
      setIsAnalyzing(false);
    },
    onError: () => {
      toast({
        title: "Analysis failed",
        description: "We couldn't analyze your issue. Please try again.",
        variant: "destructive",
      });
      setIsAnalyzing(false);
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!problemDescription.trim()) return;
    
    setIsAnalyzing(true);
    triageMutation.mutate({ 
      description: problemDescription, 
      category: selectedCategory || undefined 
    });
  };

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
    inputRef.current?.focus();
  };

  const handleBack = () => {
    if (view === "contractors") {
      setView("triage");
    } else if (view === "triage" || view === "chat") {
      setView("landing");
      setTriageResult(null);
      setProblemDescription("");
      setSelectedCategory(null);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency?.toLowerCase()) {
      case "critical":
      case "emergency":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "high":
      case "urgent":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
      case "medium":
      case "moderate":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      default:
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    }
  };

  const getUrgencyLabel = (urgency: string) => {
    switch (urgency?.toLowerCase()) {
      case "critical":
      case "emergency":
        return "Urgent - Act Now";
      case "high":
      case "urgent":
        return "High Priority";
      case "medium":
      case "moderate":
        return "Moderate";
      default:
        return "Low Priority";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Minimal Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-4 max-w-4xl mx-auto">
          {view !== "landing" ? (
            <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          ) : (
            <div className="w-20" />
          )}
          
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-semibold">AllAI</span>
          </div>

          {/* Hidden Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-1">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start gap-3"
                  onClick={() => setView("landing")}
                >
                  <Home className="h-4 w-4" />
                  Home
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start gap-3"
                >
                  <FileText className="h-4 w-4" />
                  Past Requests
                  {pastRequests.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {pastRequests.length}
                    </Badge>
                  )}
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start gap-3"
                >
                  <MessageCircle className="h-4 w-4" />
                  Messages
                </Button>
                <Separator className="my-4" />
                <Button 
                  variant="ghost" 
                  className="w-full justify-start gap-3"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start gap-3 text-muted-foreground"
                  onClick={() => logout?.()}
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-8 px-6 max-w-4xl mx-auto min-h-screen flex flex-col">
        
        {/* Landing View - The Hero Input */}
        {view === "landing" && (
          <div className="flex-1 flex flex-col items-center justify-center -mt-16">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-semibold mb-2">
                Hi, {firstName}
              </h1>
              <p className="text-muted-foreground">
                What needs fixing today?
              </p>
            </div>

            {/* The Hero Input */}
            <form onSubmit={handleSubmit} className="w-full max-w-xl mb-8">
              <label htmlFor="problem-input" className="sr-only">
                Describe what needs fixing
              </label>
              <div className="relative">
                <Input
                  id="problem-input"
                  ref={inputRef}
                  type="text"
                  placeholder="Describe what's wrong..."
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  className="h-14 pl-5 pr-24 text-lg rounded-full border-2 focus:border-primary shadow-lg"
                  disabled={isAnalyzing}
                  aria-label="Describe what needs fixing"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon"
                    className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <Mic className="h-5 w-5" />
                  </Button>
                  <Button 
                    type="submit" 
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    disabled={!problemDescription.trim() || isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              {selectedCategory && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <Badge variant="secondary" className="gap-1">
                    {categories.find(c => c.id === selectedCategory)?.label}
                    <button 
                      type="button"
                      onClick={() => setSelectedCategory(null)}
                      className="ml-1 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                </div>
              )}
            </form>

            {/* Quick Categories */}
            <div className="grid grid-cols-4 gap-4 max-w-md">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all hover:bg-muted/50 ${
                    selectedCategory === cat.id ? "bg-muted ring-2 ring-primary" : ""
                  }`}
                >
                  <div className={`p-3 rounded-full bg-muted ${cat.color}`}>
                    <cat.icon className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-medium">{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Past Requests Preview */}
            {pastRequests.length > 0 && (
              <div className="mt-12 w-full max-w-xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Recent Requests</h3>
                  <Button variant="link" size="sm" className="text-xs">
                    View All
                  </Button>
                </div>
                <Card className="divide-y">
                  {pastRequests.slice(0, 2).map((request: any) => (
                    <div key={request.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{request.title}</p>
                        <p className="text-xs text-muted-foreground">{request.status}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Triage View - AI Analysis Result */}
        {view === "triage" && triageResult && (
          <div className="flex-1 flex flex-col items-center pt-8">
            <div className="w-full max-w-xl">
              {/* What you described */}
              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-1">You described:</p>
                <p className="text-lg">{problemDescription}</p>
              </div>

              {/* Maya's Analysis */}
              <Card className="mb-6 overflow-hidden">
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-5 py-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Maya's Analysis</span>
                </div>
                <CardContent className="p-5 space-y-4">
                  {/* Urgency Badge */}
                  <div className="flex items-center gap-3">
                    <Badge className={`${getUrgencyColor(triageResult.urgency)} border-0`}>
                      {triageResult.urgency === "critical" || triageResult.urgency === "emergency" ? (
                        <AlertCircle className="h-3 w-3 mr-1" />
                      ) : null}
                      {getUrgencyLabel(triageResult.urgency)}
                    </Badge>
                  </div>

                  {/* Root Cause */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      What's likely happening
                    </h4>
                    <p className="text-base">{triageResult.rootCause}</p>
                  </div>

                  {/* Estimates */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-xs text-muted-foreground">Est. Cost</p>
                        <p className="font-semibold">{triageResult.estimatedCost}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Clock className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-xs text-muted-foreground">Est. Time</p>
                        <p className="font-semibold">{triageResult.estimatedTime}</p>
                      </div>
                    </div>
                  </div>

                  {/* Suggested Actions */}
                  {triageResult.suggestedActions?.length > 0 && (
                    <div className="pt-2">
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        Recommended steps
                      </h4>
                      <ul className="space-y-2">
                        {triageResult.suggestedActions.slice(0, 3).map((action, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Add Photos */}
              <Card className="mb-6">
                <CardContent className="p-4">
                  <Button variant="outline" className="w-full gap-2">
                    <Camera className="h-4 w-4" />
                    Add Photos
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Photos help contractors give better estimates
                  </p>
                </CardContent>
              </Card>

              {/* Primary Action */}
              <Button 
                size="lg" 
                className="w-full h-14 text-lg rounded-full"
                onClick={() => setView("contractors")}
              >
                Find a Professional
              </Button>

              {/* Chat Option */}
              <Button 
                variant="ghost" 
                className="w-full mt-3 gap-2"
                onClick={() => setView("chat")}
              >
                <MessageCircle className="h-4 w-4" />
                Chat with Maya for more help
              </Button>
            </div>
          </div>
        )}

        {/* Contractors View - Pick a Pro */}
        {view === "contractors" && (
          <div className="flex-1 pt-8">
            <div className="max-w-xl mx-auto">
              <h2 className="text-2xl font-semibold mb-2">Available Professionals</h2>
              <p className="text-muted-foreground mb-6">
                Select a contractor to request their help
              </p>

              {/* Placeholder contractors - will be replaced with real data */}
              <div className="space-y-4">
                {[
                  { id: "1", name: "Mike's Plumbing", specialty: "Plumbing", rating: 4.9, reviews: 127, availability: "Available today", priceRange: "$$ - $$$" },
                  { id: "2", name: "Quick Fix Pro", specialty: "General Repair", rating: 4.7, reviews: 89, availability: "Available tomorrow", priceRange: "$$ - $$" },
                  { id: "3", name: "Elite Home Services", specialty: "Plumbing & HVAC", rating: 4.8, reviews: 203, availability: "Available today", priceRange: "$$$ - $$$$" },
                ].map((contractor) => (
                  <Card key={contractor.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{contractor.name}</h3>
                          <p className="text-sm text-muted-foreground">{contractor.specialty}</p>
                        </div>
                        <div className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded">
                          <Star className="h-4 w-4 text-yellow-600 fill-yellow-600" />
                          <span className="font-medium text-sm">{contractor.rating}</span>
                          <span className="text-xs text-muted-foreground">({contractor.reviews})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3">
                        <Badge variant="secondary" className="gap-1">
                          <Clock className="h-3 w-3" />
                          {contractor.availability}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{contractor.priceRange}</span>
                      </div>
                      <Button className="w-full mt-4">
                        Request Help
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Chat View - Maya Chat */}
        {view === "chat" && (
          <div className="flex-1 flex flex-col pt-8">
            <div className="max-w-xl mx-auto w-full flex-1 flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-full bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">Chat with Maya</h2>
                  <p className="text-sm text-muted-foreground">Your AI assistant</p>
                </div>
              </div>
              
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  <div className="bg-muted rounded-2xl rounded-tl-sm p-4 max-w-[80%]">
                    <p className="text-sm">
                      I've analyzed your issue. What else would you like to know? I can help with:
                    </p>
                    <ul className="text-sm mt-2 space-y-1 text-muted-foreground">
                      <li>• DIY tips before calling a pro</li>
                      <li>• What to expect during the repair</li>
                      <li>• Questions to ask contractors</li>
                    </ul>
                  </div>
                </div>
              </ScrollArea>

              {/* Chat Input */}
              <div className="mt-4 relative">
                <Input
                  placeholder="Ask Maya anything..."
                  className="h-12 pl-4 pr-12 rounded-full"
                />
                <Button 
                  size="icon" 
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
