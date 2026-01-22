import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { usePermissionProfiles, PROFILE_TYPE_LABELS, PROFILE_TYPE_DESCRIPTIONS } from '@/hooks/usePermissionProfiles';
import { 
  Crown, 
  Briefcase, 
  ShoppingCart, 
  Wallet, 
  Package, 
  Factory, 
  Wrench, 
  PiggyBank,
  Settings
} from 'lucide-react';

interface PermissionProfileSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

const PROFILE_TYPE_ICONS: Record<string, React.ElementType> = {
  admin: Crown,
  gerente: Briefcase,
  vendedor: ShoppingCart,
  caixa: Wallet,
  almoxarifado: Package,
  producao: Factory,
  instalador: Wrench,
  financeiro: PiggyBank,
  custom: Settings,
};

export function PermissionProfileSelect({ 
  value, 
  onChange, 
  disabled = false,
  placeholder = "Selecione um perfil" 
}: PermissionProfileSelectProps) {
  const { profiles, isLoading } = usePermissionProfiles();

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Carregando..." />
        </SelectTrigger>
      </Select>
    );
  }

  const NONE_VALUE = "__none__";

  return (
    <Select 
      value={value || NONE_VALUE} 
      onValueChange={(v) => onChange(v === NONE_VALUE ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>
          <span className="text-muted-foreground">Nenhum perfil</span>
        </SelectItem>
        {profiles.map((profile) => {
          const Icon = PROFILE_TYPE_ICONS[profile.profile_type] || Settings;
          return (
            <SelectItem key={profile.id} value={profile.id}>
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="font-medium">{profile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {profile.description || PROFILE_TYPE_DESCRIPTIONS[profile.profile_type]}
                  </span>
                </div>
                {profile.is_system && (
                  <Badge variant="secondary" className="ml-auto text-xs">Padrão</Badge>
                )}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export function PermissionProfileBadge({ profileId }: { profileId: string | null }) {
  const { profiles } = usePermissionProfiles();
  
  if (!profileId) {
    return <Badge variant="outline" className="text-muted-foreground">Sem perfil</Badge>;
  }

  const profile = profiles.find(p => p.id === profileId);
  if (!profile) {
    return <Badge variant="outline" className="text-muted-foreground">Perfil não encontrado</Badge>;
  }

  const Icon = PROFILE_TYPE_ICONS[profile.profile_type] || Settings;
  
  const getVariant = () => {
    switch (profile.profile_type) {
      case 'admin': return 'default';
      case 'gerente': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <Badge variant={getVariant()} className="gap-1">
      <Icon className="w-3 h-3" />
      {profile.name}
    </Badge>
  );
}
