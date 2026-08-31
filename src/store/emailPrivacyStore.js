"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

const useEmailPrivacyStore = create(
  persist(
    (set) => ({
      emailsVisible: false,
      setEmailsVisible: (visible) => set({ emailsVisible: visible }),
    }),
    {
      name: "novaroute-email-privacy",
    }
  )
);

export default useEmailPrivacyStore;
