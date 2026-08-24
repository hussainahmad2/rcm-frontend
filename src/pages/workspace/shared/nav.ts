import type { LucideIcon } from 'lucide-react';
import {
  BadgeDollarSign,
  Bot,
  Building2,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  FileCheck2,
  Gavel,
  Globe2,
  Handshake,
  Hospital,
  LayoutDashboard,
  ListFilter,
  Receipt,
  Settings2,
  ShieldAlert,
  Stethoscope,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import type { WorkspaceView } from '../workspace-types';

export type NavItem = { id: WorkspaceView; label: string; icon: LucideIcon };

export const navItems: NavItem[] = [
  { id: 'overview', label: 'Home', icon: LayoutDashboard },
  { id: 'queue', label: 'My work', icon: ListFilter },
  { id: 'registration', label: 'Check-in', icon: ClipboardPlus },
  { id: 'patients', label: 'Patients', icon: UsersRound },
  { id: 'schedule', label: 'Appointments', icon: CalendarDays },
  { id: 'providers', label: 'Clinicians', icon: Hospital },
  { id: 'payers', label: 'Insurance', icon: Building2 },
  { id: 'eligibility', label: 'Coverage check', icon: UserRoundCheck },
  { id: 'authorizations', label: 'Prior auths', icon: ClipboardCheck },
  { id: 'encounters', label: 'Visits', icon: ClipboardList },
  { id: 'coding', label: 'Codes', icon: Stethoscope },
  { id: 'charges', label: 'Bills', icon: Receipt },
  { id: 'claims', label: 'Claims', icon: FileCheck2 },
  { id: 'denials', label: 'Denied claims', icon: ShieldAlert },
  { id: 'ar', label: 'Unpaid bills', icon: BadgeDollarSign },
  { id: 'payments', label: 'Payments', icon: CircleDollarSign },
  { id: 'contracts', label: 'Payer contracts', icon: Handshake },
  { id: 'leakage', label: 'Lost money', icon: CircleDollarSign },
  { id: 'ai', label: 'AI helpers', icon: Bot },
  { id: 'packs', label: 'Country settings', icon: Globe2 },
  { id: 'rules', label: 'Billing rules', icon: Gavel },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

export const navGroups: { id: string; label: string; itemIds: WorkspaceView[] }[] = [
  { id: 'today', label: 'Today', itemIds: ['overview', 'queue'] },
  { id: 'front-desk', label: 'Front desk', itemIds: ['registration', 'patients', 'schedule', 'providers'] },
  { id: 'before-visit', label: 'Before the visit', itemIds: ['eligibility', 'authorizations'] },
  { id: 'after-visit', label: 'After the visit', itemIds: ['encounters', 'coding', 'charges'] },
  { id: 'money', label: 'Getting paid', itemIds: ['claims', 'denials', 'ar', 'payments'] },
  { id: 'setup', label: 'Setup', itemIds: ['payers', 'contracts', 'leakage', 'ai', 'packs', 'rules', 'settings'] },
];

export function navItemById(id: WorkspaceView) {
  return navItems.find((item) => item.id === id);
}
