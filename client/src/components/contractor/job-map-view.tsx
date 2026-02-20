import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, DollarSign, Home } from 'lucide-react';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapItem {
  id: string;
  title: string;
  description?: string;
  customerName: string;
  category?: string;
  status: string;
  priority?: string;
  estimatedValue?: number;
  latitude?: string | number | null;
  longitude?: string | number | null;
  address?: string | null;
  city?: string | null;
  isExistingCustomer?: boolean;
  photoUrl?: string | null;
}

interface JobMapViewProps {
  items: MapItem[];
  itemType: "request" | "quote" | "job";
  selectedItemId?: string | null;
  onSelectItem?: (itemId: string) => void;
  onAccept?: (item: MapItem) => void;
  onSendQuote?: (item: MapItem) => void;
}

function MapBoundsUpdater({ items }: { items: { lat: number; lng: number }[] }) {
  const map = useMap();

  useEffect(() => {
    if (items.length > 0) {
      const bounds = L.latLngBounds(items.map(i => [i.lat, i.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [items, map]);

  return null;
}

const stageColors: Record<string, { bg: string; border: string }> = {
  request: { bg: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', border: '#7C3AED' },
  quote: { bg: 'linear-gradient(135deg, #3B82F6, #2563EB)', border: '#2563EB' },
  job: { bg: 'linear-gradient(135deg, #10B981, #059669)', border: '#059669' },
};

export function JobMapView({ items, itemType, selectedItemId, onSelectItem, onAccept, onSendQuote }: JobMapViewProps) {
  const validItems = useMemo(() =>
    items.filter(item =>
      item.latitude && item.longitude &&
      !isNaN(parseFloat(String(item.latitude))) &&
      !isNaN(parseFloat(String(item.longitude)))
    ).map(item => ({
      ...item,
      lat: parseFloat(String(item.latitude)),
      lng: parseFloat(String(item.longitude)),
    })),
    [items]
  );

  const defaultCenter: [number, number] = [39.8283, -98.5795];
  const defaultZoom = 4;
  const colors = stageColors[itemType] || stageColors.request;

  const createPinIcon = (item: typeof validItems[0], isSelected: boolean) => {
    const amount = item.estimatedValue ? `$${item.estimatedValue.toLocaleString()}` : '';
    return L.divIcon({
      className: 'custom-job-marker',
      html: `
        <div style="
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        ">
          <div style="
            background: white;
            border: 2px solid ${isSelected ? '#8B5CF6' : colors.border};
            border-radius: 8px;
            padding: 2px 6px;
            font-size: 11px;
            font-weight: 700;
            color: ${isSelected ? '#7C3AED' : '#1F2937'};
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,${isSelected ? '0.25' : '0.15'});
            transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
            transition: transform 0.2s;
          ">${amount}</div>
          <div style="
            width: 24px;
            height: 24px;
            background: ${isSelected ? 'linear-gradient(135deg, #8B5CF6, #6D28D9)' : colors.bg};
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2px solid white;
            box-shadow: 0 3px 8px rgba(0,0,0,0.3);
            margin-top: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="transform: rotate(45deg); color: white; font-size: 10px;">🏠</div>
          </div>
        </div>
      `,
      iconSize: [60, 50],
      iconAnchor: [30, 50],
      popupAnchor: [0, -45],
    });
  };

  const openDirections = (item: typeof validItems[0]) => {
    const dest = item.address || item.city || `${item.lat},${item.lng}`;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`, '_blank');
  };

  if (validItems.length === 0) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center text-center px-4">
        <MapPin className="h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-500 font-medium">No locations to display</p>
        <p className="text-sm text-gray-400 mt-1">
          {items.length > 0
            ? `${items.length} ${itemType}${items.length > 1 ? 's' : ''} found but none have location data`
            : `No ${itemType}s match your current filters`}
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-md border border-slate-200/60">
        <span className="text-xs font-medium text-slate-600">{validItems.length} on map</span>
        {items.length > validItems.length && (
          <span className="text-[10px] text-slate-400 ml-1.5">({items.length - validItems.length} missing location)</span>
        )}
      </div>
      <div className="h-[400px] w-full rounded-lg overflow-hidden border border-slate-200">
        <MapContainer
          center={defaultCenter}
          zoom={defaultZoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBoundsUpdater items={validItems} />

          {validItems.map((item) => (
            <Marker
              key={item.id}
              position={[item.lat, item.lng]}
              icon={createPinIcon(item, item.id === selectedItemId)}
              eventHandlers={{
                click: () => onSelectItem?.(item.id),
              }}
            >
              <Popup>
                <div className="min-w-[220px] p-1">
                  <div className="flex items-center gap-2 mb-2">
                    {item.photoUrl ? (
                      <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                        <img src={item.photoUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <Home className="h-5 w-5 text-slate-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-base">${(item.estimatedValue || 0).toLocaleString()}</p>
                      <span className={`text-[11px] font-medium ${item.isExistingCustomer ? 'text-blue-500' : 'text-emerald-500'}`}>
                        {item.isExistingCustomer ? 'Existing Customer' : 'New Customer'}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm font-medium text-slate-800 mb-1">{item.title}</p>
                  {item.category && (
                    <p className="text-xs text-slate-500 mb-1">{item.category}</p>
                  )}

                  <div className="flex items-start gap-1.5 text-xs text-slate-600 mb-2">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{item.address || item.city || 'Location available'}</span>
                  </div>

                  <div className="flex items-center gap-1.5 mb-3">
                    <Badge variant="secondary" className="text-[10px] h-5">{item.status}</Badge>
                    {item.priority && (item.priority.toLowerCase() === "urgent" || item.priority.toLowerCase() === "critical" || item.priority.toLowerCase() === "emergency" || item.priority.toLowerCase() === "emergent") && (
                      <Badge variant="destructive" className="text-[10px] h-5">Urgent</Badge>
                    )}
                  </div>

                  <div className="flex gap-2 border-t pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs"
                      onClick={() => openDirections(item)}
                    >
                      <Navigation className="h-3.5 w-3.5 mr-1" />
                      Directions
                    </Button>
                    {onAccept && (
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white"
                        onClick={() => onAccept(item as any)}
                      >
                        Accept
                      </Button>
                    )}
                    {onSendQuote && !onAccept && (
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white"
                        onClick={() => onSendQuote(item as any)}
                      >
                        Quote
                      </Button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
