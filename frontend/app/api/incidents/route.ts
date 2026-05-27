import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { Resend } from "resend";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

async function ensureTable() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS incidents (
      id SERIAL PRIMARY KEY,
      reported_by TEXT NOT NULL,
      incident_title TEXT NOT NULL,
      incident_detail TEXT NOT NULL,
      urgent BOOLEAN NOT NULL,
      status TEXT NOT NULL,
      date_of_incident DATE NOT NULL,
      date_of_form_entry TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

export async function GET() {
  try {
    await ensureTable();
    const sql = getDb();
    const rows = await sql`
      SELECT id, reported_by, incident_title, incident_detail,
             urgent, status, date_of_incident::text, date_of_form_entry
      FROM incidents ORDER BY id DESC
    `;
    return NextResponse.json(rows);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("GET /api/incidents error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const sql = getDb();
    const body = await req.json();
    const { reported_by, incident_title, incident_detail, urgent, status, date_of_incident } = body;

    const rows = await sql`
      INSERT INTO incidents (reported_by, incident_title, incident_detail, urgent, status, date_of_incident)
      VALUES (${reported_by}, ${incident_title}, ${incident_detail}, ${urgent}, ${status}, ${date_of_incident})
      RETURNING *
    `;
    const incident = rows[0];

    if (urgent) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "Incident Alert <onboarding@resend.dev>",
          to: process.env.URGENT_EMAIL_TO!,
          subject: "URGENT Incident Alert",
          text: `An urgent incident has been submitted.

Incident ID: ${incident.id}
Reported By: ${incident.reported_by}
Title: ${incident.incident_title}
Detail: ${incident.incident_detail}
Status: ${incident.status}
Date of Incident: ${incident.date_of_incident}

Please review and take action.`,
        });
      } catch (emailErr: unknown) {
        const message = emailErr instanceof Error ? emailErr.message : String(emailErr);
        console.error("Failed to send urgent email:", message);
      }
    }

    return NextResponse.json(incident, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("POST /api/incidents error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
