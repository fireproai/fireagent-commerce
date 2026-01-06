import Header from "../components/site/Header";
import Footer from "components/Footer";
import { GeistSans } from "geist/font/sans";
import { CartProvider } from "components/cart/cart-context";
import AnalyticsConsent from "components/site/AnalyticsConsent";
import { Toaster } from "sonner";
import "./globals.css";
import { AnnouncementBarGate } from "components/AnnouncementBarGate";

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
    <html lang="en" className={`${GeistSans.variable} light`} suppressHydrationWarning>
      <body className="bg-neutral-50 text-neutral-900" suppressHydrationWarning>
        <CartProvider cart={undefined}>
          <Header />
          <AnnouncementBarGate />
          <main className="mx-auto w-full max-w-7xl 2xl:max-w-[1440px] px-4 pb-6 pt-12 md:px-6 lg:px-8">{children}</main>
          <Footer />
          <Toaster closeButton />
          <AnalyticsConsent />
        </CartProvider>
      </body>
    </html>
  );
}
