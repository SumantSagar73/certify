Phase 4 — Server-side Export (minimal design)

Goal

Provide a secure, reliable server-side export endpoint that packages a user's selected certificates (files + metadata) into a single downloadable archive (ZIP) and returns it to the browser with minimal client memory use.

Why

- Client-side zipping works for small exports but fails/blocks memory for large sets or big files.
- Server-side export lets us use a service_role key to fetch private storage objects without exposing secrets.
- Streaming the ZIP from the server avoids loading all file bytes into the browser.

High-level approach

1. Endpoint: POST /api/export (Edge Function or Node route)
   - Accepts a JSON body: { ids: string[] }
   - Requires Authorization: Bearer <access_token> (the user's supabase access token)

2. Server-side auth and validation
   - Use the provided access token to verify the user (option A: validate token against Supabase Auth; Option B: accept supabase's row-level checks after using service_role client but still verify user id manually).
   - Confirm each certificate ID belongs to the requesting user (query `certificates` table using service role client and filter by user_id).

3. Fetch files
   - For each validated certificate, obtain a signed URL (server-side) or stream the object directly from Supabase Storage using the service_role privileges.

4. Stream ZIP
   - Use a streaming ZIP library (Node: `archiver`) to pipe files into a ZIP stream and return response with Content-Type: application/zip and appropriate Content-Disposition.
   - For Edge/Serverless environments where Node streams aren't available, either:
     - Create a temporary object in a private bucket and return a pre-signed download URL (less ideal), or
     - Use an edge-compatible streaming zip library (if available) and stream the bytes.

5. Security
   - Keep the service_role key only on server (Environment variable).
   - Always verify requested IDs belong to the authenticated user before packaging.
   - Rate-limit exports and set size limits (e.g., max files or total bytes) to avoid abuse.

API contract (example)

POST /api/export
Headers:
  Authorization: Bearer <access_token>
Body:
  { ids: ["uuid1","uuid2"] }

Responses:
  200 OK
    - Content-Type: application/zip
    - Content-Disposition: attachment; filename="certificates_<user>_<ts>.zip"
  400 Bad Request - invalid payload
  401 Unauthorized - invalid or missing token
  403 Forbidden - requesting IDs that don't belong to user
  413 Payload Too Large - export exceeds configured limits
  500 Internal Error

Implementation notes

- Node (Express) recommended for easiest streaming with `archiver`:
  - import archiver
  - for each file: use `supabase.storage.from(bucket).download(path)` to get a Readable stream and append to archiver

- Supabase Edge Functions:
  - Edge environment may not support Node-style streaming; fallback: generate temporary zip in a serverless container (or write to a temporary bucket) and return a signed URL.

- Logging and metrics:
  - Log export requests (user id, file count, total bytes) for auditing.
  - Track slow exports and errors.

Testing

- Unit test: request export for a small set of files and assert response is a valid ZIP containing expected filenames.
- Integration: test with large files to measure memory and time, and confirm streaming behavior.

Operational considerations

- Set reasonable limits: maxFiles (e.g., 200) and maxBytes (e.g., 500 MB) per request.
- Consider asynchronous export for very large exports: create job -> process in background -> notify user + provide download link.


End of minimal design
