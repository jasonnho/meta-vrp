from dataclasses import dataclass


@dataclass
class Settings:
    # === data paths ===
    DATA_NODES_PATH: str = "data/nodes.csv"
    DATA_MATRIX_PATH: str = "data/time_matrix.csv"

    # === fixed operational params ===
    DEPOT_ID: str = "0"
    VEHICLE_CAPACITY_LITERS: float = 5000.0
    ALLOW_REFILL: bool = True
    REFILL_SERVICE_MIN: float = 15.0

    # === objective & penalties ===
    LAMBDA_USE_MIN: float = 45.0  # penalti aktivasi kendaraan (menit ekv.)
    TIME_LIMIT_SEC: float = 30.0  # total waktu solver (construct+ALNS+improve)

    # === ALNS master switch & tuning ===
    USE_ALNS: bool = True  # aktifkan / matikan ALNS
    ALNS_TIME_FRAC: float = 0.7  # proporsi waktu total utk ALNS (sisanya improve)
    ALNS_LAMBDA_CAPACITY: float = 0.0  # penalti overload kapasitas (0 = off)

    # SA / acceptance params
    ALNS_SEED: int = 42
    ALNS_INIT_TEMP: float = 1000.0
    ALNS_COOLING_RATE: float = 0.995
    ALNS_MIN_TEMP: float = 1e-3

    # destroy / repair operators
    ALNS_K_REMOVE_MIN: int = 2
    ALNS_K_REMOVE_MAX: int = 8
    ALNS_SCORE_UPDATE_PERIOD: int = 25

    # tabu settings
    ALNS_TABU_TENURE: int = 20
    ALNS_USE_TABU_ON_REMOVED: bool = True

    # optional repair strategy
    ALNS_USE_CONSTRUCT_AS_REPAIR: bool = (
        False  # True = pakai greedy_construct utk repair
    )


settings = Settings()
