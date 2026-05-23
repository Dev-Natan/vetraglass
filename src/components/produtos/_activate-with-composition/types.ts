export interface ActivateWithCompositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productTemplateId: string;
  productName: string;
  productImageUrl?: string | null;
  onSuccess?: () => void;
}

export interface ComponentItem {
  id: string;
  item_template_id: string;
  quantity_formula: string;
  pieces_quantity: number;
  pieces_formula?: string | null;
  cut_angle: number;
  width_formula: string | null;
  height_formula: string | null;
  is_optional: boolean;
  notes: string | null;
  side: string | null;
  calculation_type: 'fixed' | 'per_side' | 'per_leaf' | 'per_glass' | 'formula';
  applies_to: 'product' | 'side' | 'leaf' | 'glass' | 'panel';
  isNew?: boolean;
  item_template: {
    id: string;
    name: string;
    type: string;
    unit: string;
    image_url: string | null;
  };
}

export interface ItemTemplate {
  id: string;
  name: string;
  type: string;
  unit: string;
  image_url: string | null;
  linha: string | null;
}

export type WizardStep = 'components' | 'pricing';
export type ItemTypeTab = 'glass' | 'profile' | 'accessory';
