export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  organizationId: string | null;
  organizationName: string | null;
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
  // --- Analyst workflow (Track B) ---
  assignedToId?: string | null;
  assignedTo?: AnalystRef | null;
  dueDate?: string | null;
  tags?: string[];
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

export interface OrgUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
}

export interface DashboardStats {
  total: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  recentThreats: ThreatItem[];
}
