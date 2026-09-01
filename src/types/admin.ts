/** Shared types for admin dashboard */

export interface Registration {
  id: string;
  request_id: string;
  name: string;
  mobile: string;
  date_of_birth: string;
  village: string;
  taluka: string;
  district: string;
  income_source: string;
  cluster_type: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  reviewer_notes: string | null;
}

export interface RegistrationDetail extends Registration {
  aadhar_no: string;
  consent_given: boolean;
  source: string;
  plots: Plot[];
}

export interface Plot {
  id: string;
  plot_no: string;
  area_acres: number;
  crop_name: string;
  irrigation_source: string;
}

export interface Farmer {
  id: string;
  name: string;
  mobile: string;
  date_of_birth: string;
  village: string;
  taluka: string;
  district: string;
  income_source: string;
  cluster_type: string;
  created_at: string;
}

export interface DashboardStats {
  registrations: Record<string, number>;
  by_taluka: Record<string, number>;
  total_farmers: number;
}

export interface PaginatedResponse<T> {
  rows: T[];
  total: number;
}

/** Reusable filter/select options */
export const STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

export const PAGE_SIZE = 20;

export type AdminRole = "super_admin" | "admin";

export interface AdminUser {
  id: string;
  username: string;
  display_name: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

export interface AuditLogEntry {
  id: string;
  admin_id: string | null;
  admin_username: string;
  action: string;
  target_table: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}
