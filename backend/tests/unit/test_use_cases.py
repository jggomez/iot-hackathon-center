import pytest
from unittest.mock import MagicMock
from src.application.use_cases import StoreSensorDataUseCase
from src.domain.repositories import SensorRepository
from src.domain.entities import SensorData

def test_store_sensor_data_use_case_success():
    # Arrange
    mock_repository = MagicMock(spec=SensorRepository)
    use_case = StoreSensorDataUseCase(mock_repository)
    
    temperature = 25.5
    humidity = 60.0
    state = "active"
    aiclass = 1
    aiconfidence = 95
    
    # Act
    result = use_case.execute(temperature, humidity, state, aiclass, aiconfidence)
    
    # Assert
    assert isinstance(result, SensorData)
    assert result.temperature == temperature
    assert result.humidity == humidity
    assert result.state == state
    assert result.aiclass == aiclass
    assert result.aiconfidence == aiconfidence
    assert result.timestamp is not None
    mock_repository.save.assert_called_once()
