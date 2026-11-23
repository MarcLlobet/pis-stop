# Pis Stop protocol, version 1

This is the exact specification of what the app stores and how. It is written so that someone can
re-implement it from scratch; `scripts/verify_vectors.py` does exactly that in Python and must
produce the test vectors at the end of this file. For the plain-language explanation, threat model
and known limits, read [SECURITY.md](../SECURITY.md).

All integers are big-endian. `‖` is concatenation. `b64url` is base64url without padding
(RFC 4648 §5). Strings are UTF-8.

## 1. Primitives

| Purpose        | Algorithm                                  | Source       |
| -------------- | ------------------------------------------ | ------------ |
| Key derivation | HKDF-SHA-256 (RFC 5869)                    | WebCrypto    |
| Encryption     | AES-256-GCM, 96-bit random IV, 128-bit tag | WebCrypto    |
| Signatures     | ECDSA P-256 with SHA-256, IEEE P1363 (r‖s) | WebCrypto    |
| Hashing        | SHA-256                                    | WebCrypto    |
| Length hiding  | Padmé (Nikitin et al., PETS 2019)          | `padding.ts` |
| Randomness     | `crypto.getRandomValues`                   | WebCrypto    |

No cryptography is implemented by hand: only the formats around it.

## 2. Invite

The organizer generates:

- `secret`: 32 random bytes.
- an ECDSA P-256 key pair, the **organizer key**.

The invite URL is

```
<app URL>#k=<b64url(secret)>&o=<fingerprint(organizer public key)>
```

The fragment is never sent over the network by browsers. On load, the app derives the keys
(§3), stores them, and removes the fragment with `history.replaceState`.

`fingerprint(pk) = b64url(SHA-256(raw(pk))[0..16])`, where `raw(pk)` is the 65-byte uncompressed
point. It is 22 characters long.

## 3. Key derivation

```
salt = "pis-stop/v1"
tag  = "ps_" ‖ hex(HKDF(secret, salt, info = "cloudinary-tag", 32 bytes))
aes  = HKDF(secret, salt, info = "aes-gcm", 32 bytes)  → AES-256-GCM key, non-extractable
```

`tag` is the Cloudinary tag that lists the event's entries. It reveals nothing about `aes`.
After derivation, the app keeps `{ tag, aes, organizer fingerprint }` in IndexedDB. The raw secret
is not stored.

## 4. Sealed blobs

Every object uploaded to Cloudinary is a sealed blob:

```
sealed = version (1 byte = 0x01) ‖ iv (12 bytes) ‖ AES-GCM(aes, iv, framed, aad)
framed = len(data) (4 bytes) ‖ data ‖ zero bytes up to padme(4 + len(data))
aad    = "pis-stop/v1/entry"              for entries
       | "pis-stop/v1/photo/" ‖ photoId    for full-size photos
```

`padme(L)`: for `L < 2` return `L`; else `E = ⌊log2 L⌋`, `S = ⌊log2 E⌋ + 1`, `mask = 2^(E−S) − 1`,
return `(L + mask) & ~mask`.

Opening fails (and the blob is ignored) if the version byte is not `0x01`, authentication fails,
the length field points past the end, or any padding byte is not zero.

## 5. Entries

An entry is a sealed blob (purpose `entry`) whose `data` is:

```
data    = signature (64 bytes) ‖ message
message = len(meta) (4 bytes) ‖ meta (JSON) ‖ payload
signature = ECDSA-P256-SHA256(signer, "pis-stop/v1/signature\0" ‖ message)
```

Entries are uploaded with the tag. `meta` is one of:

| `kind`    | Fields                                                                                                                     | Payload              | Signed by                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------- |
| `event`   | `name`, `organizerKey` (b64url raw P-256), `legs` (§5.1)                                                                   | empty                | organizer key                 |
| `stop`    | `id`, `name`, `order`, `position {lat,lng}`                                                                                | empty                | organizer key                 |
| `profile` | `id`, `publicKey`, `name`, `email`, `imageType`, `createdAt`                                                               | JPEG avatar or empty | the profile's own `publicKey` |
| `photo`   | `id`, `authorId`, `stopId \| null`, `position \| null`, `takenAt`, `fullUrl`, `fullSha256`, `imageType`, `width`, `height` | JPEG thumbnail       | the author's profile key      |

