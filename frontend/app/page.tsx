"use client";

import { useEffect, useState } from "react";

type Incident = {
  id: number;
  reported_by: string;
  incident_title: string;
  incident_detail: string;
  urgent: boolean;
  status: string;
  date_of_incident: string;
  date_of_form_entry: string;
};

export default function Home() {
  const [incidents, setIncidents] = useState<Incident[]>([]);

  const [form, setForm] = useState({
    reported_by: "",
    incident_title: "",
    incident_detail: "",
    urgent: false,
    status: "Open",
    date_of_incident: "",
  });

  async function fetchIncidents() {
    const response = await fetch("https://next1proj.up.railway.app/incidents");
    const data = await response.json();
    setIncidents(data || []);
  }

  useEffect(() => {
    fetchIncidents();
  }, []);

  async function submitIncident(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch("https://next1proj.up.railway.app/incidents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const text = await res.text();
      alert(`Failed to submit incident: ${text}`);
      return;
    }

    setForm({
      reported_by: "",
      incident_title: "",
      incident_detail: "",
      urgent: false,
      status: "Open",
      date_of_incident: "",
    });

    fetchIncidents();
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8 text-gray-900">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-3xl font-bold">Next1Proj Incident Tracker</h1>

        <p className="mb-8 text-gray-600">
          Simple full-stack app using Next.js, TypeScript, Go and PostgreSQL.
        </p>

        <form
          onSubmit={submitIncident}
          className="mb-8 rounded-xl bg-white p-6 shadow"
        >
          <h2 className="mb-4 text-xl font-semibold">Create Incident</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input
              className="rounded border p-2"
              placeholder="Reported By"
              value={form.reported_by}
              onChange={(e) =>
                setForm({ ...form, reported_by: e.target.value })
              }
              required
            />

            <input
              className="rounded border p-2"
              placeholder="Incident Title"
              value={form.incident_title}
              onChange={(e) =>
                setForm({ ...form, incident_title: e.target.value })
              }
              required
            />

            <input
              className="rounded border p-2"
              type="date"
              value={form.date_of_incident}
              onChange={(e) =>
                setForm({ ...form, date_of_incident: e.target.value })
              }
              required
            />

            <select
              className="rounded border p-2"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option>Open</option>
              <option>In Progress</option>
              <option>Resolved</option>
            </select>
          </div>

          <textarea
            className="mt-4 w-full rounded border p-2"
            placeholder="Incident Detail"
            value={form.incident_detail}
            onChange={(e) =>
              setForm({ ...form, incident_detail: e.target.value })
            }
            required
          />

          <label className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.urgent}
              onChange={(e) => setForm({ ...form, urgent: e.target.checked })}
            />
            Mark as urgent
          </label>

          <button className="mt-4 rounded bg-blue-600 px-4 py-2 text-white">
            Submit Incident
          </button>
        </form>

        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">Incident Dashboard</h2>

          <div className="overflow-x-auto">
            <table className="w-full border text-left text-sm">
              <thead className="bg-gray-200">
                <tr>
                  <th className="border p-2">ID</th>
                  <th className="border p-2">Reported By</th>
                  <th className="border p-2">Title</th>
                  <th className="border p-2">Urgent</th>
                  <th className="border p-2">Status</th>
                  <th className="border p-2">Date</th>
                  <th className="border p-2">Detail</th>
                </tr>
              </thead>

              <tbody>
                {incidents.map((incident) => (
                  <tr
                    key={incident.id}
                    className={incident.urgent ? "bg-red-50" : ""}
                  >
                    <td className="border p-2">{incident.id}</td>
                    <td className="border p-2">{incident.reported_by}</td>
                    <td className="border p-2">{incident.incident_title}</td>
                    <td className="border p-2">
                      {incident.urgent ? "Yes" : "No"}
                    </td>
                    <td className="border p-2">{incident.status}</td>
                    <td className="border p-2">
                      {incident.date_of_incident}
                    </td>
                    <td className="border p-2">{incident.incident_detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}