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
5. Run `user-inventory-rpc.sql` once to create the public shared-user inventory
   tables and atomic replacement function. By design, anonymous visitors can
   read and modify every shared user.
6. If the shared-user tables already exist, run `user-inventory-performance.sql`
   once. It adds the inventory ordering index and replaces the row-by-row save
   loop with set-based inserts.

The reference tables remain the editable source package, but the deployed site
does not download all of them on every visit. `npm run build:runtime-data`
creates a versioned static planning snapshot for GitHub Pages and separates the
large habitat location list into on-demand files. Runtime Supabase requests are
therefore limited to the shared-user list and the selected user's inventory.
Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
`.env.local` for development and in the deployment environment. Shared
inventories are stored in Supabase without a login requirement; browser
`localStorage` remains an offline fallback.
