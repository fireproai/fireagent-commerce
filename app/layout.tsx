import Header from "../components/site/Header";
import { GeistSans } from "geist/font/sans";
import { CartProvider } from "components/cart/cart-context";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata = {
  title: "FireAgent",
  description: "FireAgent Commerce",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} light`} suppressHydrationWarning>
      <body className="bg-neutral-50 text-neutral-900" suppressHydrationWarning>
        <CartProvider cart={undefined}>
          <Header />
          <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
          <Toaster closeButton />
          <SpeedInsights />
        </CartProvider>
      </body>
    </html>
  );
}
