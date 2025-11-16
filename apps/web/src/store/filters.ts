import { create } from 'zustand';

interface FilterState {
  selectedAgency?: string;
  flagQuery?: string;
  jobId?: string;
  statusId?: string;
  searchTerm?: string;
  skillFilters: string[];
  setAgency: (agencyId?: string) => void;
  setFlagQuery: (flag?: string) => void;
  setJobId: (jobId?: string) => void;
  setStatusId: (statusId?: string) => void;
  setSearchTerm: (term?: string) => void;
  setSkillFilters: (skills: string[]) => void;
}

export const useFiltersStore = create<FilterState>((set) => ({
  selectedAgency: undefined,
  flagQuery: undefined,
  jobId: undefined,
  statusId: undefined,
  searchTerm: undefined,
  skillFilters: [],
  setAgency: (selectedAgency) => set({ selectedAgency }),
  setFlagQuery: (flagQuery) => set({ flagQuery }),
  setJobId: (jobId) => set({ jobId }),
  setStatusId: (statusId) => set({ statusId }),
  setSearchTerm: (searchTerm) => set({ searchTerm }),
  setSkillFilters: (skills) => set({ skillFilters: skills }),
}));
