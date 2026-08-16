import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, Check, ChevronsUpDown, Crown, Briefcase, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ROLE_META: Record<string, { label: string; icon: React.ElementType }> = {
  admin: { label: "Admin", icon: Crown },
  manager: { label: "Gerente", icon: Briefcase },
  employee: { label: "Funcionário", icon: User },
};

export function CompanySwitcher({ className }: { className?: string }) {
  const { companies, currentCompany, setCurrentCompany } = useAuth();

  if (!currentCompany || companies.length === 0) return null;

  const currentMembership = companies.find((c) => c.company.id === currentCompany.id);
  const RoleIcon = currentMembership ? ROLE_META[currentMembership.role]?.icon ?? User : User;

  // Single company: render as a static badge
  if (companies.length === 1) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/40 border border-border/50",
          className
        )}
      >
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium truncate max-w-[160px]">
          {currentCompany.name}
        </span>
        {currentMembership && (
          <Badge variant="secondary" className="text-[10px] gap-1">
            <RoleIcon className="w-3 h-3" />
            {ROLE_META[currentMembership.role]?.label}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2 max-w-[260px]", className)}>
          <Building2 className="w-4 h-4 shrink-0" />
          <span className="truncate flex-1 text-left">{currentCompany.name}</span>
          {currentMembership && (
            <Badge variant="secondary" className="text-[10px] gap-1 shrink-0">
              <RoleIcon className="w-3 h-3" />
              {ROLE_META[currentMembership.role]?.label}
            </Badge>
          )}
          <ChevronsUpDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[280px]">
        <DropdownMenuLabel>Trocar empresa</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.map((c) => {
          const Icon = ROLE_META[c.role]?.icon ?? User;
          const isCurrent = c.company.id === currentCompany.id;
          return (
            <DropdownMenuItem
              key={c.membershipId}
              onClick={() => !isCurrent && setCurrentCompany(c.company)}
              className="gap-2 py-2"
            >
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.company.name}</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Icon className="w-3 h-3" />
                  {ROLE_META[c.role]?.label}
                </p>
              </div>
              {isCurrent && <Check className="w-4 h-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
