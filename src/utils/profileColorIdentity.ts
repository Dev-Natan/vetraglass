export interface ProfileColorRpcOption {
  color_id: string;
  color_code: string;
  color_name: string;
  hex_color: string | null;
  sort_order: number;
}

export interface TenantProfileColor {
  id: string;
  admin_color_id: string | null;
  code: string;
  name: string;
}

export interface ResolvedProfileColorOption extends ProfileColorRpcOption {
  company_color_id: string;
  admin_color_id: string | null;
}

export function resolveProfileColorIdentities(
  options: ProfileColorRpcOption[],
  tenantColors: TenantProfileColor[],
): ResolvedProfileColorOption[] {
  return options.map((option) => {
    const tenantColor = tenantColors.find((color) => (
      color.id === option.color_id
      || (
        color.admin_color_id === option.color_id
        && color.code === option.color_code
      )
    ));

    if (!tenantColor) {
      throw new Error('PROFILE_COLOR_IDENTITY_NOT_FOUND');
    }

    return {
      ...option,
      company_color_id: tenantColor.id,
      admin_color_id: tenantColor.admin_color_id,
    };
  });
}
