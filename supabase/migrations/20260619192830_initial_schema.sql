-- Create Enums for roles and statuses
CREATE TYPE user_role AS ENUM ('admin', 'hr', 'manager', 'candidate');
CREATE TYPE email_status AS ENUM ('queued', 'sent', 'failed');

-- 1. Profiles Table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  role user_role DEFAULT 'candidate'::user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS for Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by authenticated users."
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile."
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile."
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- 2. Candidates Table
CREATE TABLE candidates (
  id TEXT PRIMARY KEY, -- Using the existing short-code generation like 'C-1234'
  auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Null if not yet registered
  manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  position TEXT NOT NULL,
  status TEXT DEFAULT 'invited' NOT NULL,
  source TEXT,
  application JSONB DEFAULT '{}'::jsonb,
  documents JSONB DEFAULT '[]'::jsonb,
  interview_rating JSONB DEFAULT '{}'::jsonb,
  manager_review JSONB DEFAULT '{}'::jsonb,
  hr_review JSONB DEFAULT '{}'::jsonb,
  offer JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS for Candidates
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view candidates assigned to them."
  ON candidates FOR SELECT
  TO authenticated
  USING (auth.uid() = manager_id OR (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr'))));

CREATE POLICY "Managers can insert candidates."
  ON candidates FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr', 'manager')));

CREATE POLICY "Managers and HR can update assigned candidates."
  ON candidates FOR UPDATE
  TO authenticated
  USING (auth.uid() = manager_id OR (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr'))));

CREATE POLICY "Candidates can view their own application."
  ON candidates FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid());

CREATE POLICY "Candidates can update their own application."
  ON candidates FOR UPDATE
  TO authenticated
  USING (auth_id = auth.uid());

-- 3. Email Logs Table
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id TEXT REFERENCES candidates(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status email_status DEFAULT 'queued' NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  sent_at TIMESTAMPTZ
);

-- RLS for Email Logs
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and HR can view email logs for their candidates"
  ON email_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = email_logs.candidate_id
      AND (c.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'hr')))
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON candidates FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


-- 4. Supabase Storage Configuration
INSERT INTO storage.buckets (id, name, public) VALUES ('candidate-documents', 'candidate-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
CREATE POLICY "Candidates can upload their own documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'candidate-documents' AND (auth.uid()::text = (string_to_array(name, '/'))[1]));

CREATE POLICY "Candidates can view their own documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'candidate-documents' AND (auth.uid()::text = (string_to_array(name, '/'))[1]));

CREATE POLICY "Managers and HR can view documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'candidate-documents' AND 
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr', 'manager')
    )
  );

-- 5. Managers Table (Legacy Support for pravesh.html)
CREATE TABLE IF NOT EXISTS managers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS for Managers
ALTER TABLE managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public managers are viewable by all."
  ON managers FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert a manager."
  ON managers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update a manager."
  ON managers FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete a manager."
  ON managers FOR DELETE
  USING (true);
