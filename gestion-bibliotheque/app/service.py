import re
import uuid
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.time_utils import today_iso, diff_days, add_days_iso
from app.security import LOAN_RULES, MAX_RENEWALS
from app.events import publish_domain_event

def get_book_by_id(db: Session, book_id: str) -> models.Book:
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Ouvrage introuvable")
    return book

def get_active_loans(db: Session, book_id: Optional[str] = None) -> List[models.Loan]:
    q = db.query(models.Loan).filter(models.Loan.returned_at.is_(None))
    if book_id:
        q = q.filter(models.Loan.book_id == book_id)
    return q.all()

def get_waiting_queue(db: Session, book_id: str) -> List[models.Reservation]:
    return (
        db.query(models.Reservation)
        .filter(models.Reservation.book_id == book_id, models.Reservation.status == "waiting")
        .order_by(models.Reservation.created_at.asc())
        .all()
    )

def get_held_count(db: Session, book_id: str) -> int:
    return (
        db.query(models.Reservation)
        .filter(models.Reservation.book_id == book_id, models.Reservation.status == "ready")
        .count()
    )

def calculate_available_copies(db: Session, book: models.Book) -> int:
    active_count = len(get_active_loans(db, book.id))
    held_count = get_held_count(db, book.id)
    return max(0, book.copies - active_count - held_count)

def decorate_loan(db: Session, loan: models.Loan) -> schemas.LoanOut:
    book = get_book_by_id(db, loan.book_id)
    today = today_iso()
    if loan.returned_at:
        status: schemas.LoanStatus = "returned"
        days_late = max(0, diff_days(loan.due_date, loan.returned_at))
    elif loan.due_date < today:
        status = "overdue"
        days_late = diff_days(loan.due_date, today)
    else:
        status = "active"
        days_late = 0

    return schemas.LoanOut(
        id=loan.id,
        bookId=loan.book_id,
        bookTitle=book.title,
        bookAuthor=book.author,
        borrowerId=loan.borrower_id,
        borrowerName=loan.borrower_name,
        borrowerRole=loan.borrower_role,
        borrowedAt=loan.borrowed_at,
        dueDate=loan.due_date,
        returnedAt=loan.returned_at,
        renewals=loan.renewals,
        status=status,
        daysLate=days_late
    )

def to_book_view(db: Session, book: models.Book, viewer_id: str) -> schemas.BookView:
    active_loans = get_active_loans(db, book.id)
    my_loan = next((l for l in active_loans if l.borrower_id == viewer_id), None)

    my_reservation = (
        db.query(models.Reservation)
        .filter(models.Reservation.book_id == book.id, models.Reservation.member_id == viewer_id)
        .first()
    )

    queue = get_waiting_queue(db, book.id)

    res_view = None
    if my_reservation:
        position = None
        if my_reservation.status == "waiting":
            try:
                position = [r.id for r in queue].index(my_reservation.id) + 1
            except ValueError:
                position = 1
        res_view = schemas.MyReservationView(
            id=my_reservation.id,
            status=my_reservation.status, # type: ignore
            position=position
        )

    return schemas.BookView(
        id=book.id,
        title=book.title,
        author=book.author,
        isbn=book.isbn,
        category=book.category,
        year=book.year,
        copies=book.copies,
        description=book.description,
        available=calculate_available_copies(db, book),
        waiting=len(queue),
        myLoanId=my_loan.id if my_loan else None,
        myReservation=res_view
    )

def create_book(db: Session, book_in: schemas.BookInput) -> models.Book:
    digits = re.sub(r"\D", "", book_in.isbn)
    existing = db.query(models.Book).all()
    for b in existing:
        if re.sub(r"\D", "", b.isbn) == digits:
            raise HTTPException(
                status_code=409,
                detail={"message": "Cet ISBN existe déjà dans le catalogue", "code": "ISBN_EXISTS", "conflicts": [f"{b.title} — {b.isbn}"]}
            )

    new_id = f"b{uuid.uuid4().hex[:6]}"
    book = models.Book(
        id=new_id,
        title=book_in.title.strip(),
        author=book_in.author.strip(),
        isbn=book_in.isbn.strip(),
        category=book_in.category,
        year=book_in.year,
        copies=book_in.copies,
        description=book_in.description.strip(),
    )
    db.add(book)
    db.commit()
    db.refresh(book)
    return book

