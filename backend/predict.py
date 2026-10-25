import sys
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing import image

MODEL_PATH = "outputs/best_model.keras"
IMG_SIZE = (224, 224)

def predict_glaucoma(image_path):
    model = tf.keras.models.load_model(MODEL_PATH)

    img = image.load_img(image_path, target_size=IMG_SIZE)
    img_array = image.img_to_array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)

    prediction = model.predict(img_array)[0][0]

    print("\n" + "="*50)
    print(f"Image: {image_path}")
    print(f"Raw model score: {prediction:.4f}  (0 = healthy, 1 = glaucoma)")
    if prediction >= 0.5:
        print(f"Result: LIKELY GLAUCOMA  (confidence: {prediction*100:.1f}%)")
    else:
        print(f"Result: LIKELY HEALTHY  (confidence: {(1-prediction)*100:.1f}%)")
    print("="*50)
    print("\nNOTE: This is a screening tool for a coding project, NOT a medical")
    print("diagnosis. Always consult an ophthalmologist for actual diagnosis.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python predict.py path/to/your/image.png")
    else:
        predict_glaucoma(sys.argv[1])