-- SQL script to create the missing execute_sql function in Postgres
-- This function executes a given SQL query string and returns the result as JSON

CREATE OR REPLACE FUNCTION public.execute_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    result jsonb;
BEGIN
    EXECUTE query INTO result;
    RETURN result;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error executing query: %', SQLERRM;
END;
$$;

-- Note: This is a basic example. Adjust the function as needed based on your app's requirements.
