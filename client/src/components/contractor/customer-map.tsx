import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MapPin, Navigation } from 'lucide-react';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Customer {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
}

interface CustomerMapProps {
  customers: Customer[];
  selectedCustomerId?: string | null;
  onSelectCustomer?: (customerId: string) => void;
}

function MapBoundsUpdater({ customers }: { customers: Customer[] }) {
  const map = useMap();
  
  useEffect(() => {
    const validCustomers = customers.filter(c => c.latitude && c.longitude);
    if (validCustomers.length > 0) {
      const bounds = L.latLngBounds(
        validCustomers.map(c => [
          parseFloat(String(c.latitude)),
          parseFloat(String(c.longitude))
        ] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [customers, map]);
  
  return null;
}

export function CustomerMap({ customers, selectedCustomerId, onSelectCustomer }: CustomerMapProps) {
  const validCustomers = useMemo(() => 
    customers.filter(c => c.latitude && c.longitude && 
      !isNaN(parseFloat(String(c.latitude))) && 
      !isNaN(parseFloat(String(c.longitude)))
    ),
    [customers]
  );

  const defaultCenter: [number, number] = [39.8283, -98.5795];
  const defaultZoom = 4;

  const getCustomerName = (customer: Customer) => {
    if (customer.companyName) return customer.companyName;
    const parts = [customer.firstName, customer.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Unknown Customer';
  };

  const getFullAddress = (customer: Customer) => {
    const parts = [
      customer.streetAddress,
      customer.city,
      customer.state,
      customer.zipCode
    ].filter(Boolean);
    return parts.join(', ');
  };

  const openDirections = (customer: Customer) => {
    const address = encodeURIComponent(getFullAddress(customer));
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${address}`, '_blank');
  };

  const createCustomIcon = (isSelected: boolean) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background: ${isSelected ? 'linear-gradient(135deg, #8B5CF6, #3B82F6)' : 'linear-gradient(135deg, #3B82F6, #1D4ED8)'};
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            transform: rotate(45deg);
            color: white;
            font-size: 14px;
            font-weight: bold;
          ">📍</div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  };

  if (validCustomers.length === 0) {
    return (
      <Card className="h-[500px] flex items-center justify-center">
        <CardContent className="text-center">
          <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No customers with addresses to display</p>
          <p className="text-sm text-gray-400 mt-1">Add addresses to customers to see them on the map</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-500" />
            Customer Locations
          </CardTitle>
          <Badge variant="secondary">{validCustomers.length} locations</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[500px] w-full">
          <MapContainer
            center={defaultCenter}
            zoom={defaultZoom}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapBoundsUpdater customers={validCustomers} />
            
            {validCustomers.map((customer) => (
              <Marker
                key={customer.id}
                position={[
                  parseFloat(String(customer.latitude)),
                  parseFloat(String(customer.longitude))
                ]}
                icon={createCustomIcon(customer.id === selectedCustomerId)}
                eventHandlers={{
                  click: () => onSelectCustomer?.(customer.id),
                }}
              >
                <Popup>
                  <div className="min-w-[200px] p-1">
                    <h3 className="font-bold text-base mb-2">{getCustomerName(customer)}</h3>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2 text-gray-600">
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{getFullAddress(customer) || 'No address'}</span>
                      </div>
                      
                      {customer.phone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="h-4 w-4 flex-shrink-0" />
                          <a href={`tel:${customer.phone}`} className="text-blue-600 hover:underline">
                            {customer.phone}
                          </a>
                        </div>
                      )}
                      
                      {customer.email && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail className="h-4 w-4 flex-shrink-0" />
                          <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline truncate">
                            {customer.email}
                          </a>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-3 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => openDirections(customer)}
                      >
                        <Navigation className="h-4 w-4 mr-2" />
                        Get Directions
                      </Button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}
