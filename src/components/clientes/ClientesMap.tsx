import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Phone, MapPin, Edit, Navigation, X, Loader2 } from 'lucide-react';

// Fix for default marker icons in Leaflet with webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom blue marker
const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface Client {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface ClientesMapProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onClose: () => void;
  isGeocoding?: boolean;
}

// Component to fit bounds when clients change
function FitBounds({ clients }: { clients: Client[] }) {
  const map = useMap();
  
  useEffect(() => {
    const clientsWithCoords = clients.filter(c => c.latitude && c.longitude);
    if (clientsWithCoords.length > 0) {
      const bounds = L.latLngBounds(
        clientsWithCoords.map(c => [c.latitude!, c.longitude!] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [clients, map]);
  
  return null;
}

export function ClientesMap({ clients, onEdit, onClose, isGeocoding }: ClientesMapProps) {
  const clientsWithCoords = clients.filter(c => c.latitude && c.longitude);
  const clientsWithoutCoords = clients.filter(c => !c.latitude || !c.longitude);
  
  // Default center (Brazil)
  const defaultCenter: [number, number] = [-15.7801, -47.9292];
  const center = clientsWithCoords.length > 0 
    ? [clientsWithCoords[0].latitude!, clientsWithCoords[0].longitude!] as [number, number]
    : defaultCenter;

  const formatAddress = (client: Client) => {
    const parts = [client.address, client.city, client.state].filter(Boolean);
    return parts.join(', ') || 'Endereço não cadastrado';
  };

  const openWhatsApp = (phone: string | null) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${fullPhone}`, '_blank');
  };

  const getWazeUrl = (client: Client): string | null => {
    if (client.latitude && client.longitude) {
      return `https://waze.com/ul?ll=${client.latitude},${client.longitude}&navigate=yes`;
    }
    const addressParts = [client.address, client.city, client.state].filter(Boolean);
    if (addressParts.length > 0) {
      const query = encodeURIComponent(addressParts.join(', '));
      return `https://waze.com/ul?q=${query}&navigate=yes`;
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-[1000] bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-semibold text-foreground">Mapa de Clientes</h2>
            <p className="text-xs text-muted-foreground">
              {clientsWithCoords.length} de {clients.length} clientes localizados
              {isGeocoding && ' (atualizando...)'}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Loading indicator */}
      {isGeocoding && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-primary text-primary-foreground px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm font-medium">Localizando clientes...</span>
        </div>
      )}

      {/* Map */}
      <div className="pt-14 h-full">
        <MapContainer
          center={center}
          zoom={clientsWithCoords.length > 0 ? 10 : 4}
          className="h-full w-full"
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <FitBounds clients={clients} />
          
          {clientsWithCoords.map(client => (
            <Marker
              key={client.id}
              position={[client.latitude!, client.longitude!]}
              icon={blueIcon}
            >
              <Popup>
                <div className="min-w-[200px] p-1">
                  <h3 className="font-semibold text-foreground mb-2">{client.name}</h3>
                  
                  {client.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Phone className="w-3.5 h-3.5" />
                      {client.phone}
                    </div>
                  )}
                  
                  <div className="flex items-start gap-2 text-sm text-muted-foreground mb-3">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span className="leading-tight">{formatAddress(client)}</span>
                  </div>
                  
                  <div className="flex gap-2">
                    {client.phone && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 text-xs"
                        onClick={() => openWhatsApp(client.phone)}
                      >
                        <Phone className="w-3 h-3 mr-1" />
                        WhatsApp
                      </Button>
                    )}
                    {getWazeUrl(client) && (
                      <a
                        href={getWazeUrl(client)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="w-full text-xs"
                        >
                          <Navigation className="w-3 h-3 mr-1" />
                          Waze
                        </Button>
                      </a>
                    )}
                    <Button 
                      size="sm" 
                      className="flex-1 text-xs"
                      onClick={() => onEdit(client)}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Editar
                    </Button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Bottom info for clients without coordinates */}
      {clientsWithoutCoords.length > 0 && !isGeocoding && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-sm text-amber-800">
            <strong>{clientsWithoutCoords.length}</strong> cliente(s) sem localização no mapa. 
            Adicione endereço completo para exibi-los.
          </p>
        </div>
      )}
    </div>
  );
}
