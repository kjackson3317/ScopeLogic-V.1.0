import { DEMO_MASTER_ID as masterId, DEMO_PROJECT_ID as projectId } from './config';

export const demoSystems = ['Structured Cabling', 'CCTV', 'Access Control', 'Audio Visual', 'Paging'];
const date = '2026-09-16';
const stamp = date + 'T12:00:00.000Z';
const pad = (n: number) => String(n).padStart(3, '0');
// Independently authored fictional scenarios. No client/project exports are used.
const topics: [string, string, string, string][] = [
 ['Structured Cabling','Horizontal cable category','Workstation notes call for Cat6 while wireless outlets require Cat6A.','Provide Cat6 to workstations and Cat6A to wireless access points.'],
 ['Structured Cabling','Dual data outlets','Twenty-four office locations show two data connections each.','Provide two complete tested cable channels at every dual outlet.'],
 ['Structured Cabling','Telecom room racks','Rack elevations show two cabinets with shared cable management.','Include two 42U cabinets, vertical managers and grounding kits.'],
 ['Structured Cabling','Fiber backbone','The equipment room and dispatch closet require diverse backbone routes.','Provide two 12-strand OS2 backbone runs with termination and testing.'],
 ['Structured Cabling','Certification testing','The specification requires full permanent-link certification.','Include electronic test results for every copper and fiber link.'],
 ['Structured Cabling','Cable support','Open ceiling areas require independent cable support.','Provide dedicated supports; do not attach to ceiling grid wires.'],
 ['CCTV','Camera coverage','Entry doors and public corridors require continuous recorded coverage.','Provide fixed dome cameras at all scheduled locations.'],
 ['CCTV','Recording retention','Thirty-day retention is stated without final recording settings.','Carry 30 days continuous recording at scheduled resolution.'],
 ['CCTV','Exterior camera power','Exterior camera poles show low-voltage devices without power responsibility.','Coordinate branch power by the electrical contractor.'],
 ['CCTV','Camera licenses','The camera schedule contains 18 endpoints.','Include 18 perpetual camera connection licenses.'],
 ['CCTV','Network segregation','Security devices require a separate network segment.','Coordinate security VLAN and switch configuration with owner IT.'],
 ['Access Control','Controlled doors','Six doors require readers and supervised door monitoring.','Include reader, controller, contact and request-to-exit interface per door.'],
 ['Access Control','Door hardware interface','Hardware schedule and security riser use different lock descriptions.','Carry interface wiring to electrified hardware furnished by door vendor.'],
 ['Access Control','Emergency release','Required release interfaces must coordinate with fire alarm.','Include dry-contact interface and witnessed integrated testing.'],
 ['Access Control','Credential enrollment','Owner requests initial staff enrollment.','Include configuration and initial enrollment for 75 credentials.'],
 ['Audio Visual','Training room display','Training room uses two presentation positions.','Include two commercial displays and mounting hardware.'],
 ['Audio Visual','Room control','Control descriptions call for a single room operating interface.','Provide a programmed touch interface with owner-approved presets.'],
 ['Audio Visual','Hearing assistance','Assembly rooms require an accessible listening system.','Include listening system, receivers, signage and commissioning.'],
 ['Audio Visual','Conference connectivity','Table boxes require owner-selected connections.','Confirm HDMI and USB-C inputs before submittal.'],
 ['Audio Visual','Display backing','Mounting locations require structural support.','Coordinate wall backing with general contractor.'],
 ['Paging','Paging zones','Public areas and staff areas must be independently selectable.','Provide separate public and staff paging zones.'],
 ['Paging','Speaker coverage','Ceiling plans show speakers through dispatch support areas.','Include distributed speakers with final tap settings at commissioning.'],
 ['Paging','Priority override','Emergency messages must override routine paging.','Confirm priority interface requirements with owner.'],
 ['Paging','Amplifier capacity','Future areas are noted on the plan.','Carry spare amplifier capacity for the designated future zone.'],
 ['Structured Cabling','Labeling','Owner room numbering will change before occupancy.','Confirm final labeling schedule before cable certification.'],
 ['CCTV','Owner training','Operations staff need live and recorded video training.','Include two operator training sessions and recorded handover.'],
 ['Access Control','Closeout documentation','As-built door point lists must match the controller database.','Deliver editable point lists, backups and record drawings.'],
 ['Audio Visual','Warranty support','The commissioning specification requires a supported handover.','Include one year installation warranty and support contact details.'],
];

