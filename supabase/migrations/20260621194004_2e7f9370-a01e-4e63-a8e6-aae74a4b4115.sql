
ALTER FUNCTION public.update_os_items_updated_at() SET search_path = public;
ALTER FUNCTION public.trigger_calculate_commission_on_paid() SET search_path = public;
ALTER FUNCTION public.sync_quote_financial_data() SET search_path = public;
ALTER FUNCTION public.cancel_sale(uuid, uuid, uuid, text) SET search_path = public;
ALTER FUNCTION public.on_product_template_change() SET search_path = public;
ALTER FUNCTION public.check_financial_period_lock() SET search_path = public;
ALTER FUNCTION public.activate_all_templates_for_new_company() SET search_path = public;

DROP POLICY IF EXISTS "Anyone can view company item images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view company product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view item template images" ON storage.objects;
DROP POLICY IF EXISTS "Company logos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for product templates" ON storage.objects;
