import { ReactNode, useEffect, useRef } from 'react';
import Header from './Header';
import { LeftSidebar } from './LeftSidebar';
import { useUIStore } from '../../store/uiStore';

interface MainLayoutProps {
  children: ReactNode;
}

// Breakpoint for auto-collapsing sidebar (half-screen on typical displays)
const NARROW_BREAKPOINT = 900;

export default function MainLayout({ children }: MainLayoutProps) {
  const setLeftSidebarOpen = useUIStore((state) => state.setLeftSidebarOpen);
  const leftSidebarOpen = useUIStore((state) => state.leftSidebarOpen);
  const wasNarrowRef = useRef(false);
  const userToggledRef = useRef(false);

  // Auto-collapse sidebar when window becomes narrow
  useEffect(() => {
    const handleResize = () => {
      const isNarrow = window.innerWidth < NARROW_BREAKPOINT;

      // Auto-collapse when transitioning to narrow
      if (isNarrow && !wasNarrowRef.current && leftSidebarOpen) {
        setLeftSidebarOpen(false);
        userToggledRef.current = false;
      }

      // Auto-expand when transitioning to wide (only if user didn't manually toggle)
      if (!isNarrow && wasNarrowRef.current && !leftSidebarOpen && !userToggledRef.current) {
        setLeftSidebarOpen(true);
      }

      wasNarrowRef.current = isNarrow;
    };

    // Initial check
    wasNarrowRef.current = window.innerWidth < NARROW_BREAKPOINT;

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setLeftSidebarOpen, leftSidebarOpen]);

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
