import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { Sidebar } from '@/components/Sidebar';
import { BubbleSidePanel } from '@/components/BubbleSidePanel';
import { ToastContainer } from 'react-toastify';
import { useUIStore } from '@/stores/uiStore';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { isSidebarOpen, toggleSidebar } = useUIStore();

  return (
    <>
      {/* Global Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />

      {/* Main content with left padding for sidebar */}
      <div
        className={`${isSidebarOpen ? 'pl-56' : 'pl-14'} transition-all duration-200`}
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
