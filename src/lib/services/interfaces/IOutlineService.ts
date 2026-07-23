export interface OutlineDoc {
	id: string;
	url: string;
	title: string;
}

export interface OutlineDocSummary {
	id: string;
	title: string;
	url: string;
	updatedAt: string;
	collectionId: string;
}

export interface IOutlineService {
	createDoc(projectSlug: string, title: string): Promise<OutlineDoc>;
	searchDocs(query: string): Promise<OutlineDocSummary[]>;
	listDocs(collectionIds: string[]): Promise<OutlineDocSummary[]>;
}
