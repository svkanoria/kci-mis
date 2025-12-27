import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TimeDirectionState {
  isTimeFlipped: boolean;
  toggleTimeFlipped: () => void;
  setIsTimeFlipped: (value: boolean) => void;
}

export const useTimeDirectionStore = create<TimeDirectionState>()(
  persist(
    (set) => ({
      isTimeFlipped: false,
      toggleTimeFlipped: () =>
        set((state) => ({ isTimeFlipped: !state.isTimeFlipped })),
      setIsTimeFlipped: (value) => set({ isTimeFlipped: value }),
    }),
    {
      name: "global-isTimeFlipped",
    },
  ),
);

interface HeaderTitleState {
  title: string;
  setTitle: (title: string) => void;
}

export const useHeaderTitleStore = create<HeaderTitleState>((set) => ({
  title: "",
  setTitle: (title) => set({ title }),
}));
