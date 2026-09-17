// Sanitized demo copies of the user's saved SLR templates.
// Project-specific references, release numbers, and personal/vendor contact details are intentionally removed.

const emptyChildren = () => ({
  numberLocked: false,
  numberReleasedAt: '',
  rbbScopeLetterMap: {},
  rfis: [],
  recommendBaseBids: [],
  checklistQuestions: [],
});

type TemplateInput = {
  name: string;
  system: string;
  systems?: string[];
  concern: string;
  recommendation?: string;
  recommendations?: Record<string, string>;
  rfiQuestion?: string;
  checklistItem?: string;
  checklistItems?: Record<string, string>;
  sow?: boolean;
  formalRfi?: boolean;
  checklist?: boolean;
  sourceType?: string;
  basis?: string;
};

function template(uid: string, input: TemplateInput) {
  const systems = input.systems?.length ? input.systems : [input.system];
  const recommendations = input.recommendations || (input.recommendation ? { [input.system]: input.recommendation } : {});
  const checklistItems = input.checklistItems || (input.checklistItem ? { [input.system]: input.checklistItem } : {});
  return {
    uid,
    name: input.name,
    issue: {
      system: input.system,
      customSystem: '',
      systems,
      recommendations,
      title: input.name,
      status: 'Open',
      concern: input.concern,
      rfiQuestion: input.rfiQuestion || '',
      basis: input.basis || '',
      reason: '',
      reference: '',
      sourceType: input.sourceType || '',
      resolution: '',
      sow: input.sow !== false,
      clarification: true,
      formalRfi: Boolean(input.formalRfi),
      checklist: Boolean(input.checklist),
      checklistItem: input.checklistItem || '',
      checklistItems,
      response: 'Included',
      responseReason: '',
      ...emptyChildren(),
    },
  };
}

