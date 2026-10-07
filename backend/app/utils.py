import base64
import io
import numpy as np
import pydicom
from PIL import Image

def base64_to_image(base64_str: str) -> Image.Image:
    try:
        image_data = base64.b64decode(base64_str)
        return Image.open(io.BytesIO(image_data))
    except Exception as e:
        raise ValueError(f"Invalid image format: {e}")

def dicom_to_image(dicom_bytes: bytes) -> Image.Image:
    try:
        dataset = pydicom.dcmread(io.BytesIO(dicom_bytes))
        image_data = dataset.pixel_array.astype(float)
        # Normalize to 0-255
        image_data = (np.maximum(image_data, 0) / (image_data.max() if image_data.max() > 0 else 1.0)) * 255.0
        return Image.fromarray(image_data.astype(np.uint8)).convert('RGB')
    except Exception as e:
        raise ValueError(f"Invalid DICOM file: {e}")

def image_to_base64(image: Image.Image) -> str:
    buffered = io.BytesIO()
    image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")

def is_valid_xray(image: Image.Image) -> tuple[bool, str]:
    """
    Heuristic check to reject images that are clearly NOT chest X-rays
    (e.g. selfies, random colored photos, screenshots).
    """
    rgb_image = image.convert('RGB')
    arr = np.asarray(rgb_image).astype(np.float32)

    if arr.ndim != 3 or arr.shape[2] != 3:
        return False, "Image format not recognized."

    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    # 1. Color difference check across channels
    channel_diff = (np.abs(r - g) + np.abs(g - b) + np.abs(r - b)).mean()

    # 2. Saturation check using HSV
    hsv_image = rgb_image.convert('HSV')
    hsv_arr = np.asarray(hsv_image).astype(np.float32)
    mean_saturation = hsv_arr[:, :, 1].mean()

    # 3. Size sanity check
    width, height = image.size
    if width < 50 or height < 50:
        return False, "Image resolution too small to be a valid X-ray."

    # Lenient thresholds for scanned/compressed X-rays vs colored photos
    if channel_diff > 15 or mean_saturation > 40:
        return False, (
            "Uploaded image does not appear to be a valid chest X-ray "
            "(it looks like a regular color photo). Please upload a "
            "grayscale chest X-ray image (JPG, PNG, or DICOM)."
        )

    return True, ""