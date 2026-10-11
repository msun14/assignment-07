# assignment-07

# Verification record

Prepared on **11 October 2026**.

## Completed checks

| Check | Result |
| --- | --- |
| All seven supplied design images opened and inspected | Passed |
| Official product and category endpoints | HTTP 200; 33 products and eight categories |
| Official single-product and single-category endpoints | HTTP 200; schema verified |
| Next.js production compilation | Passed |
| TypeScript | Passed |
| Automated data and Better Auth integration tests | 16 checks passed |
| Production Home rendering and same-page CTA | Passed |
| Product-card slug links in rendered Home | Passed |
| Direct category, sign-in and sign-up rendering | Passed |
| Anonymous access to product, profile and edit-profile | Redirects to sign-in; protected market table is absent |
| Invalid product, invalid category and unknown path | Friendly not-found view |

The auth suite runs the actual Better Auth HTTP handler with the shipped Drizzle schema and SQL migration against an isolated PGlite PostgreSQL-compatible database. It covers weak-password rejection, registration, duplicate-email behavior, hashed credential storage, incorrect/correct passwords, HttpOnly session cookies, reuse across auth instances, forged-cookie rejection, persistent profile-name updates, origin rejection, OAuth redirect construction, and logout revocation.

The production-route smoke script invokes the built Next.js request handler directly with Next's own request/response mocks. No preview server or browser is used. This checks route rendering and server-side redirects; it is not a browser interaction test.

## Checks requiring the deployment environment

- Live Netlify build, Functions runtime and production PostgreSQL connectivity.
- Full Google/GitHub consent and callback exchange with real credentials.
- Browser interaction and visual QA at mobile, tablet and desktop sizes. Browser QA was unavailable in the execution environment; responsive breakpoints and markup are implemented, but screenshot comparisons were not performed.

Follow the submission checklist in `NETLIFY_SETUP.md` after entering your credentials. No production deployment or external-account provisioning was performed.

## Design choices where the brief differs from the screenshots

- Green rising-price badges, red falling-price badges and gray unchanged badges follow the written requirements.
- `/profile` has an update link; the editable name form is on `/profile/edit` to satisfy Challenge C3.
- The summary average is calculated from the supplied market ranges, rather than copying the headline `today` price.
- The displayed name and avatar come from the signed-in account, rather than the example profile in the screenshots.
- The date is current and formatted in Bengali using the Asia/Dhaka timezone.

## Reproduce

```bash
npm ci
npm test
npm run build
npm run typecheck
npm run test:routes
```

The tests do not require production credentials, mutate your production database, or perform real OAuth logins. The production application itself always requires persistent PostgreSQL; PGlite is a test-only development dependency.
