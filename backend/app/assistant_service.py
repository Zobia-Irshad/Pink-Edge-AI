from .schemas import CareSuggestions

def get_health_report(prediction: str, confidence: float):
    # Handle "Unknown" cases where the prediction is not Normal or Pneumonia
    if prediction not in ["Normal", "Pneumonia"]:
        return {
            "risk_level": "Unknown",
            "summary": "The model could not confidently classify this image as Normal or Pneumonia. Please ensure a valid chest X-ray was uploaded.",
            "care_suggestions": CareSuggestions(
                rest="Rest as needed.",
                diet="Maintain a balanced diet.",
                hydration="Stay hydrated.",
                warning_signs="If you experience difficulty breathing, seek immediate care.",
                follow_up="Consult a doctor for a proper evaluation."
            )
        }

    # Logic for valid predictions
    risk_level = "Medium"
    if prediction == "Normal":
        risk_level = "Low" if confidence > 0.8 else "Medium"
    elif prediction == "Pneumonia":
        risk_level = "High" if confidence >= 0.70 else "Moderate"

    return {
        "risk_level": risk_level,
        "summary": f"Based on the analysis, the model shows {confidence*100:.1f}% confidence for {prediction}.",
        "care_suggestions": CareSuggestions(
            rest="Get plenty of rest.",
            diet="Eat a balanced diet.",
            hydration="Stay hydrated.",
            warning_signs="If you experience difficulty breathing, seek immediate care.",
            follow_up="Consult a doctor within 24 hours."
        )
    }
