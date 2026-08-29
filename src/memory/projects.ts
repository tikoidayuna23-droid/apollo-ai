import { db } from '../storage/database';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

export type ProjectStatus = 'active' | 'planning' | 'paused' | 'completed' | 'archived';

export interface ProjectItem {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  memories: string[]; // List of MemoryItem IDs or key notes associated with the project
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

const PROJECTS_STORE_KEY = 'apollo_projects';

export class ProjectMemoryManager {
  static getAllProjects(): ProjectItem[] {
    const projects = db.getItem<ProjectItem[]>(PROJECTS_STORE_KEY, []);
    return projects.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  static getProject(id: string): ProjectItem | null {
    const projects = this.getAllProjects();
    return projects.find((p) => p.id === id) || null;
  }

  static getProjectByName(name: string): ProjectItem | null {
    const projects = this.getAllProjects();
    const lower = name.toLowerCase().trim();
    return projects.find((p) => p.name.toLowerCase() === lower) || null;
  }

  static saveProject(params: {
    name: string;
    description?: string;
    status?: ProjectStatus;
    tags?: string[];
    memories?: string[];
  }): ProjectItem {
    const projects = this.getAllProjects();
    const now = Date.now();
    const trimmedName = params.name.trim();

    // Check if existing project with same name exists
    const existingIndex = projects.findIndex(
      (p) => p.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingIndex >= 0) {
      const existing = projects[existingIndex];
      const updated: ProjectItem = {
        ...existing,
        description: params.description !== undefined ? params.description : existing.description,
        status: params.status || existing.status,
        tags: params.tags || existing.tags,
        memories: params.memories || existing.memories,
        updatedAt: now,
      };
      projects[existingIndex] = updated;
      db.setItem(PROJECTS_STORE_KEY, projects);
      logger.info('ProjectMemory', `Updated project: ${updated.name}`);
      return updated;
    }

    const newProject: ProjectItem = {
      id: generateId(),
      name: trimmedName,
      description: params.description || '',
      status: params.status || 'active',
      memories: params.memories || [],
      tags: params.tags || [trimmedName.toLowerCase()],
      createdAt: now,
      updatedAt: now,
    };

    projects.unshift(newProject);
    db.setItem(PROJECTS_STORE_KEY, projects);
    logger.info('ProjectMemory', `Created new project: ${newProject.name}`);
    return newProject;
  }

  static updateProject(id: string, partial: Partial<Omit<ProjectItem, 'id' | 'createdAt'>>): ProjectItem | null {
    const projects = this.getAllProjects();
    const index = projects.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const updated: ProjectItem = {
      ...projects[index],
      ...partial,
      updatedAt: Date.now(),
    };

    projects[index] = updated;
    db.setItem(PROJECTS_STORE_KEY, projects);
    logger.info('ProjectMemory', `Updated project ${id}`);
    return updated;
  }

  static deleteProject(id: string): boolean {
    const projects = this.getAllProjects();
    const filtered = projects.filter((p) => p.id !== id);
    if (filtered.length !== projects.length) {
      db.setItem(PROJECTS_STORE_KEY, filtered);
      logger.info('ProjectMemory', `Deleted project ${id}`);
      return true;
    }
    return false;
  }

  static addMemoryToProject(projectId: string, memoryId: string): boolean {
    const project = this.getProject(projectId);
    if (!project) return false;

    if (!project.memories.includes(memoryId)) {
      this.updateProject(projectId, {
        memories: [...project.memories, memoryId],
      });
      return true;
    }
    return false;
  }

  static removeMemoryFromProject(projectId: string, memoryId: string): boolean {
    const project = this.getProject(projectId);
    if (!project) return false;

    this.updateProject(projectId, {
      memories: project.memories.filter((m) => m !== memoryId),
    });
    return true;
  }

  static clearAllProjects(): void {
    db.removeItem(PROJECTS_STORE_KEY);
    logger.info('ProjectMemory', 'Cleared all projects');
  }
}
