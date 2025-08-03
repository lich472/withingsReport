
'use server';

import { z } from 'zod';
import { NextResponse } from 'next/server';
import Papa from 'papaparse';

import { WithingsClient } from '@/lib/withings/client';
import { generateReport, processSummaryData, processEpochData, dfToDataUri } from '@/lib/report-generator';
import type { ProcessedEpoch, ProcessedSummary, SleepEpochRecord, SleepSummaryResponse } from '@/lib/withings/types';
import { checkAccess } from '@/lib/access-control';
import { auth } from '@/lib/firebase/client';
import { headers } from 'next/headers';
import { getToken } from 'next-auth/jwt';


const reportRequestSchema = z.union([
  z.object({
    flow: z.literal('withings'),
    userid: z.number(),
    email: z.string().email(),
    reportLabel: z.string().min(1, { message: 'A report label is required.' }),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid start date format'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid end date format'),
    downloadOnly: z.boolean().optional(),
    applyTimezone: z.boolean().optional(),
    temp_access_token: z.string().nullable().optional(),
    requesterEmail: z.string().email(),
  }),
  z.object({
    flow: z.literal('csv'),
    label: z.string().min(1, { message: 'Label cannot be empty.'}),
    summaryCsv: z.string(),
    epochCsv: z.string().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid start date format').optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid end date format').optional(),
    applyTimezone: z.boolean().optional(),
  })
]);

function parseCsvData(summaryCsv: string, epochCsv?: string): { summaryData: ProcessedSummary[], epochData: ProcessedEpoch[] } {
    const summaryResult = Papa.parse<any>(summaryCsv, { header: true, dynamicTyping: true, skipEmptyLines: true });
    if (summaryResult.errors.length > 0 && summaryResult.errors[0].code !== 'UndetectableDelimiter') {
         throw new Error(`Error parsing summary CSV: ${summaryResult.errors[0].message}`);
    }

    let summaryData: ProcessedSummary[];
    const headers = summaryResult.meta.fields || [];

    if (headers.includes('w_startdate')) {
        const tempSummaryForProcessing = summaryResult.data.map((row: any) => {
            const newRow: any = {};
            for (const key in row) {
                if (key.startsWith('w_')) {
                    newRow[key.substring(2)] = row[key];
                } else {
                    newRow[key] = row[key];
                }
            }
            
            const startDateVal = row.startdate ? new Date(row.startdate).getTime() / 1000 : (row.w_startdate ? new Date(row.w_startdate).getTime() / 1000 : NaN);
            newRow.startdate = isNaN(startDateVal) ? null : startDateVal;
            
            const endDateVal = row.enddate ? new Date(row.enddate).getTime() / 1000 : (row.w_enddate ? new Date(row.w_enddate).getTime() / 1000 : NaN);
            newRow.enddate = isNaN(endDateVal) ? null : endDateVal;
            
            return { ...newRow, data: {} };
        });
        summaryData = processSummaryData(tempSummaryForProcessing, 'csv_upload');
    } else if (headers.includes('startdate_utc')) { 
        summaryData = summaryResult.data.map(row => ({
            ...row,
            startdate_utc: new Date(row.startdate_utc),
            enddate_utc: new Date(row.enddate_utc),
        }));
    } else {
        throw new Error('Could not determine summary CSV format. Please ensure headers are correct (e.g., "w_startdate" or "startdate_utc").');
    }

    let epochData: ProcessedEpoch[] = [];
    if (epochCsv && epochCsv.trim()) { 
        const epochResult = Papa.parse<any>(epochCsv, { header: true, dynamicTyping: true, skipEmptyLines: true });
        if (epochResult.errors.length > 0 && epochResult.errors[0].code !== 'UndetectableDelimiter') {
             throw new Error(`Error parsing epoch CSV: ${epochResult.errors[0].message}`);
        }
        epochData = epochResult.data.map(row => ({
            ...row,
            datetime_utc: new Date(row.datetime_utc),
        }));
    }

    return { summaryData, epochData };
}

