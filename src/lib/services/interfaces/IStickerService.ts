import type { StickerCategory, StickerCatalog } from '../../types/sticker';

export interface IStickerService {
    /**
     * Load the sticker catalog from Firebase Storage
     */
    loadCatalog(): Promise<StickerCatalog>;
    
    /**
     * Get all sticker categories
     */
    getCategories(): Promise<StickerCategory[]>;
    
    /**
     * Get stickers for a specific category
     */
    getStickersInCategory(categorySlug: string): Promise<StickerCategory | null>;
    
    /**
     * Get the download URL for a sticker from Firebase Storage
     */
    getStickerDownloadUrl(category: string, filename: string): Promise<string>;
    
    /**
     * Check if the catalog needs to be refreshed
     */
    isCatalogStale(): boolean;
    
    /**
     * Force refresh the catalog from Firebase Storage
     */
    refreshCatalog(): Promise<StickerCatalog>;
}