#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include "soc/soc.h"           
#include "soc/rtc_cntl_reg.h"  
#include "secrets.h" 

// TensorFlow Lite Micro libraries
#include <TensorFlowLite_ESP32.h>
#include "tensorflow/lite/micro/all_ops_resolver.h"
#include "tensorflow/lite/micro/micro_error_reporter.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/schema/schema_generated.h"
#include "model_data.h" 

// Hardware configuration
#define DHTPIN 14          
#define MIC_PIN 27         
#define DHTTYPE DHT22
const int PIN_LED = 32;    

DHT dht(DHTPIN, DHTTYPE);
WiFiClient espClient;
PubSubClient client(espClient);

// Non-blocking timers
unsigned long lastPublishTime = 0;
const long PUBLISH_INTERVAL = 5000; 

// Global variables
float global_temp = 0.0;
float global_hum = 0.0;
int global_predicted_class = 2; 
float global_max_score = 0.0;

// LSTM shape configuration (1, 32, 39)
#define TIME_STEPS 32
#define FEATURES 39
#define NUMBER_OF_OUTPUTS 3

// Majority voting filter configuration
const int DEBOUNCE_WINDOW_SIZE = 10; 
int voting_history[DEBOUNCE_WINDOW_SIZE] = {2, 2, 2, 2, 2, 2, 2, 2, 2, 2}; 
int voting_index = 0;

// TensorFlow Micro pointers
const tflite::Model* tflite_model = nullptr;
tflite::MicroInterpreter* interpreter = nullptr;
tflite::ErrorReporter* error_reporter = nullptr;
TfLiteTensor* input = nullptr;
TfLiteTensor* output = nullptr;

// Allocate 1.2MB Arena in External PSRAM for the unrolled LSTM matrix
const int kTensorArenaSize = 1200 * 1024;
uint8_t* tensor_arena = nullptr;

void setupWiFi() {
    delay(10);
    Serial.printf("\n[WIFI] Connecting to SSID: %s\n", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int timeout_counter = 0;
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
        timeout_counter++;
        if(timeout_counter > 40) {
            Serial.println("\n[WIFI] Connection Timeout. Restarting ESP32...");
            ESP.restart(); 
        }
    }

    Serial.println("\n[WIFI] Network Connected Successfully!");
    Serial.printf("[WIFI] Assigned IP Address: %s\n", WiFi.localIP().toString().c_str());
}

void reconnectMQTT() {
    while (!client.connected()) {
        Serial.print("[MQTT] Attemping connection to broker... ");
        Serial.flush(); 

        if (client.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASS)) {
            Serial.println("CONNECTED");
            client.subscribe(TOPIC_COMMANDS); 
        } else {
            Serial.printf("FAILED (rc=%d). Retrying pipeline in 5s...\n", client.state());
            Serial.flush();
            delay(5000);
        }
    }
}

/**
 * @brief Evaluates density thresholds and injects alert flags by reference.
 */
void evaluateEventSecurity(float temperature, float humidity, JsonDocument& doc) {
    const float TEMP_CRITICAL    = 30.0; 
    const float HUM_CRITICAL     = 70.0; 
    const float TEMP_WARNING     = 27.0; 
    const float HUM_WARNING      = 60.0; 

    if (temperature >= TEMP_CRITICAL || humidity >= HUM_CRITICAL) {
        digitalWrite(PIN_LED, HIGH); 
        doc["alert"] = "CRITICAL_OVERCROWDING";
        doc["msg"] = "Danger! Security regulations violated due to overcrowding. Verify exits.";
        doc["level"] = "danger"; 
    } 
    else if (temperature >= TEMP_WARNING || humidity >= HUM_WARNING) {
        digitalWrite(PIN_LED, HIGH);
        doc["alert"] = "WARNING_HIGH_DENSITY";
        doc["msg"] = "Attention: High occupant density detected. Increasing room ventilation is advised.";
        doc["level"] = "warning"; 
    } 
    else {
        digitalWrite(PIN_LED, LOW); 
        doc["alert"] = "NORMAL";
        doc["msg"] = "Environmental metrics within optimal safety margins.";
        doc["level"] = "safe"; 
    }
}

void publishTelemetry() {
    global_temp = dht.readTemperature(); 
    global_hum = dht.readHumidity();

    if (isnan(global_hum) || isnan(global_temp)) {
        Serial.println("[ERROR] Failed critical read from DHT22 sensor!");
        return;
    }

    // Allocate single ununified JSON block for telemetry + states + alerts
    StaticJsonDocument<384> doc;

    doc["temperature"] = global_temp;
    doc["humidity"] = global_hum;
    doc["status"] = "active";
    doc["aiclass"] = global_predicted_class; 
    doc["aiconfidence"] = (int)(global_max_score * 100); 

    // Append alert variables directly into the document
    evaluateEventSecurity(global_temp, global_hum, doc);

    char buffer[384];
    serializeJson(doc, buffer);

    Serial.printf("[MQTT] Dispatching Unified Payload: %s\n", buffer);
    if (client.publish(TOPIC_SENSORS, buffer)) {
        Serial.println("[MQTT] Publish transaction status: OK");
    } else {
        Serial.println("[MQTT] Publish transaction status: FAILED");
    }
}

