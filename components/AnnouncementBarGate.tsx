"use client";

import { usePathname } from "next/navigation";
import { AnnouncementBar } from "components/AnnouncementBar";

export function AnnouncementBarGate() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <AnnouncementBar />;
}
