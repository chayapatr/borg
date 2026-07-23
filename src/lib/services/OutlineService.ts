import { get } from 'svelte/store';
import type { IOutlineService, OutlineDoc } from './interfaces/IOutlineService';
import { authStore } from '../stores/authStore';
import { ServiceFactory } from './ServiceFactory';

export class OutlineService implements IOutlineService {
	async createDoc(projectSlug: string, title: string): Promise<OutlineDoc> {
		const user = get(authStore).user;
		if (!user) {
			throw new Error('Must be signed in to create an Outline doc');
		}
		const idToken = await user.getIdToken();

		const projectsService = ServiceFactory.createProjectsService();
		const project = await projectsService.getProject(projectSlug);
		if (!project) {
			throw new Error(`Project not found: ${projectSlug}`);
		}

		const res = await fetch('/api/outline/docs', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${idToken}`
			},
			body: JSON.stringify({
				projectSlug,
				projectTitle: project.title,
				existingCollectionId: project.outlineCollectionId,
				title
			})
		});

		if (!res.ok) {
			throw new Error(`Failed to create Outline doc: ${await res.text()}`);
		}

		const result: OutlineDoc & { collectionId: string } = await res.json();

		// Persist the collection id on the project the first time it's created
		if (!project.outlineCollectionId && result.collectionId) {
			await projectsService.updateProject(projectSlug, {
				outlineCollectionId: result.collectionId
			});
		}

		return { id: result.id, url: result.url, title: result.title };
	}
}
