"""Validation des images envoyees a l'agent (vision). On ne fait jamais confiance au type annonce."""
import base64
import binascii

MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED = {"image/jpeg", "image/png", "image/webp"}


class InvalidImageError(ValueError):
    pass


def _sniff(data: bytes) -> str | None:
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def decode_image(image_b64: str, declared_type: str) -> tuple[bytes, str]:
    if declared_type not in ALLOWED:
        raise InvalidImageError("Type d'image non supporte (jpeg, png ou webp)")
    if len(image_b64) > MAX_IMAGE_BYTES * 4 // 3 + 8:
        raise InvalidImageError("Image trop lourde (5 Mo maximum)")
    try:
        data = base64.b64decode(image_b64, validate=True)
    except (binascii.Error, ValueError):
        raise InvalidImageError("Image invalide") from None
    if len(data) > MAX_IMAGE_BYTES:
        raise InvalidImageError("Image trop lourde (5 Mo maximum)")
    real = _sniff(data)
    if real is None or real != declared_type:
        raise InvalidImageError("Le contenu ne correspond pas a une image du type annonce")
    return data, real
