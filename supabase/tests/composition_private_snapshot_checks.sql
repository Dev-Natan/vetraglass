BEGIN;
CREATE TEMP TABLE composition_smoke_results(test text, passed boolean, actual jsonb);
DO $test$
DECLARE
 c uuid; u uuid; p uuid; i uuid; q uuid; result jsonb; frozen jsonb;
BEGIN
 SELECT user_id INTO u FROM public.user_companies WHERE role='admin' AND is_active LIMIT 1;
 INSERT INTO public.companies(name,composition_labor_percent) VALUES ('COMPOSITION SMOKE '||gen_random_uuid(),10) RETURNING id INTO c;
 INSERT INTO public.user_companies(user_id,company_id,role,is_active) VALUES(u,c,'admin',true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 INSERT INTO public.company_items(company_id,name,type,unit,cost,sale_price,is_active,pricing_basis,catalog_origin)
 VALUES(c,'CHECK COMPONENT','accessory','un',10,20,true,'UNIT','PRIVATE') RETURNING id INTO i;
 INSERT INTO public.company_products(company_id,commercial_name,is_active,is_custom,pricing_type,commercial_unit)
 VALUES(c,'CHECK PRODUCT',true,true,'COMPOSITION','M2') RETURNING id INTO p;
 INSERT INTO public.company_product_items(company_product_id,company_item_id,company_id,quantity_formula,pieces_quantity)
 VALUES(p,i,c,'2',1);
 result:=public.resolve_company_final_product_pricing(c,p,1000,1000,1,'{}');
 INSERT INTO composition_smoke_results VALUES('complete_with_existing_labor',result->>'suggestion_status'='COMPLETE' AND (result#>>'{totals,sale_price}')::numeric=44,result->'totals');
 INSERT INTO public.quotes(company_id,customer_name) VALUES(c,'TRANSACTION TEST') RETURNING id INTO q;
 INSERT INTO public.quote_items(quote_id,company_product_id,description,width,height,quantity,unit_price,total_price,composition_snapshot)
 VALUES(q,p,'TRANSACTION TEST',1000,1000,1,55,55,result||jsonb_build_object('applied_price',55))
 RETURNING composition_snapshot INTO frozen;
 INSERT INTO composition_smoke_results VALUES('private_snapshot_preserves_final_suggestion',
 (frozen#>>'{totals,sale_price}')::numeric=44,frozen->'totals');
 INSERT INTO composition_smoke_results VALUES('private_snapshot_preserves_applied_price',
 coalesce((frozen->>'applied_price')::numeric=55,false),jsonb_build_object('applied_price',frozen->'applied_price'));
 UPDATE public.company_items SET sale_price=NULL WHERE id=i;
 result:=public.resolve_company_final_product_pricing(c,p,1000,1000,1,'{}');
 INSERT INTO composition_smoke_results VALUES('null_is_unavailable',result->>'suggestion_status'='UNAVAILABLE' AND result#>>'{totals,sale_price}' IS NULL,result->'totals');
END $test$;
SELECT * FROM composition_smoke_results;
ROLLBACK;
