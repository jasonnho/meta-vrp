# backend/routers/parks.py
from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from database import get_db

router = APIRouter(prefix="/parks", tags=["parks"])

@router.post("/")
async def create_park(park: dict):
    coords = park.get("coordinates", [])
    if len(coords) < 3:
        raise HTTPException(status_code=400, detail="Minimal 3 titik untuk polygon")

    # Buat WKT: POLYGON((lat1 lng1, lat2 lng2, ...))
    points = ", ".join(f"{lat} {lng}" for lat, lng in coords)
    wkt = f"POLYGON(({points}))"

    query = text("""
        INSERT INTO parks (name, geom)
        VALUES (:name, ST_GeomFromText(:wkt, 4326))
        RETURNING id, ST_AsGeoJSON(geom)::jsonb as geom
    """)

    db = next(get_db())
    try:
        result = db.execute(query, {"name": park.get("name", "Taman"), "wkt": wkt}).fetchone()
        if not result:
            raise HTTPException(status_code=500, detail="Gagal menyimpan taman")
        db.commit()
        return {
            "id": result.id,
            "coordinates": result.geom["coordinates"][0]
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error DB: {str(e)}")

@router.get("/")
async def get_parks():
    query = text("SELECT id, ST_AsGeoJSON(geom)::jsonb as geom FROM parks")
    db = next(get_db())
    try:
        results = db.execute(query).fetchall()
        return [
            {"id": r.id, "coordinates": r.geom["coordinates"][0]}
            for r in results
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error baca DB: {str(e)}")