void callback(char* topic, byte* payload, unsigned int length) {
    Serial.printf("\n[MQTT] Command received on topic: %s\n", topic);
    
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, payload, length);

    if (error) {
        Serial.printf("[JSON] Deserialization failed: %s\n", error.c_str());
        return;
    }

    const char* status = doc["status"]; 

    if (status) { 
        Serial.printf("[JSON] Remote 'status' value decoded: %s\n", status);

        if (strcmp(status, "ON") == 0) {
            digitalWrite(PIN_LED, HIGH);
            Serial.println(">>> Actuator Activated: LED HIGH");
        } 
        else if (strcmp(status, "OFF") == 0) {
            digitalWrite(PIN_LED, LOW);
            Serial.println(">>> Actuator Deactivated: LED LOW");
        }
    }
}

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Disable brownout detection
    setCpuFrequencyMhz(240);                  // 240MHz for fast LSTM execution
    
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n--- COGNITIVE EMBEDDED IoT CORE INITIALIZING ---");
    Serial.flush(); 

    pinMode(PIN_LED, OUTPUT);
    dht.begin();
    setupWiFi();

    if (strlen(MQTT_SERVER) > 0) {
        client.setServer(MQTT_SERVER, 1883);
        client.setCallback(callback);
        Serial.println("[SYSTEM] MQTT Client pipeline configuration bound.");
    } else {
        Serial.println("[CRITICAL ERROR] MQTT_SERVER macro empty in secrets.h!");
    }

    // Allocate memory arena directly into PSRAM (SPIRAM)
    tensor_arena = (uint8_t*) heap_caps_aligned_alloc(16, kTensorArenaSize, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (tensor_arena == nullptr) {
        Serial.println("[ERROR] PSRAM allocation failure.");
        while(true);
    }
    Serial.println("[SYSTEM] PSRAM Subsystem mapped for Edge AI runtime.");

    static tflite::MicroErrorReporter micro_error_reporter;
    error_reporter = &micro_error_reporter;

    tflite_model = tflite::GetModel(g_model);
    if (tflite_model->version() != TFLITE_SCHEMA_VERSION) {
        Serial.println("[ERROR] Model schema version mismatch.");
        while(true);
    }

    static tflite::AllOpsResolver resolver;
    static tflite::MicroInterpreter static_interpreter(
        tflite_model, resolver, tensor_arena, kTensorArenaSize, error_reporter);
    interpreter = &static_interpreter;

    if (interpreter->AllocateTensors() != kTfLiteOk) {
        Serial.println("[ERROR] AllocateTensors() mapping failed.");
        while(true);
    }

    input = interpreter->input(0);
    output = interpreter->output(0);

    Serial.println("[SYSTEM] Pipelines fully loaded. Commencing loop execution.");
    Serial.println("----------------------------------------------------------------------------\n");
}

void loop() {
    if (!client.connected()) {
        reconnectMQTT();
    }
    client.loop(); 

    // 1. Hardware Audio Sample Acquisition (16KHz Enforced)
    for (int t = 0; t < TIME_STEPS; t++) {
        for (int f = 0; f < FEATURES; f++) {
            int raw_sample = analogRead(MIC_PIN); // Uncomment for hardware microphone use
            //int raw_sample = 3000; 
            
            // Quantization: Map ADC readings to signed INT8 workspace [-128, 127]
            int8_t normalized_sample = (int8_t)((raw_sample / 16.12) - 128); 
            
            int tensor_index = (t * FEATURES) + f;
            input->data.int8[tensor_index] = normalized_sample;
            
            // 52us delay + 10us ADC sample windows = 62.5us period (16,000 Hz)
            delayMicroseconds(52);
        }
    }

    client.loop(); 

    // 2. Unrolled LSTM Neural Inference Executor
    if (interpreter->Invoke() != kTfLiteOk) {
        Serial.println("[ERROR] Neural Network execution stack crashed.");
        return;
    }

    // 3. De-quantization (Softmax extractor)
    int local_predicted_class = 0;
    float local_max_score = -1.0;
    float scores[NUMBER_OF_OUTPUTS];

    for (int i = 0; i < NUMBER_OF_OUTPUTS; i++) {
        scores[i] = (output->data.int8[i] - output->params.zero_point) * output->params.scale;
        if (scores[i] > local_max_score) {
            local_max_score = scores[i];
            local_predicted_class = i;
        }
    }

    // 4. Noise Debouncer: Majority Voting Scheduler
    if (local_max_score > 0.35) { 
        voting_history[voting_index] = local_predicted_class;
        voting_index = (voting_index + 1) % DEBOUNCE_WINDOW_SIZE; 
    }

    int electoral_box[NUMBER_OF_OUTPUTS] = {0, 0, 0};
    for (int i = 0; i < DEBOUNCE_WINDOW_SIZE; i++) {
        electoral_box[voting_history[i]]++;
    }

    int stable_majority_class = global_predicted_class; 
    int dominant_votes = 0;
    
    for (int i = 0; i < NUMBER_OF_OUTPUTS; i++) {
        if (electoral_box[i] > dominant_votes) {
            dominant_votes = electoral_box[i];
            stable_majority_class = i;
        }
    }

    // State commitment requires an absolute quorum of 6/10 historical window records
    if (dominant_votes >= 6) {
        global_predicted_class = stable_majority_class;
        global_max_score = scores[stable_majority_class]; 
    }

    Serial.printf("[Filtro AI] Window State -> [C0: %d | C1: %d | C2: %d] ---> ", 
                  electoral_box[0], electoral_box[1], electoral_box[2]);
                  
    if (dominant_votes >= 6) {
        Serial.printf("Sustained Environment State: Class %d (%d/10 Consensual Votes)\n", 
                      global_predicted_class, dominant_votes);
    } else {
        Serial.println("[AI Window] Signal unstable. Transient anomaly ignored.");
    }

    // 5. Non-blocking Telemetry Async Dispatcher
    unsigned long currentTime = millis();
    if (currentTime - lastPublishTime > PUBLISH_INTERVAL) {
        lastPublishTime = currentTime;
        publishTelemetry(); 
    }
}