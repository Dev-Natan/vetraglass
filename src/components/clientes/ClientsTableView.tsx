import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowUpDown, 
  Phone, 
  MapPin, 
  Eye,
  Trash2,
  MessageCircle,
  History,
} from 'lucide-react';
import { openWhatsapp } from '@/utils/whatsapp';
import { formatCPFOrCNPJ } from '@/utils/documentValidation';

const formatPhone = (phone: string | null) => {
  if (!phone) return '';
  const c = phone.replace(/\D/g, '');
  if (c.length === 11) return c.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (c.length === 10) return c.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return phone;
};

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

interface ClientsTableViewProps {
  clients: Client[];
  onView: (client: Client) => void;
  onViewHistory?: (client: Client) => void;
  onDelete: (client: Client) => void;
}

type SortField = 'name' | 'city' | 'document_type';
type SortDirection = 'asc' | 'desc';

export function ClientsTableView({ clients, onView, onViewHistory, onDelete }: ClientsTableViewProps) {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedClients = [...clients].sort((a, b) => {
    const aValue = a[sortField] || '';
    const bValue = b[sortField] || '';
    const comparison = aValue.localeCompare(bValue);
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleWhatsApp = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    openWhatsapp(client.phone, `Olá ${client.name}, tudo bem?`);
  };

  const formatAddress = (client: Client) => {
    const parts = [client.city, client.state].filter(Boolean);
    return parts.length > 0 ? parts.join(' - ') : '-';
  };

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 -ml-3 font-medium"
                onClick={() => handleSort('name')}
              >
                Cliente
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 -ml-3 font-medium"
                onClick={() => handleSort('city')}
              >
                Cidade
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 -ml-3 font-medium"
                onClick={() => handleSort('document_type')}
              >
                Tipo
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedClients.map((client) => (
            <TableRow 
              key={client.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onView(client)}
            >
              <TableCell>
                <div>
                  <p className="font-medium uppercase">{client.name}</p>
                  {client.document && (
                    <p className="text-xs text-muted-foreground">{formatCPFOrCNPJ(client.document)}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  {client.phone && (
                    <div className="flex items-center gap-1 text-sm">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      {formatPhone(client.phone)}
                    </div>
                  )}
                  {client.email && (
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {client.email}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  {formatAddress(client)}
                </div>
              </TableCell>
              <TableCell>
                {client.document_type && (
                  <Badge variant="outline" className="text-xs">
                    {client.document_type}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {client.phone && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => handleWhatsApp(client, e)}
                    >
                      <MessageCircle className="h-4 w-4 text-green-600" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      (onViewHistory ?? onView)(client);
                    }}
                    title="Ver histórico do cliente"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onView(client);
                    }}
                    title="Editar cadastro"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(client);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
