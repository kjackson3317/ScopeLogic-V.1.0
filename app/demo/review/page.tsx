import { notFound } from 'next/navigation';
import { isEmployerDemo, DEMO_MASTER_ID } from '../../../lib/demo/config';
import ReviewDeliverablesClient from '../../master-projects/[id]/deliverables/review-deliverables-client';
export default function DemoReviewPage() {
 if(!isEmployerDemo) notFound();
 return <ReviewDeliverablesClient masterProjectId={DEMO_MASTER_ID} actualUserId="demo-presenter" workspaceOwnerId="demo-presenter" role="administrator" userName="Demo Presenter" />;
}