export function makeDemoSeed(): any {
 const issues = topics.map(([system,title,concern,recommendation],i) => ({
  uid:`demo-slr-${i+1}`,id:`SLR-${pad(i+1)}`,system,systems:[system],customSystem:'',title,concern,status:i%5===0?'Resolved':'Open',
  recommendations:i<18?{[system]:recommendation}:{},basis:'',reason:'',reference:`T${i%2+1}.01 Note ${i+1}; ${system==='Structured Cabling'?'27 10 00':'28 00 00'} §2.${i%5+1}`,sourceType:'Drawing; Specification',rfi:'',resolution:'',snippet:'',
  sow:i<18,clarification:true,formalRfi:i<8,checklist:true,rfiQuestion:i<8?`Please confirm the design intent for ${title.toLowerCase()}. ${concern}`:'',
  checklistItem:`Confirm ${title.toLowerCase()} is included.`,checklistItems:{[system]:`Confirm ${title.toLowerCase()} is included.`},response:'Included',responseReason:'',
  numberLocked:false,numberReleasedAt:'',rbbScopeLetterMap:{},
  rfis:i<8?[{uid:`demo-rfi-${i+1}`,number:`RFI-${pad(i+1)}`,title,systems:[system],question:`Please confirm the design intent for ${title.toLowerCase()}. ${concern}`,reference:`T1.01 Note ${i+1}`,status:'Issued',response:'',responseDate:'',responseSource:'',includeInFormalRfi:true,locked:false,releasedAt:'',relatedChildNumbers:[]}]:[],
  recommendBaseBids:i<18?[{uid:`demo-rbb-${i+1}`,baseSequence:i+1,baseNumber:`RBB-${pad(i+1)}`,title,selectedSystems:[system],forceSuffix:false,sections:{[system]:{uid:`demo-section-${i+1}`,system,suffix:'',displayNumber:`RBB-${pad(i+1)}`,recommendation,status:'Current',locked:false,contentReleased:false,releasedAt:'',supersedesNumber:'',basedOnRfiUids:[]}}}]:[],
  checklistQuestions:[{uid:`demo-check-${i+1}`,number:`CL-${pad(i+1)}`,system,question:`Confirm ${title.toLowerCase()} is included.`,status:'Open',response:'Included',responseReason:'',locked:false,releasedAt:'',verifiesRbbNumbers:[]}],
 }));
 const partSpecs: [string,string,number,number][] = [
  ['CAT6','Cat6 cable run — 150 ft allowance',72,18],['JACK','Cat6 modular jack',5.4,4],['PLATE','Dual-port faceplate',2.8,3],['PORT','Patch-panel port allocation',4.25,3],['PC-W','Workstation patch cord',6.5,1],['PC-R','Rack patch cord',4.5,1],
  ['CAM','Fixed dome camera',285,35],['READER','Card reader',165,30],['SPEAKER','Ceiling speaker',42,12],['CAT6A','Cat6A cable run — 150 ft allowance',105,20],
 ];
 const parts=partSpecs.map(([id,description,unitCost,installationMinutes],i)=>({id,manufacturer:'Demo Components',partNumber:`TP-${id}`,description,system:i===6?'CCTV':i===7?'Access Control':i===8?'Paging':'Structured Cabling',category:'Demo Catalog',bomSection:'Devices & Cabling',unitCost,materialMarkup:1.2,engineeringMinutes:1,installationMinutes,programmingMinutes:0,testingMinutes:2,vendor:'Fictional Supply Co.',updatedAt:stamp,active:true}));
 const formula={id:'dual-data',name:'Dual Data Outlet',system:'Structured Cabling',unitLabel:'outlets',scenario:'Custom',active:true,items:parts.slice(0,6).map((p:any,i:number)=>({id:`formula-${i}`,partId:p.id,qtyPerUnit:i===2?1:2,calculationMode:'multiply'})),laborMinutesPerUnit:{installation:8}};
 const lines=parts.slice(0,6).map((p:any,i:number)=>({...p,id:`quote-line-${i}`,partId:p.id,qty:i===2?24:48,quantitySources:{manual:0,template:0,takeoff:i===2?24:48},takeoffGenerated:true}));
 const tools=[['Single Data','Structured Cabling',1],['Dual Data','Structured Cabling',2],['WAP','Structured Cabling',2],['Camera','CCTV',1],['Card Reader','Access Control',1],['Controlled Door','Access Control',1],['Speaker','Paging',1],['Cable Path','Structured Cabling',1],['Cable Tray','Structured Cabling',1],['Fiber Backbone','Structured Cabling',1]].map(([name,system,multiplier],i)=>({id:`tool-${i}`,name,system,multiplier,unit:i<3?'cables':'qty',shape:['square','triangle','circle','diamond'][i%4],color:['#31513b','#2563eb','#b45309','#6d28d9'][i%4],scope:'global',formulaId:i===1?'dual-data':undefined,formulaQuantityBasis:i===1?'locations':undefined}));
 return {projectId,projects:[{id:projectId,createdAt:stamp,name:'Municipal Public Safety Facility - Rev 2',client:'Municipal Facilities Department',customerId:'demo-customer',contactIds:[],versionDate:date,status:'Bidding',systems:demoSystems,revision:'Rev 2',modified:'Today',contract:{status:'Draft',offering:'Technology Preconstruction',notes:'Fictional employer demonstration; all costs are illustrative.'}}],
 issuesByProject:{[projectId]:issues},docsByProject:{[projectId]:[{id:'demo-drawings',type:'Drawings',name:'Technology Floor Plans — T1.01 / T2.01',revision:'Rev 2',date,current:true,notes:'Fictional two-sheet training drawing. Known dimension: 60 ft.',fileName:'Municipal-Technology-Plans.pdf',fileType:'application/pdf',sizeBytes:0}]},
 notesByProject:{[projectId]:'Presentation project. All names, drawings, quantities and prices are fictional.'},exportsByProject:{[projectId]:[]},templates:[],calendarEntries:[],customers:[{id:'demo-customer',name:'Municipal Facilities Department',address1:'100 Civic Plaza',address2:'',city:'Example City',state:'GA',zip:'00000',website:'',notes:'Fictional demonstration customer',contacts:[]}],
 laborRates:[{id:'engineering',name:'Engineering',costPerHour:70,markup:1.2,active:true},{id:'installation',name:'Installation',costPerHour:48,markup:1.25,active:true},{id:'programming',name:'Programming',costPerHour:68,markup:1.2,active:true},{id:'testing',name:'Testing / Commissioning',costPerHour:55,markup:1.2,active:true}],difficultyMultipliers:[{id:'standard',name:'Standard',multiplier:1,active:true}],parts,
 quotesByProject:{[projectId]:[{id:'demo-quote',number:'Q-26001',name:'Structured Cabling — Base Estimate',status:'Draft',taxRate:7,bondRate:0,shipping:0,otherCosts:0,globalMaterialMarkup:1.2,lines,createdAt:stamp,updatedAt:stamp,groups:[],breakouts:[],alternates:[],quoteKind:'base',quoteYear:2026,rootSequence:1,revisionNumber:0,locked:false}]},quoteTemplates:[],takeoffFormulas:[formula],
 takeoffEntriesByProject:{[projectId]:[{id:'drawing-dual-data',formulaId:'dual-data',description:'24 Dual Data Outlets',qty:24,notes:'24 outlet locations × 2 cables per outlet = 48 channels',source:'drawing'}]},takeoffSettingsByProject:{[projectId]:{selectedSystems:demoSystems,activeRuleIds:['dual-data'],averageCableLength:150}},drawingTakeoffTools:tools,
 drawingTakeoffMarksByProject:{[projectId]:Array.from({length:24},(_,i)=>({id:`mark-${i}`,docId:'demo-drawings',page:1,toolId:'tool-1',x:(140+(i%6)*110)/1000,y:(200+Math.floor(i/6)*95)/700}))},drawingMeasurementsByProject:{[projectId]:[]},drawingCalibrationsByProject:{[projectId]:{}},drawingAnnotationsByProject:{[projectId]:[]},scopeOfWorkByProject:{[projectId]:{includedHtml:'<p>Provide 24 dual data outlets, 48 complete cable channels, labeling and certification.</p>',excludedHtml:'<p>Active network equipment and electrical branch circuits by others.</p>'}}};
}

