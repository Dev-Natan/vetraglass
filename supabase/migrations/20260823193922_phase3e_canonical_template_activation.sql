-- Keep automatic company/template activation compatible with canonical modes.
CREATE OR REPLACE FUNCTION public.activate_product_template_for_company(
  _company_id uuid,
  _product_template_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_product_id uuid;
  v_item record;
  v_company_item_id uuid;
  v_company_product_item_id uuid;
  v_sort_counter integer := 0;
BEGIN
  SELECT cp.id INTO v_product_id FROM public.company_products cp
  WHERE cp.company_id=_company_id AND cp.product_template_id=_product_template_id;
  IF v_product_id IS NULL THEN
    INSERT INTO public.company_products(
      company_id,product_template_id,commercial_name,category,linha,description,
      image_url,is_active,is_custom,min_width,max_width,min_height,max_height,
      has_multiple_sides,pricing_type
    )
    SELECT _company_id,pt.id,pt.name,pt.category,pt.linha,pt.description,
      pt.image_url,true,false,pt.min_width,pt.max_width,pt.min_height,pt.max_height,
      COALESCE(pt.has_multiple_sides,false),'COMPOSITION'
    FROM public.product_templates pt WHERE pt.id=_product_template_id
    RETURNING id INTO v_product_id;
    IF v_product_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='PRODUCT_TEMPLATE_NOT_FOUND';
    END IF;
  ELSE
    UPDATE public.company_products cp SET is_active=true,
      has_multiple_sides=COALESCE((SELECT pt.has_multiple_sides FROM public.product_templates pt WHERE pt.id=_product_template_id),cp.has_multiple_sides),
      updated_at=now()
    WHERE cp.id=v_product_id;
  END IF;

  FOR v_item IN SELECT pti.* FROM public.product_template_items pti
    WHERE pti.product_template_id=_product_template_id
      AND (pti.company_id IS NULL OR pti.company_id=_company_id)
    ORDER BY pti.created_at,pti.id
  LOOP
    v_sort_counter:=v_sort_counter+1;
    SELECT ci.id INTO v_company_item_id FROM public.company_items ci
    WHERE ci.company_id=_company_id AND ci.item_template_id=v_item.item_template_id;
    IF v_company_item_id IS NULL THEN
      INSERT INTO public.company_items(
        company_id,item_template_id,name,type,unit,pricing_unit,is_active
      )
      SELECT _company_id,it.id,it.name,it.type,it.unit,
        CASE WHEN lower(it.type::text)='profile' THEN 'm'
             WHEN lower(it.type::text)='glass' THEN 'm²' ELSE it.unit END,true
      FROM public.item_templates it WHERE it.id=v_item.item_template_id
      RETURNING id INTO v_company_item_id;
    END IF;
    v_company_product_item_id := NULL;
    SELECT cpi.id INTO v_company_product_item_id
    FROM public.company_product_items cpi
    WHERE cpi.company_product_id=v_product_id
      AND cpi.item_template_id=v_item.item_template_id
    ORDER BY cpi.id LIMIT 1;
    IF v_company_product_item_id IS NULL THEN
      INSERT INTO public.company_product_items(
        company_product_id,company_item_id,item_template_id,quantity_formula,
        width_formula,height_formula,pieces_quantity,pieces_formula,cut_angle,
        cut_angle_start,cut_angle_end,side,sort_order,company_id,notes,section,
        calculation_type,applies_to
      ) VALUES (
        v_product_id,v_company_item_id,v_item.item_template_id,v_item.quantity_formula,
        v_item.width_formula,v_item.height_formula,v_item.pieces_quantity,
        v_item.pieces_formula,v_item.cut_angle,v_item.cut_angle_start,v_item.cut_angle_end,
        v_item.side,v_sort_counter,_company_id,v_item.notes,v_item.section,
        v_item.calculation_type,v_item.applies_to
      );
    ELSE
      UPDATE public.company_product_items SET
        company_item_id=v_company_item_id,quantity_formula=v_item.quantity_formula,
        width_formula=v_item.width_formula,height_formula=v_item.height_formula,
        pieces_quantity=v_item.pieces_quantity,pieces_formula=v_item.pieces_formula,
        cut_angle=v_item.cut_angle,cut_angle_start=v_item.cut_angle_start,
        cut_angle_end=v_item.cut_angle_end,side=v_item.side,sort_order=v_sort_counter,
        company_id=_company_id,notes=v_item.notes,section=v_item.section,
        calculation_type=v_item.calculation_type,applies_to=v_item.applies_to
      WHERE id=v_company_product_item_id;
    END IF;
    INSERT INTO public.company_stock(
      company_id,item_template_id,company_item_id,quantity,min_quantity,is_active,allow_fractional
    )
    SELECT _company_id,v_item.item_template_id,v_company_item_id,0,0,true,
      (SELECT lower(it.type::text)='profile' FROM public.item_templates it WHERE it.id=v_item.item_template_id)
    ON CONFLICT (company_id,item_template_id) DO UPDATE
      SET company_item_id=EXCLUDED.company_item_id,is_active=true;
  END LOOP;
  RETURN v_product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_product_template_for_company(uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.activate_product_template_for_company(uuid,uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
