from typing import Optional, List, Literal
from pydantic import BaseModel, Field, ConfigDict

BookCategory = Literal["Informatique", "Sciences", "Gestion", "Langues", "Littérature"]
ReservationStatus = Literal["waiting", "ready"]
LoanStatus = Literal["active", "overdue", "returned"]

class BookInput(BaseModel):
    title: str = Field(..., min_length=1)
    author: str = Field(..., min_length=1)
    isbn: str = Field(..., min_length=1)
    category: str
    year: int
    copies: int = Field(..., ge=1)
    description: str = Field(default="")

class BookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    author: str
    isbn: str
    category: str
    year: int
    copies: int
    description: str

class MyReservationView(BaseModel):
    id: str
    status: ReservationStatus
    position: Optional[int] = None

class BookView(BookOut):
    available: int
    waiting: int
    myLoanId: Optional[str] = None
    myReservation: Optional[MyReservationView] = None

class BookReservationOut(BaseModel):
    id: str
    bookId: str
    bookTitle: str
    memberId: str
    memberName: str
    status: ReservationStatus
    createdAt: str
    position: Optional[int] = None

class LoanCreate(BaseModel):
    bookId: str

class LoanOut(BaseModel):
    id: str
    bookId: str
    bookTitle: str
    bookAuthor: str
    borrowerId: str
    borrowerName: str
    borrowerRole: str
    borrowedAt: str
    dueDate: str
    returnedAt: Optional[str] = None
    renewals: int
    status: LoanStatus
    daysLate: int

class MyLibrary(BaseModel):
    loans: List[LoanOut]
    reservations: List[BookReservationOut]
    limit: int

class UserContext(BaseModel):
    id: str
    name: str
    role: str
