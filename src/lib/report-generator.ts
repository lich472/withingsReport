
import Papa from 'papaparse'; // a lib to parse CSV file to JSON 
import { Buffer } from 'buffer';
import type { SleepSummaryResponse, SleepEpochRecord, SleepSummaryRecord, SleepEpochRawData, ProcessedEpoch, ProcessedSummary } from './withings/types';

const ALL_DATA_FIELDS = [
    "total_timeinbed", "total_sleep_time", "asleepduration", 
    "lightsleepduration", "remsleepduration", "deepsleepduration", 
    "sleep_efficiency", "sleep_latency", "wakeup_latency", 
    "wakeupduration", "waso", 
    "nb_rem_episodes", "apnea_hypopnea_index", "withings_index",
    "durationtosleep", "durationtowakeup", "out_of_bed_count", 
    "hr_average", "hr_min", "hr_max", 
    "rr_average", "rr_min", "rr_max", 
    "snoring", "snoringepisodecount", "sleep_score", 
    "night_events", "mvt_score_avg", "mvt_active_duration", 
    "chest_movement_rate_average", "chest_movement_rate_min", "chest_movement_rate_max",
    "breathing_sounds", "breathing_sounds_episode_count"
];

const DURATION_FIELDS_IN_SECONDS = [
    "total_timeinbed", "total_sleep_time", "asleepduration", 
    "lightsleepduration", "remsleepduration", "deepsleepduration", 
    "sleep_latency", "wakeup_latency", "wakeupduration", "waso",
    "durationtosleep", "durationtowakeup", "snoring", "mvt_active_duration"
];

const EFFICIENCY_FIELDS = ["sleep_efficiency"];

const fieldDisplayNameMap: Record<string, string> = {  // "Record<Key, Value>" is a generic type to define object with keys of a specific type and values of a specific type.
    "total_timeinbed": "Total Time in Bed (hours)",
    "total_sleep_time": "Total Sleep Time (hours)",
    "asleepduration": "Asleep Duration (hours)",
    "lightsleepduration": "Light Sleep (hours)",
    "remsleepduration": "REM Sleep (hours)",
    "deepsleepduration": "Deep Sleep (hours)",
    "sleep_efficiency": "Sleep Efficiency (%)",
    "sleep_latency": "Time to Fall Asleep (minutes)",
    "wakeup_latency": "Time to Wake Up (minutes)",
    "wakeupduration": "Wakeup Duration (minutes)",
    "wakeupcount": "Wakeups (count)",
    "waso": "Wake After Sleep Onset (WASO) (minutes)",
    "nb_rem_episodes": "REM Episodes (count)",
    "apnea_hypopnea_index": "Apnea-Hypopnea Index (events/hour)",
    "withings_index": "Withings Sleep Index",
    "durationtosleep": "Time to Fall Asleep (minutes)",
    "durationtowakeup": "Time to Wake Up (minutes)",
    "out_of_bed_count": "Out of Bed (count)",
    "hr_average": "Average Heart Rate (bpm)",
    "hr_min": "Minimum Heart Rate (bpm)",
    "hr_max": "Maximum Heart Rate (bpm)",
    "rr_average": "Average Respiratory Rate (breaths/min)",
    "rr_min": "Minimum Respiratory Rate (breaths/min)",
    "rr_max": "Maximum Respiratory Rate (breaths/min)",
    "snoring": "Snoring Duration (minutes)",
    "snoringepisodecount": "Snoring Episodes (count)",
    "sleep_score": "Sleep Score",
    "night_events": "Night Events (count)",
    "mvt_score_avg": "Average Movement Score",
    "mvt_active_duration": "Movement Duration (minutes)",
    "chest_movement_rate_average": "Average Chest Movement Rate (breaths/min)",
    "chest_movement_rate_min": "Minimum Chest Movement Rate (breaths/min)",
    "chest_movement_rate_max": "Maximum Chest Movement Rate (breaths/min)",
    "breathing_sounds": "Breathing Sounds Intensity",
    "breathing_sounds_episode_count": "Breathing Sounds Episodes (count)"
};

export function dfToDataUri(data: any[], columns: string[]): string {
  // Use papaparse for robust CSV generation, correctly handling quotes and special characters.
  const csv = Papa.unparse(data, {
    columns: columns,
    header: true,
  });
  const buffer = Buffer.from(csv, 'utf-8');
  return `data:text/csv;base64,${buffer.toString('base64')}`;
}

export function processSummaryData(summarySeries: SleepSummaryRecord[], label: string): ProcessedSummary[] {
    return summarySeries.map(rawRow => {
        // Handle both flat and nested data structures
        const row = { ...rawRow, ...(rawRow.data || {}) };
        delete row.data;

        // Handle string dates from CSV
        let startdateNum: number | string | null = row.startdate;
        if (typeof startdateNum === 'string') {
             try {
                startdateNum = new Date(startdateNum).getTime() / 1000;
             } catch(e) { startdateNum = NaN; }
        } else if (row.w_startdate && typeof row.w_startdate === 'string') {
            try {
                startdateNum = new Date(row.w_startdate).getTime() / 1000;
            } catch(e) { startdateNum = NaN; }
        } else if (typeof startdateNum !== 'number') {
            startdateNum = NaN;
        }


        let enddateNum: number | string | null = row.enddate;
        if (typeof enddateNum === 'string') {
            try {
                enddateNum = new Date(enddateNum).getTime() / 1000;
            } catch(e) { enddateNum = NaN; }
        } else if (row.w_enddate && typeof row.w_enddate === 'string') {
            try {
                enddateNum = new Date(row.w_enddate).getTime() / 1000;
            } catch(e) { enddateNum = NaN; }
        } else if (typeof enddateNum !== 'number') {
            enddateNum = NaN;
        }

        const total_sleep_time_hours = typeof row.total_sleep_time === 'number' ? row.total_sleep_time / 3600 : null;
        const sleep_efficiency_percent = typeof row.sleep_efficiency === 'number' ? row.sleep_efficiency * 100 : null;
        const snoring_minutes = typeof row.snoring === 'number' ? row.snoring / 60 : null;
        const _raw_apnea_hypopnea_index = isNaN(Number(row.apnea_hypopnea_index)) ?  -1 : Number(row.apnea_hypopnea_index);
        const apnea_hypopnea_index = _raw_apnea_hypopnea_index >= 0 ? _raw_apnea_hypopnea_index : null;
        
        const startdate_utc = !isNaN(Number(startdateNum)) ? new Date(Number(startdateNum) * 1000) : new Date('invalid');
        const enddate_utc = !isNaN(Number(enddateNum)) ? new Date(Number(enddateNum) * 1000) : new Date('invalid');
        
        // Parse night_events if it's a string
        let night_events_parsed = row.night_events;
        if (typeof night_events_parsed === 'string') {
            try {
                night_events_parsed = JSON.parse(night_events_parsed);
            } catch (e) {
                console.warn("Could not parse night_events string:", night_events_parsed);
                night_events_parsed = undefined; // change 'null' to 'undefined'
            }
        }

        return {
            ...row,
            startdate: startdateNum,
            enddate: enddateNum,
            lab_id: label,
            startdate_utc,
            enddate_utc,
            total_sleep_time_hours,
            sleep_efficiency_percent,
            snoring_minutes,
            apnea_hypopnea_index,
            night_events: night_events_parsed,
            sleep_duration_min: total_sleep_time_hours,
        };
    });
}

export function processEpochData(epochRecords: SleepEpochRecord[], summaryData: ProcessedSummary[]): ProcessedEpoch[] {
    const summaryMap = new Map(summaryData.map(s => [s.id, { timezone: s.timezone, night_events: s.night_events }]));
    
    const allEpochs: ProcessedEpoch[] = [];
    if (!epochRecords) return [];
    
    const dataFields = [ "hr", "rr", "snoring", "sdnn_1", "rmssd", "mvt_score", "chest_movement_rate", "withings_index", "breathing_sounds" ];
    
    for (const record of epochRecords) {
        const sleep_id = record.sleep_id;
        const summaryInfo = summaryMap.get(sleep_id);
        if (!summaryInfo) continue;

        for (const seriesItem of record.series) {
            const state = seriesItem.state;
            
            let refField: keyof SleepEpochRawData | null = null;
            for (const candidate in seriesItem) {
                 if (dataFields.includes(candidate) && typeof seriesItem[candidate as keyof SleepEpochRawData] === 'object' && seriesItem[candidate as keyof SleepEpochRawData] !== null && Object.keys(seriesItem[candidate as keyof SleepEpochRawData]!).length > 0) {
                    refField = candidate as keyof SleepEpochRawData;
                    break;
                }
            }
            if (!refField || !seriesItem[refField]) continue;

            const timestamps = Object.keys(seriesItem[refField]!);

            for (const tsStr of timestamps) {
                const timestamp = parseInt(tsStr, 10);
                if (isNaN(timestamp)) continue;

                const epochRow: any = {
                    id: sleep_id,
                    timezone: summaryInfo.timezone,
                    timestamp: timestamp,
                    datetime_utc: new Date(timestamp * 1000),
                    state: state,
                    night_events: summaryInfo.night_events,
                };

                for (const field of dataFields) {
                     const fieldData = seriesItem[field as keyof typeof seriesItem];
                    if (fieldData && typeof fieldData === 'object' && (fieldData as Record<string, number>)[tsStr] !== undefined) {
                        epochRow[field] = (fieldData as Record<string, number>)[tsStr];
                    } else {
                        epochRow[field] = null;
                    }
                }

                allEpochs.push(epochRow as ProcessedEpoch);
            }
        }
    }
    
    return allEpochs;
}

function plotNight(df: ProcessedEpoch[], timezone: string, applyTimezone: boolean) {
    df.sort((a, b) => a.datetime_utc.getTime() - b.datetime_utc.getTime());
    const plots: any[]=[];
    const night_events = df.length > 0 ? df[0].night_events : null;
    const night_start_date = df.length > 0 ? df[0].datetime_utc : new Date();

    plots.push(plotNightStage(df, timezone, applyTimezone, night_events, night_start_date));

    const line = (col: keyof ProcessedEpoch, label: string) => {
        const cleanedData = df
            .map(row => ({
                datetime_utc: row.datetime_utc,
                value: row[col]
            }))
            .filter(d => d.value !== null && d.value !== undefined && !isNaN(Number(d.value)));

        if (cleanedData.length < 2) return null;

        const x_coords = cleanedData.map(d => formatInTimeZone(d.datetime_utc, timezone, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }, applyTimezone));
        const y_coords = cleanedData.map(d => d.value);

        const lineTrace = {
            x: x_coords,
            y: y_coords,
            mode: 'lines',
            name: label,
            line: { width: 1.5, color: '#75baf5' },
            hovertemplate: '%{y:.2f}<extra></extra>'
        };

        const layout = getNightlyPlotLayout(df, label, label, timezone, night_events, night_start_date, { rangemode: 'tozero' as const }, applyTimezone); // "as const" narrows the value to a literal type
        layout.showlegend = false;
        
        return { data: [lineTrace], layout: layout };
    };
    
    const nightlyColumnsToPlot: { key: keyof ProcessedEpoch; label: string }[] = [
        { key: 'hr', label: 'Heart Rate (bpm)' },
        { key: 'rr', label: 'Respiratory Rate (breaths/min)' },
        { key: 'snoring', label: 'Snoring' },
        { key: 'rmssd', label: 'HRV (RMSSD, ms)' },
        { key: 'sdnn_1', label: 'HRV (SDNN, ms)' },
        { key: 'mvt_score', label: 'Movement Score' },
        { key: 'chest_movement_rate', label: 'Chest Movement Rate (breaths/min)' },
        { key: 'breathing_sounds', label: 'Breathing Sounds' }
    ];

    for (const { key, label } of nightlyColumnsToPlot) {
        const plot = line(key, label);
        if (plot) plots.push(plot);
    }
    return plots;
}

