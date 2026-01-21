import { useState, useRef } from "react";
import allaiLogo from "@assets/ChatGPT_Image_Jan_20,_2026,_07_39_22_PM_1768956785867.png";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MoreHorizontal } from "lucide-react";
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

type ViewState = "landing" | "triage" | "contractors" | "chat" | "pastRequests";

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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const firstName = user?.firstName || user?.email?.split("@")[0] || "there";

  const categories = [
    { id: "plumbing", label: "Plumbing", icon: Droplets, color: "text-blue-500", bgColor: "bg-blue-100 dark:bg-blue-900/30", badgeBg: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300", ringColor: "ring-blue-400", glowColor: "rgba(59, 130, 246, 0.4)" },
    { id: "electrical", label: "Electrical", icon: Zap, color: "text-amber-500", bgColor: "bg-amber-100 dark:bg-amber-900/30", badgeBg: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300", ringColor: "ring-amber-400", glowColor: "rgba(245, 158, 11, 0.4)" },
    { id: "hvac", label: "HVAC", icon: Snowflake, color: "text-cyan-500", bgColor: "bg-cyan-100 dark:bg-cyan-900/30", badgeBg: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300", ringColor: "ring-cyan-400", glowColor: "rgba(6, 182, 212, 0.4)" },
  ];

  const otherCategories = [
    { id: "appliances", label: "Appliances", badgeBg: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300" },
    { id: "roofing", label: "Roofing", badgeBg: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300" },
    { id: "flooring", label: "Flooring", badgeBg: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
    { id: "windows_doors", label: "Windows & Doors", badgeBg: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300" },
    { id: "painting", label: "Painting", badgeBg: "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300" },
    { id: "landscaping", label: "Landscaping", badgeBg: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" },
    { id: "pest_control", label: "Pest Control", badgeBg: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" },
    { id: "garage", label: "Garage Door", badgeBg: "bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300" },
    { id: "security", label: "Security Systems", badgeBg: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300" },
    { id: "cleaning", label: "Cleaning", badgeBg: "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300" },
    { id: "other", label: "Other", badgeBg: "bg-gray-100 text-gray-700 dark:bg-gray-900/50 dark:text-gray-300" },
  ];

  const getCategoryInfo = (id: string) => {
    return categories.find(c => c.id === id) || otherCategories.find(c => c.id === id);
  };

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
      category: selectedCategories.length > 0 ? selectedCategories.join(", ") : undefined 
    });
  };

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
    inputRef.current?.focus();
  };

  const removeCategory = (categoryId: string) => {
    setSelectedCategories(prev => prev.filter(id => id !== categoryId));
  };

  const handleBack = () => {
    if (view === "contractors") {
      setView("triage");
    } else if (view === "triage" || view === "chat" || view === "pastRequests") {
      setView("landing");
      setTriageResult(null);
      setProblemDescription("");
      setSelectedCategories([]);
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
          
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            <div className="flex items-center gap-3" style={{ perspective: '800px' }}>
              <svg 
                width="72" 
                height="72" 
                viewBox="0 0 100 100" 
                className="animate-pyramid-rotate"
                style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
              >
                <defs>
                  <linearGradient id="pyramidGradientLeft" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#16a34a" />
                  </linearGradient>
                  <linearGradient id="pyramidGradientRight" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#0ea5e9" />
                    <stop offset="100%" stopColor="#0284c7" />
                  </linearGradient>
                  <linearGradient id="pyramidGradientCenter" x1="50%" y1="0%" x2="50%" y2="100%">
                    <stop offset="0%" stopColor="#14b8a6" />
                    <stop offset="100%" stopColor="#0d9488" />
                  </linearGradient>
                </defs>
                <polygon points="50,10 20,80 50,65" fill="url(#pyramidGradientLeft)" />
                <polygon points="50,10 80,80 50,65" fill="url(#pyramidGradientRight)" />
                <polygon points="20,80 50,65 80,80 50,90" fill="url(#pyramidGradientCenter)" />
              </svg>
              <span className="text-4xl font-bold text-gray-800 dark:text-gray-100">AllAI</span>
            </div>
            <span className="text-sm text-muted-foreground italic mt-2">Home maintenance, simplified.</span>
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
                  onClick={() => setView("pastRequests")}
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
                  className="w-full justify-start gap-3 opacity-50 cursor-not-allowed"
                  disabled
                >
                  <MessageCircle className="h-4 w-4" />
                  Messages
                </Button>
                <Separator className="my-4" />
                <Button 
                  variant="ghost" 
                  className="w-full justify-start gap-3 opacity-50 cursor-not-allowed"
                  disabled
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
      <main className="pt-32 pb-8 px-6 max-w-4xl mx-auto min-h-screen flex flex-col">
        
        {/* Landing View - The Hero Input */}
        {view === "landing" && (
          <div className="flex-1 flex flex-col items-center justify-center -mt-16">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-semibold mb-2">
                Hi, {firstName}
              </h1>
              <p className="text-muted-foreground">
                I help diagnose issues and connect the right help.
              </p>
            </div>

            {/* The Hero Input */}
            <form onSubmit={handleSubmit} className="w-full max-w-xl mb-8">
              <label htmlFor="problem-input" className="sr-only">
                How can I help?
              </label>
              <div className="relative group">
                {/* AI Gradient Glow Effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 via-purple-500 to-blue-500 rounded-full opacity-30 blur-lg group-hover:opacity-50 group-focus-within:opacity-60 transition-opacity duration-300" />
                <Input
                  id="problem-input"
                  ref={inputRef}
                  type="text"
                  placeholder="How can I help today?"
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  className="relative h-14 pl-5 pr-24 text-lg rounded-full border-2 border-muted-foreground/20 focus:border-primary/50 shadow-lg bg-background"
                  disabled={isAnalyzing}
                  aria-label="How can I help?"
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
              <div className="flex items-center justify-center gap-2 mt-3 flex-wrap min-h-[32px]">
                {selectedCategories.map(catId => {
                  const catInfo = getCategoryInfo(catId);
                  return (
                    <Badge 
                      key={catId} 
                      variant="secondary" 
                      className={`gap-1 ${catInfo?.badgeBg || "bg-gray-100 text-gray-700"}`}
                    >
                      {catInfo?.label}
                      <button 
                        type="button"
                        onClick={() => removeCategory(catId)}
                        className="ml-1 hover:opacity-70"
                      >
                        ×
                      </button>
                    </Badge>
                  );
                })}
              </div>
            </form>

            {/* Quick Categories */}
            <div className="grid grid-cols-4 gap-4 max-w-md mt-6">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.id)}
                  className="relative flex flex-col items-center gap-2 p-2 transition-all"
                >
                  <div 
                    className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                      selectedCategories.includes(cat.id) 
                        ? `${cat.bgColor} ring-2 ${cat.ringColor} ring-offset-2 ring-offset-background` 
                        : ""
                    }`} 
                    style={selectedCategories.includes(cat.id) 
                      ? { 
                          boxShadow: `0 0 28px ${cat.glowColor}, inset 0 3px 6px rgba(255,255,255,0.5), 0 8px 20px rgba(0,0,0,0.2)`,
                          border: '1.5px solid rgba(255,255,255,0.7)'
                        } 
                      : { 
                          background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(250,250,255,0.85) 20%, rgba(235,240,255,0.7) 50%, rgba(220,230,250,0.55) 80%, rgba(200,215,240,0.45) 100%)',
                          backdropFilter: 'blur(40px) saturate(200%)',
                          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
                          border: '2px solid rgba(255,255,255,0.85)',
                          boxShadow: 'inset 0 6px 16px rgba(255,255,255,1), inset 0 -5px 10px rgba(100,120,180,0.08), 0 12px 40px rgba(0,0,0,0.18), 0 6px 16px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.3)'
                        }
                    }
                  >
                    <cat.icon className={`h-7 w-7 ${selectedCategories.includes(cat.id) ? cat.color : "text-gray-600 dark:text-gray-400"}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cat.label}</span>
                </button>
              ))}
              
              {/* Other - Dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="relative flex flex-col items-center gap-2 p-2 transition-all"
                  >
                    <div 
                      className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                        selectedCategories.some(id => otherCategories.some(c => c.id === id))
                          ? "bg-purple-100 dark:bg-purple-900/30 ring-2 ring-purple-400 ring-offset-2 ring-offset-background"
                          : ""
                      }`} 
                      style={selectedCategories.some(id => otherCategories.some(c => c.id === id)) 
                        ? { 
                            boxShadow: '0 0 28px rgba(139, 92, 246, 0.4), inset 0 3px 6px rgba(255,255,255,0.5), 0 8px 20px rgba(0,0,0,0.2)',
                            border: '1.5px solid rgba(255,255,255,0.7)'
                          } 
                        : { 
                            background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(250,250,255,0.85) 20%, rgba(235,240,255,0.7) 50%, rgba(220,230,250,0.55) 80%, rgba(200,215,240,0.45) 100%)',
                            backdropFilter: 'blur(40px) saturate(200%)',
                            WebkitBackdropFilter: 'blur(40px) saturate(200%)',
                            border: '2px solid rgba(255,255,255,0.85)',
                            boxShadow: 'inset 0 6px 16px rgba(255,255,255,1), inset 0 -5px 10px rgba(100,120,180,0.08), 0 12px 40px rgba(0,0,0,0.18), 0 6px 16px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.3)'
                          }
                      }
                    >
                      <Wrench className={`h-7 w-7 ${selectedCategories.some(id => otherCategories.some(c => c.id === id)) ? "text-purple-500" : "text-gray-600 dark:text-gray-400"}`} />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">More</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="center">
                  <div className="space-y-1">
                    {otherCategories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategoryClick(cat.id)}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors hover:bg-muted ${
                          selectedCategories.includes(cat.id) ? "bg-primary/10 text-primary font-medium" : ""
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
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

        {/* Past Requests View */}
        {view === "pastRequests" && (
          <div className="flex-1 flex flex-col pt-8">
            <div className="max-w-xl mx-auto w-full">
              <h2 className="text-2xl font-semibold mb-6">Your Requests</h2>
              
              {pastRequests.length === 0 ? (
                <div className="text-center py-16">
                  <div className="p-4 rounded-full bg-muted inline-block mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-2">No requests yet</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    When you report an issue, it will appear here
                  </p>
                  <Button onClick={() => setView("landing")}>
                    Report an Issue
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {pastRequests.map((request: any) => (
                    <Card key={request.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium">{request.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {request.property?.name || "Your Property"}
                            </p>
                          </div>
                          <Badge 
                            variant="secondary"
                            className={
                              request.status === "completed" 
                                ? "bg-green-100 text-green-700" 
                                : request.status === "in_progress"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                            }
                          >
                            {request.status === "in_progress" ? "In Progress" : 
                             request.status === "completed" ? "Completed" : 
                             request.status?.replace(/_/g, " ") || "New"}
                          </Badge>
                        </div>
                        {request.description && (
                          <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                            {request.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(request.createdAt).toLocaleDateString()}
                          </span>
                          {request.category && (
                            <span className="capitalize">{request.category}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
