"""Independent re-implementation of Pis Stop's crypto, for auditors.

Recomputes the known-answer vectors in docs/PROTOCOL.md with Python's
`cryptography` package instead of WebCrypto. If both implementations agree,
the spec in PROTOCOL.md describes what the app really does.

    pip install cryptography && python3 scripts/verify_vectors.py
"""

import base64
import hashlib

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

SECRET = bytes(range(32))
IV = bytes(0xA0 + i for i in range(12))
SALT = b"pis-stop/v1"

EXPECTED_TAG = "ps_496af9b1b7b58aba5b645f6be86dc144ab5c631f1517f11fb2bb5f5daf7c80d8"
EXPECTED_ENTRY = (
    "01a0a1a2a3a4a5a6a7a8a9aaabb6b9b2a0122b9ee1c1a55009479cb21eb4910fe328aca22175c31538"
)
EXPECTED_PHOTO = (
    "01a0a1a2a3a4a5a6a7a8a9aaabb6b9b2a0122b9ee1c1a550091526130e82cf19059e3292bf2aec4d1f"
)
EXPECTED_LOCATION = (
    "01a0a1a2a3a4a5a6a7a8a9aaabb6b9b2a0122b9ee1c1a550094d872d9eb785078d21b9699a37fc1e43"
)
EXPECTED_FINGERPRINT = "DtOmq5V_9vWaljCkc9MafQ"


def hkdf(info: bytes) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=SALT, info=info).derive(SECRET)


def padme(length: int) -> int:
    if length < 2:
        return length
    exponent = length.bit_length() - 1
    exponent_bits = exponent.bit_length()
    mask = (1 << (exponent - exponent_bits)) - 1
    return (length + mask) & ~mask


def frame(data: bytes) -> bytes:
    total = padme(4 + len(data))
    return len(data).to_bytes(4, "big") + data + bytes(total - 4 - len(data))


def seal(plain: bytes, aad: bytes) -> str:
    cipher = AESGCM(hkdf(b"aes-gcm")).encrypt(IV, frame(plain), aad)
    return (bytes([1]) + IV + cipher).hex()


def check(name: str, actual: str, expected: str) -> bool:
    ok = actual == expected
    print(f"{'✔' if ok else '✖'} {name}: {actual}")
    return ok


results = [
    check("tag", "ps_" + hkdf(b"cloudinary-tag").hex(), EXPECTED_TAG),
    check("sealed entry", seal(b"Pis Stop", b"pis-stop/v1/entry"), EXPECTED_ENTRY),
    check("sealed photo", seal(b"Pis Stop", b"pis-stop/v1/photo/p1"), EXPECTED_PHOTO),
    check("sealed location", seal(b"Pis Stop", b"pis-stop/v1/location"), EXPECTED_LOCATION),
    check(
        "fingerprint",
        base64.urlsafe_b64encode(
            hashlib.sha256(bytes([4]) + bytes(range(1, 65))).digest()[:16]
        ).decode().rstrip("="),
        EXPECTED_FINGERPRINT,
    ),
    check(
        "padme",
        " ".join(str(padme(n)) for n in [0, 1, 4, 9, 12, 100, 1000, 1023, 1025, 65537, 1000000]),
        "0 1 4 10 12 104 1024 1024 1088 67584 1015808",
    ),
]
raise SystemExit(0 if all(results) else 1)
