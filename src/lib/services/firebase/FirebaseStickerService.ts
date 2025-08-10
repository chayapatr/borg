import { getStorage, ref, getDownloadURL, getBytes } from 'firebase/storage';
import { app } from '../../firebase/config';
import type { IStickerService } from '../interfaces/IStickerService';
import type { StickerCategory, StickerCatalog } from '../../types/sticker';

export class FirebaseStickerService implements IStickerService {
    private storage = getStorage(app);
    private catalogCache: StickerCatalog | null = null;
    private catalogCacheTime: number = 0;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    private readonly CATALOG_REF = 'private/sticker-catalog.json';

    async loadCatalog(): Promise<StickerCatalog> {
        // Return cached catalog if still fresh
        if (this.catalogCache && !this.isCatalogStale()) {
            console.log('📋 Using cached sticker catalog');
            return this.catalogCache;
        }

        // Try Firebase catalog first (primary source with all sticker data)
        try {
            console.log('📋 Loading sticker catalog from Firebase Storage...');
            const catalogRef = ref(this.storage, this.CATALOG_REF);
            const catalogBytes = await getBytes(catalogRef);
            const catalogJson = new TextDecoder().decode(catalogBytes);
            const catalog: StickerCatalog = JSON.parse(catalogJson);
            
            // Cache the catalog
            this.catalogCache = catalog;
            this.catalogCacheTime = Date.now();
            
            console.log(`✅ Loaded Firebase sticker catalog with ${catalog.categories.length} categories`);
            return catalog;
            
        } catch (firebaseError) {
            console.error('❌ Failed to load Firebase catalog:', firebaseError);
            console.warn('⚠️ Trying local fallback...');
        }

        // Fallback to local catalog (limited development data)
        try {
            console.log('📋 Loading sticker catalog from local source...');
            const { stickerCatalog } = await import('../../data/sticker-catalog');
            console.log('📋 Raw catalog:', stickerCatalog);
            this.catalogCache = stickerCatalog;
            this.catalogCacheTime = Date.now();
            console.log(`✅ Loaded local sticker catalog with ${this.catalogCache.categories.length} categories`);
            return this.catalogCache;
        } catch (localError) {
            console.error('❌ Failed to load sticker catalog from both sources:', localError);
            throw new Error('Failed to load sticker catalog from both Firebase and local sources');
        }
    }

    async getCategories(): Promise<StickerCategory[]> {
        const catalog = await this.loadCatalog();
        return catalog.categories;
    }

    async getStickersInCategory(categorySlug: string): Promise<StickerCategory | null> {
        const catalog = await this.loadCatalog();
        return catalog.categories.find(cat => cat.slug === categorySlug) || null;
    }

    async getStickerDownloadUrl(category: string, filename: string): Promise<string> {
        try {
            const stickerRef = ref(this.storage, `stickers/${category}/${filename}`);
            const downloadUrl = await getDownloadURL(stickerRef);
            return downloadUrl;
        } catch (error) {
            console.warn(`⚠️ Failed to get Firebase URL for ${category}/${filename}, using local fallback`);
            // Fallback to local path - this allows development/testing without full upload
            return `/stickers/${category}/${filename}`;
        }
    }

    isCatalogStale(): boolean {
        if (!this.catalogCache || !this.catalogCacheTime) {
            return true;
        }
        return Date.now() - this.catalogCacheTime > this.CACHE_DURATION;
    }

    async refreshCatalog(): Promise<StickerCatalog> {
        console.log('🔄 Force refreshing sticker catalog...');
        this.catalogCache = null;
        this.catalogCacheTime = 0;
        return await this.loadCatalog();
    }
}