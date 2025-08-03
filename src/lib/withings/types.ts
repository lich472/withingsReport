
export interface WithingsUser {
  id: number;
  email: string;
  userid: number;
  firstname: string;
  lastname: string;
  shortname: string;
  birthdate: number;
  gender: number;
  is_public: boolean;
  fully_owned: boolean;
}

export interface WithingsDevice {
  last_session_date?: number;
  first_session_date?: number;
  [key: string]: any;
}

export interface SleepSummaryRecord {
  id: number;
  timezone: string;
  startdate: number; // UTC timestamp
  enddate: number; // UTC timestamp
  total_sleep_time: number; // seconds
  sleep_efficiency: number; // ratio
  apnea_hypopnea_index: number | null;
  snoring: number; // seconds
  night_events?: string | object;
  data?: Record<string, any>; // For nested data object
  [key: string]: any;
}

export interface SleepSummaryResponse {
  status: number;
  body: {
    series: SleepSummaryRecord[];
  };
  error?: string;
}

export interface SleepEpochTimeseries {
    [timestamp: string]: number;
}

export interface SleepEpochRawData {
  state: number;
  hr?: SleepEpochTimeseries;
  rr?: SleepEpochTimeseries;
  rmssd?: SleepEpochTimeseries;
  snoring?: SleepEpochTimeseries;
  sdnn_1?: SleepEpochTimeseries;
  mvt_score?: SleepEpochTimeseries;
  chest_movement_rate?: SleepEpochTimeseries;
  withings_index?: SleepEpochTimeseries;
  breathing_sounds?: SleepEpochTimeseries;
  [key: string]: any;
}

export interface SleepEpochRecord {
  sleep_id: number;
  series: SleepEpochRawData[];
}


export interface SleepEpochsResponse {
    status: number;
    body: {
        series: SleepEpochRawData[];
    };
    error?: string;
}

// Processed data types, used after initial transformation in report-generator.ts
export interface ProcessedSummary extends SleepSummaryRecord {
    lab_id: string;
    startdate_utc: Date;
    enddate_utc: Date;
    total_sleep_time_hours: number | null;
    sleep_efficiency_percent: number | null;
    snoring_minutes: number | null;
    sleep_duration_min: number | null;
}

export interface ProcessedEpoch {
    id: number;
    timezone: string;
    timestamp: number;
    datetime_utc: Date;
    state: number;
    hr: number | null;
    rr: number | null;
    snoring: number | null;
    sdnn_1: number | null;
    rmssd: number | null;
    mvt_score: number | null;
    chest_movement_rate: number | null;
    withings_index: number | null;
    breathing_sounds: number | null;
    night_events: any;
}
