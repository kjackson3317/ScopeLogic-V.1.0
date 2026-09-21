import { DEMO_MASTER_ID, DEMO_PROJECT_ID } from './config';

const pad=(n:number)=>String(n).padStart(3,'0');
const stamp='2026-09-21T18:00:00.000Z';

type Combo={rbb?:boolean;rfi?:boolean;cl?:boolean;csc?:boolean;ve?:boolean;status:'Open'|'Under Review'|'Resolved'|'Closed'};
const combos:Combo[]=[
 {rbb:true,status:'Closed'},
 {rbb:true,rfi:true,status:'Under Review'},
 {rbb:true,cl:true,status:'Resolved'},
 {rbb:true,csc:true,status:'Open'},
 {rbb:true,ve:true,status:'Closed'},
 {rbb:true,rfi:true,cl:true,status:'Under Review'},
 {rbb:true,rfi:true,csc:true,status:'Resolved'},
 {rbb:true,cl:true,ve:true,status:'Closed'},
 {rbb:true,rfi:true,cl:true,csc:true,status:'Under Review'},
 {rbb:true,rfi:true,cl:true,csc:true,ve:true,status:'Resolved'},
 {cl:true,status:'Open'},
 {rfi:true,status:'Under Review'},
 {csc:true,status:'Resolved'},
 {ve:true,status:'Open'},
 {rbb:true,ve:true,csc:true,status:'Closed'},
 {rbb:true,rfi:true,ve:true,status:'Under Review'},
 {rbb:true,cl:true,csc:true,status:'Resolved'},
 {rbb:true,rfi:true,cl:true,ve:true,status:'Under Review'},
 {rbb:true,status:'Closed'},
 {rbb:true,rfi:true,cl:true,csc:true,ve:true,status:'Open'},
];

const resolutions=[
 'Base-bid requirement established; no blocking follow-up remains.',
 'Awaiting design-team response before final disposition.',
 'GC direction received; current recommendation may proceed.',
 'Contractor confirmation remains outstanding before buyout.',
 'Base-bid issue closed; VE remains open as a non-blocking option.',
 'Design and GC coordination are both still active.',
 'RFI answered and contractor scope confirmed.',
 'Base scope resolved; VE may continue independently.',
 'RFI remains blocking; GC clarification is complete.',
 'Base scope resolved; VE remains available for consideration.',
 'GC direction is required before responsibility can be assigned.',
 'Formal RFI response is required before the issue can be resolved.',
 'Contractor confirmation documented; no additional design action required.',
 'Optional VE item only; base scope is not affected.',
 'Base scope closed; contractor confirmation complete; VE still optional.',
 'RFI remains blocking; VE is non-blocking.',
 'GC direction and contractor confirmation establish the current disposition.',
 'RFI is still blocking; GC clarification is complete and VE remains optional.',
 'Current base-bid requirement is final.',
 'Multiple actions remain active; final disposition has not been established.',
];

