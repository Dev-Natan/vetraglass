import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Loader2, MapPin, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapControllerProps {
  center: [number, number] | null;
}

function MapController({ center }: MapControllerProps) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 16);
      map.invalidateSize();
    }
  }, [center, map]);
  return null;
}

interface Client {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface MapaClienteDialogProps {
  open: boolean;
  onClose: () => void;
  client: Client;
}

export function MapaClienteDialog({ open, onClose, client }: MapaClienteDialogProps) {
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open && client) {
      setLoading(true);
      setError(null);
      setHasChanged(false);
      
      // Se o cliente já tem coordenadas salvas, usa elas
      if (client.latitude && client.longitude) {
        setPosition([client.latitude, client.longitude]);
        setLoading(false);
        return;
      }

      // Caso contrário, faz geocode
      setPosition(null);
      fetchCoordinates();
    }
  }, [open, client]);

  const fetchCoordinates = async () => {
    try {
      const addressParts = [client.address, client.city, client.state].filter(Boolean);

      if (addressParts.length === 0) {
        setError('Endereço não informado para este cliente.');
        setLoading(false);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('geocode-address', {
        body: {
          client_id: client.id,
          address: client.address,
          city: client.city,
          state: client.state,
        },
      });

      if (fnError) {
        console.error('Geocode error:', fnError);
        setError('Erro ao buscar localização.');
        setLoading(false);
        return;
      }

      if (data?.success) {
        setPosition([data.latitude, data.longitude]);
        // A edge function já salva as coordenadas, então vamos invalidar o cache
        queryClient.invalidateQueries({ queryKey: ['clients'] });
      } else {
        setError(data?.message || 'Endereço não encontrado no mapa.');
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao buscar localização.');
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (e: L.DragEndEvent) => {
    const marker = e.target;
    const newPos = marker.getLatLng();
    if (newPos) {
      setPosition([newPos.lat, newPos.lng]);
      setHasChanged(true);
    }
  };

  const handleSave = async () => {
    if (!position || !client) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          latitude: position[0],
          longitude: position[1],
        })
        .eq('id', client.id);

      if (error) throw error;

      toast.success('Localização atualizada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setHasChanged(false);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar localização.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatAddress = () => {
    const parts = [client.address, client.city, client.state].filter(Boolean);
    return parts.length > 0 ? parts.join(' - ') : 'Endereço não cadastrado';
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Localização do Cliente
          </DialogTitle>
        </DialogHeader>

        <div className="relative h-[400px] rounded-lg overflow-hidden border bg-muted">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Buscando endereço...</span>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="flex flex-col items-center gap-2 text-center p-4">
                <AlertCircle className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">{error}</p>
              </div>
            </div>
          )}

          {!loading && position && (
            <MapContainer
              center={position}
              zoom={16}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker
                position={position}
                draggable={true}
                eventHandlers={{
                  dragend: handleDragEnd,
                }}
              >
                <Popup>
                  <div className="text-center">
                    <strong>{client.name}</strong>
                    <br />
                    <span className="text-xs text-muted-foreground">
                      Arraste para ajustar a posição
                    </span>
                  </div>
                </Popup>
              </Marker>
              <MapController center={position} />
            </MapContainer>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" />
          <span>{formatAddress()}</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Dica: Você pode arrastar o pino no mapa para ajustar a localização exata do cliente.
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || (!hasChanged && !position)}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : hasChanged ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Salvar Nova Posição
              </>
            ) : (
              'Concluir'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
