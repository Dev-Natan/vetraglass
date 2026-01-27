import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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
  center: [number, number];
}

function MapController({ center }: MapControllerProps) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 16);
      // Delay invalidateSize to ensure the map is fully rendered
      setTimeout(() => map.invalidateSize(), 100);
    }
  }, [center, map]);
  return null;
}

interface ClientMapViewProps {
  position: [number, number];
  clientName: string;
  onPositionChange: (position: [number, number]) => void;
}

export default function ClientMapView({ position, clientName, onPositionChange }: ClientMapViewProps) {
  const handleDragEnd = (e: L.DragEndEvent) => {
    const marker = e.target;
    const newPos = marker.getLatLng();
    if (newPos) {
      onPositionChange([newPos.lat, newPos.lng]);
    }
  };

  return (
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
            <strong>{clientName}</strong>
            <br />
            <span className="text-xs text-gray-500">
              Arraste para ajustar a posição
            </span>
          </div>
        </Popup>
      </Marker>
      <MapController center={position} />
    </MapContainer>
  );
}
