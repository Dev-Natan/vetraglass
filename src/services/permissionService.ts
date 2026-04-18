import type { Module, Permission } from '@/hooks/usePermissions';

export class PermissionService {
  private isAdmin: boolean;
  private profile: any;
  private permissions: Permission[];

  constructor(isAdmin: boolean, profile: any, permissions: Permission[]) {
    this.isAdmin = isAdmin;
    this.profile = profile;
    this.permissions = permissions;
  }

  getPermission(module: Module): Permission | null {
    // Check new profile system first
    if (this.profile?.permissions) {
      const perms = typeof this.profile.permissions === 'string' 
        ? JSON.parse(this.profile.permissions) 
        : this.profile.permissions;
      const modulePerm = perms[module];
      if (modulePerm) {
        return {
          module,
          can_view: modulePerm.view ?? false,
          can_create: modulePerm.create ?? false,
          can_edit: modulePerm.edit ?? false,
          can_delete: modulePerm.delete ?? false,
        };
      }
    }
    return this.permissions.find(p => p.module === module) || null;
  }

  canAccess(module: Module): boolean {
    if (this.isAdmin) return true;
    const permission = this.getPermission(module);
    return permission?.can_view ?? false;
  }

  canCreate(module: Module): boolean {
    if (this.isAdmin) return true;
    const permission = this.getPermission(module);
    return permission?.can_create ?? false;
  }

  canEdit(module: Module): boolean {
    if (this.isAdmin) return true;
    const permission = this.getPermission(module);
    return permission?.can_edit ?? false;
  }

  canDelete(module: Module): boolean {
    if (this.isAdmin) return true;
    const permission = this.getPermission(module);
    return permission?.can_delete ?? false;
  }

  canSeePrices(): boolean {
    if (this.isAdmin) return true;
    return !this.profile?.hide_prices;
  }

  canSeeCosts(): boolean {
    if (this.isAdmin) return true;
    return !this.profile?.hide_costs;
  }

  canOperateCash(): boolean {
    if (this.isAdmin) return true;
    return this.profile?.can_operate_cash ?? false;
  }
}
