from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

@dataclass
class SensorData:
    temperature: float
    humidity: float
    state: str
    aiclass: int = 0
    aiconfidence: int = 0
    alert: str = "NORMAL"
    msg: str = "Environment is optimal"
    level: str = "INFO"
    timestamp: Optional[datetime] = None

    def to_dict(self):
        return {
            "temperature": self.temperature,
            "humidity": self.humidity,
            "state": self.state,
            "aiclass": self.aiclass,
            "aiconfidence": self.aiconfidence,
            "alert": self.alert,
            "msg": self.msg,
            "level": self.level,
            "timestamp": self.timestamp or datetime.now(timezone.utc)
        }
