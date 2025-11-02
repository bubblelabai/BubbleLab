import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { FlowIDEView } from '@/components/FlowIDEView';

export const Route = createFileRoute('/flow/$flowId')({
  component: FlowRoute,
});

function FlowRoute() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const { flowId } = Route.useParams();
  const parsedFlowId = parseInt(flowId, 10);

  // Redirect if not signed in
  if (!isSignedIn) {
    navigate({ to: '/home', replace: true });
    return null;
  }

  // Validate flowId is a number
  if (isNaN(parsedFlowId)) {
    navigate({ to: '/flows', replace: true });
    return null;
  }

  return <FlowIDEView flowId={parsedFlowId} />;
}
