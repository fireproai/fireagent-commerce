import { ReactNode } from "react";
import "../globals.css";
import { Container } from "components/ui/Container";

export default async function RootLayout({ children }: { children: ReactNode }) {
  return <Container className="py-8">{children}</Container>;
}
