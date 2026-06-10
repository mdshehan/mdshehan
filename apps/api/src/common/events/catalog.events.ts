/** Domain events that decouple write modules from the search indexer / cache. */
export const CatalogEvents = {
  ProductChanged: 'product.changed',
  ProductDeleted: 'product.deleted',
} as const;

export interface ProductChangedEvent {
  productId: string;
}
export interface ProductDeletedEvent {
  productId: string;
}