### 5.1 Itinerary

`legs[n]` describes how to get from the stop with `order = n + 1` to the next one:

```json
{
  "options": [
    {
      "mode": "metro",
      "minutes": 26,
      "steps": [
        { "line": "L4", "from": "Joanic", "to": "Verdaguer" },
        { "line": "L5", "from": "Verdaguer", "to": "Badal" }
      ]
    },
    { "mode": "bike", "minutes": 17 }
  ],
  "path": [{ "lat": 41.4, "lng": 2.17 }]
}
```

`mode` is one of `metro`, `train`, `tram`, `bus`, `walk`, `bike`; `minutes` is an integer from 0 to
600; `steps` (≤ 5) and `path` (≤ 200 waypoints) are optional; a leg has at most 5 options and an
event at most 50 legs; `line` matches `[A-Za-z0-9]{1,6}`. The first option is the one drawn on the
map. The itinerary is part of the event entry, so it is signed by the organizer.

Parsing is strict: unknown kinds are dropped, unknown fields are discarded, strings are bounded
(names ≤ 80, ids `[A-Za-z0-9_-]{1,64}`, URLs ≤ 500), `imageType` must be `image/jpeg`, `fullSha256`
must be 64 lowercase hex digits, dates must parse, coordinates must be in range.

## 6. Verification rules

When loading, after decryption and parsing, an entry is kept only if:

1. **event**: `fingerprint(organizerKey)` equals the `o` value from the invite, and its signature
   verifies under `organizerKey`.
2. **stop**: its signature verifies under that same organizer key.
3. **profile**: `id == fingerprint(publicKey)` and its signature verifies under `publicKey`.
   Because the id is derived from the key, nobody can publish a profile with someone else's id.
   Several versions of a profile may exist; the latest `createdAt` wins.
4. **photo**: a verified profile with `id == authorId` exists and the signature verifies under its
   key.

Then, as defence in depth: photo and avatar payloads must start with the JPEG magic number
(`FF D8 FF`), and `fullUrl` must be a plain delivery URL of the configured Cloudinary account
(`https://res.cloudinary.com/<cloud>/raw/upload/…`, no query, no `..`).

## 7. Full-size photos

Uploaded without tag, as a sealed blob with purpose `photo/<photoId>`. The entry that points to
it carries `fullUrl` and `fullSha256 = hex(SHA-256(plaintext JPEG))`, both covered by the author's
signature. Opening a photo checks, in order: URL allowlist, size ≤ 12 MiB, decryption with the
photo-specific AAD, JPEG magic number, SHA-256 equality.

## 8. Limits

| What                  | Limit                      |
| --------------------- | -------------------------- |
| Entry blob download   | 1 MiB                      |
| Full photo download   | 12 MiB                     |
| Full photo resolution | 1600 px longest side, JPEG |
| Thumbnail             | 480 px, JPEG               |
| Avatar                | 256 px, JPEG               |

Images are re-encoded through a canvas before upload, which drops all EXIF metadata.

## 9. Test vectors

Inputs: `secret = 00 01 02 … 1f`, `iv = a0 a1 … ab`, plaintext `"Pis Stop"`.

| Value                                                            | Result                                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `tag`                                                            | `ps_496af9b1b7b58aba5b645f6be86dc144ab5c631f1517f11fb2bb5f5daf7c80d8`                |
| sealed, purpose `entry`                                          | `01a0a1a2a3a4a5a6a7a8a9aaabb6b9b2a0122b9ee1c1a55009479cb21eb4910fe328aca22175c31538` |
| sealed, `photo/p1`                                               | `01a0a1a2a3a4a5a6a7a8a9aaabb6b9b2a0122b9ee1c1a550091526130e82cf19059e3292bf2aec4d1f` |
| `fingerprint(04 01 … 40)`                                        | `DtOmq5V_9vWaljCkc9MafQ`                                                             |
| `padme` of 0, 1, 4, 9, 12, 100, 1000, 1023, 1025, 65537, 1000000 | 0, 1, 4, 10, 12, 104, 1024, 1024, 1088, 67584, 1015808                               |

The two ciphertexts share their first bytes (same key, IV and plaintext) and differ only in the
authentication tag, because only the associated data changed. That is expected: it shows the AAD
is bound to the tag. In real use the IV is always random.
