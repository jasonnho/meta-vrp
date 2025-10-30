# backend/settings.py
from dataclasses import dataclass
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # project root: meta-vrp/

@dataclass
class Settings:
    # === data paths (ABSOLUTE) ===
    DATA_NODES_PATH: str = str(BASE_DIR / "data" / "nodes.csv")
    DATA_MATRIX_PATH: str = str(BASE_DIR / "data" / "time_matrix.csv")

    # === fixed operational params ===
    DEPOT_ID: str = "0"
    VEHICLE_CAPACITY_LITERS: float = 5000.0
    ALLOW_REFILL: bool = True
    REFILL_SERVICE_MIN: float = 12.0

    # === objective & penalties ===
    LAMBDA_USE_MIN: float = 45.0
    TIME_LIMIT_SEC: float = 60.0

    # === ALNS ===
    USE_ALNS: bool = True
    ALNS_TIME_FRAC: float = 0.5
    ALNS_LAMBDA_CAPACITY: float = 0.0

    ALNS_SEED: int = 42
    ALNS_INIT_TEMP: float = 2500.0
    ALNS_COOLING_RATE: float = 0.997
    ALNS_MIN_TEMP: float = 1e-3

    ALNS_K_REMOVE_MIN: int = 4
    ALNS_K_REMOVE_MAX: int = 12
    ALNS_SCORE_UPDATE_PERIOD: int = 30

    ALNS_TABU_TENURE: int = 30
    ALNS_USE_TABU_ON_REMOVED: bool = True
    ALNS_USE_CONSTRUCT_AS_REPAIR: bool = False

    IMPROVE_MAX_NO_IMPROVE: int = 1000


settings = Settings()