export function makeDemoTables(): Record<string, any[]> {
 const seed=makeDemoSeed(), issues=seed.issuesByProject[projectId];
 const common={master_project_id:masterId,owner_id:'demo-presenter',created_by_user_id:'demo-presenter',created_at:stamp};
 const actions:any[]=[];
 const add=(type:string,i:number,content:string,extra:any={})=>{const s=issues[i];actions.push({...common,id:`action-${type}-${i}`,related_master_finding_id:s.uid,deliverable_type:type,sequence_number:i+1,display_number:`${type==='SLC'?'IC':type}-${pad(i+1)}`,system_name:s.system,title:s.title,content,reference:s.reference,status:type==='RBB'?'Current':type==='VE'?'Identified':'Open',response:'',response_date:null,response_source:'',client_facing:type!=='SLC',sort_order:i+1,impact_considerations:'',...extra});};
 for(let i=0;i<18;i++)add('RBB',i,topics[i][3]);
 for(let i=0;i<10;i++)add('CL',i,`Confirm trade responsibility and coordination for ${issues[i].title.toLowerCase()} before buyout.`);
 for(let i=0;i<8;i++)add('RFI',i,issues[i].rfiQuestion);
 const ves=['Standardize workstation patch-cord lengths','Use modular jack panels for phased expansion','Consolidate rack accessories into a kit','Use preterminated backbone where pathways permit','Batch certification by closet','Coordinate common cable supports','Standardize indoor camera models','Review recording schedules with owner'];
 for(let i=0;i<8;i++)add('VE',i,ves[i],{impact_considerations:'Potential installation or procurement savings. Confirm owner standards, maintain specified performance and obtain approval before substitution. No savings have been priced.'});
 add('SLC',12,'Compare door hardware schedule to the security riser before finalizing the interface recommendation.');
 return {master_projects:[{id:masterId,project_number:'MP-26001',name:seed.projects[0].name,location:'100 Civic Plaza, Example City',status:'Bidding',revision:'Rev 2',version_date:date,systems:demoSystems}],master_project_findings:issues.map((s:any,i:number)=>({...common,id:s.uid,display_number:s.id,scope_item:s.title,systems:s.systems,status:s.status,sequence_number:i+1})),master_project_deliverable_items:actions,
 master_project_review_notes:issues.slice(0,16).map((s:any,i:number)=>({...common,id:`note-${i}`,system_name:s.system,topic:s.title,source_type:i%2?'Specification':'Drawing',source_reference:s.reference,observation:s.concern,snippet_label:'',disposition:'Linked to SLR',linked_master_finding_id:s.uid})),
 master_project_checklist_items:issues.slice(0,16).map((s:any,i:number)=>({...common,id:`check-${i}`,linked_master_finding_id:s.uid,sequence_number:i+1,display_number:`CSC-${pad(i+1)}`,category:i<6?'General Requirements':'Project-Specific',system_name:s.system,question:s.checklistItem,status:'Open',response:i%3?'Included':'Qualified',response_reason:i%3?'':'Confirm quantity at final drawing issue.',sort_order:i+1})),
 master_project_bid_alignment_items:['Northstar Technology Services','Civic Systems Group'].flatMap((bidder,j)=>issues.slice(0,6).map((s:any,i:number)=>({...common,id:`bid-${j}-${i}`,related_deliverable_id:`action-RBB-${i}`,bidder_name:bidder,scope_item:s.title,proposal_status:i===j?'Excluded':i===j+2?'Qualified':'Included',proposal_reference:`Fictional proposal page ${i+2}`,clarification:i===j?'Confirm adder to include complete scope.':'',documented_adjustment:i===j?null:0,adjustment_type:'None',pricing_source:i===j?'':'Fictional bidder proposal',internal_notes:'Demonstration comparison only',client_notes:i===j?'Unpriced scope difference; response requested.':'Included per proposal.',sort_order:i+1}))) };
}
