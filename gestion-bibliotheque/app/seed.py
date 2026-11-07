from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app import models

def seed_database(db: Session = None):
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True
    try:
        if db.query(models.Book).first():
            return  # Déjà initialisé

        books_data = [
            models.Book(
                id="b1",
                title="Building Microservices",
                author="Sam Newman",
                category="Informatique",
                year=2021,
                isbn="978-1492034025",
                copies=3,
                description="Concevoir, découper et faire évoluer des systèmes distribués : le guide de référence sur l'architecture microservices."
            ),
            models.Book(
                id="b2",
                title="Clean Architecture",
                author="Robert C. Martin",
                category="Informatique",
                year=2017,
                isbn="978-0134494166",
                copies=2,
                description="Les principes d'une architecture logicielle maintenable, indépendante des frameworks et des bases de données."
            ),
            models.Book(
                id="b3",
                title="Designing Data-Intensive Applications",
                author="Martin Kleppmann",
                category="Informatique",
                year=2017,
                isbn="978-1449373320",
                copies=2,
                description="Fiabilité, passage à l'échelle et maintenabilité des systèmes de données modernes."
            ),
            models.Book(
                id="b4",
                title="Introduction aux probabilités",
                author="Sheldon Ross",
                category="Sciences",
                year=2014,
                isbn="978-2889150069",
                copies=4,
                description="Cours complet de probabilités avec de nombreux exercices corrigés."
            ),
            models.Book(
                id="b5",
                title="Algorithmique",
                author="Thomas H. Cormen",
                category="Informatique",
                year=2010,
                isbn="978-2100545261",
                copies=3,
                description="Une introduction complète aux algorithmes et à leur analyse."
            ),
            models.Book(
                id="b6",
                title="Le Marketing numérique",
                author="Philip Kotler",
                category="Gestion",
                year=2019,
                isbn="978-2744066443",
                copies=2,
                description="Stratégies de marque, données clients et plateformes à l'ère du numérique."
            ),
            models.Book(
                id="b7",
                title="English for Information Technology",
                author="Maja Olejniczak",
                category="Langues",
                year=2012,
                isbn="978-1408269930",
                copies=5,
                description="Vocabulaire et communication professionnelle en anglais pour l'informatique."
            ),
            models.Book(
                id="b8",
                title="L'Étranger",
                author="Albert Camus",
                category="Littérature",
                year=1942,
                isbn="978-2070360024",
                copies=4,
                description="Le roman emblématique d'Albert Camus."
            ),
            models.Book(
                id="b9",
                title="Les Misérables",
                author="Victor Hugo",
                category="Littérature",
                year=1862,
                isbn="978-2070409228",
                copies=2,
                description="La grande fresque de Victor Hugo sur la misère et la justice."
            ),
            models.Book(
                id="b10",
                title="Physique générale",
                author="Douglas Giancoli",
                category="Sciences",
                year=2018,
                isbn="978-2807308526",
                copies=3,
                description="Mécanique, ondes, électricité et optique, avec des applications concrètes."
            ),
            models.Book(
                id="b11",
                title="Refactoring",
                author="Martin Fowler",
                category="Informatique",
                year=2018,
                isbn="978-0134757599",
                copies=2,
                description="Améliorer la conception d'un code existant par petites étapes sûres."
            ),
            models.Book(
                id="b12",
                title="Gestion de projet agile",
                author="Jim Highsmith",
                category="Gestion",
                year=2009,
                isbn="978-0321658395",
                copies=3,
                description="Piloter un projet avec Scrum, Kanban et les méthodes agiles."
            ),
        ]
        db.add_all(books_data)

        # Utilisateurs démo
        now = datetime.now()
        def d_str(days_delta: int) -> str:
            return (now + timedelta(days=days_delta)).strftime("%Y-%m-%d")

        loans_data = [
            # Yasmine Ben Salah
            models.Loan(
                id="l-1",
                book_id="b1",
                borrower_id="ETU-2024-0187",
                borrower_name="Yasmine Ben Salah",
                borrower_role="student",
                borrowed_at=d_str(-9),
                due_date=d_str(5),
                renewals=0
            ),
            models.Loan(
                id="l-2",
                book_id="b5",
                borrower_id="ETU-2024-0187",
                borrower_name="Yasmine Ben Salah",
                borrower_role="student",
                borrowed_at=d_str(-13),
                due_date=d_str(1),
                renewals=0
            ),
            models.Loan(
                id="l-3",
                book_id="b8",
                borrower_id="ETU-2024-0187",
                borrower_name="Yasmine Ben Salah",
                borrower_role="student",
                borrowed_at=d_str(-60),
                due_date=d_str(-46),
                returned_at=d_str(-48),
                renewals=0
            ),
            # Clean Architecture : 2 exemplaires sortis dont un en retard
            models.Loan(
                id="l-4",
                book_id="b2",
                borrower_id="ETU-2024-0211",
                borrower_name="Amine Khelifi",
                borrower_role="student",
                borrowed_at=d_str(-20),
                due_date=d_str(-6),
                renewals=0
            ),
            models.Loan(
                id="l-5",
                book_id="b2",
                borrower_id="ETU-2023-0644",
                borrower_name="Omar Dridi",
                borrower_role="student",
                borrowed_at=d_str(-5),
                due_date=d_str(9),
                renewals=0
            ),
            # Karim Trabelsi (Enseignant)
            models.Loan(
                id="l-6",
                book_id="b3",
                borrower_id="ENS-0042",
                borrower_name="Karim Trabelsi",
                borrower_role="teacher",
                borrowed_at=d_str(-10),
                due_date=d_str(20),
                renewals=0
            ),
            # Inès Bouzid
            models.Loan(
                id="l-7",
                book_id="b4",
                borrower_id="ETU-2024-0302",
                borrower_name="Inès Bouzid",
                borrower_role="student",
                borrowed_at=d_str(-3),
                due_date=d_str(11),
                renewals=0
            ),
            # Rim Zouari
            models.Loan(
                id="l-8",
                book_id="b7",
                borrower_id="ETU-2025-0019",
                borrower_name="Rim Zouari",
                borrower_role="student",
                borrowed_at=d_str(-7),
                due_date=d_str(7),
                renewals=0
            ),
            models.Loan(
                id="l-9",
                book_id="b10",
                borrower_id="ETU-2025-0019",
                borrower_name="Rim Zouari",
                borrower_role="student",
                borrowed_at=d_str(-40),
                due_date=d_str(-26),
                returned_at=d_str(-24),
                renewals=0
            ),
        ]
        db.add_all(loans_data)

        # Réservations initiales
        res_data = [
            models.Reservation(
                id="r-1",
                book_id="b2",
                member_id="ETU-2025-0019",
                member_name="Rim Zouari",
                status="waiting",
                created_at=(now - timedelta(days=4)).isoformat() + "Z"
            ),
            models.Reservation(
                id="r-2",
                book_id="b2",
                member_id="ETU-2024-0187",
                member_name="Yasmine Ben Salah",
                status="waiting",
                created_at=(now - timedelta(days=1)).isoformat() + "Z"
            ),
        ]
        db.add_all(res_data)

        db.commit()
    finally:
        if should_close:
            db.close()
