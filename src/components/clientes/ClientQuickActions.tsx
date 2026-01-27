import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  ClipboardList, 
  MessageCircle, 
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { toast } from 'sonner';

interface ClientQuickActionsProps {
  client: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
  };
  onClose?: () => void;
}

export function ClientQuickActions({ client, onClose }: ClientQuickActionsProps) {
  const navigate = useNavigate();

  const handleNewQuote = () => {
    navigate(`/orcamentos?novo=true&clienteId=${client.id}`);
    onClose?.();
  };

  const handleNewOS = () => {
    navigate(`/ordens-servico?novo=true&clienteId=${client.id}`);
    onClose?.();
  };

  const handleWhatsApp = () => {
    if (!client.phone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }
    
    const phoneDigits = client.phone.replace(/\D/g, '');
    const whatsappNumber = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;
    const message = encodeURIComponent(`Olá ${client.name}, tudo bem?`);
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
  };

  const handleCall = () => {
    if (!client.phone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }
    
    window.open(`tel:${client.phone}`, '_self');
  };

  const handleEmail = () => {
    if (!client.email) {
      toast.error('Cliente não possui e-mail cadastrado');
      return;
    }
    
    window.open(`mailto:${client.email}`, '_blank');
  };

  const handleMaps = () => {
    const addressParts = [client.address, client.city, client.state].filter(Boolean);
    if (addressParts.length === 0) {
      toast.error('Cliente não possui endereço cadastrado');
      return;
    }
    
    const query = encodeURIComponent(addressParts.join(', '));
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Ações Principais */}
      <div>
        <h4 className="text-sm font-medium mb-2 text-muted-foreground">Criar</h4>
        <div className="grid grid-cols-2 gap-2">
          <Button 
            onClick={handleNewQuote}
            className="gap-2 justify-start"
            variant="outline"
          >
            <FileText className="h-4 w-4" />
            Novo Orçamento
          </Button>
          <Button 
            onClick={handleNewOS}
            className="gap-2 justify-start"
            variant="outline"
          >
            <ClipboardList className="h-4 w-4" />
            Nova OS
          </Button>
        </div>
      </div>

      {/* Contato */}
      <div>
        <h4 className="text-sm font-medium mb-2 text-muted-foreground">Contato</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button 
            onClick={handleWhatsApp}
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!client.phone}
          >
            <MessageCircle className="h-4 w-4 text-green-600" />
            WhatsApp
          </Button>
          <Button 
            onClick={handleCall}
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!client.phone}
          >
            <Phone className="h-4 w-4 text-blue-600" />
            Ligar
          </Button>
          <Button 
            onClick={handleEmail}
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!client.email}
          >
            <Mail className="h-4 w-4 text-purple-600" />
            E-mail
          </Button>
          <Button 
            onClick={handleMaps}
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!client.address && !client.city}
          >
            <MapPin className="h-4 w-4 text-red-600" />
            Mapa
          </Button>
        </div>
      </div>
    </div>
  );
}
