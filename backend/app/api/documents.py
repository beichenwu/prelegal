"""Saved documents — owner-scoped CRUD."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import CurrentUser
from app.db import get_session
from app.models import Document
from app.schemas import DocumentIn, DocumentOut, DocumentSummary

router = APIRouter(prefix="/api/documents", tags=["documents"])

SessionDep = Annotated[Session, Depends(get_session)]


def _owned(document_id: int, user_id: int, session: Session) -> Document:
    doc = session.get(Document, document_id)
    if doc is None or doc.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return doc


@router.get("", response_model=list[DocumentSummary])
def list_documents(user: CurrentUser, session: SessionDep) -> list[Document]:
    return list(
        session.execute(
            select(Document)
            .where(Document.user_id == user.id)
            .order_by(Document.updated_at.desc())
        ).scalars()
    )


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_document(
    body: DocumentIn, user: CurrentUser, session: SessionDep
) -> Document:
    doc = Document(
        user_id=user.id,
        slug=body.slug,
        title=body.title,
        values=body.values,
        markdown=body.markdown,
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)
    return doc


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: int, user: CurrentUser, session: SessionDep
) -> Document:
    return _owned(document_id, user.id, session)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int, user: CurrentUser, session: SessionDep
) -> None:
    session.delete(_owned(document_id, user.id, session))
    session.commit()
