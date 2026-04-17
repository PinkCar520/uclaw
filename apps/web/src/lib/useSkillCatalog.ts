import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from './api-client';

export interface SkillCatalogEntry {
  id: string;
  name: string;
  description: string;
  locales: Record<string, { displayName?: string; description?: string }> | null;
}

// Module-level cache to ensure we only fetch this once per session
let globalCatalogCache: SkillCatalogEntry[] | null = null;
let isFetching = false;
let fetchPromise: Promise<SkillCatalogEntry[]> | null = null;

export function useSkillCatalog() {
  const [catalog, setCatalog] = useState<SkillCatalogEntry[]>(globalCatalogCache || []);
  const [isLoading, setIsLoading] = useState(!globalCatalogCache);
  const { i18n } = useTranslation();

  useEffect(() => {
    if (globalCatalogCache) {
      setCatalog(globalCatalogCache);
      setIsLoading(false);
      return;
    }

    if (!isFetching) {
      isFetching = true;
      fetchPromise = api.get<any>('/api/skills/catalog')
        .then((data) => {
          const catalogData = Array.isArray(data) ? data : (data.data || []);
          globalCatalogCache = catalogData;
          setCatalog(catalogData);
          setIsLoading(false);
          isFetching = false;
          return catalogData;
        })
        .catch(err => {
          console.error('[useSkillCatalog]', err);
          isFetching = false;
          setIsLoading(false);
          return [];
        });
    } else if (fetchPromise) {
      fetchPromise.then(data => {
        setCatalog(data);
        setIsLoading(false);
      });
    }
  }, []);

  const getLocalizedName = (skillId: string, fallbackName?: string): string => {
    const entry = catalog.find(c => c.id === skillId || c.name === skillId);
    if (!entry) return fallbackName || skillId;

    const targetLocale = i18n.language ? i18n.language.split('-')[0] : 'en';
    const localized = entry.locales?.[targetLocale];
    return localized?.displayName || fallbackName || entry.name;
  };

  return { catalog, isLoading, getLocalizedName };
}
