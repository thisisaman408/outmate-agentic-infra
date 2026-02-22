import re
from typing import Iterable, List


def sanitize_email_values(values: Iterable[str]) -> List[str]:
    sanitized: List[str] = []
    for value in values:
        if not isinstance(value, str):
            continue
        email = value.strip()
        if not email:
            continue
        low = email.lower()
        if "@" not in low:
            continue
        local_part, _, domain_part = low.partition("@")
        if not local_part or not domain_part:
            continue
        if low.endswith("@example.com") or "test@" in low:
            continue
        if re.fullmatch(r"email\d+", local_part):
            continue
        if re.fullmatch(r"(test|demo|sample)\d*", local_part):
            continue
        if domain_part == "gmail.com" and (
            re.fullmatch(r"email\d+", local_part) or re.fullmatch(r"test\d*", local_part)
        ):
            continue
        sanitized.append(email)
    return sanitized


def sanitize_phone_values(values: Iterable[str]) -> List[str]:
    sanitized: List[str] = []
    for value in values:
        if not isinstance(value, str):
            continue
        phone = value.strip()
        if not phone:
            continue
        low = phone.lower()
        if "phone number" in low:
            continue
        digits = re.sub(r"\D", "", phone)
        if len(digits) < 6:
            continue
        sanitized.append(phone)
    return sanitized
