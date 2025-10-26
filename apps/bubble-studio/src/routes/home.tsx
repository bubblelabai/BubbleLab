import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { HomePage } from '@/pages/HomePage';
import { useAuth } from '@/hooks/useAuth';
import { useDeleteBubbleFlow } from '@/hooks/useDeleteBubbleFlow';
import { useGenerationStore } from '@/stores/generationStore';
import { useOutputStore } from '@/stores/outputStore';
import { useBubbleFlowList } from '@/hooks/useBubbleFlowList';
import { toast } from 'react-toastify';

export const Route = createFileRoute('/home')({
  beforeLoad: () => {
    const { isSignedIn } = useAuth();
    if (!isSignedIn) {
      throw redirect({ to: '/new' });
    }
  },
  component: HomeRoute,
});

function HomeRoute() {
  const navigate = useNavigate();
  const deleteBubbleFlowMutation = useDeleteBubbleFlow();
  const { isStreaming } = useGenerationStore();
  const { setOutput } = useOutputStore();
  const { data: bubbleFlowList } = useBubbleFlowList();

  const navigationLockToastId = 'sidebar-navigation-lock';

  const notifyNavigationLocked = () => {
    if (!toast.isActive(navigationLockToastId)) {
      toast.info(
        'Flow generation in progress. Please wait until it completes before navigating.',
        {
          toastId: navigationLockToastId,
          autoClose: 3000,
        }
      );
    }
  };

  const handleFlowSelect = (flowId: number) => {
    if (isStreaming) {
      notifyNavigationLocked();
      return;
    }
    navigate({ to: '/flow/$flowId', params: { flowId: flowId.toString() } });
  };

  const handleFlowDelete = async (flowId: number, event: React.MouseEvent) => {
    event.stopPropagation();

    if (isStreaming) {
      notifyNavigationLocked();
      return;
    }

    // Show confirmation dialog
    const flowName = bubbleFlowList?.bubbleFlows.find(
      (flow) => flow.id === flowId
    )?.name;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${flowName}"?\n\nThis action cannot be undone.`
    );

    if (confirmed) {
      try {
        console.log('[deleteFlow] Deleting flow with ID:', flowId);

        // Use the delete mutation with optimistic updates
        await deleteBubbleFlowMutation.mutateAsync(flowId);
        setOutput(
          (prev) => prev + `\n✅ Flow "${flowName}" deleted successfully.`
        );

        console.log('[deleteFlow] Flow deletion completed successfully');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.error('[deleteFlow] Error deleting flow:', error);

        setOutput(
          (prev) =>
            prev + `\n❌ Failed to delete flow "${flowName}": ${errorMessage}`
        );
      }
    }
  };

  const handleNavigateToDashboard = () => {
    if (isStreaming) {
      notifyNavigationLocked();
      return;
    }
    navigate({ to: '/new' });
  };

  return (
    <div className="h-screen flex flex-col bg-[#1a1a1a] text-gray-100">
      <div className="flex-1 min-h-0">
        <HomePage
          onFlowSelect={handleFlowSelect}
          onFlowDelete={handleFlowDelete}
          onNavigateToDashboard={handleNavigateToDashboard}
        />
      </div>
    </div>
  );
}
