# Glaucoma Detection Using Deep Learning (CNN) + AI Chat Assistant

A retinal fundus image classifier that screens for glaucoma indicators, with a built-in AI chat assistant (powered by Google Gemini) that explains results in plain language.

## Results
- **Validation Accuracy:** 83.6%
- **AUC-ROC:** 0.91
- **Trained on:** 12,316 fundus images

## Features
- CNN-based binary classification (glaucoma indicators / no indicators) using transfer learning
- Flask web app with drag-and-drop image upload
- Real-time severity scoring with suggested next steps
- Integrated chat assistant for plain-language explanation of results (not a diagnosis — always recommends seeing an eye care professional)

## Tech Stack
- **Model:** TensorFlow / Keras, CNN with transfer learning
- **Backend:** Flask, Python
- **Chat:** Google Gemini API
- **Frontend:** HTML, CSS, JavaScript

## Setup
1. Clone this repo
2. Create a virtual environment and install dependencies: `pip install -r requirements.txt`
3. Add a `.env` file with your `GOOGLE_API_KEY`
4. Run: `python app.py`

## Disclaimer
This tool is for educational/screening purposes only and is not a substitute for professional medical diagnosis.