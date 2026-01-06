import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building2, ChevronDown, Check, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function CompanySelector() {
  const { companies, currentCompany, setCurrentCompany } = useAuth();
  const navigate = useNavigate();

  if (!currentCompany) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 px-3 py-6 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <span className="font-bold text-sm text-sidebar-primary-foreground">
              {currentCompany.name.charAt(0)}
            </span>
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium truncate">{currentCompany.name}</p>
            <p className="text-xs text-sidebar-foreground/50">
              {currentCompany.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}
            </p>
          </div>
          <ChevronDown className="w-4 h-4 text-sidebar-foreground/50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>Suas Empresas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.map((uc) => (
          <DropdownMenuItem
            key={uc.company.id}
            onClick={() => setCurrentCompany(uc.company)}
            className="flex items-center gap-2"
          >
            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
              <Building2 className="w-3 h-3 text-primary" />
            </div>
            <span className="flex-1 truncate">{uc.company.name}</span>
            {currentCompany.id === uc.company.id && (
              <Check className="w-4 h-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/empresa/nova')}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Empresa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
