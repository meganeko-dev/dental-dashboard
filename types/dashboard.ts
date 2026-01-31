export interface KPIConfig {
    id: string;
    label: string;
    unit: string;
  }
  
  export interface KPIData {
    id: number;
    year: number;
    month: number;
    clinic_name: string;
    kpi_name: string;
    value: number;
    staff_name?: string;
    is_target?: boolean;
  }