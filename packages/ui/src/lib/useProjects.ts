import { useState, useEffect } from 'react';
import { api } from './api-client';

export interface Project {
  id: string;
  name: string;
  description: string;
  category: string;
  createdAt: string;
}

let globalProjectsCache: Project[] | null = null;
let isFetching = false;
let fetchPromise: Promise<Project[]> | null = null;
let listeners: Array<(projects: Project[]) => void> = [];

function notifyListeners(projects: Project[]) {
  listeners.forEach(listener => listener(projects));
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(globalProjectsCache || []);
  const [isLoading, setIsLoading] = useState(!globalProjectsCache);

  useEffect(() => {
    listeners.push(setProjects);
    if (globalProjectsCache) {
      setProjects(globalProjectsCache);
      setIsLoading(false);
    } else {
      fetchProjects();
    }
    return () => {
      listeners = listeners.filter(l => l !== setProjects);
    };
  }, []);

  const fetchProjects = () => {
    if (!isFetching) {
      isFetching = true;
      fetchPromise = api.get<any>('/api/knowledge-projects')
        .then((data) => {
          const fetchedProjects = Array.isArray(data) ? data : (data.data || []);
          globalProjectsCache = fetchedProjects;
          notifyListeners(fetchedProjects);
          setIsLoading(false);
          isFetching = false;
          return fetchedProjects;
        })
        .catch(err => {
          console.error('[useProjects]', err);
          isFetching = false;
          setIsLoading(false);
          return [];
        });
    } else if (fetchPromise) {
      fetchPromise.then(data => {
        setIsLoading(false);
      });
    }
  };

  return { projects, isLoading, fetchProjects };
}