def borrow_book(db: Session, book_id: str, user: schemas.UserContext) -> schemas.LoanOut:
    book = get_book_by_id(db, book_id)

    # Vérification: l'utilisateur a-t-il déjà un prêt en cours pour ce livre ?
    my_active_loans = db.query(models.Loan).filter(
        models.Loan.borrower_id == user.id,
        models.Loan.returned_at.is_(None)
    ).all()

    if any(l.book_id == book_id for l in my_active_loans):
        raise HTTPException(
            status_code=409,
            detail={"message": "Vous avez déjà un prêt en cours pour cet ouvrage", "code": "ALREADY_BORROWED"}
        )

    # Vérification des prêts en retard
    today = today_iso()
    overdue_loans = [l for l in my_active_loans if l.due_date < today]
    if overdue_loans:
        conflicts = [f"{get_book_by_id(db, l.book_id).title} — à rendre depuis le {l.due_date}" for l in overdue_loans]
        raise HTTPException(
            status_code=409,
            detail={"message": "Vous devez retourner vos prêts en retard avant d'emprunter", "code": "HAS_OVERDUE", "conflicts": conflicts}
        )

    # Plafond selon le rôle
    rule = LOAN_RULES.get(user.role, LOAN_RULES["student"])
    if len(my_active_loans) >= rule["limit"]:
        raise HTTPException(
            status_code=409,
            detail={"message": f"Plafond de {rule['limit']} prêts simultanés atteint", "code": "LOAN_LIMIT"}
        )

    # Vérification réservation prête
    my_reservation = db.query(models.Reservation).filter(
        models.Reservation.book_id == book_id,
        models.Reservation.member_id == user.id
    ).first()

    available = calculate_available_copies(db, book)
    if available <= 0 and not (my_reservation and my_reservation.status == "ready"):
        raise HTTPException(
            status_code=409,
            detail={"message": "Aucun exemplaire disponible", "code": "BOOK_UNAVAILABLE"}
        )

    # Consommation de la réservation si présente
    if my_reservation:
        db.delete(my_reservation)

    due_date = add_days_iso(today, rule["days"])
    new_loan = models.Loan(
        id=f"l-{uuid.uuid4().hex[:6]}",
        book_id=book.id,
        borrower_id=user.id,
        borrower_name=user.name,
        borrower_role=user.role,
        borrowed_at=today,
        due_date=due_date,
        renewals=0
    )
    db.add(new_loan)
    db.commit()
    db.refresh(new_loan)

    publish_domain_event("LivreEmprunté", f"{user.name} — {book.title}")
    return decorate_loan(db, new_loan)

def renew_loan(db: Session, loan_id: str, user: schemas.UserContext) -> schemas.LoanOut:
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Prêt introuvable")

    if loan.borrower_id != user.id:
        raise HTTPException(status_code=403, detail="Ce prêt n'est pas le vôtre")

    if loan.returned_at:
        raise HTTPException(
            status_code=409,
            detail={"message": "Ce prêt est déjà terminé", "code": "ALREADY_RETURNED"}
        )

    today = today_iso()
    if loan.due_date < today:
        book = get_book_by_id(db, loan.book_id)
        raise HTTPException(
            status_code=409,
            detail={"message": "Un prêt en retard ne peut pas être prolongé", "code": "OVERDUE", "conflicts": [f"{book.title} — à rendre depuis le {loan.due_date}"]}
        )

    if loan.renewals >= MAX_RENEWALS:
        raise HTTPException(
            status_code=409,
            detail={"message": f"Prolongation limitée à {MAX_RENEWALS} fois", "code": "RENEWAL_LIMIT"}
        )

    queue = get_waiting_queue(db, loan.book_id)
    if queue:
        book = get_book_by_id(db, loan.book_id)
        raise HTTPException(
            status_code=409,
            detail={"message": "Cet ouvrage est réservé par un autre lecteur", "code": "BOOK_RESERVED", "conflicts": [f"{book.title} — {len(queue)} réservation(s) en attente"]}
        )

    rule = LOAN_RULES.get(user.role, LOAN_RULES["student"])
    loan.due_date = add_days_iso(loan.due_date, rule["days"])
    loan.renewals += 1
    db.commit()
    db.refresh(loan)

    return decorate_loan(db, loan)

