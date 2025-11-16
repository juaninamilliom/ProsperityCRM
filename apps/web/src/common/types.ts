export type Role = 'OrgAdmin' | 'OrgEmployee';

export interface UserDTO {
  user_id: string;
  email: string;
  name: string;
  role: Role;
  sso_id?: string | null;
  organization_id: string;
  is_active?: boolean;
}

export interface AgencyDTO {
  agency_id: string;
  name: string;
  contact_email?: string | null;
}

export interface StatusDTO {
  status_id: string;
  name: string;
  order_index: number;
  is_terminal: boolean;
}

export interface JobRequisitionDTO {
  job_id: string;
  title: string;
  department?: string | null;
  location?: string | null;
  status: 'open' | 'on_hold' | 'closed';
  description?: string | null;
}

export interface CandidateDTO {
  candidate_id: string;
  name: string;
  email: string;
  phone?: string | null;
  current_status_id: string;
  target_agency_id: string;
  recruiter_id: string;
  job_requisition_id?: string | null;
  flags: string[];
  notes?: string | null;
}

export interface CandidateWithMeta extends CandidateDTO {
  status_name?: string;
  agency_name?: string;
  job_title?: string | null;
  job_status?: string | null;
}

export interface OrganizationDTO {
  organization_id: string;
  name: string;
  slug: string;
}
