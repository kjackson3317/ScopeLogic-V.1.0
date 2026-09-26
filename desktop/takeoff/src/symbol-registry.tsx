import type { ReactNode } from 'react';

export type SymbolCategory =
  | 'Generic'
  | 'Structured Cabling'
  | 'Video Surveillance'
  | 'Access Control'
  | 'Intrusion'
  | 'Intercom'
  | 'AV / PA'
  | 'Fire Alarm';

export type TakeoffSymbolDefinition = {
  id: string;
  name: string;
  category: SymbolCategory;
  keywords: string[];
  render: (size: number) => ReactNode;
};

const svg = (size: number, children: ReactNode) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const definitions: TakeoffSymbolDefinition[] = [
  {
    id: 'builtin.generic.circle',
    name: 'Circle',
    category: 'Generic',
    keywords: ['circle', 'round', 'generic'],
    render: (size) => svg(size, <circle cx="12" cy="12" r="8" />),
  },
  {
    id: 'builtin.generic.square',
    name: 'Square',
    category: 'Generic',
    keywords: ['square', 'box', 'generic'],
    render: (size) => svg(size, <rect x="4" y="4" width="16" height="16" />),
  },
  {
    id: 'builtin.generic.triangle',
    name: 'Triangle',
    category: 'Generic',
    keywords: ['triangle', 'generic'],
    render: (size) => svg(size, <path d="M12 4 21 20H3Z" />),
  },
  {
    id: 'builtin.generic.diamond',
    name: 'Diamond',
    category: 'Generic',
    keywords: ['diamond', 'generic'],
    render: (size) => svg(size, <path d="m12 3 9 9-9 9-9-9Z" />),
  },
  {
    id: 'builtin.generic.hexagon',
    name: 'Hexagon',
    category: 'Generic',
    keywords: ['hexagon', 'generic'],
    render: (size) => svg(size, <path d="m7 3 10 0 5 9-5 9H7l-5-9Z" />),
  },
  {
    id: 'builtin.generic.cross',
    name: 'Cross',
    category: 'Generic',
    keywords: ['cross', 'plus', 'generic'],
    render: (size) => svg(size, <><path d="M12 4v16" /><path d="M4 12h16" /></>),
  },
  {
    id: 'builtin.generic.x',
    name: 'X',
    category: 'Generic',
    keywords: ['x', 'cross', 'generic'],
    render: (size) => svg(size, <><path d="M5 5l14 14" /><path d="M19 5 5 19" /></>),
  },
  {
    id: 'builtin.generic.device',
    name: 'Generic Device',
    category: 'Generic',
    keywords: ['device', 'generic', 'equipment'],
    render: (size) => svg(size, <><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="12" r="2" /><path d="M13 10h4M13 14h4" /></>),
  },
  {
    id: 'builtin.data.outlet',
    name: 'Data Outlet',
    category: 'Structured Cabling',
    keywords: ['data', 'outlet', 'jack', 'network'],
    render: (size) => svg(size, <><rect x="5" y="4" width="14" height="16" rx="2" /><rect x="8" y="8" width="8" height="6" /><path d="M10 17h4" /></>),
  },
  {
    id: 'builtin.data.dual_outlet',
    name: 'Dual Data Outlet',
    category: 'Structured Cabling',
    keywords: ['data', 'dual', 'outlet', 'jack', 'network'],
    render: (size) => svg(size, <><rect x="4" y="5" width="16" height="14" rx="2" /><rect x="6.5" y="9" width="4.5" height="5" /><rect x="13" y="9" width="4.5" height="5" /></>),
  },
  {
    id: 'builtin.data.wap',
    name: 'Wireless Access Point',
    category: 'Structured Cabling',
    keywords: ['wap', 'wireless', 'wifi', 'access point'],
    render: (size) => svg(size, <><circle cx="12" cy="14" r="2" /><path d="M7.8 10a6 6 0 0 1 8.4 0" /><path d="M4.5 6.5a10.5 10.5 0 0 1 15 0" /></>),
  },
  {
    id: 'builtin.video.camera',
    name: 'Camera',
    category: 'Video Surveillance',
    keywords: ['camera', 'cctv', 'video', 'security'],
    render: (size) => svg(size, <><path d="M4 8h11l4 4-4 4H4Z" /><circle cx="9" cy="12" r="2.5" /><path d="M6 16v3" /></>),
  },
  {
    id: 'builtin.video.dome',
    name: 'Dome Camera',
    category: 'Video Surveillance',
    keywords: ['camera', 'dome', 'cctv', 'video'],
    render: (size) => svg(size, <><path d="M5 14a7 7 0 0 1 14 0" /><path d="M4 14h16" /><path d="M7 14a5 5 0 0 0 10 0" /><circle cx="12" cy="14" r="1.5" /></>),
  },
  {
    id: 'builtin.video.bullet',
    name: 'Bullet Camera',
    category: 'Video Surveillance',
    keywords: ['camera', 'bullet', 'cctv', 'video'],
    render: (size) => svg(size, <><path d="M5 8h10l4 3v2l-4 3H5Z" /><path d="m9 16-2 4" /><path d="M15 8V6" /></>),
  },
  {
    id: 'builtin.video.ptz',
    name: 'PTZ Camera',
    category: 'Video Surveillance',
    keywords: ['camera', 'ptz', 'pan tilt zoom', 'video'],
    render: (size) => svg(size, <><path d="M6 9h12l-2 7H8Z" /><path d="M9 16a3 3 0 0 0 6 0" /><path d="M4 7h16" /><path d="m6 4-2 3 2 3M18 4l2 3-2 3" /></>),
  },
  {
    id: 'builtin.video.multisensor',
    name: 'Multi-Sensor Camera',
    category: 'Video Surveillance',
    keywords: ['camera', 'multi sensor', 'multisensor', 'video'],
    render: (size) => svg(size, <><circle cx="12" cy="12" r="8" /><circle cx="9" cy="9" r="2" /><circle cx="15" cy="9" r="2" /><circle cx="9" cy="15" r="2" /><circle cx="15" cy="15" r="2" /></>),
  },
  {
    id: 'builtin.access.card_reader',
    name: 'Card Reader',
    category: 'Access Control',
    keywords: ['card reader', 'reader', 'access', 'credential'],
    render: (size) => svg(size, <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M9.5 8h5" /><path d="M10 15c1.3-1.3 2.7-1.3 4 0" /></>),
  },
  {
    id: 'builtin.access.door_contact',
    name: 'Door Contact',
    category: 'Access Control',
    keywords: ['door contact', 'contact', 'dps', 'access'],
    render: (size) => svg(size, <><rect x="5" y="5" width="4" height="14" /><rect x="14" y="5" width="5" height="14" /><path d="M11 8v8" /></>),
  },
  {
    id: 'builtin.access.rex',
    name: 'Request to Exit',
    category: 'Access Control',
    keywords: ['rex', 'request to exit', 'motion', 'access'],
    render: (size) => svg(size, <><path d="M4 12h10" /><path d="m11 8 4 4-4 4" /><rect x="16" y="5" width="4" height="14" /></>),
  },
  {
    id: 'builtin.access.lock',
    name: 'Lock',
    category: 'Access Control',
    keywords: ['lock', 'electric lock', 'strike', 'maglock', 'access'],
    render: (size) => svg(size, <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><circle cx="12" cy="15" r="1" /></>),
  },
  {
    id: 'builtin.intrusion.motion',
    name: 'Motion Detector',
    category: 'Intrusion',
    keywords: ['motion', 'pir', 'intrusion', 'detector'],
    render: (size) => svg(size, <><path d="M6 5h12v14H6Z" /><circle cx="12" cy="10" r="2" /><path d="M9 15c2-2 4-2 6 0" /></>),
  },
  {
    id: 'builtin.intrusion.keypad',
    name: 'Keypad',
    category: 'Intrusion',
    keywords: ['keypad', 'intrusion', 'alarm'],
    render: (size) => svg(size, <><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M9 7h6" /><path d="M9 11h.01M12 11h.01M15 11h.01M9 14h.01M12 14h.01M15 14h.01M9 17h.01M12 17h.01M15 17h.01" /></>),
  },
  {
    id: 'builtin.intercom.station',
    name: 'Intercom Station',
    category: 'Intercom',
    keywords: ['intercom', 'station', 'call'],
    render: (size) => svg(size, <><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="12" cy="9" r="3" /><path d="M9 16h6" /></>),
  },
  {
    id: 'builtin.audio.ceiling_speaker',
    name: 'Ceiling Speaker',
    category: 'AV / PA',
    keywords: ['speaker', 'ceiling', 'audio', 'pa'],
    render: (size) => svg(size, <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>),
  },
  {
    id: 'builtin.audio.wall_speaker',
    name: 'Wall Speaker',
    category: 'AV / PA',
    keywords: ['speaker', 'wall', 'audio', 'pa'],
    render: (size) => svg(size, <><path d="M5 7h5l5-4v18l-5-4H5Z" /><path d="M18 8c2 2 2 6 0 8" /></>),
  },
  {
    id: 'builtin.audio.microphone',
    name: 'Microphone',
    category: 'AV / PA',
    keywords: ['microphone', 'mic', 'audio', 'av'],
    render: (size) => svg(size, <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0" /><path d="M12 17v4M9 21h6" /></>),
  },
  {
    id: 'builtin.av.display',
    name: 'Display',
    category: 'AV / PA',
    keywords: ['display', 'monitor', 'tv', 'screen', 'av'],
    render: (size) => svg(size, <><rect x="3" y="4" width="18" height="13" rx="1" /><path d="M9 21h6M12 17v4" /></>),
  },
  {
    id: 'builtin.fire.smoke',
    name: 'Smoke Detector',
    category: 'Fire Alarm',
    keywords: ['smoke', 'detector', 'fire alarm'],
    render: (size) => svg(size, <><circle cx="12" cy="12" r="8" /><path d="M8 10h8M9 13h6M10 16h4" /></>),
  },
  {
    id: 'builtin.fire.heat',
    name: 'Heat Detector',
    category: 'Fire Alarm',
    keywords: ['heat', 'detector', 'fire alarm'],
    render: (size) => svg(size, <><circle cx="12" cy="12" r="8" /><path d="M12 6v12M8 9l8 6M16 9l-8 6" /></>),
  },
  {
    id: 'builtin.fire.pull',
    name: 'Pull Station',
    category: 'Fire Alarm',
    keywords: ['pull', 'pull station', 'manual station', 'fire alarm'],
    render: (size) => svg(size, <><rect x="6" y="3" width="12" height="18" rx="1" /><path d="M9 7h6M9 11h6" /><path d="m12 18-3-4h6Z" /></>),
  },
  {
    id: 'builtin.fire.horn_strobe',
    name: 'Horn / Strobe',
    category: 'Fire Alarm',
    keywords: ['horn strobe', 'notification', 'fire alarm', 'speaker strobe'],
    render: (size) => svg(size, <><rect x="4" y="6" width="16" height="12" rx="2" /><circle cx="9" cy="12" r="3" /><path d="M15 9v6M13 12h4" /></>),
  },
  {
    id: 'builtin.fire.strobe',
    name: 'Strobe',
    category: 'Fire Alarm',
    keywords: ['strobe', 'notification', 'fire alarm'],
    render: (size) => svg(size, <><rect x="6" y="5" width="12" height="14" rx="2" /><path d="M12 8v8M9 12h6" /></>),
  },
];

export const TAKEOFF_SYMBOLS = definitions;

const symbolById = new Map(definitions.map((definition) => [definition.id, definition]));

export function getTakeoffSymbol(symbolId: string | undefined): TakeoffSymbolDefinition {
  return symbolById.get(symbolId || '')
    || symbolById.get('builtin.generic.device')!;
}

export function searchTakeoffSymbols(query: string): TakeoffSymbolDefinition[] {
  const term = query.trim().toLowerCase();
  if (!term) return definitions;
  return definitions.filter((definition) => {
    const haystack = [definition.name, definition.category, ...definition.keywords]
      .join(' ')
      .toLowerCase();
    return haystack.includes(term);
  });
}

export function TakeoffSymbol({
  symbolId,
  color,
  size = 18,
  title,
}: {
  symbolId?: string;
  color?: string;
  size?: number;
  title?: string;
}) {
  const definition = getTakeoffSymbol(symbolId);
  return (
    <span
      className="takeoff-symbol"
      style={{ color: color || 'currentColor', width: size, height: size, display: 'inline-flex' }}
      title={title || definition.name}
      aria-label={title || definition.name}
    >
      {definition.render(size)}
    </span>
  );
}
