from PIL import Image, ImageDraw
import math
import os

SIZE = 128
FRAMES = 8
OUT_DIR = os.path.dirname(os.path.abspath(__file__))

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

OCEAN_TOP = hex_to_rgb('#0ea5e9')
OCEAN_BOTTOM = hex_to_rgb('#1e3a8a')
BLACK = hex_to_rgb('#0f172a')
WHITE = hex_to_rgb('#f8fafc')
EYE = hex_to_rgb('#38bdf8')

def draw_gradient(draw, size, top, bottom):
    for y in range(size[1]):
        ratio = y / size[1]
        r = int(top[0] * (1 - ratio) + bottom[0] * ratio)
        g = int(top[1] * (1 - ratio) + bottom[1] * ratio)
        b = int(top[2] * (1 - ratio) + bottom[2] * ratio)
        draw.line([(0, y), (size[0], y)], fill=(r, g, b))

def draw_ellipse_rotated(draw, cx, cy, rx, ry, angle, fill, outline=None):
    pts = []
    for t in range(0, 360, 5):
        rad = math.radians(t)
        x = rx * math.cos(rad)
        y = ry * math.sin(rad)
        xr = x * math.cos(angle) - y * math.sin(angle) + cx
        yr = x * math.sin(angle) + y * math.cos(angle) + cy
        pts.append((xr, yr))
    draw.polygon(pts, fill=fill, outline=outline)

def draw_tail(draw, cx, cy, angle, direction):
    # Tail fluke relative to body
    rad = math.radians(angle)
    # Tail stem
    stem_end_x = cx + direction * 18 * math.cos(rad)
    stem_end_y = cy + 18 * math.sin(rad)
    # Two flukes
    fluke_angle1 = rad + 0.5
    fluke_angle2 = rad - 0.5
    fluke_len = 16
    pts = [
        (cx, cy),
        (stem_end_x + direction * fluke_len * math.cos(fluke_angle1),
         stem_end_y + fluke_len * math.sin(fluke_angle1)),
        (stem_end_x, stem_end_y),
        (stem_end_x + direction * fluke_len * math.cos(fluke_angle2),
         stem_end_y + fluke_len * math.sin(fluke_angle2)),
    ]
    draw.polygon(pts, fill=BLACK)

def draw_frame(frame_idx):
    img = Image.new('RGBA', (SIZE, SIZE), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    # Background gradient
    draw_gradient(draw, (SIZE, SIZE), OCEAN_TOP, OCEAN_BOTTOM)

    # Animation parameters
    tail_sway = math.sin(frame_idx / FRAMES * 2 * math.pi) * 12  # degrees
    body_bob = math.sin(frame_idx / FRAMES * 2 * math.pi) * 3

    direction = 1  # facing right
    center_x = SIZE // 2
    center_y = SIZE // 2 + body_bob

    # Tail (drawn first so body covers the joint)
    tail_cx = center_x - direction * 38
    tail_cy = center_y
    draw_tail(draw, tail_cx, tail_cy, tail_sway, direction)

    # Body
    draw_ellipse_rotated(
        draw, center_x, center_y, 42, 20,
        math.radians(-5), fill=BLACK
    )

    # White belly patch
    belly_pts = []
    for t in range(-60, 60, 5):
        rad = math.radians(t)
        x = 36 * math.cos(rad)
        y = 10 * math.sin(rad)
        # rotate and offset downward
        xr = x + center_x
        yr = y + center_y + 8
        belly_pts.append((xr, yr))
    # Close the belly shape
    belly_pts.append((center_x - 36, center_y + 8))
    draw.polygon(belly_pts, fill=WHITE)

    # Eye patch (white oval near head)
    eye_cx = center_x + direction * 22
    eye_cy = center_y - 4
    draw.ellipse(
        [eye_cx - 8, eye_cy - 5, eye_cx + 8, eye_cy + 5],
        fill=WHITE
    )
    # Eye
    draw.ellipse(
        [eye_cx + direction * 2 - 2, eye_cy - 2, eye_cx + direction * 2 + 2, eye_cy + 2],
        fill=BLACK
    )

    # Dorsal fin
    fin_pts = [
        (center_x - direction * 8, center_y - 18),
        (center_x + direction * 4, center_y - 34),
        (center_x + direction * 10, center_y - 16),
    ]
    draw.polygon(fin_pts, fill=BLACK)

    # Pectoral fin
    pec_pts = [
        (center_x - direction * 10, center_y + 12),
        (center_x + direction * 2, center_y + 22),
        (center_x - direction * 2, center_y + 16),
    ]
    draw.polygon(pec_pts, fill=BLACK)

    # Small water bubbles
    bubble_offset = frame_idx * 5
    bubbles = [
        (20, 100 - bubble_offset % 30),
        (100, 90 - (bubble_offset + 15) % 40),
        (110, 30 - (bubble_offset + 8) % 25),
    ]
    for bx, by in bubbles:
        draw.ellipse([bx - 3, by - 3, bx + 3, by + 3], outline=(255, 255, 255, 120))

    return img


def main():
    for i in range(FRAMES):
        img = draw_frame(i)
        path = os.path.join(OUT_DIR, f'frame_{i:02d}.png')
        img.save(path)
        print(f'Saved {path}')

    # Also generate static icons in common sizes from first frame
    first = draw_frame(0)
    for size in [16, 32, 48, 128]:
        resized = first.resize((size, size), Image.Resampling.LANCZOS)
        path = os.path.join(OUT_DIR, f'icon{size}.png')
        resized.save(path)
        print(f'Saved {path}')


if __name__ == '__main__':
    main()
