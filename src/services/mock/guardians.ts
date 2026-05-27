import type { ClientLocation, Guardian } from '@/types/guardian';

export const mockGuardians: Guardian[] = [
  { id: '1',  name: 'Jean-Marie U.', initials: 'JM', district: 'Nyarugenge', assignmentType: 'Night gate security', status: 'ON_DUTY',   lat: -1.9441, lng: 30.0619 },
  { id: '2',  name: 'Amina N.',      initials: 'AN', district: 'Gasabo',     assignmentType: 'Event security',     status: 'ON_DUTY',   lat: -1.9300, lng: 30.0800 },
  { id: '3',  name: 'Patrick M.',    initials: 'PM', district: 'Kicukiro',   assignmentType: 'Office patrol',      status: 'ON_DUTY',   lat: -1.9700, lng: 30.0750 },
  { id: '4',  name: 'Emmanuel M.',   initials: 'EM', district: 'Nyarugenge', assignmentType: '',                   status: 'AVAILABLE', lat: -1.9500, lng: 30.0550 },
  { id: '5',  name: 'Claude K.',     initials: 'CK', district: 'Gasabo',     assignmentType: '',                   status: 'AVAILABLE', lat: -1.9200, lng: 30.0900 },
  { id: '6',  name: 'Rachel N.',     initials: 'RN', district: 'Kicukiro',   assignmentType: '',                   status: 'AVAILABLE', lat: -1.9600, lng: 30.0850 },
  { id: '7',  name: 'Kevin N.',      initials: 'KN', district: 'Nyarugenge', assignmentType: 'VIP escort',         status: 'ON_DUTY',   lat: -1.9550, lng: 30.0680 },
  { id: '8',  name: 'Fabrice R.',    initials: 'FR', district: 'Gasabo',     assignmentType: 'Lobby patrol',       status: 'ON_DUTY',   lat: -1.9350, lng: 30.0720 },
  { id: '9',  name: 'Jean P.',       initials: 'JP', district: 'Kicukiro',   assignmentType: '',                   status: 'AVAILABLE', lat: -1.9650, lng: 30.0600 },
  { id: '10', name: 'Louise U.',     initials: 'LU', district: 'Nyarugenge', assignmentType: '',                   status: 'OFFLINE',   lat: -1.9480, lng: 30.0500 },
  { id: '11', name: 'Samuel B.',     initials: 'SB', district: 'Gasabo',     assignmentType: '',                   status: 'AVAILABLE', lat: -1.9150, lng: 30.0950 },
  { id: '12', name: 'Marie C.',      initials: 'MC', district: 'Kicukiro',   assignmentType: '',                   status: 'AVAILABLE', lat: -1.9620, lng: 30.0900 },
  { id: '13', name: 'Nicole M.',     initials: 'NM', district: 'Nyarugenge', assignmentType: '',                   status: 'OFFLINE',   lat: -1.9520, lng: 30.0450 },
  { id: '14', name: 'Bruno U.',      initials: 'BU', district: 'Kicukiro',   assignmentType: '',                   status: 'AVAILABLE', lat: -1.9580, lng: 30.0720 },
  { id: '15', name: 'Eric H.',       initials: 'EH', district: 'Kicukiro',   assignmentType: '',                   status: 'OFFLINE',   lat: -1.9700, lng: 30.0880 },
];

export const mockClientLocations: ClientLocation[] = [
  { id: 'c1', lat: -1.9420, lng: 30.0640 },
  { id: 'c2', lat: -1.9580, lng: 30.0720 },
];
