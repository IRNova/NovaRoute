import { create } from "zustand";

export const useSidebarSearchStore = create((set) => ({
  query: "",
  setQuery: (query) => set({ query }),
}));
