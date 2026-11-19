# College and Career Center Scholarships and Summer Programs Catalog (C3SS)

The C3SS is a scholarship and summer program search catalog for the LCHS College and Career Center, meant specifically for students attending LCHS. It provides the user with a database of information of scholarships and summer programs available locally, statewide, nationwide, and globally to La Canada High School Students with fast searching and filtering capabilities. Try it out at **[c3ss.lciteam.club](https://c3ss.lciteam.club)**!

## Starting a Dev Server

This application was written in SvelteKit, and utilizes Supabase on the database side. To start up a dev server, clone the project and run the usual:
```
bun i
bun dev
```
DM us on discord with any questions, concerns, or additions!
 itest

## Admin catalog editor

The `/admin` page uses `ADMIN_PASSWORD` for sign-in. To enable database edits, configure `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` as a private server environment variable. Never expose this key through a `PUBLIC_` variable. `ADMIN_SESSION_SECRET` can be set to use a separate key for signing the eight-hour admin session cookie; if omitted, the admin password is used.
