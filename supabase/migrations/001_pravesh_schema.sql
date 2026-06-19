-- Supabase Schema for Pravesh
-- Creates tables for managers, candidates, and email logs, along with necessary webhook triggers.

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Managers Table
CREATE TABLE managers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candidates Table
CREATE TABLE candidates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    position TEXT,
    source TEXT,
    status TEXT DEFAULT 'invited',
    manager_id UUID REFERENCES managers(id),
    application JSONB DEFAULT '{}',
    documents JSONB DEFAULT '{}',
    rating_sheet JSONB,
    hr_decision JSONB,
    offer_letter JSONB,
    notifications JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Log Table
CREATE TABLE email_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id TEXT REFERENCES candidates(id),
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    error TEXT,
    sent_at TIMESTAMPTZ
);

-- Trigger for updated_at on candidates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_candidates_modtime
BEFORE UPDATE ON candidates
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Webhook Trigger for Candidate Status Change using pg_net
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION on_candidate_status_change_webhook()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM net.http_post(
            url := current_setting('app.settings.edge_function_url', true) || '/on-candidate-status-change',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
            ),
            body := jsonb_build_object(
                'type', 'UPDATE',
                'table', 'candidates',
                'record', row_to_json(NEW),
                'old_record', row_to_json(OLD)
            )
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER candidate_status_change_trigger
AFTER UPDATE ON candidates
FOR EACH ROW EXECUTE PROCEDURE on_candidate_status_change_webhook();