export function applyShowcaseSeed(seed:any){
 const project=seed.projects?.find((item:any)=>item.id===DEMO_PROJECT_ID) || seed.projects?.[0];
 if(project){
  project.name='Regional Emergency Operations & Communications Center - Rev 3';
  project.client='Regional Capital Projects Department';
  project.revision='Rev 3';
  project.status='Bidding';
  project.systems=['Structured Cabling','CCTV','Access Control','Audio Visual','Paging'];
  project.contract={...(project.contract||{}),notes:'Fictional coordination-heavy demonstration project. All names, quantities, pricing and documents are illustrative.'};
 }
 if(seed.customers?.[0]){
  seed.customers[0].name='Regional Capital Projects Department';
  seed.customers[0].address1='250 Operations Parkway';
  seed.customers[0].city='Example City';
 }
 const issues=(seed.issuesByProject?.[DEMO_PROJECT_ID]||[]).slice(0,20);
 issues.forEach((issue:any,i:number)=>{
  const combo=combos[i];
  issue.status=combo.status;
  issue.resolution=resolutions[i];
  issue.sow=Boolean(combo.rbb);
  issue.clarification=Boolean(combo.cl);
  issue.formalRfi=Boolean(combo.rfi);
  issue.checklist=Boolean(combo.csc);
  issue.recommendations=combo.rbb?{[issue.system]:Object.values(issue.recommendations||{})[0]||`Carry the complete ${issue.title.toLowerCase()} scope as shown and specified.`}:{};
  issue.rfiQuestion=combo.rfi?`Please confirm the design intent and responsibility for ${issue.title.toLowerCase()}. ${issue.concern}`:'';
  issue.rfis=combo.rfi?[{uid:`showcase-rfi-${i+1}`,number:`RFI-${pad(i+1)}`,title:issue.title,systems:[issue.system],question:issue.rfiQuestion,reference:issue.reference,status:i%3===0?'Answered':'Issued',response:i%3===0?'Design intent confirmed as noted in the current recommendation.':'',responseDate:'',responseSource:'',includeInFormalRfi:true,locked:false,releasedAt:'',relatedChildNumbers:[]}]:[];
  issue.recommendBaseBids=combo.rbb?[{uid:`showcase-rbb-${i+1}`,baseSequence:i+1,baseNumber:`RBB-${pad(i+1)}`,title:issue.title,selectedSystems:[issue.system],forceSuffix:false,sections:{[issue.system]:{uid:`showcase-rbb-section-${i+1}`,system:issue.system,suffix:'',displayNumber:`RBB-${pad(i+1)}`,recommendation:Object.values(issue.recommendations)[0],status:'Current',locked:false,contentReleased:false,releasedAt:'',supersedesNumber:'',basedOnRfiUids:[]}}}]:[];
  issue.checklistQuestions=combo.csc?[{uid:`showcase-csc-${i+1}`,number:`CL-${pad(i+1)}`,system:issue.system,question:`Confirm ${issue.title.toLowerCase()} is included in the proposal.`,status:i%2?'Confirmed':'Open',response:i%2?'Included':'',responseReason:'',locked:false,releasedAt:'',verifiesRbbNumbers:combo.rbb?[`RBB-${pad(i+1)}`]:[]}]:[];
  issue.checklistItems=combo.csc?{[issue.system]:`Confirm ${issue.title.toLowerCase()} is included in the proposal.`}:{};
  issue.checklistItem=combo.csc?`Confirm ${issue.title.toLowerCase()} is included in the proposal.`:'';
 });
 seed.issuesByProject[DEMO_PROJECT_ID]=issues;
 seed.notesByProject[DEMO_PROJECT_ID]='Showcase project intentionally includes varied SLR output combinations: RBB-only, RFI-only, GC Clarification-only, Contractor Confirmation-only, VE-only, and several multi-output SLRs.';
 if(seed.docsByProject?.[DEMO_PROJECT_ID]?.[0]){
  seed.docsByProject[DEMO_PROJECT_ID][0].name='Technology Coordination Plans — T1.01 / T2.01 / T3.01';
  seed.docsByProject[DEMO_PROJECT_ID][0].revision='Rev 3';
  seed.docsByProject[DEMO_PROJECT_ID][0].fileName='Regional-EOC-Technology-Plans.pdf';
 }
 return seed;
}

