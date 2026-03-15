#!/usr/bin/env python3
"""
Generate Play Store screenshots for ResIQ by Hostizzy.
Creates professional promotional screenshots with device frames and UI mockups.

Play Store requirements:
- Phone: 1080x1920 (or 2:3 ratio minimum)
- 7-inch tablet: 1200x1920
- 10-inch tablet: 1800x2560 (optional)
- Min 2, max 8 screenshots per device type
"""

from PIL import Image, ImageDraw, ImageFont
import os
import math

# ─── Configuration ───────────────────────────────────────────────────────────

ASSETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')
OUTPUT_DIR = os.path.join(ASSETS_DIR, 'screenshots')

# Brand colors from CSS
NAVY = (27, 58, 92)         # #1B3A5C
TEAL = (8, 145, 178)        # #0891b2
TEAL_LIGHT = (91, 186, 181) # #5BBAB5
ORANGE = (232, 148, 58)     # #E8943A
WHITE = (255, 255, 255)
OFF_WHITE = (248, 250, 252)  # #f8fafc
LIGHT_GRAY = (241, 245, 249) # #f1f5f9
BORDER_COLOR = (226, 232, 240) # #e2e8f0
TEXT_PRIMARY = (15, 23, 42)   # #0f172a
TEXT_SECONDARY = (71, 85, 105) # #475569
TEXT_TERTIARY = (148, 163, 184)
SUCCESS = (5, 150, 105)      # #059669
DANGER = (220, 38, 38)       # #dc2626
WARNING = (217, 119, 6)      # #d97706

# Phone screenshot dimensions (Play Store standard)
PHONE_W, PHONE_H = 1080, 1920
TABLET_W, TABLET_H = 1200, 1920

# Fonts
FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT_REGULAR = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def get_font(size, bold=False):
    path = FONT_BOLD if bold else FONT_REGULAR
    return ImageFont.truetype(path, size)


def draw_gradient_rect(draw, xy, color1, color2, vertical=True):
    """Draw a gradient-filled rectangle."""
    x0, y0, x1, y1 = xy
    if vertical:
        for y in range(y0, y1):
            t = (y - y0) / max(1, y1 - y0)
            r = int(color1[0] + (color2[0] - color1[0]) * t)
            g = int(color1[1] + (color2[1] - color1[1]) * t)
            b = int(color1[2] + (color2[2] - color1[2]) * t)
            draw.line([(x0, y), (x1, y)], fill=(r, g, b))
    else:
        for x in range(x0, x1):
            t = (x - x0) / max(1, x1 - x0)
            r = int(color1[0] + (color2[0] - color1[0]) * t)
            g = int(color1[1] + (color2[1] - color1[1]) * t)
            b = int(color1[2] + (color2[2] - color1[2]) * t)
            draw.line([(x, y0), (x, y1)], fill=(r, g, b))


def draw_diagonal_gradient(img, color1, color2):
    """Draw a diagonal gradient on the full image."""
    w, h = img.size
    draw = ImageDraw.Draw(img)
    for y in range(h):
        for x in range(w):
            t = (x / w * 0.5 + y / h * 0.5)
            r = int(color1[0] + (color2[0] - color1[0]) * t)
            g = int(color1[1] + (color2[1] - color1[1]) * t)
            b = int(color1[2] + (color2[2] - color1[2]) * t)
            draw.point((x, y), fill=(r, g, b))


def draw_rounded_rect(draw, xy, radius, fill=None, outline=None, width=1):
    """Draw a rounded rectangle."""
    x0, y0, x1, y1 = xy
    if fill:
        draw.rectangle([x0 + radius, y0, x1 - radius, y1], fill=fill)
        draw.rectangle([x0, y0 + radius, x1, y1 - radius], fill=fill)
        draw.pieslice([x0, y0, x0 + 2*radius, y0 + 2*radius], 180, 270, fill=fill)
        draw.pieslice([x1 - 2*radius, y0, x1, y0 + 2*radius], 270, 360, fill=fill)
        draw.pieslice([x0, y1 - 2*radius, x0 + 2*radius, y1], 90, 180, fill=fill)
        draw.pieslice([x1 - 2*radius, y1 - 2*radius, x1, y1], 0, 90, fill=fill)
    if outline:
        draw.arc([x0, y0, x0 + 2*radius, y0 + 2*radius], 180, 270, fill=outline, width=width)
        draw.arc([x1 - 2*radius, y0, x1, y0 + 2*radius], 270, 360, fill=outline, width=width)
        draw.arc([x0, y1 - 2*radius, x0 + 2*radius, y1], 90, 180, fill=outline, width=width)
        draw.arc([x1 - 2*radius, y1 - 2*radius, x1, y1], 0, 90, fill=outline, width=width)
        draw.line([x0 + radius, y0, x1 - radius, y0], fill=outline, width=width)
        draw.line([x0 + radius, y1, x1 - radius, y1], fill=outline, width=width)
        draw.line([x0, y0 + radius, x0, y1 - radius], fill=outline, width=width)
        draw.line([x1, y0 + radius, x1, y1 - radius], fill=outline, width=width)


def draw_status_bar(draw, w, y=0, dark=False):
    """Draw a mobile status bar."""
    color = WHITE if dark else TEXT_PRIMARY
    font = get_font(26)
    draw.text((40, y + 12), "9:41", fill=color, font=font)
    # Signal bars
    for i in range(4):
        h = 10 + i * 3
        draw.rectangle([w - 200 + i*14, y + 30 - h, w - 200 + i*14 + 10, y + 30], fill=color)
    # Battery
    draw.rounded_rectangle([w - 110, y + 14, w - 40, y + 34], radius=4, outline=color, width=2)
    draw.rectangle([w - 106, y + 18, w - 52, y + 30], fill=color)


