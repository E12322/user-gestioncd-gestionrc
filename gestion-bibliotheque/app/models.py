from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
from app.database import Base

class Book(Base):
    __tablename__ = "books"

    id = Column(String(50), primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    author = Column(String(255), nullable=False, index=True)
    isbn = Column(String(50), unique=True, nullable=False, index=True)
    category = Column(String(100), nullable=False, index=True)
    year = Column(Integer, nullable=False)
    description = Column(Text, nullable=False)
    copies = Column(Integer, nullable=False, default=1)

class Loan(Base):
    __tablename__ = "loans"

    id = Column(String(50), primary_key=True, index=True)
    book_id = Column(String(50), nullable=False, index=True)
    borrower_id = Column(String(50), nullable=False, index=True)
    borrower_name = Column(String(255), nullable=False)
    borrower_role = Column(String(50), nullable=False)
    borrowed_at = Column(String(20), nullable=False)  # "YYYY-MM-DD"
    due_date = Column(String(20), nullable=False)     # "YYYY-MM-DD"
    returned_at = Column(String(20), nullable=True)   # "YYYY-MM-DD"
    renewals = Column(Integer, default=0, nullable=False)

class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(String(50), primary_key=True, index=True)
    book_id = Column(String(50), nullable=False, index=True)
    member_id = Column(String(50), nullable=False, index=True)
    member_name = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="waiting")  # "waiting" | "ready"
    created_at = Column(String(50), nullable=False, default=lambda: datetime.utcnow().isoformat() + "Z")