export function applyShowcaseTables(tables:Record<string,any[]>,workspace:any){
 const issues=(workspace.issuesByProject?.[DEMO_PROJECT_ID]||[]).slice(0,20);
 const common={master_project_id:DEMO_MASTER_ID,owner_id:'demo-presenter',created_by_user_id:'demo-presenter',created_at:stamp};
 const actions:any[]=[];const checklist:any[]=[];
 issues.forEach((issue:any,i:number)=>{
  const combo=combos[i];
  const base={...common,related_master_finding_id:issue.uid,sequence_number:i+1,system_name:issue.system,title:issue.title,reference:issue.reference,client_facing:true,sort_order:i+1,response_date:null,response_source:''};
  if(combo.rbb)actions.push({...base,id:`showcase-action-rbb-${i}`,deliverable_type:'RBB',display_number:`RBB-${pad(i+1)}`,content:Object.values(issue.recommendations||{})[0]||`Carry the complete ${issue.title.toLowerCase()} scope.`,status:'Current',response:'',impact_considerations:''});
  if(combo.rfi)actions.push({...base,id:`showcase-action-rfi-${i}`,deliverable_type:'RFI',display_number:`RFI-${pad(i+1)}`,content:issue.rfiQuestion,status:i%3===0?'Answered':'Open',response:i%3===0?'Design intent confirmed; use the current base-bid direction.':'',impact_considerations:''});
  if(combo.cl)actions.push({...base,id:`showcase-action-cl-${i}`,deliverable_type:'CL',display_number:`CL-${pad(i+1)}`,content:`Confirm GC coordination and trade responsibility for ${issue.title.toLowerCase()}.`,status:i%2?'Closed':'Open',response:i%2?'GC confirmed responsibility as noted in the current resolution.':'',impact_considerations:''});
  if(combo.ve)actions.push({...base,id:`showcase-action-ve-${i}`,deliverable_type:'VE',display_number:`VE-${pad(i+1)}`,content:`Evaluate a value-engineering option related to ${issue.title.toLowerCase()}.`,status:i%2?'Under Review':'Identified',response:'',impact_considerations:'Potential procurement or installation savings. Confirm owner standards and performance requirements before acceptance. No savings are priced by ScopeLogic.'});
  if(combo.csc)checklist.push({...common,id:`showcase-check-${i}`,linked_master_finding_id:issue.uid,sequence_number:i+1,display_number:`CSC-${pad(i+1)}`,category:i<5?'General Requirements':'Project-Specific',system_name:issue.system,question:`Confirm ${issue.title.toLowerCase()} is included in the proposal.`,status:i%2?'Confirmed':'Open',response:i%2?'Included':'',response_reason:i%2?'':'Bidder confirmation requested.',sort_order:i+1});
 });
 const rbbActions=actions.filter((item:any)=>item.deliverable_type==='RBB');
 const bidders=['Northstar Technology Services','Civic Systems Group','Metro Integration Partners'];
 const bids=bidders.flatMap((bidder,j)=>rbbActions.slice(0,8).map((rbb:any,i:number)=>({...common,id:`showcase-bid-${j}-${i}`,related_deliverable_id:rbb.id,bidder_name:bidder,scope_item:rbb.title,proposal_status:(i+j)%5===0?'Excluded':(i+j)%4===0?'Qualified':'Included',proposal_reference:`Proposal page ${i+3}`,clarification:(i+j)%5===0?'Confirm adder to include the complete requirement.':'',documented_adjustment:(i+j)%5===0?null:(i+j)%4===0?4500:0,adjustment_type:(i+j)%4===0?'Add':'None',pricing_source:(i+j)%5===0?'':'Bidder proposal',internal_notes:'Fictional demonstration comparison.',client_notes:(i+j)%5===0?'Unpriced scope difference; response requested.':(i+j)%4===0?'Documented bidder adder shown.':'Included per proposal.',sort_order:i+1})));
 tables.master_projects=[{id:DEMO_MASTER_ID,project_number:'MP-26024',name:'Regional Emergency Operations & Communications Center - Rev 3',location:'250 Operations Parkway, Example City, GA',status:'Bidding',revision:'Rev 3',version_date:'2026-09-21',systems:['Structured Cabling','CCTV','Access Control','Audio Visual','Paging']}];
 tables.master_project_findings=issues.map((issue:any,i:number)=>({...common,id:issue.uid,display_number:issue.id,scope_item:issue.title,systems:issue.systems,status:issue.status,scope_concern:issue.concern,resolution:issue.resolution,reference:issue.reference,sequence_number:i+1}));
 tables.master_project_deliverable_items=actions;
 tables.master_project_checklist_items=checklist;
 tables.master_project_bid_alignment_items=bids;
 tables.master_project_review_notes=issues.map((issue:any,i:number)=>({...common,id:`showcase-note-${i}`,system_name:issue.system,topic:issue.title,source_type:i%2?'Specification':'Drawing',source_reference:issue.reference,observation:issue.concern,snippet_label:'',disposition:'Linked to SLR',linked_master_finding_id:issue.uid}));
 return tables;
}
