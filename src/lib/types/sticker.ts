export interface Sticker {
    filename: string;
    name: string;
    localPath: string;
    storageUrl: string;
    downloadUrl?: string; // Firebase Storage download URL
}

export interface StickerCategory {
    name: string;
    slug: string;
    count: number;
    stickers: Sticker[];
}

export interface StickerCatalog {
    lastUpdated: string;
    categories: StickerCategory[];
}

export interface StickerNode {
    id: string;
    type: 'sticker';
    position: { x: number; y: number };
    data: {
        templateType: 'sticker';
        stickerUrl: string;
        category: string;
        filename: string;
        size: { width: number; height: number };
        nodeData: {
            title: string;
        };
    };
}