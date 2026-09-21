import ReviewObservationsClient from './review-observations-client';

export const dynamic='force-dynamic';
export const revalidate=0;

export default async function ReviewObservationsPage({params}:{params:Promise<{id:string}>}){
 const resolved=await params;
 return <ReviewObservationsClient masterProjectId={resolved.id}/>;
}
