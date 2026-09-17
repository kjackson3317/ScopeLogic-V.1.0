import { notFound } from 'next/navigation';
import { isEmployerDemo } from '../../../lib/demo/config';
import DemoDeliverablesClient from '../deliverables-client';

export default function DemoDeliverablesPage(){
 if(!isEmployerDemo)notFound();
 return <DemoDeliverablesClient/>;
}
