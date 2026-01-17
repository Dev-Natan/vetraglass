import { ReactNode } from 'react';
import { usePermissions, Module } from '@/hooks/usePermissions';
import { Shield, Lock } from 'lucide-react';

interface PermissionGuardProps {
  module: Module;
  action?: 'view' | 'create' | 'edit' | 'delete';
  children: ReactNode;
  fallback?: ReactNode;
  showFallback?: boolean;
}

export function PermissionGuard({
  module,
  action = 'view',
  children,
  fallback,
  showFallback = false,
}: PermissionGuardProps) {
  const { canAccess, canCreate, canEdit, canDelete, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  const hasPermission = 
    action === 'view' ? canAccess(module) :
    action === 'create' ? canCreate(module) :
    action === 'edit' ? canEdit(module) :
    canDelete(module);

  if (!hasPermission) {
    if (fallback) return <>{fallback}</>;
    if (showFallback) return <AccessDeniedFallback />;
    return null;
  }

  return <>{children}</>;
}

function AccessDeniedFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Lock className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
      <p className="text-muted-foreground max-w-md">
        Você não tem permissão para acessar este recurso. 
        Entre em contato com o administrador da sua empresa para solicitar acesso.
      </p>
    </div>
  );
}

// Higher-order component for page protection
interface ProtectedPageProps {
  module: Module;
  children: ReactNode;
}

export function ProtectedPage({ module, children }: ProtectedPageProps) {
  return (
    <PermissionGuard module={module} action="view" showFallback>
      {children}
    </PermissionGuard>
  );
}
