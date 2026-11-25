# R2 Infrastructure — vidaenlosextremos-vr-2

**Status: `BLOCKED_R2_PERMISSIONS`** (verified 2026-11-25 UTC). The supplied
`CLOUDFLARE_API_TOKEN` authenticates against `GET /zones` but is rejected by every
Cloudflare R2 REST endpoint with HTTP 403. No bucket, public URL, CORS policy, or
object was created; nothing below is claimed as live.

## Intended configuration (prepared, not applied)

- **Bucket name:** `vidaenlosextremos-assets` (create attempted, rejected with 403).
- **Public base URL:** none verified — the r2.dev managed URL could not be enabled.
  Do not use a guessed URL; record the real URL here after provisioning.
- **CORS policy:** see `r2.cors.json` at repo root (`AllowedOrigins: ["*"]`,
  `AllowedMethods: ["GET", "HEAD"]`, `AllowedHeaders: ["Range", "Content-Type"]`,
  `ExposeHeaders: ["Content-Range", "Accept-Ranges", "ETag", "Content-Length"]`,
  `MaxAgeSeconds: 3600`). The file is committed; the PUT to R2 was rejected.
- **Smoke object:** `_health/ping.txt` (~60 bytes) with
  `Cache-Control: public, max-age=31536000, immutable` and `Content-Type: text/plain`.
  Upload was not possible, so no HTTP 200/206 response exists to report.

## Discovery results (sanitized)

| Endpoint | Method | HTTP | Result |
| --- | --- | --- | --- |
| `/client/v4/zones` | GET | 200 | `result: []` — **0 zones** in the account; no custom-domain zone is available. No DNS records were created or modified. |
| `/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets` | GET | 403 | No bucket list obtained. |
| `/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets/vidaenlosextremos-assets` | GET | 403 | Bucket detail unavailable. |
| `/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets` | POST | 403 | Bucket creation rejected (body `{"name":"vidaenlosextremos-assets"}`). |
| `/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets/vidaenlosextremos-assets/cors` | GET / PUT | 403 | CORS read/apply rejected (policy from `r2.cors.json`). |
| `/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets/vidaenlosextremos-assets/public` | GET / PUT | 403 | r2.dev public access enable rejected. |

Every R2 response body was:

```json
{"success":false,"errors":[{"code":10000,"message":"Authentication error","documentation_url":"https://developers.cloudflare.com/api/resources/r2"}],"messages":[],"result":null}
```

**Missing permission:** the token lacks account-wide R2 **Admin Read & Write**
(Cloudflare dashboard permission `Account → Cloudflare R2 → Edit`). Object-level
tokens (`Object Read & Write` / `Object Read only`, including bucket-scoped ones)
return exactly HTTP 403 / code 10000 against `api.cloudflare.com`. See
<https://developers.cloudflare.com/r2/platform/troubleshooting/#object-level-api-tokens-fail-against-the-rest-api>.

Unblock: update the injected token scopes to include R2 Admin Read & Write, then
re-run this task. Object uploads may use separate S3 credentials, but bucket
creation, CORS, and r2.dev enablement require the REST API token scope above.

## Exact sanitized curl header output

Request (token value and account ID are never printed; header placeholders shown):

```sh
curl -sS -i -H 'Authorization: Bearer [REDACTED]' \
  -H 'Content-Type: application/json' \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets"
```

Response (verbatim except `set-cookie` lines omitted; no credentials present):

```text
HTTP/2 403
date: Wed, 25 Nov 2026 22:58:11 GMT
content-type: application/json
content-length: 178
cf-ray: a60441b6380b408a-SCL
cf-cache-status: DYNAMIC
cache-control: no-store
server: cloudflare
cf-auditlog-id: 01a214ee-4dea-7769-b9cd-12db3d4863de
ratelimit: "rtwo_gw_apigw";r=1199;t=1
ratelimit-policy: "rtwo_gw_apigw";q=1200;w=300
api-version: 2026-10-01.epoch

{"success":false,"errors":[{"code":10000,"message":"Authentication error","documentation_url":"https://developers.cloudflare.com/api/resources/r2"}],"messages":[],"result":null}
```

The requested smoke-test verification
`curl -sI -H Origin:http://localhost:5173 -H Range:bytes=0-15 <public-base-url>/_health/ping.txt`
was **not runnable** without a public URL or object; no `access-control-allow-origin`,
`accept-ranges`, or `cache-control` response headers from an asset are claimed.

## Upload convention for the follow-up run

- Object keys: `models/<name>.glb`, `media/cards/<id>.webp`, `media/`, `_health/ping.txt`.
- Set `Cache-Control: public, max-age=31536000, immutable` on content-hashed assets;
  set an accurate `Content-Type` (e.g. `text/plain` for `_health/ping.txt`).
- After the bucket is live, verify with the exact Range/Origin HEAD request above and
  write the real sanitized headers into this document.
- The CORS policy permits `GET`/`HEAD`, accepts `Range` and `Content-Type`, and exposes
  `Content-Range`, `Accept-Ranges`, `ETag`, `Content-Length` for WebGL byte-range loads.
- Supply credentials only through environment variables/CI secrets; never commit
  tokens, access keys, or account identifiers to this repository.

## Zero secrets

This file, `r2.cors.json`, and `.env.example` contain no API token, S3 secret, or
literal account ID. Endpoints use the `$CLOUDFLARE_ACCOUNT_ID` placeholder only.
