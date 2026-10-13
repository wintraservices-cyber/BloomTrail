import './globals.css';
import PwaSetup from '@/components/PwaSetup';

export const metadata = {
  title: 'Bloom Trail',
  description: 'Every step of your medical journey, gathered in one place',
  applicationName: 'Bloom Trail',
  appleWebApp: { capable: true, title: 'Bloom Trail', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport = {
  themeColor: '#c85c8e',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Serif+Pro:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <PwaSetup />
      </body>
    </html>
  );
}
