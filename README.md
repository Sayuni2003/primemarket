# primemarket

## Running the frontend

The frontend is a React app in [`client/`](client/) (Vite, plain JavaScript and CSS, axios for HTTP). Start the backend first (see [Run it](#4-run-it) below), then in a second terminal:

```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173. Vite forwards every `/api` request to the backend on `http://localhost:5000` (the proxy in [`client/vite.config.js`](client/vite.config.js)), so the browser only talks to one origin and there are no CORS issues. No `.env` is needed. If you change `PORT` in `server/.env`, change the proxy target too.

### Switching users

There's no login. The first screen shows one button per seeded user (Nimal Perera, Ayesha Fernando). The picked user's id is stored in `localStorage`, so it's still selected after closing and reopening the browser. Click **Switch user** in the header to clear it and pick someone else.

### What the page does

- **Feed:** loaded when a user is picked and when you click **Refresh feed**. Saving, viewing or contacting never refetches it, so cards don't move while you're using the page. A user with no activity sees "Fresh picks for you" (the cold-start feed); otherwise "Recommended for you" shows each card's score and reasons, followed by every other listing.
- **Interactions:** each action is a `POST /api/interactions` with `{ userId, listingId, type }`:
  - Clicking a card opens its details and records `view`.
  - The **heart** button records `save` and turns red.
  - **Contact Seller** records `contact_seller` and shows the seller's name and phone number.
- **Images:** a listing without an `imageUrl`, or whose image fails to load (e.g. an expired presigned URL), shows a "No photo" placeholder.

All API calls live in [`client/src/api.js`](client/src/api.js). Errors show the backend's `message`, or "Backend not reachable — is the server running?" when the backend doesn't answer.

## Recommendation logic

`GET /api/recommendations?userId=…` returns `{ userId, isNewUser, message, recommendations, others }`.
It is content-based filtering with weighted interactions: listings similar to what the user viewed, saved or contacted a seller about rank first.
All weights, caps and matching attributes live in [`server/config/recommendation.js`](server/config/recommendation.js); the scoring itself is a set of pure functions (no database calls) in [`server/services/recommendationScoring.js`](server/services/recommendationScoring.js).

### 1. Interaction weights and caps

| Interaction | Weight | Max counted per listing | Why |
|---|---|---|---|
| `view` | 1 | 3 | Initial interest |
| `save` | 3 | 1 | Stronger interest: they want to come back to it |
| `contact_seller` | 5 | 2 | Purchase or enquiry intent |

Every click is stored as its own document, but repeats are capped per user, listing and type, so refreshing a page can't push one listing to dominate the feed. A listing's points are:

```
points = Σ over types of  min(count, cap) × weight
```

5 views of one listing = min(5, 3) × 1 = **3** points, not 5. The most one listing can earn is 3 + 3 + 10 = 16.

### 2. Preference profile

The backend loads only this user's interactions, then the listings they point to (interactions whose listing was deleted are ignored). Each interacted listing adds its points to three maps:

- **Category**, e.g. `property`
- **Location**, e.g. `colombo`
- **Matching attributes** for its category, keyed `category:key:value`, e.g. `vehicle:make:toyota`

| Category | Matching attributes |
|---|---|
| property | `propertyType`, `bedrooms` |
| vehicle | `make`, `fuelType` |
| electronics | `brand`, `type` |
| furniture | `type`, `material` |

Keys and locations are trimmed and lowercased, so "Toyota " and "toyota" match. An attribute a listing doesn't have (land has no bedrooms) is simply skipped. Price isn't used yet. The profile is rebuilt on every request and never stored, so it can't get out of sync with the interactions.

### 3. Scoring and ranking

Candidates are the listings the user hasn't interacted with (`_id: { $nin: interactedIds }`). Each one scores:

```
score = category points + location points + Σ points of each matching attribute
```

Every match adds a reason, e.g. "Matches preferred category: property", "Matches preferred location: Colombo", "Matches preferred make: toyota". Candidates are sorted by score (highest first), then by `_id`, so the order is the same on every request. The score is a ranking value, not a percentage.

### 4. The response

- `recommendations`: up to 8 candidates with a score above 0, each `{ listing, score, reasons }`. A score of 0 matches nothing the user has shown interest in, so it isn't recommended.
- `others`: every other listing as `{ listing }`, in default feed order, with the listings the user already interacted with at the end. Together the two lists show every listing exactly once.
- `message`: explains an empty `recommendations` (no activity yet, nothing matches, or every listing already interacted with); otherwise `null`.

### 5. Cold start

A user with no interactions (or whose interactions only point to deleted listings) gets `isNewUser: true`, `recommendations: []` and the full default feed in `others`: newest first within each category, then interleaved vehicle → property → electronics → furniture → vehicle…, with `_id` (descending) breaking ties. The same order is used for `others` whenever nothing scores above 0. It depends only on listing data, never on other users' activity, so one user's clicks can never change another user's feed.

### 6. Worked example

The user viewed an apartment in Colombo (1 point), saved another apartment in Colombo (3 points) and viewed a Toyota hybrid in Kandy (1 point).

| Profile | Value | Points |
|---|---|---|
| Category | property / vehicle | 4 / 1 |
| Location | colombo / kandy | 4 / 1 |
| Attribute | `property:propertytype:apartment`, `property:bedrooms:2` | 4 each |
| Attribute | `vehicle:make:toyota`, `vehicle:fueltype:hybrid` | 1 each |

| Candidate | Category | Location | Attributes | Score |
|---|---|---|---|---|
| Apartment, Dehiwala, 2 bedrooms | 4 | 0 | 4 + 4 | **12** |
| Toyota hybrid, Colombo | 1 | 4 | 1 + 1 | **7** |
| House, Kandy, 4 bedrooms | 4 | 1 | 0 | **5** |

This exact example is checked by the unit tests.

### 7. Trade-offs and possible improvements

- **No recency decay**: an interaction from last month counts as much as one from today. `createdAt` on interactions could be used to fade older ones.
- **Price isn't used**: price ranges could be added as another profile dimension.
- **Weights and caps are hand-picked**: they can be tuned after testing with real usage.
- **Category weighs a lot**: the same points go to category, location and each attribute, so a broad category match counts as much as a specific one like make.
- **Recomputed per request**: every candidate is scored on each request. That's fine at this size but would need caching for thousands of listings.

## AWS S3 setup

Listing images live in a **private** S3 bucket. MongoDB stores only each image's object key (e.g. `listings/vehicle-toyota-aqua.jpg`), and the API turns it into a short-lived presigned URL on every request.

### 1. Create the bucket

In the S3 console, create a bucket in your region with **Block all public access** turned **on** (the default), ACLs disabled and default SSE-S3 encryption. No bucket policy or CORS configuration is needed.

### 2. Create an IAM user for the app

In IAM, create a user with **no console access**, attach this policy (replace `YOUR-BUCKET`), then create an access key for it under *Security credentials → Access keys*:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadWriteListingImages",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::YOUR-BUCKET/*"
    },
    {
      "Sid": "ListBucket",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::YOUR-BUCKET"
    }
  ]
}
```

Object actions (`GetObject`, `PutObject`) apply to `YOUR-BUCKET/*` (the objects), while `ListBucket` applies to the bucket itself. Without `ListBucket`, S3 answers a request for a missing object with `AccessDenied` instead of a clear `NoSuchKey`.

### 3. Fill in `server/.env`

Copy [`server/.env.example`](server/.env.example) to `server/.env` and fill in:

| Variable | Value |
|---|---|
| `AWS_REGION` | The bucket's region, e.g. `us-east-1` |
| `AWS_ACCESS_KEY_ID` | The IAM user's access key ID |
| `AWS_SECRET_ACCESS_KEY` | The IAM user's secret access key |
| `AWS_S3_BUCKET` | The bucket name |

`.env` is git-ignored. The server and the upload script refuse to start if any of these (or `MONGO_URI`) is missing, and name the missing ones.

### 4. Run it

Put the listing images (under 1 MB each, `.jpg`/`.jpeg`/`.png`/`.webp`) in `server/scripts/images/`. The seed expects `vehicle-toyota-aqua.jpg`, `vehicle-toyota-prius.jpg`, `vehicle-honda-fit.jpg`, `property-house-nugegoda.jpg` and `property-apartment-colombo.jpg`, and warns about any that are missing.

```bash
cd server
npm install
npm run upload:images   # uploads each file to listings/<filename>; safe to re-run (overwrites)
npm run seed
npm run dev
```

`GET /api/recommendations?userId=…`, `GET /api/listings` and `GET /api/listings/:id` return an `imageUrl` for each listing (or `null` if it has no image).

### Design decisions

- **Private bucket:** nobody can load an image just by guessing its URL, and every access goes through credentials the backend controls.
- **Presigned URLs:** the backend signs a URL with its secret key that grants read access to one object for a limited time. The browser loads the image straight from S3, so images never pass through the Express server, and the frontend never sees any credentials. Signing is done locally and doesn't call AWS.
- **Only keys in MongoDB:** presigned URLs expire, so a stored URL would turn into a broken image after 5 minutes. A key never expires, and a fresh URL is generated on each request. It also means a different bucket, region or CDN only needs a config change, not a data migration.
- **Least-privilege IAM user:** the app can only read and write objects in this one bucket and list it. It can't delete objects, change bucket settings or touch any other AWS service, so a leaked key can do very little damage. It has no console password because it's only used by code.
- **5-minute expiry (`URL_EXPIRY_SECONDS` in [`server/services/s3.js`](server/services/s3.js)):** long enough for the page to load its images, short enough that a copied or leaked link soon stops working. When a URL has expired, the frontend should show a placeholder (e.g. from the `<img>` `onError` handler).
- **One bad image doesn't break the feed:** if signing fails for a listing, it's returned with `imageUrl: null` and the error is logged on the server.

### Running the tests

```bash
cd server
npm test
```

Tests use an in-memory MongoDB (mongodb-memory-server), so they never touch the real database. The first run downloads a MongoDB binary and takes a while.
