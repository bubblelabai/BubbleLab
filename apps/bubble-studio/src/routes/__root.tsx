import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { Sidebar } from '@/components/Sidebar';
import { BubbleSidePanel } from '@/components/BubbleSidePanel';
import { ToastContainer } from 'react-toastify';
import { useUIStore } from '@/stores/uiStore';
import { useEffect, useRef } from 'react';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { isSidebarOpen, toggleSidebar } = useUIStore();
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isSidebarOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        toggleSidebar();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    console.log('Clicked outside sidebar, closing it.');
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen, toggleSidebar]);

  return (
    <>
      {/* Global Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        ref={sidebarRef}
      />

      {/* Main content with left padding for sidebar */}
      <div
        className={`${isSidebarOpen ? 'md:pl-56' : 'pl-14'} transition-all duration-200`}
      >
        <Outlet />
      </div>

      {/* Global overlays */}
      <BubbleSidePanel />
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />

      {/* Dev tools (only in dev) */}
      {import.meta.env.DEV && (
        <TanStackRouterDevtools position="bottom-right" />
      )}
    </>
  );
}
