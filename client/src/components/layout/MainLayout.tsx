import { ReactNode } from 'react';
import Header from './Header';
import { LeftSidebar } from './LeftSidebar';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="h-screen flex flex-col bg-atmosphere">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <LeftSidebar />
        {children}
      </div>
    </div>
  );
}