def draw_bottom_nav(draw, w, h, active_index=0):
    """Draw the bottom navigation bar."""
    nav_h = 140
    nav_y = h - nav_h
    draw.rectangle([0, nav_y, w, h], fill=WHITE)
    draw.line([0, nav_y, w, nav_y], fill=BORDER_COLOR, width=2)

    tabs = [
        ("Dashboard", True),
        ("Calendar", False),
        ("Guests", False),
        ("Payments", False),
        ("More", False),
    ]

    tab_w = w // len(tabs)
    for i, (label, _) in enumerate(tabs):
        cx = i * tab_w + tab_w // 2
        is_active = (i == active_index)
        color = TEAL if is_active else TEXT_TERTIARY

        # Icon placeholder (circle)
        icon_y = nav_y + 25
        draw.ellipse([cx - 16, icon_y, cx + 16, icon_y + 32], fill=color)

        # Label
        font = get_font(22, bold=is_active)
        bbox = draw.textbbox((0, 0), label, font=font)
        tw = bbox[2] - bbox[0]
        draw.text((cx - tw // 2, icon_y + 42), label, fill=color, font=font)


def create_promo_screenshot(w, h, headline, subtext, draw_content_fn, filename):
    """Create a screenshot with headline at top and app content below."""
    img = Image.new('RGB', (w, h), OFF_WHITE)
    draw = ImageDraw.Draw(img)

    # Top section with gradient background
    top_h = 440
    draw_gradient_rect(draw, (0, 0, w, top_h), NAVY, TEAL)

    # Load and place logo
    try:
        logo = Image.open(os.path.join(ASSETS_DIR, 'logo.png'))
        logo_size = 80
        logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
        img.paste(logo, (w // 2 - logo_size // 2, 60), logo if logo.mode == 'RGBA' else None)
    except Exception:
        pass

    # Headline
    font_headline = get_font(52, bold=True)
    bbox = draw.textbbox((0, 0), headline, font=font_headline)
    tw = bbox[2] - bbox[0]
    draw.text((w // 2 - tw // 2, 160), headline, fill=WHITE, font=font_headline)

    # Subtext
    font_sub = get_font(32)
    lines = subtext.split('\n')
    y = 230
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font_sub)
        tw = bbox[2] - bbox[0]
        draw.text((w // 2 - tw // 2, y), line, fill=(200, 225, 240), font=font_sub)
        y += 42

    # Content area (phone frame mockup)
    content_y = top_h - 60
    content_x = 60
    content_w = w - 120
    content_h = h - content_y - 40

    # Phone frame shadow
    draw_rounded_rect(draw, (content_x - 4, content_y - 4, content_x + content_w + 4, content_y + content_h + 4),
                      radius=30, fill=(0, 0, 0, 40))
    # Phone frame
    draw_rounded_rect(draw, (content_x, content_y, content_x + content_w, content_y + content_h),
                      radius=28, fill=WHITE, outline=BORDER_COLOR, width=2)

    # Draw the app content
    draw_content_fn(draw, img, content_x + 2, content_y + 2, content_w - 4, content_h - 4)

    img.save(os.path.join(OUTPUT_DIR, filename), 'PNG', optimize=True)
    print(f"  Generated {filename}")


def draw_stat_card(draw, x, y, w, h, label, value, color, delta=None):
    """Draw a statistics card."""
    draw_rounded_rect(draw, (x, y, x + w, y + h), radius=16, fill=WHITE, outline=BORDER_COLOR, width=2)
    font_val = get_font(36, bold=True)
    font_label = get_font(20)
    draw.text((x + 20, y + 16), value, fill=TEXT_PRIMARY, font=font_val)
    draw.text((x + 20, y + 58), label, fill=TEXT_SECONDARY, font=font_label)
    # Color accent bar at top
    draw.rectangle([x + 2, y + 2, x + w - 2, y + 8], fill=color)
    if delta:
        font_delta = get_font(18)
        delta_color = SUCCESS if delta.startswith('+') or delta.startswith('↑') else DANGER
        draw.text((x + w - 80, y + 20), delta, fill=delta_color, font=font_delta)


def draw_reservation_row(draw, x, y, w, guest, room, dates, status, status_color):
    """Draw a reservation list item."""
    row_h = 80
    draw_rounded_rect(draw, (x, y, x + w, y + row_h), radius=12, fill=WHITE, outline=BORDER_COLOR, width=1)

    # Guest avatar circle
    draw.ellipse([x + 16, y + 16, x + 64, y + 64], fill=TEAL)
    initials = ''.join(n[0] for n in guest.split()[:2])
    font_init = get_font(20, bold=True)
    bbox = draw.textbbox((0, 0), initials, font=font_init)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((x + 40 - tw // 2, y + 36 - th // 2), initials, fill=WHITE, font=font_init)

    # Guest name and room
    font_name = get_font(24, bold=True)
    font_detail = get_font(18)
    draw.text((x + 80, y + 14), guest, fill=TEXT_PRIMARY, font=font_name)
    draw.text((x + 80, y + 44), f"{room}  |  {dates}", fill=TEXT_SECONDARY, font=font_detail)

    # Status badge
    font_status = get_font(18, bold=True)
    bbox = draw.textbbox((0, 0), status, font=font_status)
    sw = bbox[2] - bbox[0]
    badge_x = x + w - sw - 40
    badge_y = y + 28
    draw_rounded_rect(draw, (badge_x - 10, badge_y - 6, badge_x + sw + 10, badge_y + 26),
                      radius=12, fill=(*status_color, 30))
    draw.text((badge_x, badge_y), status, fill=status_color, font=font_status)


# ─── Screenshot 1: Dashboard ────────────────────────────────────────────────

def draw_dashboard_content(draw, img, cx, cy, cw, ch):
    """Draw dashboard screen content."""
    # Status bar area
    draw_status_bar(draw, cx + cw, cy)
    y = cy + 50

    # App header
    font_header = get_font(32, bold=True)
    draw.text((cx + 24, y), "Dashboard", fill=TEXT_PRIMARY, font=font_header)

    # Today's date
    font_date = get_font(20)
    draw.text((cx + 24, y + 40), "Saturday, March 15, 2026", fill=TEXT_SECONDARY, font=font_date)
    y += 90

    # Stats row 1
    card_w = (cw - 72) // 2
    card_h = 90
    draw_stat_card(draw, cx + 24, y, card_w, card_h, "Check-ins Today", "8", TEAL, "↑ 15%")
    draw_stat_card(draw, cx + 48 + card_w, y, card_w, card_h, "Check-outs", "5", ORANGE)
    y += card_h + 16

    # Stats row 2
    draw_stat_card(draw, cx + 24, y, card_w, card_h, "Occupancy", "87%", SUCCESS, "↑ 5%")
    draw_stat_card(draw, cx + 48 + card_w, y, card_w, card_h, "Revenue", "$12.4K", NAVY, "↑ 12%")
    y += card_h + 30

    # Section header
    font_section = get_font(26, bold=True)
    draw.text((cx + 24, y), "Today's Activity", fill=TEXT_PRIMARY, font=font_section)
    y += 44

    # Activity cards
    activities = [
        ("Carlos Martinez", "Suite 302", "Mar 15-18", "Arriving", SUCCESS),
        ("Emily Johnson", "Room 105", "Mar 13-16", "In-House", TEAL),
        ("James Wilson", "Villa A", "Mar 12-15", "Departing", ORANGE),
        ("Sophia Chen", "Room 208", "Mar 15-20", "Arriving", SUCCESS),
        ("Michael Brown", "Suite 401", "Mar 14-17", "In-House", TEAL),
        ("Anna Schmidt", "Room 110", "Mar 10-15", "Departing", ORANGE),
    ]

    for guest, room, dates, status, color in activities:
        if y + 90 > cy + ch - 160:
            break
        draw_reservation_row(draw, cx + 24, y, cw - 48, guest, room, dates, status, color)
        y += 92

    # Bottom nav
    draw_bottom_nav(draw, cx + cw, cy + ch, active_index=0)


# ─── Screenshot 2: Reservations / Calendar ────────────────────────────────

def draw_calendar_content(draw, img, cx, cy, cw, ch):
    """Draw calendar view content."""
    draw_status_bar(draw, cx + cw, cy)
    y = cy + 50

    font_header = get_font(32, bold=True)
    draw.text((cx + 24, y), "Calendar", fill=TEXT_PRIMARY, font=font_header)
    y += 50

    # Month header
    font_month = get_font(26, bold=True)
    draw.text((cx + cw // 2 - 50, y), "March 2026", fill=TEXT_PRIMARY, font=font_month)
    # Nav arrows
    font_arrow = get_font(30)
    draw.text((cx + 30, y), "<", fill=TEAL, font=font_arrow)
    draw.text((cx + cw - 50, y), ">", fill=TEAL, font=font_arrow)
    y += 50

    # Day headers
    days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    day_w = (cw - 48) // 7
    font_day = get_font(18)
    for i, d in enumerate(days):
        dx = cx + 24 + i * day_w
        bbox = draw.textbbox((0, 0), d, font=font_day)
        tw = bbox[2] - bbox[0]
        draw.text((dx + day_w // 2 - tw // 2, y), d, fill=TEXT_TERTIARY, font=font_day)
    y += 32

    # Calendar grid
    font_num = get_font(22)
    start_day = 6  # March 2026 starts on Sunday (index 6)
    today = 15
    for week in range(6):
        for dow in range(7):
            day_num = week * 7 + dow - start_day + 1
            if day_num < 1 or day_num > 31:
                continue
            dx = cx + 24 + dow * day_w
            cell_x = dx + 4
            cell_y = y + 4
            cell_s = day_w - 8

            # Highlight today
            if day_num == today:
                draw.ellipse([cell_x + cell_s//2 - 18, cell_y + 2, cell_x + cell_s//2 + 18, cell_y + 38],
                             fill=TEAL)
                color = WHITE
            else:
                color = TEXT_PRIMARY

            bbox = draw.textbbox((0, 0), str(day_num), font=font_num)
            tw = bbox[2] - bbox[0]
            draw.text((cell_x + cell_s // 2 - tw // 2, cell_y + 6), str(day_num), fill=color, font=font_num)

            # Booking indicators (colored dots)
            if day_num in [3, 4, 5, 8, 9, 10, 11, 14, 15, 16, 17, 18, 20, 21, 22, 25, 26, 27]:
                dot_colors = [TEAL, ORANGE, SUCCESS]
                dot_color = dot_colors[day_num % 3]
                draw.ellipse([cell_x + cell_s//2 - 4, cell_y + 40, cell_x + cell_s//2 + 4, cell_y + 48],
                             fill=dot_color)

        y += 58

    y += 10

    # Upcoming reservations
    font_section = get_font(24, bold=True)
    draw.text((cx + 24, y), "Upcoming", fill=TEXT_PRIMARY, font=font_section)
    y += 40

    upcoming = [
        ("Lisa Park", "Room 203", "Mar 16-19", "Confirmed", SUCCESS),
        ("David Lee", "Suite 501", "Mar 17-22", "Confirmed", SUCCESS),
        ("Maria Garcia", "Room 112", "Mar 18-20", "Pending", WARNING),
    ]

    for guest, room, dates, status, color in upcoming:
        if y + 90 > cy + ch - 160:
            break
        draw_reservation_row(draw, cx + 24, y, cw - 48, guest, room, dates, status, color)
        y += 92

    draw_bottom_nav(draw, cx + cw, cy + ch, active_index=1)


# ─── Screenshot 3: Guest KYC / Documents ────────────────────────────────────

def draw_guest_kyc_content(draw, img, cx, cy, cw, ch):
    """Draw guest KYC/documents screen."""
    draw_status_bar(draw, cx + cw, cy)
    y = cy + 50

    font_header = get_font(32, bold=True)
    draw.text((cx + 24, y), "Guest Documents", fill=TEXT_PRIMARY, font=font_header)
    y += 50

    # Search bar
    draw_rounded_rect(draw, (cx + 24, y, cx + cw - 24, y + 52), radius=12,
                      fill=LIGHT_GRAY, outline=BORDER_COLOR, width=1)
    font_search = get_font(22)
    draw.text((cx + 60, y + 14), "Search guests...", fill=TEXT_TERTIARY, font=font_search)
    # Search icon
    draw.ellipse([cx + 34, y + 14, cx + 54, y + 34], outline=TEXT_TERTIARY, width=2)
    y += 72

    # KYC Status summary
    summary_cards = [
        ("Verified", "24", SUCCESS),
        ("Pending", "6", WARNING),
        ("Expired", "2", DANGER),
    ]
    card_w = (cw - 80) // 3
    for i, (label, count, color) in enumerate(summary_cards):
        sx = cx + 24 + i * (card_w + 16)
        draw_rounded_rect(draw, (sx, y, sx + card_w, y + 80), radius=12, fill=WHITE, outline=BORDER_COLOR, width=1)
        draw.rectangle([sx + 2, y + 2, sx + card_w - 2, y + 8], fill=color)
        font_count = get_font(30, bold=True)
        font_label = get_font(16)
        draw.text((sx + 16, y + 18), count, fill=TEXT_PRIMARY, font=font_count)
        draw.text((sx + 16, y + 52), label, fill=TEXT_SECONDARY, font=font_label)
    y += 100

    # Guest list with document status
    guests = [
        ("Carlos Martinez", "ID + Passport", "Verified", SUCCESS, "Suite 302"),
        ("Emily Johnson", "Passport", "Verified", SUCCESS, "Room 105"),
        ("James Wilson", "Driver License", "Pending", WARNING, "Villa A"),
        ("Sophia Chen", "ID Card", "Verified", SUCCESS, "Room 208"),
        ("Michael Brown", "Passport", "Pending Review", WARNING, "Suite 401"),
        ("Robert Taylor", "ID + Visa", "Expired", DANGER, "Room 315"),
        ("Anna Schmidt", "Passport", "Verified", SUCCESS, "Room 110"),
    ]

    for name, doc_type, status, color, room in guests:
        if y + 100 > cy + ch - 160:
            break

        row_h = 88
        draw_rounded_rect(draw, (cx + 24, y, cx + cw - 24, y + row_h), radius=12,
                          fill=WHITE, outline=BORDER_COLOR, width=1)

        # Avatar
        draw.ellipse([cx + 40, y + 16, cx + 84, y + 60], fill=NAVY)
        initials = ''.join(n[0] for n in name.split()[:2])
        font_init = get_font(18, bold=True)
        bbox = draw.textbbox((0, 0), initials, font=font_init)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text((cx + 62 - tw // 2, y + 34 - th // 2), initials, fill=WHITE, font=font_init)

        # Name and details
        font_name = get_font(22, bold=True)
        font_detail = get_font(16)
        draw.text((cx + 96, y + 12), name, fill=TEXT_PRIMARY, font=font_name)
        draw.text((cx + 96, y + 38), f"{doc_type}  |  {room}", fill=TEXT_SECONDARY, font=font_detail)

        # Status badge
        font_status = get_font(16, bold=True)
        bbox = draw.textbbox((0, 0), status, font=font_status)
        sw = bbox[2] - bbox[0]
        badge_x = cx + cw - sw - 54
        draw_rounded_rect(draw, (badge_x - 8, y + 58, badge_x + sw + 8, y + 80),
                          radius=10, fill=(*color, 30))
        draw.text((badge_x, y + 58), status, fill=color, font=font_status)

        y += row_h + 10

    draw_bottom_nav(draw, cx + cw, cy + ch, active_index=2)


# ─── Screenshot 4: Payments ──────────────────────────────────────────────────

def draw_payments_content(draw, img, cx, cy, cw, ch):
    """Draw payments screen."""
    draw_status_bar(draw, cx + cw, cy)
    y = cy + 50

    font_header = get_font(32, bold=True)
    draw.text((cx + 24, y), "Payments", fill=TEXT_PRIMARY, font=font_header)
    y += 50

    # Revenue overview card
    draw_rounded_rect(draw, (cx + 24, y, cx + cw - 24, y + 160), radius=16, fill=WHITE, outline=BORDER_COLOR, width=2)
    draw_gradient_rect(draw, (cx + 26, y + 2, cx + cw - 26, y + 10), TEAL, NAVY)

    font_revenue_label = get_font(20)
    font_revenue = get_font(44, bold=True)
    font_period = get_font(18)

    draw.text((cx + 44, y + 24), "Total Revenue", fill=TEXT_SECONDARY, font=font_revenue_label)
    draw.text((cx + 44, y + 52), "$48,750", fill=TEXT_PRIMARY, font=font_revenue)
    draw.text((cx + 44, y + 108), "March 2026", fill=TEXT_TERTIARY, font=font_period)

    # Mini chart bars
    bar_data = [65, 80, 55, 90, 75, 85, 95, 70, 88, 78, 92, 60, 85, 72, 88]
    bar_w = 14
    bar_spacing = 4
    bar_start_x = cx + cw - 60 - len(bar_data) * (bar_w + bar_spacing)
    max_bar_h = 80
    for i, val in enumerate(bar_data):
        bx = bar_start_x + i * (bar_w + bar_spacing)
        bh = int(val / 100 * max_bar_h)
        bar_color = TEAL if i == len(bar_data) - 1 else (*TEAL, 80)
        draw.rectangle([bx, y + 130 - bh, bx + bar_w, y + 130], fill=bar_color)

    y += 180

    # Payment filter tabs
    tabs = ["All", "Completed", "Pending", "Failed"]
    tab_x = cx + 24
    for i, tab in enumerate(tabs):
        font_tab = get_font(20, bold=(i == 0))
        bbox = draw.textbbox((0, 0), tab, font=font_tab)
        tw = bbox[2] - bbox[0]
        tab_bg = TEAL if i == 0 else LIGHT_GRAY
        tab_fg = WHITE if i == 0 else TEXT_SECONDARY
        draw_rounded_rect(draw, (tab_x, y, tab_x + tw + 28, y + 38), radius=19, fill=tab_bg)
        draw.text((tab_x + 14, y + 8), tab, fill=tab_fg, font=font_tab)
        tab_x += tw + 44
    y += 56

    # Payment transactions
    transactions = [
        ("Carlos Martinez", "Suite 302", "$1,250", "Completed", SUCCESS, "Mar 15"),
        ("Emily Johnson", "Room 105", "$680", "Completed", SUCCESS, "Mar 14"),
        ("James Wilson", "Villa A", "$2,100", "Pending", WARNING, "Mar 13"),
        ("Sophia Chen", "Room 208", "$450", "Completed", SUCCESS, "Mar 12"),
        ("David Lee", "Suite 501", "$1,890", "Pending", WARNING, "Mar 11"),
        ("Lisa Park", "Room 203", "$720", "Completed", SUCCESS, "Mar 10"),
        ("Robert Taylor", "Room 315", "$350", "Failed", DANGER, "Mar 9"),
    ]

    for name, room, amount, status, color, date in transactions:
        if y + 86 > cy + ch - 160:
            break

        row_h = 76
        draw_rounded_rect(draw, (cx + 24, y, cx + cw - 24, y + row_h), radius=12,
                          fill=WHITE, outline=BORDER_COLOR, width=1)

        # Avatar
        draw.ellipse([cx + 40, y + 14, cx + 78, y + 52], fill=ORANGE)
        initials = ''.join(n[0] for n in name.split()[:2])
        font_init = get_font(16, bold=True)
        bbox = draw.textbbox((0, 0), initials, font=font_init)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text((cx + 59 - tw // 2, y + 29 - th // 2), initials, fill=WHITE, font=font_init)

        font_name = get_font(22, bold=True)
        font_detail = get_font(16)
        draw.text((cx + 92, y + 10), name, fill=TEXT_PRIMARY, font=font_name)
        draw.text((cx + 92, y + 36), f"{room}  |  {date}", fill=TEXT_SECONDARY, font=font_detail)

        # Amount
        font_amount = get_font(22, bold=True)
        bbox = draw.textbbox((0, 0), amount, font=font_amount)
        aw = bbox[2] - bbox[0]
        draw.text((cx + cw - aw - 44, y + 10), amount, fill=TEXT_PRIMARY, font=font_amount)

        # Status
        font_status = get_font(14, bold=True)
        bbox = draw.textbbox((0, 0), status, font=font_status)
        sw = bbox[2] - bbox[0]
        draw.text((cx + cw - sw - 44, y + 42), status, fill=color, font=font_status)

        y += row_h + 8

    draw_bottom_nav(draw, cx + cw, cy + ch, active_index=3)


# ─── Screenshot 5: Property Management ──────────────────────────────────────

def draw_property_content(draw, img, cx, cy, cw, ch):
    """Draw property management screen."""
    draw_status_bar(draw, cx + cw, cy)
    y = cy + 50

    font_header = get_font(32, bold=True)
    draw.text((cx + 24, y), "Properties", fill=TEXT_PRIMARY, font=font_header)

    # Add button
    font_add = get_font(22, bold=True)
    draw_rounded_rect(draw, (cx + cw - 100, y, cx + cw - 24, y + 40), radius=12, fill=TEAL)
    draw.text((cx + cw - 82, y + 8), "+ Add", fill=WHITE, font=font_add)
    y += 56

    # Properties
    properties = [
        ("Ocean View Resort", "24 rooms", "87%", "Active", SUCCESS),
        ("Mountain Lodge", "12 rooms", "92%", "Active", SUCCESS),
        ("City Center Hotel", "36 rooms", "78%", "Active", SUCCESS),
        ("Beach Villa Complex", "8 villas", "100%", "Active", SUCCESS),
        ("Lakeside Retreat", "6 cabins", "67%", "Maintenance", WARNING),
    ]

    for name, rooms, occ, status, color in properties:
        if y + 190 > cy + ch - 160:
            break

        card_h = 170
        draw_rounded_rect(draw, (cx + 24, y, cx + cw - 24, y + card_h), radius=16,
                          fill=WHITE, outline=BORDER_COLOR, width=1)

        # Property image placeholder
        img_w = cw - 48 - 8
        draw_rounded_rect(draw, (cx + 28, y + 4, cx + cw - 28, y + 80), radius=14,
                          fill=LIGHT_GRAY)
        # Property image gradient overlay
        draw_gradient_rect(draw, (cx + 28, y + 50, cx + cw - 28, y + 80), (0, 0, 0, 0), (0, 0, 0))

        font_prop = get_font(24, bold=True)
        draw.text((cx + 44, y + 54), name, fill=WHITE, font=font_prop)

        font_detail = get_font(18)
        draw.text((cx + 44, y + 92), rooms, fill=TEXT_SECONDARY, font=font_detail)

        # Occupancy bar
        bar_x = cx + 44
        bar_y = y + 120
        bar_w = cw - 180
        bar_h = 10
        draw_rounded_rect(draw, (bar_x, bar_y, bar_x + bar_w, bar_y + bar_h), radius=5, fill=LIGHT_GRAY)
        occ_val = int(occ.replace('%', ''))
        fill_w = int(bar_w * occ_val / 100)
        draw_rounded_rect(draw, (bar_x, bar_y, bar_x + fill_w, bar_y + bar_h), radius=5, fill=TEAL)
        draw.text((bar_x + bar_w + 10, bar_y - 4), occ, fill=TEXT_PRIMARY, font=font_detail)

        # Status badge
        font_status = get_font(16, bold=True)
        bbox = draw.textbbox((0, 0), status, font=font_status)
        sw = bbox[2] - bbox[0]
        badge_x = cx + cw - sw - 54
        draw_rounded_rect(draw, (badge_x - 8, y + 140, badge_x + sw + 8, y + 162),
                          radius=10, fill=(*color, 30))
        draw.text((badge_x, y + 142), status, fill=color, font=font_status)

        y += card_h + 12

    draw_bottom_nav(draw, cx + cw, cy + ch, active_index=4)


# ─── Screenshot 6: Analytics ────────────────────────────────────────────────

def draw_analytics_content(draw, img, cx, cy, cw, ch):
    """Draw analytics screen."""
    draw_status_bar(draw, cx + cw, cy)
    y = cy + 50

    font_header = get_font(32, bold=True)
    draw.text((cx + 24, y), "Analytics", fill=TEXT_PRIMARY, font=font_header)
    y += 50

    # Period selector
    periods = ["Week", "Month", "Quarter", "Year"]
    px = cx + 24
    for i, p in enumerate(periods):
        font_p = get_font(20, bold=(i == 1))
        bbox = draw.textbbox((0, 0), p, font=font_p)
        tw = bbox[2] - bbox[0]
        bg = NAVY if i == 1 else LIGHT_GRAY
        fg = WHITE if i == 1 else TEXT_SECONDARY
        draw_rounded_rect(draw, (px, y, px + tw + 28, y + 36), radius=18, fill=bg)
        draw.text((px + 14, y + 7), p, fill=fg, font=font_p)
        px += tw + 40
    y += 56

    # Revenue chart area
    chart_h = 200
    draw_rounded_rect(draw, (cx + 24, y, cx + cw - 24, y + chart_h), radius=16,
                      fill=WHITE, outline=BORDER_COLOR, width=1)

    font_chart_title = get_font(20, bold=True)
    draw.text((cx + 44, y + 16), "Revenue Trend", fill=TEXT_PRIMARY, font=font_chart_title)

    # Chart bars
    data_points = [3200, 4500, 3800, 5200, 4800, 6100, 5500, 7200, 6800, 7800, 6500, 8100,
                   7500, 8800, 9200]
    max_val = max(data_points)
    chart_left = cx + 44
    chart_bottom = y + chart_h - 30
    chart_top = y + 50
    chart_right = cx + cw - 44
    bar_w = (chart_right - chart_left) // len(data_points) - 4

    for i, val in enumerate(data_points):
        bx = chart_left + i * (bar_w + 4)
        bh = int((val / max_val) * (chart_bottom - chart_top))
        bar_color = TEAL if i >= len(data_points) - 3 else (*TEAL[:3], 120)
        draw.rectangle([bx, chart_bottom - bh, bx + bar_w, chart_bottom], fill=bar_color)

    y += chart_h + 20

    # KPI Cards
    kpis = [
        ("Avg Daily Rate", "$185", "↑ 8%", SUCCESS),
        ("RevPAR", "$161", "↑ 12%", SUCCESS),
        ("Avg Stay", "3.2 nights", "↑ 0.3", TEAL),
        ("Guest Rating", "4.8/5", "↑ 0.2", ORANGE),
    ]

    card_w = (cw - 72) // 2
    for i, (label, value, delta, color) in enumerate(kpis):
        col = i % 2
        row = i // 2
        kx = cx + 24 + col * (card_w + 24)
        ky = y + row * 110
        draw_stat_card(draw, kx, ky, card_w, 96, label, value, color, delta)

    draw_bottom_nav(draw, cx + cw, cy + ch, active_index=4)


# ─── Screenshot 7: Communication / WhatsApp ─────────────────────────────────

def draw_communication_content(draw, img, cx, cy, cw, ch):
    """Draw communication screen."""
    draw_status_bar(draw, cx + cw, cy)
    y = cy + 50

    font_header = get_font(32, bold=True)
    draw.text((cx + 24, y), "Messages", fill=TEXT_PRIMARY, font=font_header)
    y += 56

    # Quick action buttons
    actions = [("WhatsApp", SUCCESS), ("Email", TEAL), ("SMS", NAVY)]
    ax = cx + 24
    for label, color in actions:
        font_act = get_font(20, bold=True)
        bbox = draw.textbbox((0, 0), label, font=font_act)
        tw = bbox[2] - bbox[0]
        draw_rounded_rect(draw, (ax, y, ax + tw + 36, y + 42), radius=12, fill=color)
        draw.text((ax + 18, y + 10), label, fill=WHITE, font=font_act)
        ax += tw + 50
    y += 62

    # Message threads
    threads = [
        ("Carlos Martinez", "Thank you for the info! See you...", "2m ago", True, 2),
        ("Emily Johnson", "Could you arrange late check-out?", "15m ago", True, 1),
        ("James Wilson", "The Wi-Fi password is not working", "1h ago", False, 0),
        ("Sophia Chen", "What time is breakfast served?", "2h ago", False, 0),
        ("David Lee", "Confirmed! Arriving at 3 PM.", "3h ago", False, 0),
        ("Lisa Park", "Is parking available at the hotel?", "5h ago", False, 0),
        ("Maria Garcia", "Thank you for the warm welcome!", "1d ago", False, 0),
    ]

    for name, msg, time, unread, count in threads:
        if y + 86 > cy + ch - 160:
            break

        row_h = 78
        bg = (*TEAL[:3], 15) if unread else WHITE
        draw_rounded_rect(draw, (cx + 24, y, cx + cw - 24, y + row_h), radius=12,
                          fill=WHITE, outline=BORDER_COLOR, width=1)

        # Avatar
        draw.ellipse([cx + 40, y + 14, cx + 78, y + 52], fill=TEAL if unread else TEXT_TERTIARY)
        initials = ''.join(n[0] for n in name.split()[:2])
        font_init = get_font(16, bold=True)
        bbox = draw.textbbox((0, 0), initials, font=font_init)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text((cx + 59 - tw // 2, y + 29 - th // 2), initials, fill=WHITE, font=font_init)

        # Name and message
        font_name = get_font(22, bold=unread)
        font_msg = get_font(18)
        font_time = get_font(14)
        draw.text((cx + 92, y + 10), name, fill=TEXT_PRIMARY, font=font_name)

        # Truncate message
        max_msg_w = cw - 200
        draw.text((cx + 92, y + 38), msg[:40], fill=TEXT_SECONDARY, font=font_msg)

        # Time
        bbox = draw.textbbox((0, 0), time, font=font_time)
        tw_time = bbox[2] - bbox[0]
        draw.text((cx + cw - tw_time - 44, y + 14), time, fill=TEXT_TERTIARY, font=font_time)

        # Unread badge
        if count > 0:
            badge_x = cx + cw - 56
            draw.ellipse([badge_x, y + 44, badge_x + 28, y + 68], fill=TEAL)
            font_badge = get_font(16, bold=True)
            draw.text((badge_x + 8, y + 48), str(count), fill=WHITE, font=font_badge)

        y += row_h + 8

    draw_bottom_nav(draw, cx + cw, cy + ch, active_index=4)


# ─── Screenshot 8: Settings / Onboarding ─────────────────────────────────────

def draw_onboarding_content(draw, img, cx, cy, cw, ch):
    """Draw an onboarding/feature overview screen."""
    draw_status_bar(draw, cx + cw, cy, dark=True)

    # Full gradient background
    draw_gradient_rect(draw, (cx, cy, cx + cw, cy + ch), NAVY, TEAL)

    y = cy + 80

    # Logo
    try:
        logo = Image.open(os.path.join(ASSETS_DIR, 'logo.png'))
        logo_size = 120
        logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
        logo_x = cx + cw // 2 - logo_size // 2
        # Create white circle background for logo
        draw.ellipse([logo_x - 20, y - 20, logo_x + logo_size + 20, y + logo_size + 20],
                     fill=WHITE)
        img.paste(logo, (logo_x, y), logo if logo.mode == 'RGBA' else None)
    except Exception:
        pass
    y += 170

    # App name
    font_app = get_font(48, bold=True)
    text = "ResIQ"
    bbox = draw.textbbox((0, 0), text, font=font_app)
    tw = bbox[2] - bbox[0]
    draw.text((cx + cw // 2 - tw // 2, y), text, fill=WHITE, font=font_app)
    y += 60

    font_by = get_font(24)
    text = "by Hostizzy"
    bbox = draw.textbbox((0, 0), text, font=font_by)
    tw = bbox[2] - bbox[0]
    draw.text((cx + cw // 2 - tw // 2, y), text, fill=(200, 225, 240), font=font_by)
    y += 80

    # Feature list
    features = [
        "Reservation Management",
        "Guest KYC & Documents",
        "Payment Tracking",
        "Calendar & Scheduling",
        "Multi-Property Support",
        "WhatsApp Integration",
        "Real-time Analytics",
        "Team Collaboration",
    ]

    font_feat = get_font(26)
    for feat in features:
        # Checkmark
        draw.ellipse([cx + 60, y + 2, cx + 90, y + 32], fill=SUCCESS)
        font_check = get_font(18, bold=True)
        draw.text((cx + 68, y + 5), "✓", fill=WHITE, font=font_check)

        draw.text((cx + 104, y + 2), feat, fill=WHITE, font=font_feat)
        y += 48

    y += 30

    # CTA button
    btn_w = cw - 120
    btn_x = cx + 60
    draw_rounded_rect(draw, (btn_x, y, btn_x + btn_w, y + 60), radius=30, fill=ORANGE)
    font_cta = get_font(26, bold=True)
    text = "Get Started Free"
    bbox = draw.textbbox((0, 0), text, font=font_cta)
    tw = bbox[2] - bbox[0]
    draw.text((btn_x + btn_w // 2 - tw // 2, y + 16), text, fill=WHITE, font=font_cta)


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("Generating Play Store screenshots for ResIQ...\n")

    # Phone screenshots (1080x1920)
    screenshots = [
        {
            'headline': 'Smart Dashboard',
            'subtext': 'Real-time overview of your\nproperty operations',
            'draw_fn': draw_dashboard_content,
            'filename': 'phone-01-dashboard.png',
        },
        {
            'headline': 'Calendar View',
            'subtext': 'Visual booking calendar\nwith availability tracking',
            'draw_fn': draw_calendar_content,
            'filename': 'phone-02-calendar.png',
        },
        {
            'headline': 'Guest KYC & Documents',
            'subtext': 'Digital document verification\nand guest management',
            'draw_fn': draw_guest_kyc_content,
            'filename': 'phone-03-guest-kyc.png',
        },
        {
            'headline': 'Payment Tracking',
            'subtext': 'Complete payment management\nand revenue insights',
            'draw_fn': draw_payments_content,
            'filename': 'phone-04-payments.png',
        },
        {
            'headline': 'Multi-Property',
            'subtext': 'Manage all your properties\nfrom a single platform',
            'draw_fn': draw_property_content,
            'filename': 'phone-05-properties.png',
        },
        {
            'headline': 'Analytics & Reports',
            'subtext': 'Data-driven insights for\nbetter decision making',
            'draw_fn': draw_analytics_content,
            'filename': 'phone-06-analytics.png',
        },
        {
            'headline': 'Guest Communication',
            'subtext': 'WhatsApp, Email & SMS\nall in one place',
            'draw_fn': draw_communication_content,
            'filename': 'phone-07-messages.png',
        },
    ]

    print("Phone screenshots (1080x1920):")
    for ss in screenshots:
        create_promo_screenshot(
            PHONE_W, PHONE_H,
            ss['headline'], ss['subtext'],
            ss['draw_fn'], ss['filename']
        )

    # Feature overview / onboarding (standalone, no frame)
    print("\nFeature overview screenshot:")
    img = Image.new('RGB', (PHONE_W, PHONE_H), NAVY)
    draw = ImageDraw.Draw(img)
    draw_onboarding_content(draw, img, 0, 0, PHONE_W, PHONE_H)
    img.save(os.path.join(OUTPUT_DIR, 'phone-08-features.png'), 'PNG', optimize=True)
    print("  Generated phone-08-features.png")

    # Also generate the manifest-referenced screenshots
    print("\nManifest-referenced screenshots:")

    # dashboard-mobile.png (540x720 as per manifest)
    img_dash = Image.open(os.path.join(OUTPUT_DIR, 'phone-01-dashboard.png'))
    img_dash_resized = img_dash.resize((540, 720), Image.Resampling.LANCZOS)
    img_dash_resized.save(os.path.join(OUTPUT_DIR, 'dashboard-mobile.png'), 'PNG', optimize=True)
    print("  Generated dashboard-mobile.png (540x720)")

    # reservations-mobile.png
    img_cal = Image.open(os.path.join(OUTPUT_DIR, 'phone-02-calendar.png'))
    img_cal_resized = img_cal.resize((540, 720), Image.Resampling.LANCZOS)
    img_cal_resized.save(os.path.join(OUTPUT_DIR, 'reservations-mobile.png'), 'PNG', optimize=True)
    print("  Generated reservations-mobile.png (540x720)")

    # Desktop versions (1280x800 as per manifest)
    print("\nDesktop screenshots (1280x800):")
    for src, dst, label in [
        ('phone-01-dashboard.png', 'dashboard-desktop.png', 'Dashboard Desktop'),
        ('phone-06-analytics.png', 'analytics-desktop.png', 'Analytics Desktop'),
    ]:
        img_src = Image.open(os.path.join(OUTPUT_DIR, src))
        # Create a desktop-sized image with the phone screenshot centered
        img_desktop = Image.new('RGB', (1280, 800), OFF_WHITE)
        draw_desktop = ImageDraw.Draw(img_desktop)
        draw_gradient_rect(draw_desktop, (0, 0, 1280, 200), NAVY, TEAL)

        # Place phone screenshot scaled down in center
        phone_h = 700
        phone_w = int(PHONE_W * phone_h / PHONE_H)
        img_phone = img_src.resize((phone_w, phone_h), Image.Resampling.LANCZOS)
        img_desktop.paste(img_phone, (1280 // 2 - phone_w // 2, 80))

        img_desktop.save(os.path.join(OUTPUT_DIR, dst), 'PNG', optimize=True)
        print(f"  Generated {dst}")

    print(f"\nAll screenshots saved to: {OUTPUT_DIR}")
    print(f"Total files generated: {len(os.listdir(OUTPUT_DIR))}")


if __name__ == '__main__':
    main()
