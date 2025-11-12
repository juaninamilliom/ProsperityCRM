import { create } from 'zustand';

interface FilterState {
  selectedAgency?: string;
  flagQuery?: string;
  setAgency: (agencyId?: string) => void;
  setFlagQuery: (flag?: string) => void;
}

export const useFiltersStore = create<FilterState>((set) => ({
  selectedAgency: undefined,
  flagQuery: undefined,
  setAgency: (selectedAgency) => set({ selectedAgency }),
  setFlagQuery: (flagQuery) => set({ flagQuery }),
}));
