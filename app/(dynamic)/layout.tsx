import { CartProvider } from 'components/cart/cart-context';
import Navbar from 'components/layout/navbar/server-navbar';
import { WelcomeToast } from 'components/welcome-toast';
import { GeistSans } from 'geist/font/sans';
import { ReactNode } from 'react';
import { Toaster } from 'sonner';
import '../globals.css';

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="bg-neutral-50 text-black dark:bg-neutral-900 dark:text-white">
        <CartProvider cart={undefined}>
          {/* Navbar is async component */}
          {await Navbar()}
          <main>{children}</main>
          <Toaster closeButton />
          <WelcomeToast />
        </CartProvider>
      </body>
    </html>
  );
}
