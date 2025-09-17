# Certify

Certify is a small, secure certificate manager built with React and Vite and backed by Supabase (Auth, Storage, Postgres). It helps users store, organize, and export their certificates (PDFs or images) with a simple, responsive UI.

Features
- Email magic-link and Google sign-in (Supabase Auth)
- Upload certificates (PDF or images) with metadata: title, issuing authority, category, issue & expiry dates, notes
- Preview and download certificates (signed URLs or public URLs)
- Organize and search: full-text title search, filter by category or issuing authority, date range filters
- Bulk download (client-side ZIP) and bulk delete
- Delete with undo window (7s) to recover accidental deletions
- Responsive UI using Tailwind CSS and accessible components

Quick start (local)
1. Install dependencies:

```powershell
npm install
```

2. Provide Supabase credentials via environment variables. Create a `.env` file in the project root with:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. Run the dev server:

```powershell
npm run dev
```

4. Open the app at the Vite dev URL (e.g. http://localhost:5173 or the port shown by Vite).

Supabase setup notes
- Create a Supabase project and enable Email and Google providers in Authentication → Providers.
- Create a Postgres table named `certificates` with appropriate columns (example minimal schema):

	- id: uuid (primary key, default gen_random_uuid())
	- user_id: uuid (references auth.users)
	- file_name: text
	- storage_path: text
	- mime_type: text
	- title: text
	- issuing_authority: text
	- category: text
	- issue_date: date
	- expiry_date: date
	- notes: text
	- is_private: boolean
	- created_at: timestamptz (default now())

- Create a Storage bucket (used in the app as `certify-certificates`) and ensure your RLS and policies allow authenticated users to insert/read/delete their own rows and storage objects as needed.

Deployment notes
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your hosting provider (Vercel, Netlify) environment variables.
- Add your production URL as a Redirect URL in Supabase Auth settings and OAuth provider consoles (Google) so magic links and OAuth redirects work.
- Ensure you clear tokens from URL fragments — the app already parses and clears auth tokens from the URL when the redirect completes.

Security and maintenance
- Do not commit your `VITE_SUPABASE_ANON_KEY` to source control. Rotate keys if they are accidentally exposed.
- Consider implementing server-side backups or lifecycle rules for storage to manage costs and retention.

Contributing
- This project is intended as a small demo / starter. Feel free to open issues or submit PRs for enhancements (categories persistence, export endpoints, soft-delete, ACL improvements).

License
- MIT
