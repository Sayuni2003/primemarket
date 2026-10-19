# primemarket

## Recommendation logic

`GET /api/recommendations?userId=…` returns `{ userId, isNewUser, forYou, others }`.
All weights live in [`server/config/recommendation.js`](server/config/recommendation.js); the ranking itself is a set of pure functions in [`server/services/recommendationScoring.js`](server/services/recommendationScoring.js).

### 1. Action weights

| Action | Weight | Why |
|---|---|---|
| `view` | 1 | Curiosity: the user opened the listing |
| `save` | 3 | Interest: they want to come back to it |
| `contact_seller` | 5 | Strong intent: they're ready to talk about buying |

### 2. Tags: two attributes per category

Each listing is turned into tags, and two listings are "similar" when they share tags.

| Category | Primary (most specific) | Secondary (supporting detail) |
|---|---|---|
| vehicle | `make` | `fuelType` |
| property | `propertyType` | `bedrooms` |
| electronics | `brand` | `type` |
| furniture | `type` | `material` |

Every listing also gets a `category:<category>` tag and a `location:<location>` tag. Attribute tags are prefixed with the category (`vehicle:make:toyota`), so `electronics:type:laptop` can't collide with `furniture:type:sofa`. Values are trimmed and lowercased. A missing attribute (land has no bedrooms) is simply skipped.

Every category gets the **same number of tags** on purpose: if vehicles had five tags and furniture two, vehicles would win simply because they have more chances to match.

### 3. Scoring

1. **Points per touched listing**: the sum of the weights of the *distinct* actions on it.
2. **Profile**: each touched listing adds its points to every one of its tags. It is rebuilt on every request and never stored, so it can't get out of sync with the interactions.
3. **Score** of an untouched listing:

```
score = Σ over the listing's tags of  profile[tag] × tagWeight
tagWeight: category ×1, primary ×2, secondary ×1, location ×1
```

The primary attribute counts **×2** because it's the most specific signal: "Toyota" says much more about what someone wants than "vehicle".

`forYou` holds the top 8 untouched listings with a score above 0. Each one has a `breakdown` of contributing tags and a `reason` taken from the biggest contributor, e.g. "Because you showed interest in Toyota", "Because you've been looking in Colombo", "Because you've been browsing Vehicles". Equal scores keep the default feed order.

### 4. Repeated clicks

Every click is stored as its own document (views and contacts are an activity log; saves are unique per user + listing). For scoring, each action type counts **once per listing**, so a listing can earn at most 1 + 3 + 5 = **9** points. 10 views + 1 contact = 6, not 15, and refreshing a page can't push one listing to dominate the feed.

### 5. Already-interacted listings

They're excluded from `forYou` (recommending something you've already contacted adds nothing) and shown at the end of `others` with `interacted` set to their strongest action (`contact_seller`, `save` or `view`) so the UI can show a badge like "Contacted".

### 6. Cold start

A user with no interactions (or whose interactions only point to deleted listings) gets `isNewUser: true`, `forYou: []` and a category-mixed default feed: newest first within each category, then interleaved vehicle → property → electronics → furniture → vehicle… It depends only on listing data, never on other users' activity, so one user's clicks can never change another user's feed.

### 7. Worked example

The user viewed and contacted the seller of a **Toyota Aqua** (Colombo, toyota, hybrid) → 1 + 5 = **6 points**, and viewed a **Honda Fit** (Colombo, honda, hybrid) → **1 point**.

Profile: `category:vehicle` 7, `vehicle:make:toyota` 6, `vehicle:make:honda` 1, `vehicle:fuelType:hybrid` 7, `location:colombo` 7.

| Listing | Category ×1 | Make ×2 | Fuel ×1 | Location ×1 | Score |
|---|---|---|---|---|---|
| Toyota Prius, Kandy, hybrid | 7 | 12 | 7 | 0 | **26** |
| Toyota Axio, Gampaha, hybrid | 7 | 12 | 7 | 0 | **26** |
| Suzuki Wagon R, Colombo, hybrid | 7 | 0 | 7 | 7 | **21** |
| Toyota Vitz, Nugegoda, petrol | 7 | 12 | 0 | 0 | **19** |
| Honda Vezel, Negombo, hybrid | 7 | 2 | 7 | 0 | **16** |
| Honda Dio, Dehiwala, petrol | 7 | 2 | 0 | 0 | **9** |
| Apartment, Colombo | 0 | 0 | 0 | 7 | **7** |
| House, Kandy | 0 | 0 | 0 | 0 | **0** (not in forYou) |

This exact example is checked by the unit tests.

### 8. Trade-offs and possible improvements

- **No recency decay**: an interaction from last month counts as much as one from today. `createdAt` on interactions could be used to fade older ones.
- **Price isn't used**: price ranges (e.g. `vehicle:price:5-10m`) could be added as another tag.
- **Weights are hand-picked**: they could instead be calculated from how rare each tag is (IDF), so a rare match counts more than a common one.
- **Recomputed per request**: every listing's tags and score are rebuilt on each request. That's fine at this size but would need caching or precomputed tags for thousands of listings.

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
