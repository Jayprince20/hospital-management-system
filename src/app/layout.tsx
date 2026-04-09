import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider } from "@/context/theme-context";
import { LanguageProvider } from "@/context/language-context";
import { NotificationProvider } from "@/context/notification-context";
import { ToastProvider } from "@/components/toast";
import { NotificationToastContainer } from "@/components/notifications";

// Using system font stack for Docker compatibility - fonts defined in tailwind.config.ts

export const metadata: Metadata = {
  title: "HMS Dashboard - Hospital Management System",
  description: "Admin dashboard for Hospital Management System",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

// Script to prevent flash of wrong theme - runs before React hydration
const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('theme') || 'light';
      if (theme === 'system') {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased font-sans">
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <NotificationProvider>
                <ToastProvider>
                  {children}
                  <NotificationToastContainer />
                </ToastProvider>
              </NotificationProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
