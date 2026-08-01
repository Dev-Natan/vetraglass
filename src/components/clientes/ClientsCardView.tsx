import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  MapPin, 
  User,
  Trash2,
  MessageCircle,
  Eye,
  History
} from 'lucide-react';
import { openWhatsapp } from '@/utils/whatsapp';

interface Client {
  id: string;
  name: string;
  document: string | null;
  document_type: 'CPF' | 'CNPJ' | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

interface ClientsCardViewProps {
  clients: Client[];
  onView: (client: Client) => void;
  onViewHistory?: (client: Client) => void;
  onDelete: (client: Client) => void;
}

export const ClientsCardView = memo(function ClientsCardView({ clients, onView, onViewHistory, onDelete }: ClientsCardViewProps) {
  const navigate = useNavigate();
  const handleWhatsApp = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    openWhatsapp(client.phone, `Olá ${client.name}, tudo bem?`);
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return '(00) 00000-0000';
    const c = phone.replace(/\D/g, '');
    if (c.length === 11) return c.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (c.length === 10) return c.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return phone;
  };

  const formatAddress = (client: Client) => {
    const parts = [client.address, client.city, client.state].filter(Boolean);
    if (parts.length === 0) return 'Endereço não cadastrado';
    const fullAddress = parts.join(', ');
    return fullAddress.length > 35 ? fullAddress.substring(0, 35) + '...' : fullAddress;
  };

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {clients.map(client => (
        <div 
          key={client.id} 
          className="bg-card rounded-xl border border-border p-5 relative hover:shadow-lg transition-all duration-200 cursor-pointer group"
          onClick={() => onView(client)}
        >
          {/* Badge de tipo */}
          {client.document_type && (
            <Badge 
              variant="outline" 
              className="absolute top-3 right-3 text-xs"
            >
              {client.document_type}
            </Badge>
          )}

          {/* Client info */}
          <div className="space-y-2 mb-4 pr-12">
            <div className="flex items-start gap-2">
              <User className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <span className="font-semibold text-foreground text-sm leading-tight uppercase">
                {client.name}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm text-muted-foreground">
                {formatPhone(client.phone)}
              </span>
            </div>
            
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-sm text-muted-foreground leading-tight">
                {formatAddress(client)}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              className="flex-1 gap-2"
              onClick={(e) => {
                e.stopPropagation();
                (onViewHistory ?? onView)(client);
              }}
              title="Ver histórico completo"
            >
              <History className="w-4 h-4" />
              Ver Histórico
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onView(client);
              }}
              title="Editar cadastro"
            >
              <Eye className="w-4 h-4" />
            </Button>
            
            {client.phone && (
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={(e) => handleWhatsApp(client, e)}
              >
                <MessageCircle className="w-4 h-4 text-green-600" />
              </Button>
            )}
            
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(client);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
});
