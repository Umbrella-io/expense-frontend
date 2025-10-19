import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/contexts/AuthContext";
import { CategoriesProvider } from "@/contexts/CategoriesContext";
import AuthWrapper from "@/components/AuthWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Expense Tracker",
  description: "Track your income and expenses with ease",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <CategoriesProvider>
            <AuthWrapper>
              {children}
            </AuthWrapper>
            <Toaster 
              position="top-right" 
              toastOptions={{
                style: {
                  position: 'fixed',
                },
              }}
              containerStyle={{
                position: 'fixed',
                zIndex: 9999,
              }}
            />
          </CategoriesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
