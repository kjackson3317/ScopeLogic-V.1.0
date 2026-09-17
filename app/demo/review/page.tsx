import { redirect } from 'next/navigation';
import { isEmployerDemo } from '../../../lib/demo/config';

export default function DemoReviewPage() {
  if (!isEmployerDemo) redirect('/');
  redirect('/');
}
