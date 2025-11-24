// This file is referred to by Shadcn UI components, hence is left here.
// Ideally, we should move it into the /lib/utils folder. However, doing
// so would require manually changing the import location every time we
// install a new component from Shadcn UI.

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
