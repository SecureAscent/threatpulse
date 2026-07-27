export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  organizationId: string | null;
  organizationName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  parentOrganizationId: string | null;
  parentOrganizationName: string | null;
}

export interface ThreatItem {
  id: string;
  threatId: string;
  title: string;
  type: string;
  severity: string;
  status: string;
  description: string | null;
  affectedAssets: string | null;
  source: string | null;
  indicators: string | null;
  mitreTactic: string | null;
  mitreTechnique: string | null;
  cvssScore: number | null;
  dateAdded: string;
  lastUpdated: string;
  organizationId: string;
  departmentId: string | null;
  assignedToId?: string | null;
  assignedTo?: AnalystRef | null;
  dueDate?: string | null;
  tags?: string[];
  riskScore?: number | null;
  epssScore?: number | null;
  epssPercentile?: number | null;
  epssUpdatedAt?: string | null;
  isKev?: boolean;
  exploitAvailable?: boolean;
  mitreAttackIds?: string[];
  sourceUrls?: string[];
  enrichedAt?: string | null;
}

export interface AnalystRef {
  id: string;
  name: string | null;
  email: string;
  role?: string;
}

export interface ThreatNoteItem {
  id: string;
  threatId: string;
  authorId: string;
  author: AnalystRef | null;
  content: string;
  isInternal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ThreatStatusHistoryItem {
  id: string;
  threatId: string;
  changedById: string;
  changedBy: AnalystRef | null;
  fromStatus: string;
  toStatus: string;
  note: string | null;
  createdAt: string;
}

export interface SavedFilterItem {
  id: string;
  userId: string;
  organizationId: string;
  name: string;
  filters: Record<string, any>;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
  owned?: boolean;
}

export interface DepartmentSummary {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  _count?: { users: number; threats: number };
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  parentOrganizationId: string | null;
  createdAt?: string;
  departments?: DepartmentSummary[];
  _count?: {
    users: number;
    threats: number;
    departments?: number;
  };
}

export interface ParentOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  createdAt?: string;
  organizations: OrganizationSummary[];
}

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  _count?: { users: number; threats?: number };
}

export interface OrgUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  organizationId: string | null;
  departmentId: string | null;
  organization: Pick<OrganizationSummary, 'id' | 'name' | 'slug'> | null;
  department: Pick<DepartmentSummary, 'id' | 'name' | 'slug'> | null;
  createdAt: string;
}

export interface DashboardStats {
  total: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  recentThreats: ThreatItem[];
}
