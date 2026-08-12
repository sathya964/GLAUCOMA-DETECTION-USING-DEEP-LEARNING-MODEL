import os
import io
from dotenv import load_dotenv
from google import genai
import uuid
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing import image
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
load_dotenv()
gemini_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
MODEL_PATH = "outputs/best_model.keras"
IMG_SIZE = (224, 224)

print("Loading model...")
model = tf.keras.models.load_model(MODEL_PATH)
print("Model loaded.")

history_store = []


def get_severity(confidence_pct):
    if confidence_pct < 30:
        return {"label": "Low risk", "action": "No immediate concern. A routine yearly eye checkup is still recommended.", "level": 1}
    elif confidence_pct < 60:
        return {"label": "Moderate - Monitor", "action": "Consider seeing an eye doctor within 1-3 months.", "level": 2}
    elif confidence_pct < 85:
        return {"label": "High concern", "action": "Recommended to see an eye doctor within 2-4 weeks.", "level": 3}
    else:
        return {"label": "Urgent", "action": "Please see an eye doctor as soon as possible.", "level": 4}


@app.route("/api/predict", methods=["POST"])
def predict():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files["image"]

    try:
        img = image.load_img(io.BytesIO(file.read()), target_size=IMG_SIZE)
    except Exception as e:
        return jsonify({"error": f"Could not read image: {str(e)}"}), 400

    img_array = image.img_to_array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)

    raw_score = float(model.predict(img_array)[0][0])
    is_glaucoma = raw_score >= 0.5
    confidence_pct = round((raw_score if is_glaucoma else 1 - raw_score) * 100, 1)
    glaucoma_confidence_pct = round(raw_score * 100, 1)

    severity = get_severity(glaucoma_confidence_pct)

    result = {
        "id": str(uuid.uuid4()),
        "prediction": "Glaucoma indicators detected" if is_glaucoma else "No glaucoma indicators detected",
        "is_glaucoma": is_glaucoma,
        "confidence_pct": confidence_pct,
        "glaucoma_confidence_pct": glaucoma_confidence_pct,
        "severity": severity,
        "filename": file.filename,
    }

    history_store.append(result)
    return jsonify(result)


@app.route("/api/history", methods=["GET"])
def get_history():
    return jsonify(history_store[::-1])


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})
from flask import render_template

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    user_message = data.get("message", "")
    result_context = data.get("result_context", None)

    system_prompt = (
        "You are a helpful assistant embedded in ClearSight, a retinal glaucoma "
        "screening web app. You answer questions about glaucoma, eye health terms "
        "(like IOP, cup-to-disc ratio, optic nerve health), and help users understand "
        "their screening result in plain language. You are NOT a doctor and must never "
        "give a diagnosis or tell someone what to do instead of seeing a doctor. Always "
        "encourage users with concerning results to see an eye care professional. Keep "
        "answers concise and friendly."
    )

    if result_context:
        system_prompt += f"\n\nThe user's most recent screening result: {result_context}"

    try:
        response = gemini_client.models.generate_content(
            model="gemini-3.6-flash",
            contents=f"{system_prompt}\n\nUser question: {user_message}"
        )
        reply = response.text
        return jsonify({"reply": reply})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route("/api/list-models", methods=["GET"])
def list_models():
    models = [m.name for m in gemini_client.models.list()]
    return jsonify({"available_models": models})

if __name__ == "__main__":
    app.run(debug=True, port=5000)