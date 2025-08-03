import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Project } from '../local/ProjectsService';
import type { Task } from '../../types/task';
import type { Person } from '../local/PeopleService';

export class DataMigration {
	async migrateAllData(): Promise<void> {
		console.log('Starting data migration from localStorage to Firebase...');
		
		try {
			// 1. Migrate projects
			await this.migrateProjects();
			
			// 2. Migrate canvas data (nodes and edges)
			await this.migrateCanvasData();
			
			// 3. Migrate tasks
			await this.migrateTasks();
			
			// 4. Migrate people
			await this.migratePeople();
			
			// 5. Migrate timeline (when implemented)
			// await this.migrateTimeline();
			
			console.log('Migration completed successfully');
		} catch (error) {
			console.error('Migration failed:', error);
			throw error;
		}
	}

	private async migrateProjects(): Promise<void> {
		const projectsData = localStorage.getItem('things-projects');
		if (!projectsData) return;

		const projects: Project[] = JSON.parse(projectsData);
		const batch = writeBatch(db);

		for (const project of projects) {
			const projectRef = doc(collection(db, 'projects'));
			batch.set(projectRef, {
				...project,
				id: projectRef.id, // Update with Firestore ID
				createdAt: project.createdAt,
				updatedAt: project.updatedAt,
				createdBy: 'migration' // Will be updated when user creates new content
			});
		}

		await batch.commit();
		console.log(`Migrated ${projects.length} projects`);
	}

	private async migrateCanvasData(): Promise<void> {
		const projectsData = localStorage.getItem('things-projects');
		if (!projectsData) return;

		const projects: Project[] = JSON.parse(projectsData);

		for (const project of projects) {
			const canvasData = localStorage.getItem(`things-canvas-data-${project.slug}`);
			if (!canvasData) continue;

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const { nodes, edges } = JSON.parse(canvasData) as { nodes: any[]; edges: any[] };
			
			// Get Firestore project ID - in a real migration, you'd need to map old IDs to new ones
			const projectRef = doc(collection(db, 'projects'));
			
			// Migrate nodes
			if (nodes && nodes.length > 0) {
				const nodesBatch = writeBatch(db);
				
				for (const node of nodes) {
					const nodeRef = doc(collection(db, 'projects', projectRef.id, 'nodes'));
					nodesBatch.set(nodeRef, {
						...node.data,
						id: nodeRef.id,
						type: node.type,
						position: node.position,
						templateType: node.data.templateType,
						status: node.data.nodeData?.status || null,
						projectSlug: project.slug,
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
						createdBy: 'migration'
					});
				}
				
				await nodesBatch.commit();
			}

			// Migrate edges
			if (edges && edges.length > 0) {
				const edgesBatch = writeBatch(db);
				
				for (const edge of edges) {
					const edgeRef = doc(collection(db, 'projects', projectRef.id, 'edges'));
					edgesBatch.set(edgeRef, {
						...edge,
						id: edgeRef.id,
						createdAt: new Date().toISOString(),
						createdBy: 'migration'
					});
				}
				
				await edgesBatch.commit();
			}
		}

		console.log('Migrated canvas data for all projects');
	}

	private async migrateTasks(): Promise<void> {
		const tasksData = localStorage.getItem('borg-tasks');
		if (!tasksData) return;

		const tasks: Task[] = JSON.parse(tasksData);
		const batch = writeBatch(db);

		for (const task of tasks) {
			const taskRef = doc(collection(db, 'tasks'));
			batch.set(taskRef, {
				...task,
				id: taskRef.id,
				createdAt: task.createdAt,
				isOverdue: false, // Will be computed
				createdBy: 'migration'
			});
		}

		await batch.commit();
		console.log(`Migrated ${tasks.length} tasks`);
	}

	private async migratePeople(): Promise<void> {
		// Migrate global people index
		const globalPeopleData = localStorage.getItem('borg-people-global');
		if (globalPeopleData) {
			const globalPeople = JSON.parse(globalPeopleData);
			const batch = writeBatch(db);

			for (const person of globalPeople) {
				const personRef = doc(collection(db, 'people'));
				batch.set(personRef, {
					...person,
					id: personRef.id,
					createdAt: person.createdAt,
					updatedAt: person.updatedAt,
					lastUsedAt: person.lastUsedAt
				});
			}

			await batch.commit();
			console.log(`Migrated ${globalPeople.length} global people`);
		}

		// Migrate project-scoped people
		const projects = JSON.parse(localStorage.getItem('things-projects') || '[]');
		
		for (const project of projects) {
			const projectPeopleData = localStorage.getItem(`borg-people-${project.slug}`);
			if (!projectPeopleData) continue;

			const projectPeople: Person[] = JSON.parse(projectPeopleData);
			const batch = writeBatch(db);

			for (const person of projectPeople) {
				const personRef = doc(collection(db, 'projects', project.id, 'people'));
				batch.set(personRef, {
					...person,
					id: personRef.id,
					createdAt: person.createdAt,
					updatedAt: person.updatedAt,
					addedBy: 'migration'
				});
			}

			await batch.commit();
			console.log(`Migrated ${projectPeople.length} people for project ${project.slug}`);
		}
	}

	async exportCurrentData(): Promise<{
		projects: Project[];
		tasks: Task[];
		people: Person[];
	}> {
		return {
			projects: JSON.parse(localStorage.getItem('things-projects') || '[]'),
			tasks: JSON.parse(localStorage.getItem('borg-tasks') || '[]'),
			people: JSON.parse(localStorage.getItem('borg-people-global') || '[]')
		};
	}

	async checkMigrationStatus(): Promise<{
		hasLocalData: boolean;
		localDataCounts: {
			projects: number;
			tasks: number;
			people: number;
		};
	}> {
		const projects = JSON.parse(localStorage.getItem('things-projects') || '[]');
		const tasks = JSON.parse(localStorage.getItem('borg-tasks') || '[]');
		const people = JSON.parse(localStorage.getItem('borg-people-global') || '[]');

		return {
			hasLocalData: projects.length > 0 || tasks.length > 0 || people.length > 0,
			localDataCounts: {
				projects: projects.length,
				tasks: tasks.length,
				people: people.length
			}
		};
	}
}