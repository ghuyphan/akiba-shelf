-- Trusted server writes evaluate constraints and functions in the private
-- schema. USAGE permits name resolution without exposing the schema through
-- the Data API or granting access to browser roles.
grant usage on schema private to service_role;
