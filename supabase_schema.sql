-- Table for user profiles
CREATE TABLE IF NOT EXISTS profiles (
  id SERIAL PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL,
  activity TEXT NOT NULL,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Trigger to update updated_at on row update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- Table for daily completions
CREATE TABLE IF NOT EXISTS daily_completions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  comment TEXT,
  photo_url TEXT,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, date)
);

DROP TRIGGER IF EXISTS update_daily_completions_updated_at ON daily_completions;

CREATE TRIGGER update_daily_completions_updated_at
BEFORE UPDATE ON daily_completions
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();
