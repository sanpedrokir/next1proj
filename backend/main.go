package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

type Incident struct {
	ID              int       `json:"id"`
	ReportedBy      string    `json:"reported_by"`
	IncidentTitle   string    `json:"incident_title"`
	IncidentDetail  string    `json:"incident_detail"`
	Urgent          bool      `json:"urgent"`
	Status          string    `json:"status"`
	DateOfIncident  string    `json:"date_of_incident"`
	DateOfFormEntry time.Time `json:"date_of_form_entry"`
}

var db *sql.DB

func main() {
	godotenv.Load()

	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		connStr = "postgres://next1proj_user:next1proj_password@localhost:5433/next1proj_db?sslmode=disable"
	}

	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal(err)
	}

	err = db.Ping()
	if err != nil {
		log.Fatal("Cannot connect to database:", err)
	}

	createTable()

	http.HandleFunc("/incidents", incidentsHandler)

	log.Println("Backend running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", enableCORS(http.DefaultServeMux)))
}

func createTable() {
	query := `
	CREATE TABLE IF NOT EXISTS incidents (
		id SERIAL PRIMARY KEY,
		reported_by TEXT NOT NULL,
		incident_title TEXT NOT NULL,
		incident_detail TEXT NOT NULL,
		urgent BOOLEAN NOT NULL,
		status TEXT NOT NULL,
		date_of_incident DATE NOT NULL,
		date_of_form_entry TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`

	_, err := db.Exec(query)
	if err != nil {
		log.Fatal("Cannot create table:", err)
	}
}

func incidentsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		getIncidents(w, r)
		return
	}

	if r.Method == http.MethodPost {
		createIncident(w, r)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func getIncidents(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`
		SELECT id, reported_by, incident_title, incident_detail,
		       urgent, status, date_of_incident::text, date_of_form_entry
		FROM incidents
		ORDER BY id DESC
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var incidents []Incident

	for rows.Next() {
		var incident Incident

		err := rows.Scan(
			&incident.ID,
			&incident.ReportedBy,
			&incident.IncidentTitle,
			&incident.IncidentDetail,
			&incident.Urgent,
			&incident.Status,
			&incident.DateOfIncident,
			&incident.DateOfFormEntry,
		)

		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		incidents = append(incidents, incident)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(incidents)
}

func createIncident(w http.ResponseWriter, r *http.Request) {
	var incident Incident

	err := json.NewDecoder(r.Body).Decode(&incident)
	if err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err = db.QueryRow(`
		INSERT INTO incidents (
			reported_by, incident_title, incident_detail,
			urgent, status, date_of_incident
		)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id, date_of_form_entry
	`,
		incident.ReportedBy,
		incident.IncidentTitle,
		incident.IncidentDetail,
		incident.Urgent,
		incident.Status,
		incident.DateOfIncident,
	).Scan(&incident.ID, &incident.DateOfFormEntry)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if incident.Urgent {
		if err := sendUrgentIncidentEmail(incident); err != nil {
			log.Println("Failed to send urgent email:", err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(incident)
}

func sendUrgentIncidentEmail(incident Incident) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	emailTo := os.Getenv("URGENT_EMAIL_TO")

	if apiKey == "" || emailTo == "" {
		return fmt.Errorf("missing RESEND_API_KEY or URGENT_EMAIL_TO")
	}

	subject := "URGENT Incident Alert"

	body := fmt.Sprintf(`
An urgent incident has been submitted.

Incident ID: %d
Reported By: %s
Title: %s
Detail: %s
Status: %s
Date of Incident: %s
Date of Form Entry: %s

Please review and take action.
`,
		incident.ID,
		incident.ReportedBy,
		incident.IncidentTitle,
		incident.IncidentDetail,
		incident.Status,
		incident.DateOfIncident,
		incident.DateOfFormEntry.Format("2006-01-02 15:04:05"),
	)

	payload := fmt.Sprintf(`{
		"from": "Incident Alert <onboarding@resend.dev>",
		"to": ["%s"],
		"subject": "%s",
		"text": %q
	}`, emailTo, subject, body)

	req, err := http.NewRequest(
		"POST",
		"https://api.resend.com/emails",
		bytes.NewBuffer([]byte(payload)),
	)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("resend email failed with status: %s — %s", resp.Status, string(bodyBytes))
	}

	return nil
}

func enableCORS(next http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			return
		}

		next.ServeHTTP(w, r)
	}
}
