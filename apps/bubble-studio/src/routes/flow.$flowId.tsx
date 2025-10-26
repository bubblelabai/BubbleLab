import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { FlowIDEView } from '@/components/FlowIDEView';

export const Route = createFileRoute('/flow/$flowId')({
  beforeLoad: ({ params }) => {
    const { isSignedIn } = useAuth();
    if (!isSignedIn) {
      throw redirect({ to: '/new' });
    }

    // Validate flowId is a number
    const flowId = parseInt(params.flowId, 10);
    if (isNaN(flowId)) {
      throw redirect({ to: '/home' });
    }
  },
  component: FlowRoute,
});

function FlowRoute() {
  const { flowId } = Route.useParams();
  const parsedFlowId = parseInt(flowId, 10);

  return <FlowIDEView flowId={parsedFlowId} />;
}
