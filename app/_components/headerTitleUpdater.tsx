"use client";

import { useEffect } from "react";
import { useHeaderTitleStore } from "@/lib/store";

export function HeaderTitleUpdater({ title }: { title: string }) {
  const { setTitle } = useHeaderTitleStore();

  useEffect(() => {
    setTitle(title);
    return () => setTitle("");
  }, [title, setTitle]);

  return null;
}