function formatInTimeZone(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions, applyTimezone: boolean = true): string {
    const tz = applyTimezone ? timeZone : 'UTC';
    try {
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        const robustOptions: Intl.DateTimeFormatOptions = { ...options, timeZone: tz, hourCycle: 'h23' };
        if ('hour12' in robustOptions) {
            delete robustOptions.hour12;
        }
        let formatted = new Intl.DateTimeFormat('en-CA', robustOptions).format(date);
        
        return formatted.replace(',', '').replace(' 24', ' 00');
    } catch (e) {
        if (e instanceof RangeError) {
            console.warn(`Invalid timezone "${tz}", falling back to UTC.`);
            const fallbackOptions: Intl.DateTimeFormatOptions = { ...options, timeZone: 'UTC', hourCycle: 'h23' };
            if ('hour12' in fallbackOptions) {
                delete fallbackOptions.hour12;
            }
            let formatted = new Intl.DateTimeFormat('en-CA', fallbackOptions).format(date);
            return formatted.replace(',', '').replace(' 24', ' 00');
        }
        throw e;
    }
}

function getNightlyPlotLayout(df: ProcessedEpoch[], title: string, yLabel: string, timezone: string, night_events: any, sleepRecordStartDate: Date | null, yAxisSettings: object = {}, applyTimezone: boolean) {
    if (!df || df.length === 0) {
        return { title: { text: title }, margin: { l: 80, r: 20, t: 40, b: 40 } };
    }

    df.sort((a, b) => a.datetime_utc.getTime() - b.datetime_utc.getTime());
    const start = df[0].datetime_utc;
    const end = df[df.length - 1].datetime_utc;

    let shapes = [];

    const eventMapping: Record<string, {name: string, color: string, dash: string}> = {
        '1': { name: 'Got in Bed', color: '#1f77b4', dash: 'dash' },
        '2': { name: 'Fell Asleep', color: '#2ca02c', dash: 'dash' },
        '3': { name: 'Woke Up', color: '#ff7f0e', dash: 'dash' },
        '4': { name: 'Got out of Bed', color: '#d62728', dash: 'dash' },
    };

    if (night_events && typeof night_events === 'object' && sleepRecordStartDate) {
        shapes = Object.entries(night_events).flatMap(([eventCode, timestamps]) => {
            if (!eventMapping[eventCode] || !Array.isArray(timestamps)) return [];
            return timestamps.map(tsOffset => {
                const event_date = new Date(sleepRecordStartDate.getTime() + (tsOffset * 1000));
                return {
                    type: 'line',
                    x0: formatInTimeZone(event_date, timezone, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }, applyTimezone),
                    y0: 0,
                    x1: formatInTimeZone(event_date, timezone, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }, applyTimezone),
                    y1: 1,
                    yref: 'paper',
                    line: {
                        color: eventMapping[eventCode].color,
                        width: 1,
                        dash: eventMapping[eventCode].dash
                    },
                    name: eventMapping[eventCode].name,
                };
            });
        });
    }

    const tzForCalc = applyTimezone ? timezone : 'UTC';
    
    const startInTz = new Date(start.toLocaleString('en-US', {timeZone: tzForCalc}));
    const midnight = new Date(startInTz);
    midnight.setHours(24, 0, 0, 0);

    if (midnight.getTime() > start.getTime() && midnight.getTime() < end.getTime()) {
        const midnightUTCString = formatInTimeZone(midnight, "UTC", { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }, true);
        
        shapes.push({
            type: 'line',
            x0: midnightUTCString,
            y0: 0,
            x1: midnightUTCString,
            y1: 1,
            yref: 'paper',
            line: { color: 'rgba(128, 128, 128, 0.5)', width: 1.5, dash: 'dash' }
        });
    }

    return {
        template: 'simple_white',
        title: { text: title },
        xaxis: {
            tickformat: '%H:%M',
            showgrid: false,
            zeroline: false,
        },
        yaxis: {
            title: yLabel,
            showgrid: false,
            zeroline: false,
            ...yAxisSettings
        },
        autosize: true,
        margin: { l: 80, r: 20, t: 40, b: 40 },
        hovermode: "x",
        shapes: shapes,
        showlegend: false
    };
}


function plotNightStage(df: ProcessedEpoch[], timezone: string, applyTimezone: boolean, night_events: any, sleepRecordStartDate: Date | null) {
    const stageMap: Record<number, { name: string, color: string }> = {
        0: { name: 'Awake', color: '#808080' },
        1: { name: 'Light', color: '#a6cee3' },
        2: { name: 'Deep', color: '#1f78b4' },
        3: { name: 'REM', color: '#9467bd' },
    };

    const data = df.map(row => ({
        x: formatInTimeZone(row.datetime_utc, timezone, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }, applyTimezone),
        y: row.state,
        text: stageMap[row.state]?.name || 'Unknown',
        color: stageMap[row.state]?.color || '#808080',
    })).sort((a, b) => new Date(a.x).getTime() - new Date(b.x).getTime());
    
    const traces = [];
    let currentSegment = { x: [], y: [], text: [], color: null };

    for (let i = 0; i < data.length; i++) {
        const point = data[i];
        if (currentSegment.color !== point.color) {
            if (currentSegment.x.length > 0) {
                // Before starting a new segment, add the start of the new point to close the gap for hv shape
                currentSegment.x.push(point.x);
                currentSegment.y.push(currentSegment.y[currentSegment.y.length - 1]);
                traces.push({
                    x: currentSegment.x,
                    y: currentSegment.y,
                    text: currentSegment.text,
                    mode: 'lines',
                    line: { color: currentSegment.color, shape: 'hv', width: 4 },
                    hoverinfo: 'x+text',
                    name: stageMap[currentSegment.y[0]]?.name || 'Unknown',
                    hovertemplate: `<b>%{text}</b><br>%{x|%H:%M}<extra></extra>`
                });
            }
            currentSegment = { x: [], y: [], text: [], color: point.color }; // issue: the value of "color" is only null
        }
        currentSegment.x.push(point.x); // issue: "never[]" is empty array forever
        currentSegment.y.push(point.y);
        currentSegment.text.push(point.text);
    }
    // Add the last segment
    if (currentSegment.x.length > 0) {
        traces.push({
            x: currentSegment.x,
            y: currentSegment.y,
            text: currentSegment.text,
            mode: 'lines',
            line: { color: currentSegment.color, shape: 'hv', width: 4 },
            hoverinfo: 'x+text',
            name: stageMap[currentSegment.y[0]]?.name || 'Unknown',
            hovertemplate: `<b>%{text}</b><br>%{x|%H:%M}<extra></extra>`
        });
    }

    const layout = getNightlyPlotLayout(df, 'Sleep Stages', 'Sleep Stage', timezone, night_events, sleepRecordStartDate, {
        tickmode: 'array' as const,
        tickvals: [0, 1, 2, 3],
        ticktext: ['Awake', 'Light', 'Deep', 'REM'],
        autorange: 'reversed'
    }, applyTimezone);

    layout.showlegend = true;
    layout.legend = {
        orientation: 'h',
        yanchor: 'bottom',
        y: -0.3,
        xanchor: 'right',
        x: 1
    };
    
    return { data: traces, layout: layout };
}

