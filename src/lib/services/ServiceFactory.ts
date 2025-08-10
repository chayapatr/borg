import type { IProjectsService, ITaskService, IPeopleService, ITimelineService, INodesService, IStickerService } from './interfaces';
import { ProjectsService } from './local/ProjectsService';
import { TaskService } from './local/TaskService';  
import { PeopleService } from './local/PeopleService';
import { TimelineService } from './local/TimelineService';
import { NodesService } from './local/NodesService';
import { FirebaseProjectsService } from './firebase/FirebaseProjectsService';
import { FirebaseTaskService } from './firebase/FirebaseTaskService';
import { FirebaseTimelineService } from './firebase/FirebaseTimelineService';
import { FirebaseNodesService } from './firebase/FirebaseNodesService';
import { FirebasePeopleService } from './firebase/FirebasePeopleService';
import { FirebaseStickerService } from './firebase/FirebaseStickerService';
import type { Node, Edge } from '@xyflow/svelte';

export class ServiceFactory {
	private static getServiceMode(): 'local' | 'firebase' {
		return import.meta.env.VITE_SERVICE_MODE === 'firebase' ? 'firebase' : 'local';
	}

	static createProjectsService(): IProjectsService {
		const mode = this.getServiceMode();
		if (mode === 'firebase') {
			return new FirebaseProjectsService();
		}
		return new ProjectsService();
	}

	static createTaskService(): ITaskService {
		const mode = this.getServiceMode();
		if (mode === 'firebase') {
			return new FirebaseTaskService();
		}
		return new TaskService();
	}

	static createPeopleService(): IPeopleService {
		const mode = this.getServiceMode();
		if (mode === 'firebase') {
			return new FirebasePeopleService();
		}
		return new PeopleService();
	}

	static createTimelineService(projectId?: string): ITimelineService {
		const mode = this.getServiceMode();
		if (mode === 'firebase') {
			return new FirebaseTimelineService(projectId);
		}
		return new TimelineService();
	}

	static createNodesService(
		projectId: string,
		setNodes: (nodes: Node[]) => void,
		getNodes: () => Node[],
		setEdges: (edges: Edge[]) => void,
		getEdges: () => Edge[],
		projectSlug?: string
	): INodesService {
		const mode = this.getServiceMode();
		if (mode === 'firebase') {
			return new FirebaseNodesService(projectId, setNodes, getNodes, setEdges, getEdges, projectSlug);
		}
		return new NodesService(setNodes, getNodes, setEdges, getEdges, projectSlug);
	}

	static isUsingFirebase(): boolean {
		return this.getServiceMode() === 'firebase';
	}

	static createStickerService(): IStickerService {
		// Stickers always use Firebase Storage for images, regardless of service mode
		return new FirebaseStickerService();
	}

	static getCurrentMode(): 'local' | 'firebase' {
		return this.getServiceMode();
	}
}