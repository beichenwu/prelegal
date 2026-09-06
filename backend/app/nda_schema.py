"""Partial field model for the Mutual NDA, used by the AI-chat extraction step.

This mirrors ``NdaFormValues`` in ``frontend/lib/mutualNda.ts``. The frontend
remains the source of truth for document assembly (``buildAgreement``) and final
validation; this model only needs to describe the fields well enough for the LLM
to extract them and for us to report what is still missing.

Every field is optional — extraction is incremental across a conversation.
"""

from typing import Literal

from pydantic import BaseModel, Field

MndaTermKind = Literal["years", "until_terminated"]
ConfidentialityTermKind = Literal["years", "perpetuity"]


class PartyFields(BaseModel):
    name: str | None = Field(None, description="Printed name of the signatory")
    title: str | None = Field(None, description="Signatory's job title (optional)")
    company: str | None = Field(None, description="Legal entity name of the party")
    noticeAddress: str | None = Field(
        None, description="Email or postal address for legal notices"
    )


class NdaFields(BaseModel):
    purpose: str | None = Field(
        None, description="Why the parties are sharing confidential information"
    )
    effectiveDate: str | None = Field(
        None, description="Date the NDA takes effect, as ISO yyyy-mm-dd"
    )
    mndaTermKind: MndaTermKind | None = Field(
        None,
        description="'years' if the NDA expires after a fixed number of years, "
        "'until_terminated' if it runs until a party ends it",
    )
    mndaTermYears: int | None = Field(
        None, description="Whole number of years for the NDA term (when mndaTermKind='years')"
    )
    confidentialityTermKind: ConfidentialityTermKind | None = Field(
        None,
        description="'years' for a fixed confidentiality period, 'perpetuity' for indefinite",
    )
    confidentialityTermYears: int | None = Field(
        None,
        description="Whole number of years confidentiality lasts "
        "(when confidentialityTermKind='years')",
    )
    governingLaw: str | None = Field(None, description="US state whose law governs the NDA")
    jurisdiction: str | None = Field(
        None, description="City or county and state whose courts have jurisdiction"
    )
    modifications: str | None = Field(
        None, description="Any changes to the standard terms; empty means none"
    )
    party1: PartyFields | None = None
    party2: PartyFields | None = None


def _party_missing(prefix: str, party: PartyFields | None) -> list[str]:
    if party is None:
        return [f"{prefix}.name", f"{prefix}.company", f"{prefix}.noticeAddress"]
    missing = []
    if not (party.name or "").strip():
        missing.append(f"{prefix}.name")
    if not (party.company or "").strip():
        missing.append(f"{prefix}.company")
    if not (party.noticeAddress or "").strip():
        missing.append(f"{prefix}.noticeAddress")
    return missing


def missing_required(fields: NdaFields) -> list[str]:
    """Field keys still needed before the draft can be generated.

    Mirrors ``validate()`` in ``frontend/lib/mutualNda.ts``.
    """
    missing: list[str] = []

    if not (fields.purpose or "").strip():
        missing.append("purpose")
    if not _is_iso_date(fields.effectiveDate):
        missing.append("effectiveDate")
    if not (fields.governingLaw or "").strip():
        missing.append("governingLaw")
    if not (fields.jurisdiction or "").strip():
        missing.append("jurisdiction")

    if fields.mndaTermKind == "years" and not _positive_int(fields.mndaTermYears):
        missing.append("mndaTermYears")
    if fields.confidentialityTermKind == "years" and not _positive_int(
        fields.confidentialityTermYears
    ):
        missing.append("confidentialityTermYears")

    missing += _party_missing("party1", fields.party1)
    missing += _party_missing("party2", fields.party2)
    return missing


def _is_iso_date(value: str | None) -> bool:
    if not value:
        return False
    parts = value.split("-")
    return (
        len(parts) == 3
        and len(parts[0]) == 4
        and all(p.isdigit() for p in parts)
        and len(parts[1]) == 2
        and len(parts[2]) == 2
    )


def _positive_int(value: int | None) -> bool:
    return isinstance(value, int) and value >= 1
