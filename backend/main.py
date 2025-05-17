from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

app = FastAPI()

# CORS stuff
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def init_db():
    conn = sqlite3.connect("attendees.db", timeout=10)
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS attendees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            role TEXT NOT NULL,
            unique_id TEXT UNIQUE NOT NULL,
            qr_code TEXT NOT NULL
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS attendee_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            attendee_id INTEGER NOT NULL,
            event_date TEXT NOT NULL,
            is_checked_in BOOLEAN DEFAULT 0,
            has_collected_kit BOOLEAN DEFAULT 0,
            has_collected_lunch BOOLEAN DEFAULT 0,
            registration_time TEXT,
            kit_collection_time TEXT,
            lunch_collection_time TEXT,
            UNIQUE(attendee_id, event_date),
            FOREIGN KEY(attendee_id) REFERENCES attendees(id)
        )
        """
    )
    conn.commit()
    conn.close()

init_db()

class Attendee(BaseModel):
    id: Optional[int] = None
    name: str
    email: str
    phone: str
    role: str
    unique_id: str
    qr_code: str
    is_checked_in: bool = False
    has_collected_kit: bool = False
    has_collected_lunch: bool = False
    registration_time: Optional[str] = None
    kit_collection_time: Optional[str] = None
    lunch_collection_time: Optional[str] = None

class AttendeeEvent(BaseModel):
    attendee_id: int
    event_date: str
    is_checked_in: bool = False
    has_collected_kit: bool = False
    has_collected_lunch: bool = False
    registration_time: Optional[str] = None
    kit_collection_time: Optional[str] = None
    lunch_collection_time: Optional[str] = None

@app.post("/attendees/", response_model=Attendee)
def create_attendee(attendee: Attendee):
    conn = sqlite3.connect("attendees.db", timeout=10)
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO attendees (name, email, phone, role, unique_id, qr_code, is_checked_in, has_collected_kit, has_collected_lunch)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                attendee.name,
                attendee.email,
                attendee.phone,
                attendee.role,
                attendee.unique_id,
                attendee.qr_code,
                attendee.is_checked_in,
                attendee.has_collected_kit,
                attendee.has_collected_lunch,
            ),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Unique ID already exists")
    finally:
        conn.close()
    return attendee

@app.get("/attendees/", response_model=List[Attendee])
def get_attendees():
    conn = sqlite3.connect("attendees.db", timeout=10)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM attendees")
    rows = cursor.fetchall()
    conn.close()
    attendees = [
        Attendee(
            id=row[0],  # Include the ID field
            name=row[1],
            email=row[2],
            phone=row[3],
            role=row[4],
            unique_id=row[5],
            qr_code=row[6],
            is_checked_in=bool(row[7]) if len(row) > 7 else False,
            has_collected_kit=bool(row[8]) if len(row) > 8 else False,
            has_collected_lunch=bool(row[9]) if len(row) > 9 else False,
            registration_time=row[10] if len(row) > 10 else None,
            kit_collection_time=row[11] if len(row) > 11 else None,
            lunch_collection_time=row[12] if len(row) > 12 else None,
        )
        for row in rows
    ]
    return attendees

@app.post("/attendee_events/", response_model=AttendeeEvent)
def create_attendee_event(event: AttendeeEvent):
    conn = sqlite3.connect("attendees.db", timeout=10)
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO attendee_events (attendee_id, event_date, is_checked_in, has_collected_kit, has_collected_lunch)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                event.attendee_id,
                event.event_date,
                event.is_checked_in,
                event.has_collected_kit,
                event.has_collected_lunch,
            ),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Event for attendee on this date already exists")
    finally:
        conn.close()
    return event

@app.put("/attendee_events/{attendee_id}/{event_date}/checkin")
def check_in_attendee_event(attendee_id: int, event_date: str):
    conn = sqlite3.connect("attendees.db", timeout=10)
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        """
        UPDATE attendee_events SET is_checked_in = 1, registration_time = ?
        WHERE attendee_id = ? AND event_date = ? AND is_checked_in = 0
        """,
        (now, attendee_id, event_date),
    )
    if cursor.rowcount == 0:
        raise HTTPException(status_code=400, detail="Attendee event not found or already checked in")
    conn.commit()
    conn.close()
    return {"message": "Attendee checked in for this day successfully"}

@app.put("/attendee_events/{attendee_id}/{event_date}/kit")
def collect_kit_event(attendee_id: int, event_date: str):
    conn = sqlite3.connect("attendees.db", timeout=10)
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        """
        UPDATE attendee_events SET has_collected_kit = 1, kit_collection_time = ?
        WHERE attendee_id = ? AND event_date = ? AND has_collected_kit = 0
        """,
        (now, attendee_id, event_date),
    )
    if cursor.rowcount == 0:
        raise HTTPException(status_code=400, detail="Attendee event not found or already collected kit")
    conn.commit()
    conn.close()
    return {"message": "Kit collected for this day successfully"}

@app.put("/attendee_events/{attendee_id}/{event_date}/lunch")
def collect_lunch_event(attendee_id: int, event_date: str):
    conn = sqlite3.connect("attendees.db", timeout=10)
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        """
        UPDATE attendee_events SET has_collected_lunch = 1, lunch_collection_time = ?
        WHERE attendee_id = ? AND event_date = ? AND has_collected_lunch = 0
        """,
        (now, attendee_id, event_date),
    )
    if cursor.rowcount == 0:
        raise HTTPException(status_code=400, detail="Attendee event not found or already collected lunch")
    conn.commit()
    conn.close()
    return {"message": "Lunch collected for this day successfully"}

@app.delete("/attendees/{unique_id}")
def delete_attendee(unique_id: str):
    conn = sqlite3.connect("attendees.db", timeout=10)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM attendees WHERE unique_id = ?", (unique_id,))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Attendee not found")
    conn.commit()
    conn.close()
    return {"message": "Attendee deleted successfully"}

@app.get("/attendee_events")
def get_attendee_events(event_date: str = None, attendee_id: int = None):
    conn = sqlite3.connect("attendees.db", timeout=10)
    cursor = conn.cursor()
    
    # Base query with join
    base_query = """
        SELECT ae.*, a.name, a.email, a.phone, a.role, a.unique_id, a.qr_code
        FROM attendee_events ae
        JOIN attendees a ON ae.attendee_id = a.id
    """
    
    params = []
    where_clauses = []
    
    if event_date:
        where_clauses.append("ae.event_date = ?")
        params.append(event_date)
    
    if attendee_id:
        where_clauses.append("ae.attendee_id = ?")
        params.append(attendee_id)
    
    if where_clauses:
        query = base_query + " WHERE " + " AND ".join(where_clauses)
    else:
        query = base_query
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        result.append({
            "id": row[0],
            "attendee_id": row[1],
            "event_date": row[2],
            "is_checked_in": bool(row[3]),
            "has_collected_kit": bool(row[4]),
            "has_collected_lunch": bool(row[5]),
            "registration_time": row[6],
            "kit_collection_time": row[7],
            "lunch_collection_time": row[8],
            "name": row[9],
            "email": row[10],
            "phone": row[11],
            "role": row[12],
            "unique_id": row[13],
            "qr_code": row[14]
        })
    
    return result