export async function generateReport(label: string, summaryData: ProcessedSummary[], epochData?: ProcessedEpoch[], applyTimezone: boolean = true): Promise<string> {
    const report_timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    if (summaryData.length === 0) {
        throw new Error("No data found for this user to generate a report.");
    }

    const hasEpochData = !!epochData && epochData.length > 0;
    
    const summaryDataForCsv = summaryData.map(row => {
        const newRow = {...row};
        if(typeof newRow.night_events === 'object' && newRow.night_events !== null) {
            newRow.night_events = JSON.stringify(newRow.night_events);
        }
        return newRow;
    });
    const summary_csv_datauri = dfToDataUri(summaryDataForCsv, Object.keys(summaryData[0] || {}));

    const epoch_csv_columns = ['id', 'timestamp', 'state', 'hr', 'rr', 'snoring', 'sdnn_1', 'rmssd', 'mvt_score', 'chest_movement_rate', 'withings_index', 'breathing_sounds'];
    const epoch_csv_datauri = hasEpochData ? dfToDataUri(epochData, epoch_csv_columns) : '';

    const night_plot_data: Record<string, any> = {};
    const night_meta_json: Record<string, any> = {};

    if (hasEpochData) {
        const epochDataById: Record<string, ProcessedEpoch[]> = {};
        epochData.forEach(e => {
            if (!epochDataById[e.id]) epochDataById[e.id] = [];
            epochDataById[e.id].push(e);
        });

        for (const [wid, night_df] of Object.entries(epochDataById)) {
            const summaryRow = summaryData.find(s => String(s.id) === wid);
            const timezone = summaryRow?.timezone;
            if (timezone) {
                night_plot_data[wid] = plotNight(night_df, timezone, applyTimezone);
            }
        }
        
        summaryData.forEach(row => {
            night_meta_json[row.id] = {
                lab_id: row.lab_id,
                startdate: formatInTimeZone(row.startdate_utc, row.timezone, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }, applyTimezone),
                enddate: formatInTimeZone(row.enddate_utc, row.timezone, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }, applyTimezone),
            }
        });
    }
    
    const legend_modal_html = `
        <div id="legend-modal">
            <div id="legend-modal-dialog">
                <h3>Night Event Legend</h3>
                <ul id="legend-list">
                    <!-- Legend items will be injected here by JS -->
                </ul>
                <button id="legend-modal-close-btn">Close</button>
            </div>
        </div>
    `;

    const nightly_modal_html = hasEpochData ? `
        <div id="nightly-modal">
            <div id="nightly-modal-dialog">
                <div id="nightly-modal-header">
                    <div id="nightly-modal-meta"></div>
                    <div class="header-buttons">
                        <button id="legend-help-btn" title="Event Legend">?</button>
                        <button id="nightly-modal-close-btn">✕</button>
                    </div>
                </div>
                <div id="nightly-modal-body">
                    <div id="nightly-modal-content"></div>
                </div>
                <div id="nightly-modal-footer">
                    <button id="prev-night">← Previous</button>
                    <button id="next-night">Next →</button>
                </div>
            </div>
        </div>
        ${legend_modal_html}
    ` : '';

    const timing_modal_html = `
        <div id="timing-modal">
            <div id="timing-modal-dialog">
                <div id="timing-modal-header">
                    <h3>Sleep Timing Overview</h3>
                    <button id="timing-modal-close-btn" onclick="document.getElementById('timing-modal').style.display='none'">✕</button>
                </div>
                <div id="timing-modal-body">
                    <div id="timing-modal-content"></div>
                </div>
            </div>
        </div>
    `;
    
    const footer_links = [
        `<a id="summary-data-link" href="${summary_csv_datauri}" download="summary_df.csv">📄 Download Summary CSV</a>`,
    ];
    if (hasEpochData) {
        footer_links.push(`<a id="epoch-data-link" href="${epoch_csv_datauri}" download="epoch_df.csv">📄 Download Epoch CSV</a>`);
    }

    const nightly_data_note = !hasEpochData ? '<p style="font-style: italic; color: #555;">Note: Epoch data not provided. Nightly detailed views are unavailable.</p>' : '';
    
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Withings Report: ${label}</title>
        <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>
        <style>
            html { font-size: 16px; }
            @media (max-width: 600px) { html { font-size: 14px; } }
            body { font-family: "Segoe UI", sans-serif; margin: 0; background: #f9f9f9; color: #333; }
            .container { max-width: 1200px; margin: 0 auto; padding: 2rem; position: relative; }
            h1, h2 { color: #2c3e50; }
            ul { line-height: 1.6; padding-left: 20px; }
            .summary-card { background: #fff; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); margin-bottom: 2rem; }
            .summary-card ul li { padding: 0.25rem 0; }
            .plot-wrapper > div { width: 100%; }
            #nightly-modal, #timing-modal, #legend-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1000; background-color: rgba(0,0,0,0.4); backdrop-filter: blur(5px); animation: fadeIn 0.3s ease-in-out; }
            #nightly-modal-dialog, #timing-modal-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90%; height: 90%; background: #ffffff; border: none; border-radius: 12px; overflow: hidden; padding: 0; display: flex; flex-direction: column; box-shadow: 0 15px 30px rgba(0,0,0,0.2); }
            @media (max-width: 768px) { #nightly-modal-dialog, #timing-modal-dialog { width: 96%; height: 96%; } }
            #nightly-modal-header, #timing-modal-header { padding: 1rem 1.5rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
            #nightly-modal-meta, #timing-modal-header h3 { font-size: 0.95rem; color: #555; margin: 0; }
            #nightly-modal-header .header-buttons { display: flex; gap: 0.5rem; align-items: center; }
            #nightly-modal-close-btn, #timing-modal-close-btn, #legend-help-btn { width: 2.2rem; height: 2.2rem; border-radius: 50%; font-size: 1.1rem; line-height: 1; padding: 0; display: flex; align-items: center; justify-content: center; background: #e0e0e0; color: #333; border: none; cursor: pointer; }
            #nightly-modal-close-btn:hover, #timing-modal-close-btn:hover, #legend-help-btn:hover { background: #d0d0d0; }
            #nightly-modal-body, #timing-modal-body { flex-grow: 1; overflow-y: auto; padding: 1.5rem; }
            #nightly-modal-content, #timing-modal-content { width: 100%; display: flex; flex-direction: column; gap: 1rem; }
            #timing-modal-content { overflow-x: auto; }
            #nightly-modal-content > div { margin-bottom: 2rem; width: 100%; }
            #nightly-modal-footer { padding: 1rem 1.5rem; border-top: 1px solid #eee; display:flex; justify-content:space-between; flex-shrink: 0; }
            #nightly-modal-footer button { background: #2c3e50; color: white; border: none; padding: 0.5rem 1rem; font-size: 1rem; cursor: pointer; border-radius: 5px; }
            #nightly-modal-footer button:hover { background: #34495e; }
            #nightly-modal-footer button:disabled { opacity: 0.5; cursor: not-allowed; background: #bdc3c7; }
            .responsive-plot { margin-bottom: 1rem; padding-bottom: 1rem; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

            #legend-modal-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); width: auto; min-width: 300px; background: #fff; padding: 1.5rem; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); z-index: 1001; }
            #legend-modal-dialog h3 { margin-top: 0; }
            #legend-list { list-style: none; padding: 0; }
            #legend-list li { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
            #legend-list .color-box { width: 20px; height: 20px; border: 1px solid #ccc; }
            #legend-modal-close-btn { display: block; margin: 1.5rem auto 0; padding: 0.5rem 1rem; cursor: pointer; }


            .summary-stats-table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border-radius: 8px; overflow: hidden; }
            .summary-stats-table th, .summary-stats-table td { padding: 0.75rem 1rem; text-align: left; }
            .summary-stats-table th { background: #f8f9fa; font-weight: 600; color: #34495e; }
            .summary-stats-table tbody tr { border-bottom: 1px solid #eee; }
            .summary-stats-table tbody tr:last-child { border-bottom: none; }
            .summary-stats-table .data-row.expandable { cursor: pointer; }
            .summary-stats-table .data-row.expandable:hover { background: #f0f4f8; }
            .summary-stats-table .data-row.expandable td:first-child { position: relative; padding-left: 2.5rem; }
            .summary-stats-table .data-row.expandable td:first-child::before { content: '▸'; position: absolute; left: 1rem; top: 50%; transform: translateY(-50%) rotate(0deg); transition: transform 0.2s ease; }
            .summary-stats-table .data-row.expandable.open td:first-child::before { transform: translateY(-50%) rotate(90deg); }
            .summary-stats-table .plot-row { display: none; }
            .summary-stats-table .plot-row.open { display: table-row; }
            .summary-stats-table .plot-row > td { padding: 0; }
            .details-content { padding: 1rem; }
            footer { margin-top:3rem; text-align:center; color:#999; padding-bottom: 2rem; }
            
            .settings-container { position: fixed; top: 1.5rem; right: 1.5rem; z-index: 1001; }
            .floating-menu-btn { width: 3rem; height: 3rem; border-radius: 50%; background: #fff; border: 1px solid #ddd; box-shadow: 0 4px 12px rgba(0,0,0,0.1); cursor: pointer; display: flex; align-items: center; justify-content: center; }
            .floating-menu-btn:hover { background: #f0f0f0; }
            .floating-menu-btn svg { width: 1.5rem; height: 1.5rem; color: #333; }
            .settings-menu { display: none; position: absolute; top: calc(100% + 0.5rem); right: 0; background: #fff; border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,0.15); border: 1px solid #ddd; width: 280px; padding: 0.5rem 0; }
            .menu-section { padding: 0.5rem 1rem; }
            .menu-section h3 { margin-top: 0; margin-bottom: 0.75rem; font-size: 1rem; color: #2c3e50; }
            .menu-section .filter-item { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
            .menu-section .filter-item input[type="number"] { width: 60px; padding: 0.25rem; border: 1px solid #ccc; border-radius: 4px; }
            .menu-section a { display: block; padding: 0.5rem 0; color: #3498db; text-decoration: none; font-size: 0.9rem; }
            .menu-section a:hover { text-decoration: underline; }
            .menu-divider { border: none; border-top: 1px solid #eee; margin: 0.5rem 0; }
            
            .heading-with-button { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
            .icon-button { background: none; border: 1px solid #ccc; border-radius: 50%; width: 2rem; height: 2rem; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #555; }
            .icon-button:hover { background: #f0f0f0; border-color: #bbb; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="settings-container">
                <button id="floating-settings-btn" class="floating-menu-btn" title="Settings and Downloads">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2.4l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2.4l.15.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <div id="settings-menu" class="settings-menu">
                    <div class="menu-section">
                        <h3>Report Filters</h3>
                        <div class="filter-item">
                            <input type="checkbox" id="nap-filter-toggle" onchange="window.applyFilters()">
                            <label for="nap-filter-toggle">Hide naps (short sleep periods)</label>
                        </div>
                        <div class="filter-item">
                            <label for="nap-duration-hours">Hide sleeps <</label>
                            <input type="number" id="nap-duration-hours" value="3" min="0" step="0.5" onchange="window.applyFilters()">
                            <span>hours</span>
                        </div>
                    </div>
                    <hr class="menu-divider">
                    <div class="menu-section" id="download-links-container">
                        ${footer_links.join('')}
                    </div>
                </div>
            </div>

            <div class="summary-card">
                <h1>Withings Report: ${label}</h1>
                ${nightly_data_note}
                <ul id="summary-stats-list">
                    <!-- Stats will be dynamically inserted here -->
                </ul>
            </div>

            <h2>Detailed Sleep Metrics</h2>
            <div id="sleep-timing-plot-container-h"></div>
            <div id="detailed-metrics-container"></div>
            <div id="duration-efficiency-regularity-container"></div>
            <div id="sleep-ritual-container"></div>
            <div id="AHI-container"></div>
            <div id="osa-chart-container"></div>
            <div id="snoring-chart-container"></div>
            <div id="wake-episodes-container"></div> 

            
            ${nightly_modal_html}
            ${timing_modal_html}
            
            <footer>
                Report generated on ${report_timestamp}
            </footer>
        </div>

        <script>
        const DURATION_FIELDS_IN_SECONDS = ${JSON.stringify(DURATION_FIELDS_IN_SECONDS)};
        const EFFICIENCY_FIELDS = ${JSON.stringify(EFFICIENCY_FIELDS)};
        const ALL_DATA_FIELDS = ${JSON.stringify(ALL_DATA_FIELDS)};
        const fieldDisplayNameMap = ${JSON.stringify(fieldDisplayNameMap)};
        const hasEpochData = ${hasEpochData};
        const nightlyPlotData = ${hasEpochData ? JSON.stringify(night_plot_data) : 'null'};
        const nightlyMeta = ${hasEpochData ? JSON.stringify(night_meta_json) : 'null'};
        const REPORT_APPLY_TIMEZONE = ${applyTimezone};
        const EVENT_MAPPING = {
            '1': { name: 'Got in Bed', color: '#1f77b4' },
            '2': { name: 'Fell Asleep', color: '#2ca02c' },
            '3': { name: 'Woke Up', color: '#ff7f0e' },
            '4': { name: 'Got out of Bed', color: '#d62728' },
        };

        let fullSummaryData = [];
        let epochData = []; // epoch__
        let sleepTimingPlotData = [];
        let currentWids = [];

        document.addEventListener('DOMContentLoaded', () => {
            const dataLink = document.getElementById('summary-data-link');
            if (!dataLink) {
                console.error("Summary data link not found!");
                return;
            }
            const dataUri = dataLink.href;
            
            Papa.parse(dataUri, {
                download: true,
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: (results) => {
                    fullSummaryData = results.data.map(row => {
                        const parseDate = (val) => {
                            if (!val) return null;
                            const d = new Date(val);
                            return isNaN(d.getTime()) ? null : d;
                        }
                        const startdate_utc_val = parseDate(row.w_startdate || row.startdate_utc);
                        const enddate_utc_val = parseDate(row.w_enddate || row.enddate_utc);

                        return { ...row, startdate_utc: startdate_utc_val, enddate_utc: enddate_utc_val };
                    }).filter(row => row.startdate_utc && row.enddate_utc);
                    if (!hasEpochData) {
                        renderHorizontalSleepTimingPlot(fullSummaryData, false);
                    }
                    applyFilters();
                },
                error: (err) => {
                    console.error("Error parsing summary CSV:", err);
                    document.getElementById('summary-stats-list').innerHTML = '<li>Error loading report data.</li>';
                }
            });

            // epoch__
            // ---- EPOCH ----
            const epochLink = document.getElementById('epoch-data-link');
            if (epochLink) {
                Papa.parse(epochLink.href, {
                    download: true,
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        epochData = results.data.map(row => ({
                            id: row.id,
                            state: row.state,
                            timestamp: row.timestamp,
                            date: new Date(row.timestamp * 1000)
                        })).filter(r => r.id && r.timestamp);

                        // const wakeEpisodes = findWakeEpisodes(epochData);
                        const wakeEpisodes = findWakeEpisodes(epochData, fullSummaryData);


                        // Degbug: render into DOM IF WE HAVE Epoch data
                        // renderWakeEpisodes(wakeEpisodes);
                        // renderHorizontalSleepTimingPlot(fullSummaryData, wakeEpisodes);

                        // Call the plot function if summary is already loaded
                        renderHorizontalSleepTimingPlot(fullSummaryData, wakeEpisodes);
                    },
                    error: (err) => {
                        console.error("Error parsing epoch CSV:", err);
                    }
                });
            }

            const settingsBtn = document.getElementById('floating-settings-btn');
            const settingsMenu = document.getElementById('settings-menu');
            if (settingsBtn && settingsMenu) {
                settingsBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const isShown = settingsMenu.style.display === 'block';
                    settingsMenu.style.display = isShown ? 'none' : 'block';
                });

                window.addEventListener('click', (event) => {
                    if (!settingsMenu.contains(event.target) && !settingsBtn.contains(event.target)) {
                        settingsMenu.style.display = 'none';
                    }
                });
            }
            
            if (hasEpochData) {
                setupLegendModal();
            }
        });

        /* Debug: If we have Epoch data, you can uncommend this code to evaluate "Time of out bed" Episodes 
        function renderWakeEpisodes(episodes) {
            const container = document.getElementById("wake-episodes-container");
            if (!container) return;

            if (episodes.length === 0) {
                container.innerHTML = "<p>No long wake episodes found.</p>";
                return;
            }

            const html = episodes.map(e =>
                \`<li>ID: \${e.id} | Start: \${e.start.toLocaleString()} | End: \${e.end.toLocaleString()} | Duration: \${(e.durationSec/60).toFixed(1)} min</li>\`
            ).join("");

            container.innerHTML = \`<h3>Wake Episodes ≥10min</h3><ul>\${html}</ul>\`;
        } */


        function applyFilters() {
            const filterToggle = document.getElementById('nap-filter-toggle').checked;
            const durationHours = parseFloat(document.getElementById('nap-duration-hours').value);
            const durationSeconds = durationHours * 3600;

            let filteredData = fullSummaryData;
            if (filterToggle && !isNaN(durationSeconds)) {
                filteredData = fullSummaryData.filter(d => (d.w_total_sleep_time || d.total_sleep_time) >= durationSeconds);
            }
            
            if (filteredData.length === 0) {
                document.getElementById('summary-stats-list').innerHTML = '<li>No data matches the current filters.</li>';
                document.getElementById('sleep-timing-plot-container-h').innerHTML = '';
                document.getElementById('detailed-metrics-container').innerHTML = '';
                return;
            }

            updateReport(filteredData);
        }

        function findWakeEpisodes(data, summaryData) {
            if (data.length === 0) return [];

            // Group by night ID
            const grouped = {};
            data.forEach(row => {
                if (!grouped[row.id]) grouped[row.id] = [];
                grouped[row.id].push(row);
            });

            // Build a map of night intervals
            const nightIntervals = {};
            summaryData.forEach(d => {
                const id = String(d.w_id || d.id);
                nightIntervals[id] = { start: d.startdate_utc, end: d.enddate_utc };
        });

    const results = [];

    Object.keys(grouped).forEach(id => {
        const rows = grouped[id].sort((a, b) => a.timestamp - b.timestamp);
        const night = nightIntervals[id];
        if (!night) return; // skip if no sleep interval

        let start = null;
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            if (r.state === 0) { // awake
                if (!start) start = r;
            } else { // asleep
                if (start) {
                    const episodeStart = start.date;
                    const episodeEnd = rows[i - 1].date;

                    // Clip episode to sleep interval
                    const clippedStart = episodeStart < night.start ? night.start : episodeStart;
                    const clippedEnd   = episodeEnd > night.end ? night.end : episodeEnd;
                    const duration = (clippedEnd.getTime() - clippedStart.getTime()) / 1000;

                    if (duration >= 600) { // ≥10 min
                        results.push({
                            id,
                            start: clippedStart,
                            end: clippedEnd,
                            durationSec: duration
                        });
                    }
                    start = null;
                }
            }
        }

        // Check if wake extends to end
        if (start) {
            const last = rows[rows.length - 1];
            const episodeStart = start.date;
            const episodeEnd = last.date;

            const clippedStart = episodeStart < night.start ? night.start : episodeStart;
            const clippedEnd   = episodeEnd > night.end ? night.end : episodeEnd;
            const duration = (clippedEnd.getTime() - clippedStart.getTime()) / 1000;

            if (duration >= 600) {
                results.push({
                    id,
                    start: clippedStart,
                    end: clippedEnd,
                    durationSec: duration
                });
            }
        }
    });

        return results;
    }



    function updateReport(data) {
        const sortedData = [...data].sort((a, b) => a.startdate_utc.getTime() - b.startdate_utc.getTime());
        
        currentWids = hasEpochData ? sortedData.map(d => String(d.w_id || d.id)).filter(id => nightlyPlotData[id]) : [];

        renderSummaryStats(sortedData);
        DurationEfficiencyRegularity(sortedData);
        SleepRitual(sortedData);
        SleepVitals(sortedData);
        OSAChart();
        SnoringChart();
    }

    function renderSummaryStats(data) {
        const statsList = document.getElementById('summary-stats-list');
        if (!statsList) return;

        const mean = arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        const std = (arr, avg) => arr.length > 0 ? Math.sqrt(arr.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b) / arr.length) : 0;

        const durations = data.map(d => (d.w_total_sleep_time || d.total_sleep_time) / 3600).filter(v => v !== null && !isNaN(v));
        const efficiencies = data.map(d => (d.w_sleep_efficiency || d.sleep_efficiency) * 100).filter(v => v !== null && !isNaN(v));
        const ahis = data.map(d => (d.w_apnea_hypopnea_index || d.apnea_hypopnea_index)).filter(v => v !== null && !isNaN(v));
        const snores = data.map(d => (d.w_snoring || d.snoring) / 60).filter(v => v !== null && !isNaN(v));

        const meanDuration = mean(durations);
        const meanEff = mean(efficiencies);
        const stdEff = std(efficiencies, meanEff);
        const meanAhi = mean(ahis);
        const stdAhi = std(ahis, meanAhi);
        const meanSnore = mean(snores);
        const stdSnore = std(snores, meanSnore);

        const validDates = data.filter(d => d.startdate_utc && !isNaN(d.startdate_utc.getTime()));
        if (validDates.length === 0) {
            statsList.innerHTML = \`<li>No valid date data found.</li>\`;
            return;
        }
        const minDate = new Date(Math.min(...validDates.map(d => d.startdate_utc.getTime())));
        const maxDate = new Date(Math.max(...validDates.map(d => d.enddate_utc.getTime())));

        statsList.innerHTML = \`
            <li><strong>Date Range:</strong> \${minDate.toISOString().split('T')[0]} to \${maxDate.toISOString().split('T')[0]}</li>
            <li><strong>Total Nights:</strong> \${data.length}</li>
            <li><strong>Avg Duration:</strong> \${meanDuration.toFixed(1)} hours</li>
            <li><strong>Sleep Efficiency:</strong> \${meanEff.toFixed(2)} ± \${stdEff.toFixed(2)} %</li>
            <li><strong>AHI:</strong> \${meanAhi.toFixed(2)} ± \${stdAhi.toFixed(2)} events/hour</li>
            <li><strong>Snoring:</strong> \${meanSnore.toFixed(2)} ± \${stdSnore.toFixed(2)} minutes/night</li>
        \`;
    }

    function formatInTimeZoneJS(date, timeZone, options) {
        try {
            if (!(date instanceof Date) || isNaN(date)) return null;
            const tz = REPORT_APPLY_TIMEZONE ? timeZone : 'UTC';
            const robustOptions = { ...options, timeZone: tz, hourCycle: 'h23' };
            if ('hour12' in robustOptions) delete robustOptions.hour12;
            return new Intl.DateTimeFormat('en-CA', robustOptions).format(date).replace(',', '').replace(' 24', ' 00');
        } catch (e) {
            const tz = 'UTC';
            const fallbackOptions = { ...options, timeZone: tz, hourCycle: 'h23' };
            if ('hour12' in fallbackOptions) delete fallbackOptions.hour12;
            return new Intl.DateTimeFormat('en-CA', fallbackOptions).format(date).replace(',', '').replace(' 24', ' 00');
        }
    }
        
    function mins_from_noon_js(date, timeZone) {
        try {
            if (!(date instanceof Date) || isNaN(date)) return null;
            const tz = REPORT_APPLY_TIMEZONE ? timeZone : 'UTC';
            const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
            const parts = formatter.formatToParts(date);
            const hourPart = parts.find(p => p.type === 'hour')?.value ?? 'NaN';
            const hour = parseInt(hourPart.replace('24', '0'), 10);
            const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? 'NaN', 10);
            if (isNaN(hour) || isNaN(minute)) return null;
            return (((hour * 60 + minute) - 720) + 1440) % 1440;
        } catch (e) { return null; }
    }

    function renderHorizontalSleepTimingPlot(summaryData, wakeEpisodes) {
        const container = document.getElementById('sleep-timing-plot-container-h');
        container.innerHTML = '';
        if (!summaryData.length) return;

        const validSummary = summaryData
            .filter(d => d.enddate_utc && !isNaN(d.enddate_utc.getTime()))
            .sort((a, b) => a.enddate_utc - b.enddate_utc);

        if (!validSummary.length) return;

        // Build maps from summary rows
        const idToTz = new Map(validSummary.map(r => [
            String(r.w_id || r.id), r.w_timezone || r.timezone || 'UTC'
        ]));

        const plotData = validSummary.map(row => {
            const timezone = row.w_timezone || row.timezone;
            const yLabel = formatInTimeZoneJS(row.enddate_utc, timezone, { day: '2-digit', month: 'short' });
            const startMin = mins_from_noon_js(row.startdate_utc, timezone);
            const endMinRaw = mins_from_noon_js(row.enddate_utc, timezone);
            if (startMin == null || endMinRaw == null || yLabel == null) return null;
            const endMin = endMinRaw < startMin ? endMinRaw + 1440 : endMinRaw;
            const sleep_latency = row.sleep_latency;

            return {
            startdate_utc: row.startdate_utc,  
            enddate_utc: row.enddate_utc,       
            timezone,
            sleep_latency,
            id: String(row.w_id || row.id),
            y: yLabel,
            base: startMin,
            duration: endMin - startMin,
            start_min_from_noon: startMin,
            out_of_bed_count: row.out_of_bed_count,
            ahi_round: Math.round(row.apnea_hypopnea_index),
            snoring_minutes: row.snoring_minutes,
            hr_average: row.hr_average,
            TIB_min: row.total_timeinbed / 3600,
            asleep_min: row.total_sleep_time / 3600,
            sleep_efficiency_percent: (row.sleep_efficiency || 0) * 100,
            hovertemplate: hasEpochData
                ? \`\${yLabel}<br>Start: \${formatInTimeZoneJS(row.startdate_utc, timezone, {hour: '2-digit', minute:'2-digit'})}<br>End: \${formatInTimeZoneJS(row.enddate_utc, timezone, {hour:'2-digit', minute:'2-digit'})}<br>Click for details<extra></extra>\`
                : \`\${yLabel}<br>Start: \${formatInTimeZoneJS(row.startdate_utc, timezone, {hour: '2-digit', minute:'2-digit'})}<br>End: \${formatInTimeZoneJS(row.enddate_utc, timezone, {hour:'2-digit', minute:'2-digit'})}<extra></extra>\`
            };
        }).filter(Boolean);

        if (!plotData.length) return;

        // id -> y label for aligning wake episodes
        const idToY = new Map(plotData.map(d => [d.id, d.y]));

        // Convert wake episodes using the SAME tz as the night with that id
        let epochPlotData = []; 
        let wakeTrace = null;
        if(wakeEpisodes){
            epochPlotData = wakeEpisodes
                .filter(w => w.durationSec >= 600)
                .map(w => {
                const id = String(w.id);
                const timezone = idToTz.get(id) || 'UTC';
                const y = idToY.get(id) || formatInTimeZoneJS(w.end, timezone, { day: '2-digit', month: 'short' });
                const startMin = mins_from_noon_js(w.start, timezone);
                const endMin = mins_from_noon_js(w.end, timezone);
                if (startMin == null || endMin == null) return null;
                const durationMin = endMin >= startMin ? (endMin - startMin) : (endMin + 1440 - startMin);
                return { id, y, timezone, start: w.start, end: w.end, startMin, durationMin };
                })
                .filter(Boolean);
        }

        // *** traces ***

        const traceDuration = {
            y: plotData.map(d => d.y),
            x: plotData.map(d => d.duration),
            base: plotData.map(d => d.base),
            type: 'bar',
            orientation: 'h',
            customdata: plotData.map(d => d.id),
            hovertemplate: plotData.map(d => d.hovertemplate),
            marker: { color: '#75baf5', line: { color: '#75baf5', width: 1 } },
            showlegend: true,
            name: 'Total Sleep Time (TST)',
            offsetgroup: 0
        };

        const traceStartTime = {
            y: plotData.map(d => d.y),
            x: plotData.map(d => (d.sleep_latency) / 60), // convert to minute
            base: plotData.map(d => d.start_min_from_noon),
            type: 'bar',
            orientation: 'h',
            customdata: plotData.map(d => d.id),
            hovertemplate: plotData.map(d => {
                const s = formatInTimeZoneJS(d.startdate_utc, d.timezone, { hour:'2-digit', minute:'2-digit' });
                const eDate = new Date(d.startdate_utc.getTime() + (d.sleep_latency || 0)*1000);
                const e = formatInTimeZoneJS(eDate, d.timezone, { hour:'2-digit', minute:'2-digit' });
                return \`Sleep Latency: \${d.y}<br>Start: \${s}<br>End: \${e}<br>Duration: \${(d.sleep_latency/60).toFixed(1)} min<extra></extra>\`;
            }),
            marker: { color: 'white', line: { color: '#75baf5', width: 1 } },
            showlegend: true,
            name: 'Sleep Latency'
        };

        // IMPORTANT: build wake trace from epochPlotData (not plotData)
        if(epochPlotData.length){
            wakeTrace = {
                y: epochPlotData.map(d => d.y),
                x: epochPlotData.map(d => d.durationMin),
                base: epochPlotData.map(d => d.startMin),
                type: 'bar',
                orientation: 'h',
                name: 'Extended Out of Bed',
                marker: { color: 'red', line: { color: 'darkred', width: 1 } },
                hovertemplate: epochPlotData.map(d => {
                const s = formatInTimeZoneJS(d.start, d.timezone, { hour: '2-digit', minute: '2-digit' });
                const e = formatInTimeZoneJS(d.end, d.timezone, { hour: '2-digit', minute: '2-digit' });
                return \`Out of Bed: \${d.y}<br>Start: \${s}<br>End: \${e}<br>Duration: \${d.durationMin.toFixed(1)} min<extra></extra>\`;
                })
            };
        }   

        // axes & layout
        const tickVals = Array.from({ length: 49 }, (_, i) => i * 60);
        const tickText = tickVals.map(v => {
            const h24 = (Math.floor((v + 720) / 60) % 24);
            const h12 = h24 % 12 || 12;
            const ampm = h24 < 12 ? 'AM' : 'PM';
            return \`\${h12}\${ampm}\`;
        });

        const minX = Math.min(...plotData.map(d => d.base));
        const maxX = Math.max(...plotData.map(d => d.base + d.duration));
        const filteredTickVals = tickVals.filter(v => v >= minX - 30 && v <= maxX + 30);
        const filteredTickText = tickText.filter((_, i) => tickVals[i] >= minX - 30 && tickVals[i] <= maxX + 30);

        const layout = {
            template: 'simple_white',
            hovermode: 'closest',
            barmode: 'overlay',
            xaxis: { tickmode: 'array', side: 'top', tickvals: filteredTickVals, ticktext: filteredTickText, showgrid: true },
            yaxis: { title: 'Date', type: 'category', autorange: 'reversed', automargin: true },
            autosize: true,
            showlegend: true,
            legend: { orientation: 'h', y: -0.2 }
        };

        wakeEpisodes ? Plotly.newPlot(container, [traceDuration, traceStartTime, wakeTrace], layout, { responsive: true }) : Plotly.newPlot(container, [traceDuration, traceStartTime], layout, { responsive: true });

        // ANNOTATIONS METHOD

        // Calculate x position for annotations — a bit right of the longest bar end
        const maxBarEnd = Math.max(...plotData.map(d => d.base + d.duration));
        const maxBarStart = Math.max(...plotData.map(d => d.base));
        const annotationXPos1 = maxBarEnd + 20;  // Times Out Of Bed 
        const annotationXPos2 = annotationXPos1 + 200;  // AHI
        const annotationXPos3 = annotationXPos2 + 80; // Snoring
        const annotationXPos4 = annotationXPos3 + 100; // Average Heart Rate
        const annotationXPos5 = maxBarStart - 250; // Sleep efficiency
        const annotationXPos6 = annotationXPos5 - 100; // TIB
        const annotationXPos7 = annotationXPos6 - 100; // Asleep


        // Create annotations array
        const annotations = plotData.map(d => ([
        {
            x: annotationXPos1,
            y: d.y,
            text: d.out_of_bed_count.toString(),
            showarrow: false,
            font: { color: 'black', size: 13, family: 'Arial, sans-serif' },
            xanchor: 'left',
            yanchor: 'middle'
        },
        {
            x: annotationXPos2,
            y: d.y,
            text: \`<span style="color:\${getOSASeverityAndColor(d.ahi_round).color}">●</span> \${d.ahi_round}\`,
            showarrow: false,
            font: { color: 'black', size: 13, family: 'Arial, sans-serif' },
            xanchor: 'left',
            yanchor: 'middle'
        },

        {
            x: annotationXPos3,
            y: d.y,
            text: d.snoring_minutes.toString() + " Min",
            showarrow: false,
            font: { color: 'black', size: 13, family: 'Arial, sans-serif' },
            xanchor: 'left',
            yanchor: 'middle'
        },
        {
            x: annotationXPos4,
            y: d.y,
            text: d.hr_average.toString() + " bpm",
            showarrow: false,
            font: { color: 'black', size: 13, family: 'Arial, sans-serif' },
            xanchor: 'left',
            yanchor: 'middle'
        },
        {
            x: annotationXPos5,
            y: d.y,
            text: d.sleep_efficiency_percent.toString() + " %",
            showarrow: false,
            font: { color: 'black', size: 13, family: 'Arial, sans-serif' },
            xanchor: 'left',
            yanchor: 'middle'
        },
        {
            x: annotationXPos6,
            y: d.y,
            text: formatHoursAndMinutes(d.TIB_min).toString(),
            showarrow: false,
            font: { color: 'black', size: 13, family: 'Arial, sans-serif' },
            xanchor: 'left',
            yanchor: 'middle'
        },
        {
            x: annotationXPos7,
            y: d.y,
            text: formatHoursAndMinutes(d.asleep_min).toString(),
            showarrow: false,
            font: { color: 'black', size: 13, family: 'Arial, sans-serif' },
            xanchor: 'left',
            yanchor: 'middle'
        }
        ])).flat();


        // Add header annotation for the column
        annotations.push(
        {
            x: annotationXPos1,
            y: 1,       // top position
            xref: 'x',
            yref: 'paper',
            text: '<b>Times Out Of Bed</b>',
            showarrow: false,
            font: { color: 'black', size: 14, family: 'Arial, sans-serif' },
            xanchor: 'left',
            yanchor: 'bottom'
        },
        {
            x: annotationXPos2,
            y: 1,
            xref: 'x',
            yref: 'paper',
            text: '<b>AHI</b>',
            showarrow: false,
            font: { color: 'black', size: 14, family: 'Arial, sans-serif' },
            xanchor: 'left',
            yanchor: 'bottom'
        },
        {
            x: annotationXPos3,
            y: 1,
            xref: 'x',
            yref: 'paper',
            text: '<b>Snoring</b>',
            showarrow: false,
            font: { color: 'black', size: 14, family: 'Arial, sans-serif' },
            xanchor: 'left',
            yanchor: 'bottom'
        },
        {
            x: annotationXPos4,
            y: 1,
            xref: 'x',
            yref: 'paper',
            text: '<b>Average Heart Rate</b>',
            showarrow: false,
            font: { color: 'black', size: 14, family: 'Arial, sans-serif' },
            xanchor: 'left',
            yanchor: 'bottom'
        },
        {
            x: annotationXPos5,
            y: 1,
            xref: 'x',
            yref: 'paper',
            text: '<b>Efficiency</b>',
            showarrow: false,
            font: { color: 'black', size: 14, family: 'Arial, sans-serif' },
            xanchor: 'left',
            yanchor: 'bottom'
        },
        {
            x: annotationXPos6,
            y: 1,
            xref: 'x',
            yref: 'paper',
            text: '<b>In Bed</b>',
            showarrow: false,
            font: { color: 'black', size: 14, family: 'Arial, sans-serif' },
            xanchor: 'left',
            yanchor: 'bottom'
        },
        {
            x: annotationXPos7,
            y: 1,
            xref: 'x',
            yref: 'paper',
            text: '<b>Asleep</b>',
            showarrow: false,
            font: { color: 'black', size: 14, family: 'Arial, sans-serif' },
            xanchor: 'left',
            yanchor: 'bottom'
        }
        );

        // Add to layout
        layout.annotations = (layout.annotations || []).concat(annotations);


        if (hasEpochData) {
            container.on('plotly_click', (data) => {
                if (data.points.length > 0) {
                    const id = data.points[0].customdata;
                    if (id && nightlyPlotData[String(id)]) showNight(String(id));
                }
            });
        }
    }

    function renderMetricsTable(data) {
        // Get the container element where the table will be rendered
        const container = document.getElementById('detailed-metrics-container');
        container.innerHTML = '';
        // Filter out invalid rows that don't have a valid date
        const validData = data.filter(d => d.enddate_utc && !isNaN(d.enddate_utc.getTime()));
        if (validData.length === 0) return;
        
        // Create and append the summary table
        const table = document.createElement('table');
        table.className = 'summary-stats-table';
        container.appendChild(table);

        // Add table headers
        table.innerHTML = \`
            <thead><tr><th>Metric</th><th>Average (SD)</th><th>Min</th><th>Max</th></tr></thead>
            <tbody></tbody>\`;
        const tbody = table.querySelector('tbody');

        // Loop through all the metric fields defined in your config
        ALL_DATA_FIELDS.forEach(field => {
            let values = validData.map(row => (row['w_' + field] !== undefined ? row['w_' + field] : row[field])).filter(v => typeof v === 'number' && !isNaN(v));
            if (values.length === 0) return;  // Skip this metric if no valid values

            // Get a clean display name for the field
            const displayName = fieldDisplayNameMap[field] || field.replace(/_/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());
            
            // Convert seconds to hours/minutes if field is a duration
            if (DURATION_FIELDS_IN_SECONDS.includes(field)) {
                if (displayName.includes('(hours)')) {
                    values = values.map(v => v / 3600);
                } else {
                    values = values.map(v => v / 60);
                }
            } else if (EFFICIENCY_FIELDS.includes(field)) {
                // Convert efficiency from fraction to percentage
                values = values.map(v => v * 100);
            }

            // Compute summary stats
            const mean = arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
            const std = (arr, avg) => arr.length > 0 ? Math.sqrt(arr.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b) / arr.length) : 0;

            const avg = mean(values);
            const stdev = std(values, avg);
            const minVal = Math.min(...values);
            const maxVal = Math.max(...values);

            // Prepare data for line plot
            let plotData = validData.map(row => {
                const timezone = row.w_timezone || row.timezone;
                const dateStr = formatInTimeZoneJS(row.enddate_utc, timezone, { year: 'numeric', month: '2-digit', day: '2-digit' });
                if (dateStr === null) return null;
                return { x: dateStr, y: (row['w_' + field] !== undefined ? row['w_' + field] : row[field]), id: (row.w_id || row.id) };
            }).filter(Boolean); // Remove null entries
            
            // Apply same unit conversions to plot data
            if (DURATION_FIELDS_IN_SECONDS.includes(field)) {
                if(displayName.includes('(hours)')) plotData = plotData.map(d => ({ ...d, y: d.y !== null ? d.y / 3600 : null }));
                else plotData = plotData.map(d => ({ ...d, y: d.y !== null ? d.y / 60 : null }));
            } else if (EFFICIENCY_FIELDS.includes(field)) {
                plotData = plotData.map(d => ({ ...d, y: d.y !== null ? d.y * 100 : null }));
            }
            
            // Clean up plot data (remove invalid y-values)
            const cleanedPlotData = plotData.filter(d => d.y !== null && d.y !== undefined && !isNaN(d.y));

            // Create a new row for this metric
            const dataRow = document.createElement('tr');
            dataRow.className = 'data-row';
            dataRow.innerHTML = \`<td>\${displayName}</td><td>\${avg.toFixed(2)} (\${stdev.toFixed(2)})</td><td>\${minVal.toFixed(2)}</td><td>\${maxVal.toFixed(2)}</td>\`;
            
            // If plot data exists, add expandable chart row
            if (cleanedPlotData.length > 0) {
                dataRow.classList.add('expandable');
                const plotRow = document.createElement('tr');
                plotRow.className = 'plot-row';
                plotRow.innerHTML = \`<td colspan="4"><div class="details-content responsive-plot"><div id="plot-\${field}"></div></div></td>\`;
                tbody.appendChild(dataRow);
                tbody.appendChild(plotRow);

                // Click-to-expand plot row
                const clickHandler = function(event) {
                    const targetRow = this;
                    if (event.target.tagName === 'A') return;
                    
                    targetRow.classList.toggle('open');
                    const nextRow = targetRow.nextElementSibling;
                    const isNowOpen = nextRow.classList.toggle('open');
                    
                    // Only initialize plot once
                    if (isNowOpen && !nextRow.dataset.plotInitialized) {
                        nextRow.dataset.plotInitialized = 'true';
                            setTimeout(() => {
                            const defaultLineColor = '#75baf5';
                            const x_coords = cleanedPlotData.map(d => d.x);
                            const y_coords = cleanedPlotData.map(d => d.y);

                            // Define plot trace
                            const lineTrace = {
                                x: x_coords,
                                y: y_coords,
                                mode: 'lines',
                                name: displayName,
                                line: { width: 2, color: defaultLineColor },
                                customdata: cleanedPlotData.map(d => d.id),
                                hovertemplate: hasEpochData ? '%{x}<br>%{y:.2f}<br>Click for details<extra></extra>' : '%{x}<br>%{y:.2f}<extra></extra>'
                            };
                            
                            // Define plot layout
                            const x_range = [
                                formatInTimeZoneJS(new Date(cleanedPlotData[0].x), 'UTC', { year: 'numeric', month: '2-digit', day: '2-digit' }),
                                formatInTimeZoneJS(new Date(cleanedPlotData[cleanedPlotData.length-1].x), 'UTC', { year: 'numeric', month: '2-digit', day: '2-digit' })
                            ];
                            
                            const fig = {
                                data: [lineTrace],
                                layout: {
                                    template: 'simple_white',
                                    title: displayName, xaxis: { title: "Date (of sleep-end)", range: x_range },
                                    yaxis: { title: displayName, rangemode: 'tozero' }, autosize: true,
                                    margin: { l: 80, r: 20, t: 40, b: 40 }, hovermode: 'x', showlegend: false
                                }
                            };
                            const plotElementId = \`plot-\${field}\`;
                            const plotDiv = document.getElementById(plotElementId);
                            Plotly.newPlot(plotElementId, fig.data, fig.layout, {responsive: true});

                            // Optional: click point to show detailed view
                            if (hasEpochData) {
                                plotDiv.on('plotly_click', function(data) {
                                    if (data.points.length > 0) {
                                        const id = data.points[0].customdata;
                                        if (id && nightlyPlotData[String(id)]) showNight(String(id));
                                    }
                                });
                            }
                            Plotly.Plots.resize(plotElementId); // Resize for responsiveness
                        }, 50);
                    } else if (isNowOpen) {
                        // If already initialized, just resize on open
                        setTimeout(() => {
                            const plotElement = document.getElementById(\`plot-\${field}\`);
                            if (plotElement) Plotly.Plots.resize(plotElement);
                        }, 50);
                    }
                };

                // Attach click handler to data row
                dataRow.addEventListener('click', clickHandler);
            } else {

                // If no plot data, just append the row
                tbody.appendChild(dataRow);
            }
        });
    }

    //Helper funtions
    function formatHoursAndMinutes(decimalHours){
        const hours = Math.floor(decimalHours);
        const minutes = Math.round((decimalHours - hours) * 60);
        return hours + 'h' + minutes;
    }
        
    function timeStrToMinutes(str) {
        if (typeof str !== 'string') return null;
        const [hours, minutes] = str.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return null;
        return hours * 60 + minutes;
    }

    function minutesToTimeStr(minutes) {
        if (typeof minutes !== 'number' || isNaN(minutes)) return '–';
        const h = Math.floor(minutes / 60) % 24;
        const m = Math.round(minutes % 60);
        return \`\${String(h).padStart(2, '0')}:\${String(m).padStart(2, '0')}\`;
    }

    // function split dateStr into weekdays and weekends
    function isWeekend(dateStr){
        const day = new Date(dateStr).getDay(); // Sunday=0, Saturday=6
        return day === 0 || day === 6;
    };


    function DurationEfficiencyRegularity(data) {
        const container = document.getElementById('duration-efficiency-regularity-container');
        container.innerHTML = '';
        const validData = data.filter(d => d.enddate_utc && !isNaN(d.enddate_utc.getTime()));
        if (validData.length === 0) return;

        const getDurationInHours = (row) => {
            const rawValue = row.total_sleep_time_hours;
            return typeof rawValue === 'number' ? rawValue : null;
        };

        //Sleep Latency
        const getSleepLatency = (row) => {
            const rawValue = row.sleep_latency;
            return typeof rawValue === 'number' ? rawValue / 60 : null; // convert seconds to minutes
        };

        //Sleep Efficiency
        const getTimeInBed = (row) => {
            const rawValue = row.total_timeinbed;
            return typeof rawValue === 'number' ? rawValue / 3600 : null; // convert seconds to hours
        };
        
        const getTotalSleepTime = (row) => {
            const rawValue = row.total_sleep_time;
            return typeof rawValue === 'number' ? rawValue / 3600 : null; // convert seconds to hours
        };

        const getSleepEfficiencyPercent = (row) => {
            const rawValue = row.sleep_efficiency;
            return typeof rawValue === 'number' ? rawValue * 100 : null; // convert to percent (%)
        };

        // Sleep Duration
        const weekdaysDurations = validData
            .filter(d => !isWeekend(d.enddate_utc))
            .map(getDurationInHours)
            .filter(v => typeof v === 'number' && !isNaN(v));

        const weekendsDurations = validData
            .filter(d => isWeekend(d.enddate_utc))
            .map(getDurationInHours)
            .filter(v => typeof v === 'number' && !isNaN(v));

        // Sleep Latency
        const sleepLatencies = validData
            .map(getSleepLatency)
            .filter(v => v !== null && !isNaN(v));

        // Sleep Efficiency
        const timeInBed = validData
            .map(getTimeInBed)
            .filter(v => v !== null && !isNaN(v));

        const totalSleepTime = validData
            .map(getTotalSleepTime)
            .filter(v => v !== null && !isNaN(v));

        const sleepEfficiency = validData
            .map(getSleepEfficiencyPercent)
            .filter(v => v !== null && !isNaN(v));

        const mean = (arr) => arr.length > 0 ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;

        const weekdayAvg = mean(weekdaysDurations)
        const weekendAvg = mean(weekendsDurations)

        const sleepLatencyAvg = Math.round(mean(sleepLatencies));

        const timeInBedAvg = mean(timeInBed);
        const totalSleepTimeAvg = mean(totalSleepTime);
        const sleepEfficiencyAvg = mean(sleepEfficiency);

        // Create summary table
        const table = document.createElement('table');
        table.className = 'summary-stats-table';
        container.appendChild(table);

        table.innerHTML = \`
            <caption style="font-weight: bold; font-size: 1.2em; text-align: left; padding: 8px 0;">
                Duration, Efficiency & Regularity
            </caption>

            <table>
                <thead><tr><th>Type</th><th>Weekdays</th><th>Weekends</th></tr></thead>
                <tbody>
                    <tr><td>Sleep Duration Average</td><td><strong>\${formatHoursAndMinutes(weekdayAvg)}</strong></td><td><strong>\${formatHoursAndMinutes(weekendAvg)}</strong></td></tr>             
                </tbody>
            </table>

            <table>
                <thead><tr><th></th><th>Average (min)</th></tr></thead>
                <tbody>
                    <tr><td>Sleep Latency</td><td><strong>\${sleepLatencyAvg} min</strong></td></tr>             
                </tbody>
            </table>

            <table>
                <thead><tr><th></th><th>Time In Bed (TIB)</th><th>Total Sleep Time (TST)</th><th>Efficiency</th></tr></thead>
                <tbody>
                    <tr><td>Sleep Efficiency</td><td><strong>\${formatHoursAndMinutes(timeInBedAvg)}</strong></td><td><strong>\${formatHoursAndMinutes(totalSleepTimeAvg)}</strong></td><td><strong>\${sleepEfficiencyAvg.toFixed(2)} %</strong></td></tr>             
                </tbody>
            </table>
            \`;
        const tbody = table.querySelector('tbody');
    }

    function SleepRitual(data) {
        const container = document.getElementById('sleep-ritual-container');
        container.innerHTML = '';
        const validData = data.filter(d => d.enddate_utc && !isNaN(d.enddate_utc.getTime()));
        if (validData.length === 0) return;

        // split data into weekdays and weekends

        const isWeekend = (dateStr) => {
            const day = new Date(dateStr).getDay(); // Sunday=0, Saturday=6
            return day === 0 || day === 6;
        };

        const getBedtime = (row) => {
            const timezone = row.w_timezone || row.timezone;
            const start_time = formatInTimeZoneJS(row.startdate_utc, timezone, { hour: '2-digit', minute: '2-digit' });
            const start_time_min = timeStrToMinutes(start_time);
            return typeof start_time_min === 'number' ? start_time_min : null;
        };

        const getWakeUpTime = (row) => {
            const timezone = row.w_timezone || row.timezone;
            const end_time = formatInTimeZoneJS(row.enddate_utc, timezone, { hour: '2-digit', minute: '2-digit' });
            const end_time_min = timeStrToMinutes(end_time);
            return typeof end_time_min === 'number' ? end_time_min : null;
        };

        const getDurationToSleep = (row) => {
            const durationValue = row.durationtosleep;
            return typeof durationValue === 'number' ? durationValue / 60 : null; // convert seconds to minutes
        };

        const getDurationToWakeUp = (row) => {
            const durationValue = row.durationtowakeup;
            return typeof durationValue === 'number' ? durationValue / 60 : null; // convert seconds to minutes
        };

        const getTimeToFallAsleep = (row) => {
            const timezone = row.w_timezone || row.timezone;
            const start_time = formatInTimeZoneJS(row.startdate_utc, timezone, { hour: '2-digit', minute: '2-digit' });
            const start_time_min = timeStrToMinutes(start_time);
            const durationValue = row.durationtosleep / 60;
            return typeof start_time_min === 'number' ? start_time_min + durationValue : null;
        };

        const getTimeToGetUp = (row) => {
            const timezone = row.w_timezone || row.timezone;
            const end_time = formatInTimeZoneJS(row.enddate_utc, timezone, { hour: '2-digit', minute: '2-digit' });
            const end_time_min = timeStrToMinutes(end_time);
            const durationValue = row.durationtowakeup / 60;
            return typeof end_time_min === 'number' ? end_time_min + durationValue : null;
        };

        // Bedtime
        const weekdaysBedtime = validData
            .filter(d => !isWeekend(d.enddate_utc))
            .map(getBedtime)
            .filter(v => typeof v === 'number' && !isNaN(v));

        const weekdaysTimeToFallAsleep = validData
            .filter(d => !isWeekend(d.enddate_utc))
            .map(getTimeToFallAsleep)
            .filter(v => typeof v === 'number' && !isNaN(v));

        const weekendsBedtime = validData
            .filter(d => isWeekend(d.enddate_utc))
            .map(getBedtime)
            .filter(v => typeof v === 'number' && !isNaN(v));

        const weekendsTimeToFallAsleep = validData
            .filter(d => isWeekend(d.enddate_utc))
            .map(getTimeToFallAsleep)
            .filter(v => typeof v === 'number' && !isNaN(v));

        // Wake Up
        const weekdaysWakeUp = validData
            .filter(d => !isWeekend(d.enddate_utc))
            .map(getWakeUpTime)
            .filter(v => typeof v === 'number' && !isNaN(v));

        const weekdaysTimeToGetUp = validData
            .filter(d => !isWeekend(d.enddate_utc))
            .map(getTimeToGetUp)
            .filter(v => typeof v === 'number' && !isNaN(v));

        const weekendsWakeUp = validData
            .filter(d => isWeekend(d.enddate_utc))
            .map(getWakeUpTime)
            .filter(v => typeof v === 'number' && !isNaN(v));

        const weekendsTimeToGetUp = validData
            .filter(d => isWeekend(d.enddate_utc))
            .map(getTimeToGetUp)
            .filter(v => typeof v === 'number' && !isNaN(v));
        
        const mean = (arr) => arr.length > 0 ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
        // mean() of weekdays
        const BedTimeWdAvg = mean(weekdaysBedtime)
        const timeToFallAsleepWdAvg = mean(weekdaysTimeToFallAsleep)
        const wakeUpTimeWdAvg = mean(weekdaysWakeUp)
        const getUpTimeWdAvg = mean(weekdaysTimeToGetUp)
        // mean of weekends
        const bedTimeWkAvg = mean(weekendsBedtime)
        const timeToFallAsleepWkAvg = mean(weekendsTimeToFallAsleep)
        const wakeUpTimeWkAvg = mean(weekendsWakeUp)
        const getUpTimeWkAvg = mean(weekendsTimeToGetUp)
    
        // Create summary table
        const table = document.createElement('table');
        table.className = 'summary-stats-table';
        container.appendChild(table);

        table.innerHTML = \`
            <caption style="font-weight: bold; font-size: 1.2em; text-align: left; padding: 8px 0;">
                Sleep Ritual
            </caption>
            <table>
                <thead>
                    <tr><th></th><th>Average Bedtime</th><th>Average Time to Fall Asleep</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Bedtime (Weekdays)</td><td><strong>\${minutesToTimeStr(BedTimeWdAvg)}PM</strong></td><td><strong>\${minutesToTimeStr(timeToFallAsleepWdAvg)}PM</strong></td>
                    </tr>
                    <tr>
                        <td>Bedtime (Weekends)</td><td><strong>\${minutesToTimeStr(bedTimeWkAvg)}PM</strong></td><td><strong>\${minutesToTimeStr(timeToFallAsleepWkAvg)}PM</strong></td>
                    </tr>     
                </tbody>
            </table>

            <table>
                <thead>
                    <tr><th></th><th>Average Wake-Up Time</th><th>Average Get-Up Time</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Wake-Up Time (Weekdays)</td><td><strong>\${minutesToTimeStr(wakeUpTimeWdAvg)}AM</strong></td><td><strong>\${minutesToTimeStr(getUpTimeWdAvg)}AM</strong></td>
                    </tr>
                    <tr>
                        <td>Wake-Up Time (Weekends)</td><td><strong>\${minutesToTimeStr(wakeUpTimeWkAvg)}AM</strong></td><td><strong>\${minutesToTimeStr(getUpTimeWkAvg)}AM</strong></td>
                    </tr>            
                </tbody>
            </table>
        \`;
        const tbody = table.querySelector('tbody');
    }

    function getOSASeverityAndColor(ahi) {
        if (ahi <= 5) return { label: "None/Minimal", color: "green" };
        if (ahi <= 15) return { label: "Mild", color: "yellow" };
        if (ahi <= 30) return { label: "Moderate", color: "orange" };
        return { label: "Severe", color: "red" };
    }

    function getSnoringSeverityAndColor(snoring) {
        if (snoring === 0) return { label: "No Snoring", color: "green" };
        if (snoring <= 15) return { label: "Mild", color: "yellow" };
        if (snoring <= 30) return { label: "Moderate", color: "goldenrod" };
        if (snoring <= 60) return { label: "Heavy", color: "orange" };
        return { label: "Severe", color: "red" };
    }

    function SleepVitals(data) {
        const container = document.getElementById('AHI-container');
        container.innerHTML = '';
        const validData = data.filter(d => d.enddate_utc && !isNaN(d.enddate_utc.getTime()));
        if (validData.length === 0) return;

        const getAHI = (row) => {
            const rawValue = row.apnea_hypopnea_index;
            return typeof rawValue === 'number' ? rawValue : null;
        };

        const getPercentSnoringNight = (row) => {
            const snoring_minute = row.snoring_minutes;
            const total_sleep_time_minute = row.total_sleep_time/60; // convert second to minutes
            const snoring_night_percent = ((snoring_minute)/(total_sleep_time_minute)) * 100;
            return typeof snoring_night_percent === 'number' ? snoring_night_percent : null;
        };

        const getSnoring = (row) => {
            const snoring_minutes = row.snoring_minutes;
            return typeof snoring_minutes === 'number' ? snoring_minutes : null;
        };

        const getHR = (row) => {
            const heart_rate = row.hr_average;
            return typeof heart_rate === 'number' ? heart_rate : null;
        }

        const getHRMin = (row) => {
            const heart_rate_min = row.hr_min;
            return typeof heart_rate_min === 'number' ? heart_rate_min : null;
        }

        const getHRMax = (row) => {
            const heart_rate_max = row.hr_max;
            return typeof heart_rate_max === 'number' ? heart_rate_max : null;
        }

        const AHI = validData
            .map(getAHI)
            .filter(v => v !== null && !isNaN(v));

        const PercentSnoringNight = validData
            .map(getPercentSnoringNight)
            .filter(v => v !== null && !isNaN(v));

        const Snoring = validData
            .map(getSnoring)
            .filter(v => v !== null && !isNaN(v));

        const HeartRate = validData
            .map(getHR)
            .filter(v => v !== null && !isNaN(v));

        const HeartRateMin = validData
            .map(getHRMin)
            .filter(v => v !== null && !isNaN(v));

        const HeartRateMax = validData
            .map(getHRMax)
            .filter(v => v !== null && !isNaN(v));

        const mean = (arr) => arr.length > 0 ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
        const AHIAvg = mean(AHI);
        const AHIMin = Math.min(...AHI);
        const AHIMax = Math.max(...AHI);

        const SnoringPercentAvg = Math.round(mean(PercentSnoringNight));
        const SnoringAvg = Math.round(mean(Snoring));

        const HeartRateAvg = Math.round(mean(HeartRate));
        const HRMin = Math.min(...HeartRateMin);
        const HRMax = Math.max(...HeartRateMax);

        // make color and label object for each value
        const severityMin = getOSASeverityAndColor(AHIMin);
        const severityAvg = getOSASeverityAndColor(AHIAvg);
        const severityMax = getOSASeverityAndColor(AHIMax);

        const severitySnoring = getSnoringSeverityAndColor(SnoringAvg)

        // Create summary table
        const table = document.createElement('table');
        table.className = 'summary-stats-table';
        container.appendChild(table);

        table.innerHTML = \`
            <caption style="font-weight: bold; font-size: 1.2em; text-align: left; padding: 8px 0;">
                Sleep Vitals
            </caption>
            <table>
                <thead><tr><th></th><th>Min</th><th>Average</th><th>Max</th></tr></thead>
                <tbody>
                    <tr><td>AHI</td><td><strong>\${AHIMin.toFixed(1)} Event/Hour</strong></td><td><strong>\${AHIAvg.toFixed(1)} Events/Hour</strong></td><td><strong>\${AHIMax.toFixed(1)} Events/Hour</strong></td></tr>
                    <tr>
                        <td>OSA Severity</td>
                        <td><span style="display: inline-block; width: 15px; height: 15px; background-color: \${severityMin.color}; border-radius: 50%; margin-right: 8px;"></span><strong>\${severityMin.label}</strong></td>
                        <td><span style="display: inline-block; width: 15px; height: 15px; background-color: \${severityAvg.color}; border-radius: 50%; margin-right: 10px;"></span><strong>\${severityAvg.label}</strong></td>
                        <td><span style="display: inline-block; width: 15px; height: 15px; background-color: \${severityMax.color}; border-radius: 50%; margin-right: 10px;"></span><strong>\${severityMax.label}</strong></td>
                    </tr>
                </tbody>
            </table>

            <table>
                <thead><tr><th></th><th>Average Night</th><th>Average</th><th>Severity</th></tr></thead>
                <tbody>
                    <tr>
                        <td>Snoring</td><td><strong>\${SnoringPercentAvg} %</strong></td>
                        <td><strong>\${SnoringAvg} min</strong></td>
                        <td><span style="display: inline-block; width: 15px; height: 15px; background-color: \${severitySnoring.color}; border-radius: 50%; margin-right: 10px;"></span><strong>\${severitySnoring.label}</strong></td>
                        <td></td>
                    </tr>
                </tbody>
            </table>

            <table>
                <thead><tr><th></th><th>Average</th><th>Range</th></tr></thead>
                <tbody>
                    <tr>
                        <td>Overnight Heart Rate</td>
                        <td><strong>\${HeartRateAvg} bpm</strong></td>
                        <td><strong>\${HRMin}-\${HRMax} bpm</strong></td>
                    </tr>
                </tbody>
            </table>
            \`;
        const tbody = table.querySelector('tbody');
    }

    function OSAChart() {
        const container = document.getElementById('osa-chart-container');
        container.innerHTML = '';
        
        // Create summary table
        const table = document.createElement('table');
        table.className = 'summary-stats-table';
        container.appendChild(table);

        table.innerHTML = \`
            <caption style="font-weight: bold; font-size: 1.2em; text-align: left; padding: 8px 0;">
                Reference Charts
            </caption>
            <table>
                <thead>
                    <tr>
                        <th></th>
                        <th>AHI < 5 (Event/Hour)</th>
                        <th>5 ≤ AHI < 15 (Event/Hour)</th>
                        <th>15 ≤ AHI < 30 (Event/Hour)</th>
                        <th>AHI ≥ 30 (Event/Hour)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>OSA Rating</td>
                        <td><span style="display: inline-block; width: 15px; height: 15px; background-color:green; border-radius: 50%; margin-right: 8px;"></span><strong>None/Minimal Sleep</strong></td>
                        <td><span style="display: inline-block; width: 15px; height: 15px; background-color:yellow; border-radius: 50%; margin-right: 8px;"></span><strong>Mild Sleep</strong></td>
                        <td><span style="display: inline-block; width: 15px; height: 15px; background-color:orange; border-radius: 50%; margin-right: 8px;"></span><strong>Moderate Sleep</strong></td>
                        <td><span style="display: inline-block; width: 15px; height: 15px; background-color:red; border-radius: 50%; margin-right: 8px;"></span><strong>Severe Sleep</strong></td>
                    </tr>             
                </tbody>
            </table>
            \`;
        const tbody = table.querySelector('tbody');
    }

    function SnoringChart() {
        const container = document.getElementById('snoring-chart-container');
        container.innerHTML = '';
        
        // Create summary table
        const table = document.createElement('table');
        table.className = 'summary-stats-table';
        container.appendChild(table);

        table.innerHTML = \`
            <table>
                <thead>
                    <tr>
                        <th></th>
                        <th>Snoring = 0 (minutes)</th>
                        <th>1 ≤ AHI < 15 (minutes)</th>
                        <th>15 ≤ AHI < 30 (minutes)</th>
                        <th>30 ≤ AHI < 60 (minutes)</th>
                        <th>AHI ≥ 60 (minutes)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Snoring Average Rating</td>
                        <td><span style="display: inline-block; width: 15px; height: 15px; background-color:green; border-radius: 50%; margin-right: 8px;"></span><strong>No Snoring</strong></td>
                        <td><span style="display: inline-block; width: 15px; height: 15px; background-color:yellow; border-radius: 50%; margin-right: 8px;"></span><strong>Mild</strong></td>
                        <td><span style="display: inline-block; width: 15px; height: 15px; background-color:orange; border-radius: 50%; margin-right: 8px;"></span><strong>Moderate</strong></td>
                        <td><span style="display: inline-block; width: 15px; height: 15px; background-color:goldenrod; border-radius: 50%; margin-right: 8px;"></span><strong>Heavy</strong></td>
                        <td><span style="display: inline-block; width: 15px; height: 15px; background-color:red; border-radius: 50%; margin-right: 8px;"></span><strong>Severe</strong></td>
                    </tr>             
                </tbody>
            </table>
            \`;
        const tbody = table.querySelector('tbody');
    }
    
    let currentWid = null;
    if (nightlyPlotData) {
        const modal = document.getElementById('nightly-modal');
        document.getElementById("prev-night").onclick = () => {
            const idx = currentWids.indexOf(currentWid);
            if (idx > 0) showNight(currentWids[idx - 1]);
        };
        document.getElementById("next-night").onclick = () => {
            const idx = currentWids.indexOf(currentWid);
            if (idx < currentWids.length - 1) showNight(currentWids[idx + 1]);
        };
        document.addEventListener('keydown', (event) => {
            if (event.key === "Escape" && modal.style.display === "block") modal.style.display = "none";
        });
        document.getElementById('nightly-modal-close-btn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        modal.addEventListener('click', (event) => {
            if (event.target === modal) modal.style.display = "none";
        });
    }
    
    function setupLegendModal() {
        const legendModal = document.getElementById('legend-modal');
        const legendBtn = document.getElementById('legend-help-btn');
        const legendCloseBtn = document.getElementById('legend-modal-close-btn');
        const legendList = document.getElementById('legend-list');

        if (!legendModal || !legendBtn || !legendCloseBtn || !legendList) return;

        legendBtn.addEventListener('click', () => {
            legendList.innerHTML = ''; // Clear previous items
            Object.values(EVENT_MAPPING).forEach(event => {
                const li = document.createElement('li');
                li.innerHTML = \`<div class="color-box" style="background-color:\${event.color};"></div><span>\${event.name}</span>\`;
                legendList.appendChild(li);
            });
            legendModal.style.display = 'block';
        });
        legendCloseBtn.addEventListener('click', () => {
            legendModal.style.display = 'none';
        });
        legendModal.addEventListener('click', (e) => {
            if (e.target === legendModal) {
                legendModal.style.display = 'none';
            }
        });
    }

    function showNight(id) {
        currentWid = String(id);
        const meta = nightlyMeta[currentWid];
        const plots = nightlyPlotData[currentWid];
        if (!meta || !plots) return;

        document.getElementById("nightly-modal-meta").innerHTML = \`
            <strong>Lab ID:</strong> \${meta.lab_id} &nbsp;&nbsp;
            <strong>Start:</strong> \${meta.startdate} &nbsp;&nbsp;
            <strong>End:</strong> \${meta.enddate}
        \`;

        plots.forEach((plot, index) => {
            const plotDiv = document.createElement("div");
            plotDiv.id = \`plot-\${id}-\${index}\`;
            Plotly.newPlot(plotDiv, plot.data, plot.layout, {responsive: true});
        });

        document.getElementById("nightly-modal").style.display = "block";
        document.getElementById("nightly-modal-body").scrollTop = 0;
        
        setTimeout(() => plots.forEach((_, index) => {
            const plotElement = document.getElementById(\`plot-\${id}-\${index}\`);
            if(plotElement) Plotly.Plots.resize(plotElement)
        }), 100);

        const idx = currentWids.indexOf(currentWid);
        document.getElementById("prev-night").disabled = idx <= 0;
        document.getElementById("next-night").disabled = idx >= currentWids.length - 1;
    }
        
    window.applyFilters = applyFilters;
    window.addEventListener("resize", () => {
        const timingPlot = document.getElementById('sleep-timing-plot-container-h').querySelector('.js-plotly-plot');
        if (timingPlot) {
                Plotly.Plots.resize(timingPlot);
        }

        document.querySelectorAll(".details-content .js-plotly-plot").forEach(div => {
                Plotly.Plots.resize(div);
        });
    });
        </script>
    </body>
    </html>
    `;
}


