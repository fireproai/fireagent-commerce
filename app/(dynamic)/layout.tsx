import { ReactNode } from "react";
import "../globals.css";

export default async function RootLayout({ children }: { children: ReactNode }) {
  return <div className="py-8">{children}</div>;
}
