export type DemoSlrTemplateRecord = {
  id: string;
  legacy_id: string;
  name: string;
  active: true;
  template_data: Record<string, any>;
};

const record = (index: number, name: string, data: Record<string, any>): DemoSlrTemplateRecord => ({
  id: `demo-template-record-${String(index).padStart(2, '0')}`,
  legacy_id: `demo-template-${String(index).padStart(2, '0')}`,
  name,
  active: true,
  template_data: {
    title: name,
    status: 'Open',
    customSystem: '',
    reason: '',
    resolution: '',
    response: 'Included',
    responseReason: '',
    sourceType: data.sourceType || '',
    reference: data.reference || '',
    basis: data.basis || '',
    rfiQuestion: data.rfiQuestion || '',
    checklistItem: data.checklistItem || '',
    checklistItems: data.checklistItems || {},
    recommendations: data.recommendations || {},
    sow: data.sow ?? true,
    clarification: data.clarification ?? true,
    formalRfi: data.formalRfi ?? false,
    checklist: data.checklist ?? false,
    ...data,
  },
});

export const demoSlrTemplateRecords: DemoSlrTemplateRecord[] = [
  record(1, 'TV/Display Install', { system:'Structured Cabling', systems:['Structured Cabling'], concern:'Drawings are unclear on whether installation of Owner Furnished TVs is included.', recommendations:{'Structured Cabling':'Install Owner provided TVs. Backing and mounts by others.'}, rfiQuestion:'Is the low-voltage contractor responsible for installing Owner-provided TVs?', checklistItems:{'Structured Cabling':'Is TV installation included?'}, formalRfi:true }),
  record(2, 'WestNet Cable', { system:'Structured Cabling', systems:['Structured Cabling'], concern:'Drawings state that the contractor is responsible for the specialty public-safety cable but cable requirements must be coordinated with the system vendor.', recommendations:{'Structured Cabling':'Coordinate cable type, pathway and termination requirements with the specialty system vendor before pricing.'}, reference:'E5.01 & E5.02', sow:false, formalRfi:false }),
  record(3, 'CCTV Cable', { system:'Structured Cabling', systems:['Structured Cabling','CCTV'], concern:'Camera cable responsibility is not clearly assigned between structured cabling and security.', basis:'Structured Cabling contractor provides, installs, terminates, tests and labels one Cat 6 cable for each camera.', recommendations:{'Structured Cabling':'Provide, install, terminate, test and label one Cat 6 cable for each camera.','CCTV':'Exclude horizontal camera cable.'}, rfiQuestion:'Which contractor is responsible for providing the camera cable?', checklist:true, checklistItem:'Camera cable responsibility included?', checklistItems:{'Structured Cabling':'Camera cable included?','CCTV':'Camera cable excluded from security equipment scope?'}, formalRfi:true }),
  record(4, 'MDF/IDF Buildout', { system:'Structured Cabling', systems:['Structured Cabling'], concern:'Specifications identify rack types but the drawings do not fully define the telecom-room buildout.', recommendations:{'Structured Cabling':'Exclude undefined MDF/IDF room buildout until rack, ladder tray and room requirements are confirmed.'}, rfiQuestion:'Who is responsible for racks and telecom-room buildout, and what rack/ladder-rack configuration is required?', checklistItems:{'Structured Cabling':'Telecom-room buildout basis confirmed?'}, formalRfi:true }),
  record(5, 'UPS Requirements', { system:'Structured Cabling', systems:['Structured Cabling'], concern:'Bid documents conflict on responsibility for UPS equipment.', recommendations:{'Structured Cabling':'Exclude UPS equipment unless specifically assigned.'}, rfiQuestion:'Who is responsible for UPS equipment, and what size/model is required if contractor furnished?', checklistItems:{'Structured Cabling':'UPS equipment excluded unless specifically assigned?'}, formalRfi:true }),
  record(6, 'Pole Camera Fiber', { system:'Structured Cabling', systems:['Structured Cabling'], concern:'Drawings call for 12-strand OS2 fiber to each camera pole although fewer strands may satisfy the endpoint requirement.', basis:'Provide 6-strand OS2 OSP fiber from MDF to each camera pole; terminate, test and label all strands.', recommendations:{'Structured Cabling':'Provide 6-strand OS2 OSP fiber from MDF to each camera pole; terminate, test and label all strands.'}, reference:'SE5.01', sourceType:'Drawing', rfiQuestion:'Are 12 strands required at each pole, or is a smaller strand count with spare pairs acceptable?', checklist:true, checklistItem:'Fiber strand count to each pole confirmed?', formalRfi:true }),
  record(7, 'Vehicle Pedestal', { system:'Structured Cabling', systems:['Structured Cabling'], concern:'Pathway and connectivity requirements for the vehicle pedestal are not fully defined.', basis:'Provide six-strand OSP OS2 fiber to a pedestal network enclosure with PoE switching; branch power by electrical contractor.', recommendations:{'Structured Cabling':'Provide six-strand OSP OS2 fiber to the pedestal network enclosure and coordinate active equipment/power requirements.'}, reference:'T4.01 and SE1.01', sourceType:'Drawing', rfiQuestion:'What connectivity, network enclosure and pathway are required at the vehicle pedestal?', checklist:true, checklistItem:'Vehicle pedestal fiber/network enclosure included?', formalRfi:true }),
  record(8, 'UPS and PDU Requirements', { system:'Structured Cabling', systems:['Structured Cabling'], concern:'Bid documents do not clearly assign responsibility for UPS and PDU equipment.', basis:'Exclude UPS and PDU equipment pending confirmation.', recommendations:{'Structured Cabling':'Exclude UPS and PDU equipment pending confirmation.'}, reference:'E6.03', sourceType:'Drawing', rfiQuestion:'Are UPS and PDUs owner furnished or contractor furnished? If contractor furnished, provide required sizes/part numbers.', checklist:true, checklistItem:'UPS and PDU responsibility confirmed?', formalRfi:true }),
  record(9, 'Fiber Panel on Rack Detail', { system:'Structured Cabling', systems:['Structured Cabling'], concern:'Rack detail shows a fiber panel although no project fiber scope is otherwise identified.', basis:'Exclude fiber and fiber material unless a backbone/service-provider requirement is confirmed.', recommendations:{'Structured Cabling':'Exclude fiber and fiber material unless a backbone/service-provider requirement is confirmed.'}, reference:'E6.03', sourceType:'Drawing', rfiQuestion:'Is the fiber panel shown on the rack detail required, and what fiber is intended to terminate there?', checklist:true, checklistItem:'Fiber material basis confirmed?', formalRfi:true }),
  record(10, 'Network Equipment', { system:'Structured Cabling', systems:['Structured Cabling'], concern:'Drawings reference network equipment without clearly defining procurement responsibility.', basis:'Exclude active network equipment.', recommendations:{'Structured Cabling':'Exclude switches, routers, firewalls and other active network equipment unless specifically assigned.'}, reference:'E5.01', sourceType:'Drawing', rfiQuestion:'Is network equipment owner furnished or contractor furnished? If contractor furnished, provide standards and equipment requirements.', checklist:true, checklistItem:'Active network equipment excluded unless specifically assigned?', formalRfi:true }),
  record(11, 'Existing FA Manufacturer', { system:'Fire Alarm', systems:['Fire Alarm'], concern:'Documents require new fire-alarm work to remain compatible with the existing system but do not identify the existing manufacturer.', recommendations:{'Fire Alarm':'Confirm existing manufacturer and compatibility requirements before pricing final equipment.'}, reference:'E-4', sourceType:'Drawing', rfiQuestion:'What is the existing fire-alarm manufacturer/model that the new work must remain compatible with?', sow:false, formalRfi:true }),
  record(12, 'Tel/Data Cable', { system:'Structured Cabling', systems:['Structured Cabling'], concern:'Drawing notes conflict on responsibility for telecommunications/data cable.', basis:'Provide telecommunications/data cable for all indicated locations.', recommendations:{'Structured Cabling':'Provide telecommunications/data cable for all indicated locations.'}, reference:'E-4 General Notes 1 & 4', sourceType:'Drawing', rfiQuestion:'Who is responsible for furnishing and installing telecommunications/data cable where drawing notes conflict?', checklist:true, checklistItem:'Telecommunications/data cable included?', formalRfi:true }),
  record(13, 'Security System OFOI, OFCI, or CFCI', { system:'Access Control', systems:['Access Control','CCTV'], concern:'Documents do not clearly establish procurement and installation responsibility for security equipment and associated cabling.', basis:'Carry camera cabling in base bid and access-control cabling as an add option until responsibility is confirmed.', recommendations:{'CCTV':'Provide camera cabling in the base bid.','Access Control':'Provide access-control cabling as an add option.'}, sourceType:'Not Mentioned in Contract Documents', rfiQuestion:'Who is responsible for procurement/installation of CCTV and access-control equipment and cabling?', checklist:true, checklistItems:{'CCTV':'Camera cable included in base?','Access Control':'Access-control cable included as an option?'}, formalRfi:true }),
  record(14, 'Tel/Data Outlet Cable Qty', { system:'Structured Cabling', systems:['Structured Cabling'], concern:'The legend does not define the number of data cables required for each outlet symbol.', basis:'Provide two cables for combination outlets, one for telephone-only and one for data-only symbols.', recommendations:{'Structured Cabling':'Provide two cables for combination outlets, one for telephone-only and one for data-only symbols.'}, reference:'E-1', sourceType:'Drawing', rfiQuestion:'How many data cables are required for each outlet symbol type?', checklist:true, checklistItem:'Outlet cable quantities carried per bid basis?', formalRfi:true }),
  record(15, 'Cat 6 vs Cat 6A', { system:'Structured Cabling', systems:['Structured Cabling'], concern:'Specifications require Cat 6A while drawing legends call for Cat 6.', recommendations:{'Structured Cabling':'Provide Cat 6A for all locations and identify a Cat 6 deduct where permitted.'}, reference:'T0.01 Data Legend and 27 1513 §2.5', sourceType:'Drawing; Specification', rfiQuestion:'Is Cat 6 or Cat 6A required, and are WAP locations intended to remain Cat 6A if workstation cabling is Cat 6?', checklist:true, checklistItem:'Cat 6A base bid / Cat 6 deduct basis confirmed?', formalRfi:false }),
  record(16, 'LV Systems OFOI, OFCI, or CFCI', { system:'Structured Cabling', systems:['Structured Cabling'], concern:'Specifications assign low-voltage systems to the contractor while drawings indicate owner responsibility.', recommendations:{'Structured Cabling':'Provide and label cabling required for low-voltage systems except fire alarm; final equipment/termination by owner vendor unless assigned otherwise.'}, rfiQuestion:'Who is responsible for procurement, installation and cabling of the low-voltage systems?', checklistItems:{'Structured Cabling':'Cabling responsibility for all low-voltage systems confirmed?'}, formalRfi:false }),
  record(17, 'MATV/CATV', { system:'Structured Cabling', systems:['Structured Cabling'], concern:'A MATV/CATV specification and riser are present, but coaxial cable requirements are not clearly identified.', recommendations:{'Structured Cabling':'Provide two Cat 6A cables to display locations and exclude coaxial/MATV equipment unless specifically confirmed.'}, reference:'T5.01 Detail 2 and Division 27', rfiQuestion:'What cable is required for display locations, and is a MATV/CATV system required?', checklistItems:{'Structured Cabling':'Display cabling basis and MATV/CATV exclusion confirmed?'}, formalRfi:true }),
  record(18, 'Parking Lot Pole Cameras', { system:'Structured Cabling', systems:['Structured Cabling'], concern:'Drawings require a network enclosure at each parking-lot camera pole without fully defining the assembly.', basis:'Provide a weather-rated fiber/PoE network enclosure at each camera pole.', recommendations:{'Structured Cabling':'Provide a weather-rated fiber/PoE network enclosure at each camera pole.'}, reference:'SE5.01', sourceType:'Drawing', rfiQuestion:'Is a weather-rated fiber/PoE network enclosure acceptable at each parking-lot camera pole?', checklist:true, checklistItem:'Pole-camera network enclosure included?', formalRfi:true }),
];

export const demoWorkspaceSlrTemplates = demoSlrTemplateRecords.map((record) => {
  const data = record.template_data;
  return {
    uid: record.legacy_id,
    name: record.name,
    issue: {
      system: data.system || '',
      customSystem: data.customSystem || '',
      systems: data.systems || (data.system ? [data.system] : []),
      recommendations: data.recommendations || {},
      title: data.title || record.name,
      status: data.status || 'Open',
      concern: data.concern || '',
      rfiQuestion: data.rfiQuestion || '',
      basis: data.basis || '',
      reason: data.reason || '',
      reference: data.reference || '',
      sourceType: data.sourceType || '',
      resolution: '',
      sow: data.sow ?? true,
      clarification: data.clarification ?? true,
      formalRfi: data.formalRfi ?? false,
      checklist: data.checklist ?? false,
      checklistItem: data.checklistItem || '',
      checklistItems: data.checklistItems || {},
      response: data.response || 'Included',
      responseReason: '',
      numberLocked: false,
      numberReleasedAt: '',
      rbbScopeLetterMap: {},
      rfis: [],
      recommendBaseBids: [],
      checklistQuestions: [],
    },
  };
});
