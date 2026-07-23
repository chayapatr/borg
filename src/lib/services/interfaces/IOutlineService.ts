export interface OutlineDoc {
	id: string;
	url: string;
	title: string;
}

export interface IOutlineService {
	createDoc(projectSlug: string, title: string): Promise<OutlineDoc>;
}