def return_loan(db: Session, loan_id: str) -> schemas.LoanOut:
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Prêt introuvable")

    if loan.returned_at:
        raise HTTPException(
            status_code=409,
            detail={"message": "Ce prêt est déjà rendu", "code": "ALREADY_RETURNED"}
        )

    loan.returned_at = today_iso()

    # Si une réservation est en attente, elle passe en "ready"
    queue = get_waiting_queue(db, loan.book_id)
    next_res = queue[0] if queue else None
    if next_res:
        next_res.status = "ready"

    db.commit()
    db.refresh(loan)

    book = get_book_by_id(db, loan.book_id)
    if next_res:
        publish_domain_event("LivreRetourné", f"{book.title} — réservé pour {next_res.member_name}")
    else:
        publish_domain_event("LivreRetourné", f"{loan.borrower_name} — {book.title}")

    return decorate_loan(db, loan)

def reserve_book(db: Session, book_id: str, user: schemas.UserContext) -> schemas.BookReservationOut:
    book = get_book_by_id(db, book_id)

    # L'utilisateur a-t-il déjà emprunté ce livre ?
    active_loans = get_active_loans(db, book_id)
    if any(l.borrower_id == user.id for l in active_loans):
        raise HTTPException(
            status_code=409,
            detail={"message": "Vous avez déjà emprunté cet ouvrage", "code": "ALREADY_BORROWED"}
        )

    # A-t-il déjà réservé cet ouvrage ?
    existing_res = db.query(models.Reservation).filter(
        models.Reservation.book_id == book_id,
        models.Reservation.member_id == user.id
    ).first()
    if existing_res:
        raise HTTPException(
            status_code=409,
            detail={"message": "Vous avez déjà réservé cet ouvrage", "code": "ALREADY_RESERVED"}
        )

    # Y a-t-il un exemplaire disponible ?
    if calculate_available_copies(db, book) > 0:
        raise HTTPException(
            status_code=409,
            detail={"message": "Un exemplaire est disponible : empruntez-le directement", "code": "BOOK_AVAILABLE"}
        )

    new_res = models.Reservation(
        id=f"r-{uuid.uuid4().hex[:6]}",
        book_id=book_id,
        member_id=user.id,
        member_name=user.name,
        status="waiting",
        created_at=today_iso() + "T12:00:00Z"
    )
    db.add(new_res)
    db.commit()
    db.refresh(new_res)

    queue = get_waiting_queue(db, book_id)
    position = [r.id for r in queue].index(new_res.id) + 1 if new_res in queue else 1

    return schemas.BookReservationOut(
        id=new_res.id,
        bookId=new_res.book_id,
        bookTitle=book.title,
        memberId=new_res.member_id,
        memberName=new_res.member_name,
        status=new_res.status, # type: ignore
        createdAt=new_res.created_at,
        position=position
    )

def cancel_reservation(db: Session, res_id: str, user: schemas.UserContext) -> None:
    res = db.query(models.Reservation).filter(models.Reservation.id == res_id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Réservation introuvable")

    if res.member_id != user.id:
        raise HTTPException(status_code=403, detail="Cette réservation n'est pas la vôtre")

    book_id = res.book_id
    was_ready = (res.status == "ready")

    db.delete(res)
    db.commit()

    if was_ready:
        queue = get_waiting_queue(db, book_id)
        if queue:
            queue[0].status = "ready"
            db.commit()
