"""Render the website's Krasnoyarsk coat of arms at browser icon sizes."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'public' / 'favicon.png'
OUT = Path(__file__).resolve().parents[1] / 'public' / 'icons'
OUT.mkdir(parents=True, exist_ok=True)

with Image.open(SOURCE) as source:
    image = source.convert('RGBA')
    for size in (16, 32, 48, 96, 128, 256):
        image.resize((size, size), Image.Resampling.LANCZOS).save(
            OUT / f'icon-{size}.png', optimize=True
        )
