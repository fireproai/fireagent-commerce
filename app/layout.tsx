import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata = {
  title: "FireAgent",
  description: "FireAgent Commerce",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.variable} suppressHydrationWarning>
      <body
        className="bg-neutral-50 text-black dark:bg-neutral-900 dark:text-white"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
