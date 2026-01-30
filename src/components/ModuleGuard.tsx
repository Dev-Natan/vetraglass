import { Navigate } from "react-router-dom";
import { useModuleEnabled } from "@/hooks/useModuleSettings";
import { toast } from "sonner";
import { useEffect, useRef } from "react";

interface ModuleGuardProps {
  moduleKey: string;
  children: React.ReactNode;
}

export function ModuleGuard({ moduleKey, children }: ModuleGuardProps) {
  const isEnabled = useModuleEnabled(moduleKey);
  const hasShownToast = useRef(false);

  useEffect(() => {
    if (!isEnabled && !hasShownToast.current) {
      hasShownToast.current = true;
      toast.error("Este módulo foi desativado pelo administrador do sistema");
    }
  }, [isEnabled]);

  if (!isEnabled) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
