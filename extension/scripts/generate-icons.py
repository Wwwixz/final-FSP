"""Render the geometric Krasnopars mark at browser toolbar icon sizes."""
from math import hypot
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[1] / 'public' / 'icons'
OUT.mkdir(parents=True, exist_ok=True)
SIZE = 768
SCALE = SIZE / 512

def xy(values):
    return tuple(round(value * SCALE) for value in values)

image = Image.new('RGBA', (SIZE, SIZE))
pixels = image.load()
for y in range(SIZE):
    for x in range(SIZE):
        t = min(1, max(0, (x * .35 + y * .65) / SIZE))
        glow = max(0, 1 - hypot(x / SIZE - .16, y / SIZE - .08) / .8)
        pixels[x, y] = (int(12 - 3 * t + 12 * glow), int(40 - 14 * t + 22 * glow), int(72 - 22 * t + 30 * glow), 255)
mask = Image.new('L', image.size)
ImageDraw.Draw(mask).rounded_rectangle(xy((16, 16, 496, 496)), radius=round(47 * SCALE), fill=255)
image.putalpha(mask)

gloss = Image.new('RGBA', image.size)
draw = ImageDraw.Draw(gloss)
draw.ellipse(xy((-110, -295, 648, 265)), fill=(134, 212, 246, 18))
gloss = gloss.filter(ImageFilter.GaussianBlur(13 * SCALE))
gloss.putalpha(Image.composite(gloss.getchannel('A'), Image.new('L', image.size), mask))
image = Image.alpha_composite(image, gloss)

details = Image.new('RGBA', image.size)
draw = ImageDraw.Draw(details)
draw.rounded_rectangle(xy((24, 24, 488, 488)), radius=round(40 * SCALE), outline=(117, 200, 233, 120), width=round(2 * SCALE))
draw.rounded_rectangle(xy((35, 35, 477, 477)), radius=round(31 * SCALE), outline=(116, 196, 228, 35), width=round(1 * SCALE))
draw.arc(xy((91, 91, 421, 421)), 38, 325, fill=(112, 206, 242, 27), width=round(2 * SCALE))
image = Image.alpha_composite(image, details)

shadow = Image.new('RGBA', image.size)
draw = ImageDraw.Draw(shadow)
strokes = [((176, 148), (176, 364)), ((184, 258), (335, 148)), ((210, 251), (348, 363))]
for a, b in strokes:
    draw.line(xy((*a, *b)), fill=(0, 9, 24, 140), width=round(44 * SCALE))
shadow = shadow.filter(ImageFilter.GaussianBlur(9 * SCALE))
image = Image.alpha_composite(image, shadow)
draw = ImageDraw.Draw(image)
for a, b in strokes:
    draw.line(xy((*a, *b)), fill=(216, 241, 250, 255), width=round(42 * SCALE))
    for cx, cy in (a, b):
        draw.ellipse(xy((cx - 21, cy - 21, cx + 21, cy + 21)), fill=(216, 241, 250, 255))
draw.ellipse(xy((357, 104, 401, 148)), fill=(99, 255, 196, 45))
draw.ellipse(xy((365, 112, 393, 140)), fill=(102, 225, 231, 255))
draw.ellipse(xy((370, 115, 377, 122)), fill=(235, 255, 245, 240))
for size in (16, 32, 48, 96, 128, 256):
    image.resize((size, size), Image.Resampling.LANCZOS).save(OUT / f'icon-{size}.png', optimize=True)
