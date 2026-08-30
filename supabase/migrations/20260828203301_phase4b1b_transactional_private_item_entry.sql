-- One transaction for tenant item identity, unit contract, commercial fields and opening stock.
CREATE OR REPLACE FUNCTION public.create_private_item_with_opening_stock(
  _company_id uuid,
  _name text,
  _code text,
  _type text,
  _purchase_unit text,
  _stock_unit text,
  _consumption_unit text,
  _canonical_unit text,
  _purchase_factor numeric,
  _stock_factor numeric,
  _consumption_factor numeric,
  _initial_quantity numeric,
  _total_cost numeric,
  _sale_price numeric,
  _idempotency_key uuid,
  _nominal_length_mm numeric DEFAULT NULL,
  _description text DEFAULT NULL,
  _line text DEFAULT NULL,
  _image_url text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_created jsonb; v_item_id uuid; v_movement jsonb;
BEGIN
  IF COALESCE(_initial_quantity,0)<=0 OR COALESCE(_total_cost,0)<0 OR COALESCE(_sale_price,0)<0
     OR _idempotency_key IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_ITEM_CONFIGURATION';
  END IF;
  v_created:=public.create_private_company_item(
    _company_id,_name,_code,_type,_purchase_unit,_stock_unit,_consumption_unit,
    _canonical_unit,_purchase_factor,_stock_factor,_consumption_factor,
    _nominal_length_mm,_description
  );
  v_item_id:=(v_created->>'company_item_id')::uuid;
  UPDATE public.company_items SET
    linha=COALESCE(NULLIF(btrim(_line),''),linha),
    image_url=COALESCE(NULLIF(btrim(_image_url),''),image_url),
    specifications=COALESCE(specifications,'{}'::jsonb)||COALESCE(_metadata,'{}'::jsonb),
    sale_price=_sale_price,updated_at=now()
  WHERE id=v_item_id AND company_id=_company_id;
  v_movement:=public.record_tenant_stock_movement(
    _company_id,v_item_id,'IN',_initial_quantity,_purchase_unit,
    'Entrada inicial do item privado',NULL,NULL,NULL,_total_cost,_sale_price,
    _idempotency_key,'',NULL,NULL,NULL,NULL,
    jsonb_build_object('source','private_item_creation')
  );
  RETURN v_created||jsonb_build_object('movement',v_movement);
END;
$$;

REVOKE ALL ON FUNCTION public.create_private_item_with_opening_stock(
  uuid,text,text,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,uuid,numeric,text,text,text,jsonb
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_private_item_with_opening_stock(
  uuid,text,text,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,uuid,numeric,text,text,text,jsonb
) TO authenticated,service_role;
