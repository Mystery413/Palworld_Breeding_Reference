# Supabase import

1. Run `schema.sql` in Supabase SQL Editor.
2. In Table Editor, import the CSV files in this order:
   1. `01_pals.csv`
   2. `02_pal_work_suitabilities.csv`
   3. `03_pal_elements.csv`
   4. `04_pal_habitats.csv`
   5. `05_pal_habitat_locations.csv`
   6. `06_breeding_combos.csv`
   7. `07_passives.csv`
   8. `08_pal_asset_aliases.csv`
3. For identity tables (`pal_habitat_locations`, `breeding_combos`), the CSV
   deliberately omits the generated ID column.
4. Static reference tables are public-read and have no client write policy.
   User inventory tables require Supabase Auth and are protected by RLS.
5. Run `user-inventory-rpc.sql` once to enable atomic save-profile imports.
6. In Supabase Authentication, keep Email/Password enabled. Configure the
   project's Site URL to the deployed GitHub Pages URL if email confirmation is
   enabled.

The application reads public reference data from these tables at runtime through
PostgREST. Configure `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` for development and in the
deployment environment. Signed-in inventories are stored in the user tables;
browser `localStorage` remains an offline fallback for signed-out use.