export const demoSlrTemplates = [
  template('demo-template-cat6-vs-cat6a', {
    name: 'Cat 6 vs Cat 6A',
    system: 'Structured Cabling',
    concern: 'Specifications require Cat 6A while drawing notes or legends indicate Cat 6 for the same data outlets.',
    recommendation: 'Carry Cat 6A as the base bid where the contract documents conflict, with a separate Cat 6 deduct where appropriate.',
    rfiQuestion: 'Please confirm whether Cat 6 or Cat 6A is required and whether WAP locations require a different cable category than standard data outlets.',
    checklistItem: 'Confirm the base bid cable category and any separate Cat 6 deduct.',
    checklist: true,
  }),
  template('demo-template-cctv-cable', {
    name: 'CCTV Cable',
    system: 'Structured Cabling',
    systems: ['Structured Cabling', 'CCTV'],
    concern: 'Camera cabling responsibility is not clearly assigned between the structured cabling and security contractors.',
    recommendations: {
      'Structured Cabling': 'Provide, install, terminate, test, and label one Cat 6 cable for each camera unless the contract documents state otherwise.',
      CCTV: 'Exclude horizontal camera cabling when it is assigned to the structured cabling contractor.',
    },
    rfiQuestion: 'Which contractor is responsible for providing and installing the camera cabling?',
    checklistItems: {
      'Structured Cabling': 'Confirm one complete tested Cat 6 channel is included for each camera.',
      CCTV: 'Confirm camera cabling is excluded when carried by the structured cabling contractor.',
    },
    formalRfi: true,
    checklist: true,
  }),
  template('demo-template-existing-fa-manufacturer', {
    name: 'Existing FA Manufacturer',
    system: 'Fire Alarm',
    concern: 'The documents require the new fire alarm work to be compatible with an existing system but do not identify the existing manufacturer or platform.',
    rfiQuestion: 'What is the existing fire alarm manufacturer and platform that the new work must be compatible with?',
    formalRfi: true,
    sow: false,
  }),
  template('demo-template-fiber-panel-rack-detail', {
    name: 'Fiber Panel on Rack Detail',
    system: 'Structured Cabling',
    concern: 'A fiber panel is shown on the rack detail, but the project documents do not clearly identify a corresponding fiber backbone scope.',
    recommendation: 'Exclude fiber and fiber termination materials unless fiber backbone requirements are identified elsewhere in the contract documents.',
    rfiQuestion: 'Is the fiber panel shown on the rack detail required, and is any contractor-furnished fiber backbone associated with it?',
    checklistItem: 'Confirm fiber backbone and fiber material are excluded unless specifically identified.',
    formalRfi: true,
    checklist: true,
  }),
  template('demo-template-lv-systems-delivery', {
    name: 'LV Systems OFOI, OFCI, or CFCI',
    system: 'Structured Cabling',
    concern: 'The specifications and drawings conflict on whether low-voltage systems are Owner Furnished/Owner Installed, Owner Furnished/Contractor Installed, or Contractor Furnished/Contractor Installed.',
    recommendation: 'Carry the clearly identified contractor-installed cabling in the base bid and separately clarify equipment procurement and final termination responsibilities.',
    rfiQuestion: 'Please confirm procurement and installation responsibility for each low-voltage system and its associated cabling.',
    checklistItem: 'Confirm the bidder has included the low-voltage cabling assigned to its trade.',
    checklist: true,
  }),
  template('demo-template-matv-catv', {
    name: 'MATV/CATV',
    system: 'Structured Cabling',
    concern: 'The project includes MATV/CATV references but does not clearly identify the required coaxial cabling or head-end scope.',
    recommendation: 'Provide the specified data connectivity to display locations and exclude coax/MATV/CATV equipment unless clearly required.',
    rfiQuestion: 'What cabling and MATV/CATV equipment, if any, are required at the TV/display locations?',
    checklistItem: 'Confirm the required display cabling is included and undefined MATV/CATV equipment is excluded.',
    formalRfi: true,
  }),
  template('demo-template-mdf-idf-buildout', {
    name: 'MDF/IDF Buildout',
    system: 'Structured Cabling',
    concern: 'Specifications identify rack types or telecom-room requirements, but the drawings do not fully define the MDF/IDF buildout.',
    recommendation: 'Exclude undefined room buildout components until rack quantity, rack type, ladder tray, grounding, and accessory requirements are established.',
    rfiQuestion: 'Please define the required MDF/IDF rack types, quantities, ladder tray, grounding, and associated room buildout requirements.',
    checklistItem: 'Confirm undefined MDF/IDF buildout components are excluded or specifically carried by allowance.',
    formalRfi: true,
  }),
  template('demo-template-network-equipment', {
    name: 'Network Equipment',
    system: 'Structured Cabling',
    concern: 'The drawings reference network equipment without clearly establishing whether switches, routers, firewalls, wireless access points, or related electronics are contractor furnished.',
    recommendation: 'Exclude active network electronics unless the contract documents provide clear equipment requirements and contractor responsibility.',
    rfiQuestion: 'Are active network electronics OFOI, OFCI, or CFCI? If CFCI, provide the required standards or equipment schedule.',
    checklistItem: 'Confirm active network equipment is excluded unless specifically assigned to the bidder.',
    formalRfi: true,
    checklist: true,
  }),
  template('demo-template-parking-lot-pole-cameras', {
    name: 'Parking Lot Pole Cameras',
    system: 'Structured Cabling',
    concern: 'Pole-mounted cameras require a network enclosure, but enclosure construction, power, switching, and environmental requirements are not fully defined.',
    recommendation: 'Carry a weather-rated network enclosure at each camera pole with the required power interface and network connectivity, subject to final approved equipment selection.',
    rfiQuestion: 'Please confirm the acceptable network enclosure, power arrangement, and network equipment requirements for each pole-mounted camera.',
    checklistItem: 'Confirm pole-camera network enclosure and associated connectivity are included.',
    formalRfi: true,
    checklist: true,
  }),
  template('demo-template-pole-camera-fiber', {
    name: 'Pole Camera Fiber',
    system: 'Structured Cabling',
    concern: 'The drawing requires more fiber strands to each pole-mounted camera than the endpoint appears to need, and the spare-strand requirement is not explained.',
    recommendation: 'Provide a right-sized OS2 OSP fiber backbone to each pole with spare strands, termination, testing, and labeling.',
    rfiQuestion: 'Please confirm the required fiber strand count to each pole-mounted camera and the desired spare capacity.',
    checklistItem: 'Confirm the approved OS2 strand count, termination, testing, and labeling are included.',
    formalRfi: true,
    checklist: true,
  }),
  template('demo-template-security-system-delivery', {
    name: 'Security System OFOI, OFCI, or CFCI',
    system: 'Access Control',
    systems: ['Access Control', 'CCTV'],
    concern: 'The drawings do not clearly assign procurement and installation responsibility for CCTV and access-control equipment or associated cabling.',
    recommendations: {
      'Access Control': 'Carry access-control cabling as a separate add option when equipment responsibility is unresolved.',
      CCTV: 'Carry camera cabling in the base bid when it is clearly shown and not assigned elsewhere.',
    },
    rfiQuestion: 'Please confirm procurement and installation responsibility for CCTV, access-control equipment, and their associated cabling.',
    checklistItems: {
      'Access Control': 'Confirm access-control cabling is included in the stated base/alternate position.',
      CCTV: 'Confirm camera cabling is included in the stated base/alternate position.',
    },
    formalRfi: true,
    checklist: true,
  }),
  template('demo-template-tel-data-cable', {
    name: 'Tel/Data Cable',
    system: 'Structured Cabling',
    concern: 'The contract documents contain conflicting notes about who is responsible for providing and installing telecommunications/data cabling.',
    recommendation: 'Provide telecommunications/data cabling for all identified locations unless another trade is explicitly assigned the scope.',
    rfiQuestion: 'Please confirm which contractor is responsible for providing and installing telecommunications/data cabling.',
    checklistItem: 'Confirm telecommunications/data cabling is included for all identified locations.',
    formalRfi: true,
    checklist: true,
  }),
  template('demo-template-tel-data-outlet-qty', {
    name: 'Tel/Data Outlet Cable Qty',
    system: 'Structured Cabling',
    concern: 'The symbol legend does not clearly state the number of data cables required for each telecommunications outlet type.',
    recommendation: 'Carry two cables for combination/dual-data outlets and one cable for single telephone or single data outlets unless the legend states otherwise.',
    rfiQuestion: 'Please confirm the required cable quantity for each telecommunications/data symbol type.',
    checklistItem: 'Confirm cable quantities match the approved outlet-symbol interpretation.',
    formalRfi: true,
    checklist: true,
  }),
  template('demo-template-tv-display-install', {
    name: 'TV/Display Install',
    system: 'Structured Cabling',
    concern: 'The drawings do not clearly state whether installation of Owner-furnished TVs/displays is included in the low-voltage contractor scope.',
    recommendation: 'Install Owner-furnished displays when specifically assigned; backing and mounting support remain by the responsible construction trade unless noted otherwise.',
    rfiQuestion: 'Is the low-voltage contractor responsible for installing Owner-furnished TVs/displays?',
    formalRfi: true,
  }),
  template('demo-template-ups-pdu', {
    name: 'UPS and PDU Requirements',
    system: 'Structured Cabling',
    concern: 'The bid documents do not clearly assign responsibility or provide equipment requirements for UPS units and rack PDUs.',
    recommendation: 'Exclude UPS units and PDUs until contractor responsibility and equipment requirements are defined.',
    rfiQuestion: 'Are UPS units and PDUs OFOI, OFCI, or CFCI? If CFCI, provide the required capacities or part numbers.',
    checklistItem: 'Confirm UPS units and PDUs are excluded unless specifically assigned.',
    formalRfi: true,
    checklist: true,
  }),
  template('demo-template-ups', {
    name: 'UPS Requirements',
    system: 'Structured Cabling',
    concern: 'The bid documents conflict on whether UPS equipment is required in the low-voltage contractor scope.',
    recommendation: 'Exclude UPS equipment until responsibility and required size/capacity are defined.',
    rfiQuestion: 'Who is responsible for providing the UPS equipment? If contractor furnished, what capacity is required?',
    checklistItem: 'Confirm UPS equipment is excluded unless specifically assigned.',
    formalRfi: true,
  }),
  template('demo-template-vehicle-pedestal', {
    name: 'Vehicle Pedestal',
    system: 'Structured Cabling',
    concern: 'Connectivity and pathway requirements for the vehicle pedestal are not fully defined for card reader, camera, and video-intercom devices.',
    recommendation: 'Provide an OSP fiber connection to a weather-rated pedestal network enclosure with the required low-voltage power supply and network equipment; branch power by electrical contractor.',
    rfiQuestion: 'Please confirm the required connectivity, pathway, enclosure, power, and network equipment at the vehicle pedestal.',
    checklistItem: 'Confirm vehicle-pedestal fiber and network enclosure scope is included.',
    formalRfi: true,
    checklist: true,
  }),
  template('demo-template-westnet-cable', {
    name: 'WestNet Cable',
    system: 'Structured Cabling',
    concern: 'The drawings require WestNet-related cabling but direct the contractor to coordinate final cable requirements separately rather than defining them in the bid documents.',
    recommendation: 'Carry only the clearly identified WestNet cabling scope and obtain written cable requirements before procurement or installation.',
    rfiQuestion: 'Please provide the final WestNet cable type, quantity, termination, and pathway requirements.',
    formalRfi: false,
    sow: false,
  }),
];
