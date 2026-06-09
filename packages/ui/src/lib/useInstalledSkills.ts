import { useState, useEffect } from 'react';
import { api } from './api-client';

export interface SkillCard {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  color?: string;
}

let globalInstalledSkillsCache: SkillCard[] | null = null;
let isFetching = false;
let fetchPromise: Promise<SkillCard[]> | null = null;
let listeners: Array<(skills: SkillCard[]) => void> = [];

function notifyListeners(skills: SkillCard[]) {
  listeners.forEach(listener => listener(skills));
}

export function useInstalledSkills() {
  const [installedSkills, setInstalledSkills] = useState<SkillCard[]>(globalInstalledSkillsCache || []);
  const [isLoading, setIsLoading] = useState(!globalInstalledSkillsCache);

  useEffect(() => {
    listeners.push(setInstalledSkills);
    if (globalInstalledSkillsCache) {
      setInstalledSkills(globalInstalledSkillsCache);
      setIsLoading(false);
    } else {
      fetchInstalledSkills();
    }
    return () => {
      listeners = listeners.filter(l => l !== setInstalledSkills);
    };
  }, []);

  const fetchInstalledSkills = () => {
    if (!isFetching) {
      isFetching = true;
      fetchPromise = api.get<any>('/api/skills?installed=true') // Adjust endpoint if needed to fetch only installed skills
        .then((data) => {
          const fetchedSkills = Array.isArray(data) ? data : (data.data || []);
          globalInstalledSkillsCache = fetchedSkills;
          notifyListeners(fetchedSkills);
          setIsLoading(false);
          isFetching = false;
          return fetchedSkills;
        })
        .catch(err => {
          console.error('[useInstalledSkills]', err);
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

  return { installedSkills, isLoading, fetchInstalledSkills };
}
