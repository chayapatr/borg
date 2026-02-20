import type {
	IProjectsService,
	ITaskService,
	IPeopleService,
	ITimelineService,
	INodesService,
	IStickerService,
	IUserService,
	IWikiService
} from './interfaces';
import { FirebaseProjectsService } from './firebase/FirebaseProjectsService';
import { FirebaseTaskService } from './firebase/FirebaseTaskService';
import { FirebaseTimelineService } from './firebase/FirebaseTimelineService';
import { FirebaseNodesService } from './firebase/FirebaseNodesService';
import { FirebasePeopleService } from './firebase/FirebasePeopleService';
import { FirebaseStickerService } from './firebase/FirebaseStickerService';
import { FirebaseUserService } from './firebase/FirebaseUserService';
import { FirebaseWikiService } from './firebase/FirebaseWikiService';
import type { Node, Edge } from '@xyflow/svelte';

export class ServiceFactory {
	static createProjectsService(): IProjectsService {
		return new FirebaseProjectsService();
	}

	static createTaskService(): ITaskService {
		return new FirebaseTaskService();
	}

	static createPeopleService(): IPeopleService {
		return new FirebasePeopleService();
	}

	static createTimelineService(projectId?: string): ITimelineService {
		return new FirebaseTimelineService(projectId);
	}

	static createNodesService(
		projectId: string,
		setNodes: (nodes: Node[]) => void,
		getNodes: () => Node[],
		setEdges: (edges: Edge[]) => void,
		getEdges: () => Edge[],
		projectSlug?: string
	): INodesService {
		return new FirebaseNodesService(
			projectId,
			setNodes,
			getNodes,
			setEdges,
			getEdges,
			projectSlug
		);
	}

	static createStickerService(): IStickerService {
		return new FirebaseStickerService();
	}

	static createUserService(): IUserService {
		return new FirebaseUserService();
	}

	static createWikiService(): IWikiService {
		return new FirebaseWikiService();
	}
}
