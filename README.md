# IoT Hackathon Center: Intelligent Acoustic Inference & Environmental Safety System

## a. Abstract
This research and development project presents an end-to-end **Industrial IoT (IIoT)** ecosystem designed to solve the challenges of large-scale indoor event management. The system integrates **Edge Artificial Intelligence** for acoustic scene classification with real-time environmental telemetry to mitigate risks such as thermal stress and overcrowding. By deploying a custom **Long Short-Term Memory (LSTM)** neural network onto **ESP32** microcontrollers using **TensorFlow Lite Micro**, we achieve local inference with low power consumption and high privacy. The data is orchestrated through an asynchronous cloud architecture involving **MQTT**, **GCP Pub/Sub**, and **Cloud Run**, culminating in a high-fidelity reactive dashboard that provides sub-second latency for critical safety decision-making.

## b. Keywords
Edge AI, TinyML, ESP32, LSTM Recurrent Neural Networks, Acoustic Scene Classification (ASC), Thermal Stress, Heat Index, IIoT, Google Cloud Platform, Firebase Firestore, MQTT, Real-Time Analytics.

## c. Introduction
Managing high-density indoor environments, such as Hackathons, involves monitoring complex variables. Traditional systems rely solely on temperature/humidity, ignoring the "activity context" and the non-linear relationship between humidity and human health.

### The Problem
1.  **Context Blindness**: Knowing a room is at 25°C doesn't tell if it's a quiet study session or a high-energy keynote.
2.  **Thermal Stress**: In crowded spaces, the human body acts as a 100W radiator and a humidifier. High humidity prevents sweat evaporation, leading to "thermal stress by overcrowding," causing dizziness or heat stroke.
3.  **Privacy Concerns**: Streaming raw audio to the cloud for analysis is a major privacy violation and consumes excessive bandwidth.

### The Solution: "Intelligence at the Edge"
This project proposes a "Local Inference, Global Monitoring" model. The ESP32 processes audio internally, extracting features and running deep learning models locally. Only the result (the class ID) is sent to the cloud, ensuring total participant privacy and extreme data efficiency.

---

## d. System Architecture (Technical Deep Dive)

The system is built on a decoupled, event-driven microservices architecture:

### 1. Hardware & Edge AI Layer
*   **Microcontroller**: ESP32-WROOM-32.
*   **Sensors**: DHT22 (Digital Temperature/Humidity) + INMP441 (Omnidirectional I2S Microphone).
*   **Inference Engine**: TensorFlow Lite Micro (TFLM).
*   **Local Logic**: Samples audio at 16kHz, performs INT8 normalization, and runs the LSTM model every 2 seconds.

### 2. Communication & Ingestion Layer
*   **MQTT Bridge**: EMQX Platform serves as the gateway. Devices publish to `v1/sensors/data`.
*   **Cloud Integration**: EMQX routes messages to **GCP Pub/Sub** via a managed rule engine. This ensures the system can handle thousands of messages per second without blocking.

### 3. Processing & Persistence Layer
*   **Cloud Run Service**: A Python (FastAPI) microservice subscribes to Pub/Sub. It performs:
    *   Data validation using Pydantic.
    *   Firestore document creation.
    *   BigQuery historical logging.
*   **Firestore**: Serves as the real-time state store. The frontend uses `onSnapshot()` listeners to receive updates without refreshing.

### 4. Visualization & Actuation Layer
*   **Dashboard**: A Single Page Application (SPA) using Tailwind CSS and Chart.js.
*   **Bidirectional Control**: Users can toggle an "Alarm" on the dashboard. This sends a POST request to Cloud Run, which publishes an MQTT command back to the ESP32 to trigger a local buzzer/LED.

---

## e. Results: Technical Specifications & Performance

### 1. Deep Learning Model (Edge AI)
*   **Dataset**: Consists of 2,000+ samples from the **ESC-50** corpus, augmented with white noise, pink noise, and time-stretching.
*   **Model Architecture**: 
    *   Input Layer: 1248-sample window (INT8).
    *   Recurrent Layer: 2-layer LSTM with 32 units, `unroll=True` for TFLM compatibility.
    *   Output Layer: Softmax with 3 classes.
*   **Metrics**:
    | Class | Recall | Precision | Diagnosis |
    | :--- | :--- | :--- | :--- |
    | DEEP_FOCUS | 78% | 81% | High accuracy in detecting continuous laptop typing. |
    | HIGH_ENGAGEMENT | 72% | 75% | Successfully captures applause/keynote patterns. |
    | ROOM_EMPTY | 90% | 94% | Near-perfect detection of silent/empty zones. |

### 2. Thermal Stress Algorithm
The system implements a local risk evaluation based on the Heat Index (HI) formula, represented by the `alert` and `msg` variables:

| Alert Variable | Temperature ($T$) | Humidity ($H$) | System Status |
| :--- | :--- | :--- | :--- |
| **NORMAL** | $T < 26^\circ C$ | $40\% \le H \le 60\%$ | **Optimal**. Systems green. |
| **WARNING_HIGH_DENSITY** | $26^\circ C \le T < 30^\circ C$ | $61\% \le H \le 70\%$ | **Warning**. Blinking yellow LED. |
| **CRITICAL_OVERCROWDING**| $T \ge 30^\circ C$ | $H > 70\%$ | **Emergency**. Red Alert + Buzzers. |

### 3. Memory & Efficiency
*   **RAM usage**: < 45 KB (including audio buffers and TFLM tensor arena).
*   **Storage**: 320 KB (Model weights + code).
*   **Power**: Optimized sampling allows the device to run on battery for extended periods by using deep-sleep between cycles.

---

## f. Conclusions
1.  **Efficiency of TinyML**: Proved that LSTM networks can run efficiently on $10 microcontrollers, providing context that was previously only possible with expensive cloud GPUs.
2.  **Scalable Safety**: The system successfully bridges the gap between hardware telemetry and actionable safety protocols for public events.
3.  **Low Latency Architecture**: The choice of MQTT + Pub/Sub + Firestore enables a "Live Experience" with global end-to-end latency of less than 0.5 seconds.
4.  **Privacy by Design**: By never sending audio data to the cloud, the project complies with strict data protection standards (GDPR/LGPD).

---

## g. Bibliography & References
1.  **Piczak, K. J.** (2015). *Environmental Sound Classification with Convolutional Neural Networks*. IEEE International Workshop on Machine Learning for Signal Processing.
2.  **Warden, P., & Situnayake, D.** (2019). *TinyML: Machine Learning with TensorFlow Lite on Arduino and Ultra-Low-Power Microcontrollers*. O'Reilly Media.
3.  **ISO 7730:2005**: *Ergonomics of the thermal environment — Analytical determination and interpretation of thermal comfort*.
4.  **Google Cloud Platform Documentation**: *Cloud Run & Pub/Sub Architectural Patterns*. (2024).
5.  **EMQX Team**: *Distributed MQTT Broker for IoT Edge-to-Cloud Integration*. (2024).
