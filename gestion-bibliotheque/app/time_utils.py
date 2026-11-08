from datetime import date, datetime

def today_iso() -> str:
    return date.today().isoformat()

def diff_days(date_from: str, date_to: str) -> int:
    d1 = datetime.strptime(date_from, "%Y-%m-%d").date()
    d2 = datetime.strptime(date_to, "%Y-%m-%d").date()
    return (d2 - d1).days

def add_days_iso(base_date: str, days: int) -> str:
    from datetime import timedelta
    d = datetime.strptime(base_date, "%Y-%m-%d").date()
    return (d + timedelta(days=days)).isoformat()
