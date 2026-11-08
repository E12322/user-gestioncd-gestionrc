import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.seed import seed_database
from app import models

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_database(db)
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    # Pass raise_server_exceptions=True
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()

def test_health_check(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "UP", "service": "library-service"}

def test_list_books(client):
    res = client.get("/books", headers={"X-User-Id": "ETU-2024-0187", "X-User-Role": "student"})
    assert res.status_code == 200
    books = res.json()
    assert len(books) >= 12
    # Check b1 fields
    b1 = next(b for b in books if b["id"] == "b1")
    assert b1["title"] == "Building Microservices"
    assert "available" in b1
    assert "waiting" in b1
    assert b1["myLoanId"] == "l-1"

def test_get_book(client):
    res = client.get("/books/b1", headers={"X-User-Id": "ETU-2024-0187", "X-User-Role": "student"})
    assert res.status_code == 200
    book = res.json()
    assert book["id"] == "b1"
    assert book["copies"] == 3

def test_borrow_unavailable_book_fails(client):
    # b2 has 2 copies and both are on loan -> unavailable
    res = client.post(
        "/loans",
        json={"bookId": "b2"},
        headers={"X-User-Id": "ETU-NEW", "X-User-Role": "student", "X-User-Name": "Nouveau Lecteur"}
    )
    assert res.status_code == 409
    assert res.json()["detail"]["code"] == "BOOK_UNAVAILABLE"

def test_reserve_book_success(client):
    # b2 can be reserved because available == 0
    res = client.post(
        "/books/b2/reservations",
        headers={"X-User-Id": "ETU-NEW", "X-User-Role": "student", "X-User-Name": "Nouveau Lecteur"}
    )
    assert res.status_code == 201
    res_data = res.json()
    assert res_data["bookId"] == "b2"
    assert res_data["status"] == "waiting"
    assert res_data["position"] == 3  # After Rim (1) and Yasmine (2)

def test_renew_loan(client):
    # l-1 is active, borrower is Yasmine
    res = client.put(
        "/loans/l-1/renew",
        headers={"X-User-Id": "ETU-2024-0187", "X-User-Role": "student", "X-User-Name": "Yasmine Ben Salah"}
    )
    assert res.status_code == 200
    loan = res.json()
    assert loan["renewals"] == 1

def test_return_loan_and_trigger_reservation(client):
    # b2 has loans l-4 and l-5, and reservation r-1 waiting
    res = client.put(
        "/loans/l-4/return",
        headers={"X-User-Id": "ADMIN-1", "X-User-Role": "admin"}
    )
    assert res.status_code == 200
    loan = res.json()
    assert loan["status"] == "returned"

    # Now verify r-1 became ready
    my_lib = client.get("/loans/me", headers={"X-User-Id": "ETU-2025-0019", "X-User-Role": "student"}).json()
    r1 = next(r for r in my_lib["reservations"] if r["id"] == "r-1")
    assert r1["status"] == "ready"
