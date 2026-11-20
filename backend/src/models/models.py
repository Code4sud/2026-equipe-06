from datetime import datetime, timezone
from typing import Annotated, Any, Self

from pydantic import (
    AfterValidator,
    BaseModel,
    EmailStr,
    Field,
    field_validator,
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


UtcDatetime = Annotated[datetime, AfterValidator(_to_utc)]


class DbModel(BaseModel):
    id: str | None = None

    def to_document(self) -> dict[str, Any]:
        return self.model_dump(exclude={"id"})

    @classmethod
    def from_document(cls, doc: dict[str, Any]) -> Self:
        return cls.model_validate(doc)


class User(DbModel):
    email: EmailStr
    created_at: UtcDatetime = Field(default_factory=utcnow)


class AuthCode(DbModel):
    email: EmailStr
    code_hash: str
    expires_at: UtcDatetime
    attempts: int = 0
    created_at: UtcDatetime = Field(default_factory=utcnow)


class EmailPayload(BaseModel):
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def _normalize(cls, value: Any) -> Any:
        return value.strip().lower() if isinstance(value, str) else value


class CodeRequest(EmailPayload):
    pass


class VerifyRequest(EmailPayload):
    code: str = Field(pattern=r"^\d{6}$")


class PublicUser(BaseModel):
    id: str
    email: EmailStr
