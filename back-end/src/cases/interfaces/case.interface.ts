export interface Case {
  id: number;
  consultation_id?: string;
  lawfirm_id?: string;
  lawyer_id?: string;
  client_id?: string;
  cnr: string;
  case_type: string;
  brief_description: string;
  status: string;
  progress?: number;
  timeline?: any[];
  documents?: any[];
  client?: any;
  team?: any[];
  filed_date?: string;
  created_at?: string;
}
