import unicodedata
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, service
from app.security import get_current_user, require_admin, LOAN_RULES

router = APIRouter()

def normalize_text(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", text.lower())
        if unicodedata.category(c) != "Mn"
    )

@router.get("/books", response_model=List[schemas.BookView])
def list_books(
    q: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    availableOnly: Optional[bool] = Query(False),
    db: Session = Depends(get_db),
    user: schemas.UserContext = Depends(get_current_user)
):
    query = db.query(models.Book)
    if category:
        query = query.filter(models.Book.category == category)
    books = query.all()

    book_views: List[schemas.BookView] = []
    normalized_q = normalize_text(q.strip()) if q else None

    for b in books:
        if normalized_q:
            haystack = normalize_text(f"{b.title} {b.author} {b.isbn}")
            if normalized_q not in haystack:
                continue
        view = service.to_book_view(db, b, user.id)
        if availableOnly and view.available <= 0:
            continue
        book_views.append(view)

    return book_views

@router.get("/books/{book_id}", response_model=schemas.BookView)
def get_book(
    book_id: str,
    db: Session = Depends(get_db),
    user: schemas.UserContext = Depends(get_current_user)
):
    book = service.get_book_by_id(db, book_id)
    return service.to_book_view(db, book, user.id)

@router.post("/books", response_model=schemas.BookOut, status_code=201)
def create_book(
    book_in: schemas.BookInput,
    db: Session = Depends(get_db),
    user: schemas.UserContext = Depends(get_current_user)
):
    require_admin(user)
    return service.create_book(db, book_in)

@router.post("/loans", response_model=schemas.LoanOut, status_code=201)
def borrow_book(
    payload: schemas.LoanCreate,
    db: Session = Depends(get_db),
    user: schemas.UserContext = Depends(get_current_user)
):
    return service.borrow_book(db, payload.bookId, user)

@router.get("/loans/me", response_model=schemas.MyLibrary)
def get_my_loans(
    db: Session = Depends(get_db),
    user: schemas.UserContext = Depends(get_current_user)
):
    raw_loans = db.query(models.Loan).filter(models.Loan.borrower_id == user.id).all()
    loans = [service.decorate_loan(db, l) for l in raw_loans]

    order_map = {"overdue": 0, "active": 1, "returned": 2}
    loans.sort(key=lambda l: (order_map[l.status], l.dueDate))

    my_reservations = db.query(models.Reservation).filter(models.Reservation.member_id == user.id).all()
    res_list: List[schemas.BookReservationOut] = []
    for r in my_reservations:
        book = service.get_book_by_id(db, r.book_id)
        queue = service.get_waiting_queue(db, r.book_id)
        position = [x.id for x in queue].index(r.id) + 1 if r.status == "waiting" and r in queue else None
        res_list.append(
            schemas.BookReservationOut(
                id=r.id,
                bookId=r.book_id,
                bookTitle=book.title,
                memberId=r.member_id,
                memberName=r.member_name,
                status=r.status, # type: ignore
                createdAt=r.created_at,
                position=position
            )
        )

    rule = LOAN_RULES.get(user.role, LOAN_RULES["student"])
    return schemas.MyLibrary(
        loans=loans,
        reservations=res_list,
        limit=rule["limit"]
    )

@router.put("/loans/{loan_id}/renew", response_model=schemas.LoanOut)
def renew_loan(
    loan_id: str,
    db: Session = Depends(get_db),
    user: schemas.UserContext = Depends(get_current_user)
):
    return service.renew_loan(db, loan_id, user)

@router.get("/loans", response_model=List[schemas.LoanOut])
def list_loans(
    db: Session = Depends(get_db),
    user: schemas.UserContext = Depends(get_current_user)
):
    require_admin(user)
    raw_loans = db.query(models.Loan).all()
    loans = [service.decorate_loan(db, l) for l in raw_loans]
    order_map = {"overdue": 0, "active": 1, "returned": 2}
    loans.sort(key=lambda l: (order_map[l.status], l.dueDate))
    return loans

@router.put("/loans/{loan_id}/return", response_model=schemas.LoanOut)
def return_loan(
    loan_id: str,
    db: Session = Depends(get_db),
    user: schemas.UserContext = Depends(get_current_user)
):
    require_admin(user)
    return service.return_loan(db, loan_id)

@router.post("/books/{book_id}/reservations", response_model=schemas.BookReservationOut, status_code=201)
def reserve_book(
    book_id: str,
    db: Session = Depends(get_db),
    user: schemas.UserContext = Depends(get_current_user)
):
    return service.reserve_book(db, book_id, user)

@router.delete("/reservations/{reservation_id}", status_code=204)
def cancel_reservation(
    reservation_id: str,
    db: Session = Depends(get_db),
    user: schemas.UserContext = Depends(get_current_user)
):
    service.cancel_reservation(db, reservation_id, user)
    return Response(status_code=204)
