/**
 * Phase 3E compatibility hooks.
 *
 * Product prices are resolved on demand by `resolve_company_product_pricing`.
 * Persisting derived cost/price in `company_products` would recreate a parallel
 * source of truth, so legacy callers intentionally have nothing to write.
 */
export async function recalculateProductPrice(_productId: string): Promise<void> {
  return Promise.resolve();
}

export async function recalculatePricesForProductsWithItem(
  _itemTemplateId: string | null,
  _companyItemId: string | null,
): Promise<void> {
  return Promise.resolve();
}
