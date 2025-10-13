from dataclasses import dataclass

@dataclass
class Settings:
    # data paths
    DATA_NODES_PATH: str = "data/nodes.csv"
    DATA_MATRIX_PATH: str = "data/time_matrix.csv"

    # fixed operational params (bisa kamu ubah kapan saja)
    DEPOT_ID: str = "0"
    VEHICLE_CAPACITY_LITERS: float = 5000.0
    ALLOW_REFILL: bool = True
    REFILL_SERVICE_MIN: float = 15.0

    # objective & penalties (tetap minimize waktu total; penalti opsional)
    LAMBDA_USE_MIN: float = 45.0  # penalti aktifkan kendaraan (menit ekv.)
    TIME_LIMIT_SEC: float = 15.0  # default batas waktu solver

settings = Settings()
