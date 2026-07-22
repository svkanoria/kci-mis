"use client";

import dynamic from "next/dynamic";

export const Map = dynamic(() => import("./map").then((mod) => mod.Map), {
  ssr: false,
});
