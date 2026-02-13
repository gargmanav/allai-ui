import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertTriangle, 
  DollarSign, 
  MapPin, 
  Settings, 
  X, 
  Check, 
  Map as MapIcon, 
  List, 
  Loader2,
  Wrench,
  Camera,
  ChevronDown,
  ChevronUp,
  Zap
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface FeedCase {
  id: string;
  title: string;
  description?: string;
  category?: string;
  priority: string;
  isUrgent?: boolean;
  estimatedCost?: string | number | null;
  quotedPrice?: string | number | null;
  createdAt?: string;
  postedAt?: string;
  media?: { id: string; url: string; type: string }[];
  property?: { name?: string; address?: string; city?: string; state?: string; latitude?: string; longitude?: string } | null;
}

interface Specialty {
  id: string;
  name: string;
  tier: string;
  description?: string;
}

interface JobFeedProps {
  onQuoteCase: (caseId: string) => void;
  onBack: () => void;
}

export function JobFeed({ onQuoteCase, onBack }: JobFeedProps) {
  const { toast } = useToast();
  const [showMap, setShowMap] = useState(false);
  const [showSpecialtyPicker, setShowSpecialtyPicker] = useState(false);
  const [passingId, setPassingId] = useState<string | null>(null);
  const [newJobIds, setNewJobIds] = useState<Set<string>>(new Set());
  const prevCaseIdsRef = useRef<Set<string>>(new Set());

  const { data: feedCases = [], isLoading } = useQuery<FeedCase[]>({
    queryKey: ["/api/contractor/job-feed"],
    refetchInterval: 15000,
  });

  const { data: allSpecialties = [] } = useQuery<Specialty[]>({
    queryKey: ["/api/contractor/specialties"],
  });

  const { data: mySpecialtyIds = [] } = useQuery<string[]>({
    queryKey: ["/api/contractor/my-specialties"],
  });

  useEffect(() => {
    if (feedCases.length > 0) {
      const currentIds = new Set(feedCases.map(c => c.id));
      const prevIds = prevCaseIdsRef.current;
      if (prevIds.size > 0) {
        const brandNew = new Set<string>();
        currentIds.forEach(id => {
          if (!prevIds.has(id)) brandNew.add(id);
        });
        if (brandNew.size > 0) {
          setNewJobIds(brandNew);
          const newCase = feedCases.find(c => brandNew.has(c.id));
          if (newCase) {
            toast({
              title: newCase.isUrgent || newCase.priority === "Urgent" ? "New Urgent Job Available" : "New Job Available",
              description: `${newCase.title}${newCase.estimatedCost ? ` - $${newCase.estimatedCost}` : ""}`,
              variant: newCase.isUrgent || newCase.priority === "Urgent" ? "destructive" : "default",
            });
          }
          setTimeout(() => setNewJobIds(new Set()), 3000);
        }
      }
      prevCaseIdsRef.current = currentIds;
    }
  }, [feedCases]);

  const dismissMutation = useMutation({
    mutationFn: async (caseId: string) => {
      await apiRequest("POST", "/api/contractor/dismiss-case", { caseId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor/job-feed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contractor/dismissed-cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/cases"] });
    },
  });

  const updateSpecialtiesMutation = useMutation({
    mutationFn: async (specialtyIds: string[]) => {
      await apiRequest("PUT", "/api/contractor/my-specialties", { specialtyIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor/my-specialties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contractor/job-feed"] });
      toast({ title: "Specialties updated", description: "Your job feed will now show matching jobs" });
    },
  });

  const handlePass = (caseId: string) => {
    setPassingId(caseId);
    setTimeout(() => {
      dismissMutation.mutate(caseId);
      setPassingId(null);
    }, 300);
  };

  const handleQuote = (caseId: string) => {
    onQuoteCase(caseId);
  };

  const toggleSpecialty = (specialtyId: string) => {
    const current = new Set(mySpecialtyIds);
    if (current.has(specialtyId)) {
      current.delete(specialtyId);
    } else {
      current.add(specialtyId);
    }
    updateSpecialtiesMutation.mutate(Array.from(current));
  };

  const getPrice = (c: FeedCase) => {
    const price = c.quotedPrice || c.estimatedCost;
    if (!price) return null;
    return `$${Math.round(Number(price)).toLocaleString()}`;
  };

  const isUrgent = (c: FeedCase) => c.isUrgent || c.priority === "Urgent" || c.priority === "High";

  const tier1Specialties = allSpecialties.filter(s => s.tier === "tier1");
  const tier2Specialties = allSpecialties.filter(s => s.tier === "tier2");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-bold">Job Feed</h2>
            <Badge variant="secondary" className="text-xs">
              {feedCases.length} available
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showMap ? "default" : "outline"}
              size="sm"
              onClick={() => setShowMap(!showMap)}
              className="h-8 gap-1"
            >
              {showMap ? <List className="h-3.5 w-3.5" /> : <MapIcon className="h-3.5 w-3.5" />}
              {showMap ? "List" : "Map"}
            </Button>
            <Button
              variant={showSpecialtyPicker ? "default" : "outline"}
              size="sm"
              onClick={() => setShowSpecialtyPicker(!showSpecialtyPicker)}
              className="h-8 gap-1"
            >
              <Settings className="h-3.5 w-3.5" />
              Trades
            </Button>
          </div>
        </div>

        {mySpecialtyIds.length === 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <Wrench className="h-4 w-4 flex-shrink-0" />
            <span>Select your trades to see relevant jobs only</span>
            <Button size="sm" variant="outline" className="ml-auto h-6 text-xs" onClick={() => setShowSpecialtyPicker(true)}>
              Set Up
            </Button>
          </div>
        )}
      </div>

      {/* Specialty Picker */}
      {showSpecialtyPicker && (
        <div className="border-b bg-muted/30 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">My Trades</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowSpecialtyPicker(false)} className="h-6 w-6 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Common</p>
            <div className="flex flex-wrap gap-1.5">
              {tier1Specialties.map(s => (
                <button
                  key={s.id}
                  onClick={() => toggleSpecialty(s.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    mySpecialtyIds.includes(s.id)
                      ? "bg-violet-600 text-white shadow-sm"
                      : "bg-background border hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                  }`}
                >
                  {s.name.replace(' / ', '/')}
                </button>
              ))}
            </div>
            {tier2Specialties.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground font-medium pt-1">Specialized</p>
                <div className="flex flex-wrap gap-1.5">
                  {tier2Specialties.map(s => (
                    <button
                      key={s.id}
                      onClick={() => toggleSpecialty(s.id)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        mySpecialtyIds.includes(s.id)
                          ? "bg-violet-600 text-white shadow-sm"
                          : "bg-background border hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                      }`}
                    >
                      {s.name.replace(' / ', '/')}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Map View */}
      {showMap && (
        <JobFeedMap cases={feedCases} onQuote={handleQuote} onPass={handlePass} passingId={passingId} />
      )}

      {/* Card Feed */}
      {!showMap && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {feedCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Wrench className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">No matching jobs right now</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {mySpecialtyIds.length === 0 ? "Set your trades to start seeing jobs" : "New jobs will pop in as they arrive"}
              </p>
            </div>
          ) : (
            feedCases.map((c) => (
              <JobCard
                key={c.id}
                caseItem={c}
                onQuote={() => handleQuote(c.id)}
                onPass={() => handlePass(c.id)}
                isPassing={passingId === c.id}
                isNew={newJobIds.has(c.id)}
                isUrgentJob={isUrgent(c)}
                price={getPrice(c)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function JobCard({ 
  caseItem, 
  onQuote, 
  onPass, 
  isPassing, 
  isNew,
  isUrgentJob,
  price 
}: { 
  caseItem: FeedCase; 
  onQuote: () => void; 
  onPass: () => void; 
  isPassing: boolean;
  isNew: boolean;
  isUrgentJob: boolean;
  price: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const photoUrl = caseItem.media?.[0]?.url;

  return (
    <Card 
      className={`overflow-hidden transition-all duration-300 touch-manipulation ${
        isPassing ? "opacity-0 translate-x-full scale-95" : ""
      } ${isNew ? "ring-2 ring-violet-500 animate-pulse" : ""} ${
        isUrgentJob ? "border-red-300 dark:border-red-700 shadow-[0_0_12px_rgba(239,68,68,0.15)]" : ""
      }`}
    >
      <div className="flex">
        {/* Photo thumbnail */}
        {photoUrl ? (
          <div className="w-20 h-20 min-w-[80px] bg-muted flex-shrink-0">
            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-20 h-20 min-w-[80px] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center flex-shrink-0">
            <Camera className="h-5 w-5 text-muted-foreground/40" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {isUrgentJob && (
                  <span className="text-red-500 animate-pulse font-bold text-lg leading-none">!</span>
                )}
                <h3 className="font-semibold text-sm truncate">{caseItem.title}</h3>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">{caseItem.category || "General"}</span>
              </div>
            </div>
            {price && (
              <div className="flex items-center gap-0.5 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md flex-shrink-0">
                <DollarSign className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{price.replace('$', '')}</span>
              </div>
            )}
          </div>

          {/* Expandable description */}
          {caseItem.description && (
            <button 
              onClick={() => setExpanded(!expanded)} 
              className="flex items-center gap-1 mt-1 text-xs text-violet-600 dark:text-violet-400 hover:underline"
            >
              {expanded ? "Less" : "More"}
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
          {expanded && caseItem.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{caseItem.description}</p>
          )}
        </div>
      </div>

      {/* Action Buttons - big tap targets */}
      <div className="flex border-t">
        <button
          onClick={onPass}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-muted-foreground hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 transition-colors active:bg-red-100 touch-manipulation"
        >
          <X className="h-4 w-4" />
          Pass
        </button>
        <div className="w-px bg-border" />
        <button
          onClick={onQuote}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/10 transition-colors active:bg-violet-100 touch-manipulation"
        >
          <Check className="h-4 w-4" />
          Quote It
        </button>
      </div>
    </Card>
  );
}

function JobFeedMap({ cases, onQuote, onPass, passingId }: { cases: FeedCase[]; onQuote: (id: string) => void; onPass: (id: string) => void; passingId: string | null }) {
  const [selectedCase, setSelectedCase] = useState<string | null>(null);

  const casesWithCoords = cases.filter(c => c.property?.latitude && c.property?.longitude);

  if (casesWithCoords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <MapIcon className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground font-medium">No job locations available</p>
        <p className="text-sm text-muted-foreground/70 mt-1">Jobs without location data won't appear on the map</p>
      </div>
    );
  }

  const selected = cases.find(c => c.id === selectedCase);

  return (
    <div className="flex-1 flex flex-col min-h-[400px]">
      <div className="flex-1 relative">
        <MapComponent cases={casesWithCoords} selectedId={selectedCase} onSelect={setSelectedCase} />
      </div>

      {selected && (
        <div className="border-t bg-background p-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {(selected.isUrgent || selected.priority === "Urgent" || selected.priority === "High") && (
                  <span className="text-red-500 animate-pulse font-bold text-lg">!</span>
                )}
                <h3 className="font-semibold text-sm truncate">{selected.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{selected.category || "General"}</p>
              {(selected.quotedPrice || selected.estimatedCost) && (
                <p className="text-sm font-bold text-emerald-600 mt-1">
                  ${Math.round(Number(selected.quotedPrice || selected.estimatedCost)).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onPass(selected.id)} className="h-8">
                <X className="h-3.5 w-3.5 mr-1" /> Pass
              </Button>
              <Button size="sm" onClick={() => onQuote(selected.id)} className="h-8 bg-violet-600 hover:bg-violet-700">
                <Check className="h-3.5 w-3.5 mr-1" /> Quote It
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function MapComponent({ cases, selectedId, onSelect }: { cases: FeedCase[]; selectedId: string | null; onSelect: (id: string) => void }) {

  const defaultCenter: [number, number] = [40.7128, -74.0060];
  const firstCase = cases[0];
  const center: [number, number] = firstCase?.property?.latitude 
    ? [parseFloat(String(firstCase.property.latitude)), parseFloat(String(firstCase.property.longitude))]
    : defaultCenter;

  const urgentIcon = L.divIcon({
    className: 'custom-marker',
    html: `<div style="background: #ef4444; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(239,68,68,0.5); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">!</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  const normalIcon = L.divIcon({
    className: 'custom-marker',
    html: `<div style="background: #7c3aed; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(124,58,237,0.4);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  return (
    <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }} className="z-0">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {cases.map(c => {
        const lat = parseFloat(String(c.property!.latitude));
        const lng = parseFloat(String(c.property!.longitude));
        const urgent = c.isUrgent || c.priority === "Urgent" || c.priority === "High";
        return (
          <Marker
            key={c.id}
            position={[lat, lng]}
            icon={urgent ? urgentIcon : normalIcon}
            eventHandlers={{
              click: () => onSelect(c.id),
            }}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-semibold">{c.title}</p>
                <p className="text-muted-foreground">{c.category}</p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