export async function POST(request: Request) {
  let validatedBody;
  try {
    const body = await request.json();
    validatedBody = reportRequestSchema.safeParse(body);
    if (!validatedBody.success) {
      return NextResponse.json({ message: validatedBody.error.errors[0].message, reportHtml: null }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ message: 'Invalid request body.', reportHtml: null }, { status: 400 });
  }

  const { data } = validatedBody;

  try {
    if (data.flow === 'withings') {
      const { userid, email, reportLabel, startDate, endDate, downloadOnly, applyTimezone, temp_access_token, requesterEmail } = data;
      
      const hasPermission = await checkAccess(requesterEmail, email);
      if (!hasPermission) {
          return NextResponse.json({ message: `Access Denied: You do not have permission to generate reports for ${email}.`, reportHtml: null }, { status: 403 });
      }

      const clientId = process.env.WITHINGS_CLIENT_ID;
      const clientSecret = process.env.WITHINGS_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new Error('Withings API credentials are not configured on the server.');
      }
      
      const client = new WithingsClient(clientId, clientSecret);
      
      console.log(`Getting access token for userid: ${userid}`);
      const token = temp_access_token ? temp_access_token : await client.getAccessToken(userid);
      
      console.log(`Fetching sleep summary from ${startDate} to ${endDate}`);
      const sleepSummary: SleepSummaryResponse = await client.getSleepSummary(token, startDate, endDate);
      
      if (sleepSummary.status !== 0) {
          const errorMessage = sleepSummary.status === 293 ? "No data found for this user in the selected range." : sleepSummary.error || 'Unknown error fetching sleep summary';
          const error: any = new Error(`Error fetching sleep summary: ${errorMessage}`);
          error.details = JSON.stringify(sleepSummary, null, 2);
          throw error;
      }
      
      if (!sleepSummary.body || !sleepSummary.body.series || sleepSummary.body.series.length === 0) {
          const error: any = new Error("No data found for this user in the selected range.");
          error.details = JSON.stringify(sleepSummary, null, 2);
          throw error;
      }

      console.log("Fetching sleep epochs...");
      const sleepEpochs: SleepEpochRecord[] = await client.getSleepEpochs(token, sleepSummary);

      const finalSummaryData = processSummaryData(sleepSummary.body.series, reportLabel);
      const finalEpochData = processEpochData(sleepEpochs, finalSummaryData);

      if (downloadOnly) {
          const summaryCsvUri = dfToDataUri(finalSummaryData, Object.keys(finalSummaryData[0] || {}));
          const epochCsvUri = dfToDataUri(finalEpochData, ['id', 'timestamp', 'state', 'hr', 'rr', 'snoring', 'sdnn_1', 'rmssd', 'mvt_score', 'chest_movement_rate', 'withings_index', 'breathing_sounds']);
          return NextResponse.json({
              message: 'Data downloaded successfully!',
              summaryCsvUri,
              epochCsvUri,
              reportHtml: null
          });
      } else {
        console.log("Generating HTML report for Withings data...");
        const reportHtml = await generateReport(reportLabel, finalSummaryData, finalEpochData, applyTimezone);
        return NextResponse.json({
            message: 'Report generated successfully!',
            reportHtml: reportHtml,
        });
      }
    } else { // data.flow === 'csv'
        const { label, summaryCsv, epochCsv, startDate, endDate, applyTimezone } = data;
        let { summaryData, epochData } = parseCsvData(summaryCsv, epochCsv);

        if (startDate && endDate && summaryData.length > 0) {
            const start = new Date(startDate);
            start.setUTCHours(0, 0, 0, 0);

            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);
            
            const originalSummaryCount = summaryData.length;
            summaryData = summaryData.filter(row => {
                const rowDate = row.w_enddate ? new Date(row.w_enddate) : row.enddate_utc;
                return rowDate >= start && rowDate <= end;
            });
            
            if (epochData.length > 0) {
                const filteredSummaryIds = new Set(summaryData.map(s => s.id));
                epochData = epochData.filter(e => filteredSummaryIds.has(e.id));
            }
            console.log(`Filtered CSV data from ${originalSummaryCount} to ${summaryData.length} summary records based on date range: ${startDate} to ${endDate}.`);
        }
        
        console.log(`Generating HTML report from CSV data. Epochs included: ${epochData.length > 0}`);
        const reportHtml = await generateReport(label, summaryData, epochData, applyTimezone);
        return NextResponse.json({
            message: 'Report generated successfully!',
            reportHtml: reportHtml,
        });
    }

  } catch (e: any) {
    console.error('An unexpected error occurred:', e);
    return NextResponse.json(
      { 
        message: `An error occurred while generating the report: ${e.message || 'An unknown error occurred.'}`, 
        details: e.details || e.stack || JSON.stringify(e, null, 2),
        reportHtml: null 
      },
      { status: 500 }
    );
  }
}
