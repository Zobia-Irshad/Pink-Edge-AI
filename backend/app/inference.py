from pathlib import Path

try:
    import torch
    from torchvision import models, transforms
    from captum.attr import LayerGradCam
except ImportError:
    torch = None
    models = None
    transforms = None
    LayerGradCam = None
from .utils import base64_to_image, dicom_to_image, image_to_base64
from PIL import Image
import numpy as np
import io
import os

# Set device
device = torch.device("cuda" if torch.cuda.is_available() else "cpu") if torch else None

def load_model():
    if torch is None or models is None:
        raise RuntimeError(
            "Inference dependencies are not installed. Run `pip install -r requirements.txt` "
            "with Python 3.11 or use the backend Docker image."
        )
    model = models.resnet18(weights=None)
    num_ftrs = model.fc.in_features
    model.fc = torch.nn.Linear(num_ftrs, 2)

    weights_path = Path(__file__).resolve().parent / "models" / "best_model.pth"
    if not os.path.exists(weights_path):
        raise FileNotFoundError(f"Model weights not found at {weights_path}")

    model.load_state_dict(torch.load(weights_path, map_location=device, weights_only=False))
    model.to(device)
    model.eval()
    return model

model = None
transform = None


def get_model_and_transform():
    global model, transform
    if model is None or transform is None:
        model = load_model()
        transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
    return model, transform

def run_inference(file_bytes: bytes, is_dicom: bool = False):
    try:
        model_instance, image_transform = get_model_and_transform()
        if is_dicom:
            image = dicom_to_image(file_bytes).convert('RGB')
        else:
            image = Image.open(io.BytesIO(file_bytes)).convert('RGB')

        input_tensor = image_transform(image).unsqueeze(0).to(device)

        # Inference
        with torch.no_grad():
            output = model_instance(input_tensor)
            probabilities = torch.nn.functional.softmax(output, dim=1)
            confidence, prediction_idx = torch.max(probabilities, dim=1)

        # Map index to label
        labels = {0: "Normal", 1: "Pneumonia"}
        prediction_label = labels[prediction_idx.item()]
        confidence_val = confidence.item()

        # Grad-CAM
        # Target the last convolutional layer
        target_layer = model_instance.layer4[-1]
        grad_cam = LayerGradCam(model_instance, target_layer)
        attr = grad_cam.attribute(input_tensor, target=prediction_idx.item())

        # Process heatmap
        attr = attr.detach().squeeze().cpu().numpy()
        attr = (attr - attr.min()) / (attr.max() - attr.min() + 1e-8)
        heatmap = Image.fromarray((attr * 255).astype(np.uint8)).resize(image.size)

        return prediction_label, confidence_val, image_to_base64(heatmap)
    except Exception as e:
        raise RuntimeError(f"Inference failed: {e}")
