from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image, ImageEnhance
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_ALIGN_VERTICAL, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "documents"
TMP = ROOT / "tmp" / "leaflet"
OUT.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)

DOCX_PATH = OUT / "Ganpati_Agro_Farmer_Information_Leaflet.docx"
PHOTO_PATH = ROOT / "public" / "images" / "about-farm.jpg"
LOGO_PATH = ROOT / "public" / "brand" / "logo-icon.png"
CROPPED_PHOTO = TMP / "about-farm-banner.jpg"


GREEN = "1F6B3A"
DEEP_GREEN = "123B24"
GOLD = "D99A2B"
FRESH = "6FAF45"
EARTH = "7A5635"
SKY = "3D8FBF"
WARM = "FAFAF7"
PALE_GREEN = "EFF6F0"
PALE_GOLD = "FFF6E5"
BORDER = "D9D9D9"
TEXT = "1C241E"
MUTED = "667067"
WHITE = "FFFFFF"
FONT = "Nirmala UI"


def set_cell_shading(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_border(cell, color: str = BORDER, size: str = "8") -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = "w:" + edge
        node = borders.find(qn(tag))
        if node is None:
            node = OxmlElement(tag)
            borders.append(node)
        node.set(qn("w:val"), "single")
        node.set(qn("w:sz"), size)
        node.set(qn("w:space"), "0")
        node.set(qn("w:color"), color)


def set_cell_margins(cell, top=150, start=170, bottom=150, end=170) -> None:
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn("w:" + margin))
        if node is None:
            node = OxmlElement("w:" + margin)
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_cell_width(cell, width_twips: int) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_w = tc_pr.find(qn("w:tcW"))
    if tc_w is None:
        tc_w = OxmlElement("w:tcW")
        tc_pr.append(tc_w)
    tc_w.set(qn("w:w"), str(width_twips))
    tc_w.set(qn("w:type"), "dxa")


def prevent_row_split(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    cant_split = OxmlElement("w:cantSplit")
    tr_pr.append(cant_split)


def set_repeat_table_header(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def set_font(run, size: float | None = None, bold: bool | None = None,
             color: str | None = None, italic: bool | None = None) -> None:
    run.font.name = FONT
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), FONT)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), FONT)
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), FONT)
    run._element.get_or_add_rPr().rFonts.set(qn("w:cs"), FONT)
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if color is not None:
        run.font.color.rgb = RGBColor.from_string(color)
    if italic is not None:
        run.italic = italic


def format_paragraph(paragraph, before=0, after=6, line=1.12,
                     align: WD_ALIGN_PARAGRAPH | None = None, keep=False) -> None:
    pf = paragraph.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    pf.line_spacing = line
    if align is not None:
        paragraph.alignment = align
    if keep:
        pf.keep_with_next = True


def add_text(paragraph, text: str, size=11.2, bold=False, color=TEXT,
             italic=False) -> None:
    run = paragraph.add_run(text)
    set_font(run, size=size, bold=bold, color=color, italic=italic)


def add_body(doc_or_cell, text: str, *, bold_lead: str | None = None,
             align: WD_ALIGN_PARAGRAPH = WD_ALIGN_PARAGRAPH.LEFT,
             size=11.2, after=6, color=TEXT) -> object:
    p = doc_or_cell.add_paragraph()
    format_paragraph(p, after=after, line=1.12, align=align)
    if bold_lead and text.startswith(bold_lead):
        add_text(p, bold_lead, size=size, bold=True, color=color)
        add_text(p, text[len(bold_lead):], size=size, color=color)
    else:
        add_text(p, text, size=size, color=color)
    return p


def add_bullets(doc_or_cell, items: Iterable[str], *, size=10.9, color=TEXT,
                left=0.45, hanging=0.18, after=4) -> None:
    for item in items:
        p = doc_or_cell.add_paragraph()
        p.style = "List Bullet"
        pf = p.paragraph_format
        pf.left_indent = Inches(left)
        pf.first_line_indent = Inches(-hanging)
        pf.space_after = Pt(after)
        pf.line_spacing = 1.08
        add_text(p, item, size=size, color=color)


def add_eyebrow(doc, text: str) -> None:
    p = doc.add_paragraph()
    format_paragraph(p, after=4, keep=True)
    add_text(p, text.upper(), size=8.4, bold=True, color=GREEN)


def add_heading(doc_or_cell, marathi: str, english: str | None = None,
                level=1, before=0, after=8) -> object:
    p = doc_or_cell.add_paragraph(style=f"Heading {level}")
    format_paragraph(p, before=before, after=after, keep=True)
    add_text(p, marathi, size=20 if level == 1 else 14.5, bold=True, color="000000")
    if english:
        add_text(p, f"  {english}", size=10.2 if level == 1 else 9.2,
                 bold=False, color=MUTED)
    return p


def add_small_rule(doc, color=GOLD) -> None:
    p = doc.add_paragraph()
    format_paragraph(p, before=0, after=10)
    p.paragraph_format.right_indent = Inches(5.8)
    p_pr = p._p.get_or_add_pPr()
    pbdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "18")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), color)
    pbdr.append(bottom)
    p_pr.append(pbdr)


def add_page_break(doc) -> None:
    p = doc.add_paragraph()
    p.add_run().add_break(WD_BREAK.PAGE)


def add_page_kicker(doc, page_no: int, label: str) -> None:
    p = doc.add_paragraph()
    format_paragraph(p, after=3, align=WD_ALIGN_PARAGRAPH.RIGHT)
    add_text(p, f"{page_no:02d}   {label}", size=8.4, bold=True, color=GREEN)


def style_table(table, widths: list[int] | None = None) -> None:
    table.autofit = False
    table.alignment = 1
    for row in table.rows:
        prevent_row_split(row)
        for idx, cell in enumerate(row.cells):
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            set_cell_border(cell)
            set_cell_margins(cell)
            if widths:
                set_cell_width(cell, widths[idx])


def replace_cell_text(cell, text: str, *, size=10.5, bold=False,
                      color=TEXT, align=WD_ALIGN_PARAGRAPH.LEFT) -> None:
    cell.text = ""
    p = cell.paragraphs[0]
    format_paragraph(p, after=0, line=1.08, align=align)
    add_text(p, text, size=size, bold=bold, color=color)


def add_header_row(table, headers: list[str], fill=DEEP_GREEN) -> None:
    row = table.rows[0]
    set_repeat_table_header(row)
    for idx, text in enumerate(headers):
        cell = row.cells[idx]
        set_cell_shading(cell, fill)
        replace_cell_text(cell, text, size=10.2, bold=True, color=WHITE,
                          align=WD_ALIGN_PARAGRAPH.CENTER)


def crop_banner(source: Path, target: Path) -> None:
    with Image.open(source) as image:
        image = image.convert("RGB")
        target_ratio = 2.25
        current_ratio = image.width / image.height
        if current_ratio > target_ratio:
            new_width = int(image.height * target_ratio)
            left = (image.width - new_width) // 2
            image = image.crop((left, 0, left + new_width, image.height))
        else:
            new_height = int(image.width / target_ratio)
            top = max(0, int((image.height - new_height) * 0.34))
            image = image.crop((0, top, image.width, top + new_height))
        image = image.resize((1800, 800), Image.Resampling.LANCZOS)
        image = ImageEnhance.Color(image).enhance(0.92)
        image = ImageEnhance.Contrast(image).enhance(1.04)
        image.save(target, quality=93, optimize=True)


def add_footer(section) -> None:
    footer = section.footer
    footer.is_linked_to_previous = True
    p = footer.paragraphs[0]
    format_paragraph(p, before=2, after=0, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_text(p, "श्री गणपती ॲग्रो प्रोड्युसर कंपनी लिमिटेड   •   +91 70300 39005   •   ",
             size=8.2, color=MUTED)
    run = p.add_run()
    fld_char1 = OxmlElement("w:fldChar")
    fld_char1.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "end")
    run._r.append(fld_char1)
    run._r.append(instr)
    run._r.append(fld_char2)
    set_font(run, size=8.2, color=MUTED)


def set_core_properties(doc: Document) -> None:
    props = doc.core_properties
    props.title = "Ganpati Agro Farmer Information Leaflet"
    props.subject = "Farmer-facing company and membership information"
    props.author = "Shri Ganpati Agro Producer Company Limited"
    props.keywords = "Ganpati Agro, farmer, membership, registration, Maharashtra"


def configure_document(doc: Document) -> None:
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.45)
    section.bottom_margin = Cm(1.45)
    section.left_margin = Cm(1.7)
    section.right_margin = Cm(1.7)
    section.header_distance = Cm(0.55)
    section.footer_distance = Cm(0.6)

    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = FONT
    normal.font.size = Pt(11.2)
    normal.font.color.rgb = RGBColor.from_string(TEXT)
    normal._element.rPr.rFonts.set(qn("w:ascii"), FONT)
    normal._element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    normal._element.rPr.rFonts.set(qn("w:cs"), FONT)

    title = styles["Title"]
    title.font.name = FONT
    title.font.size = Pt(25)
    title.font.bold = True
    title.font.color.rgb = RGBColor(0, 0, 0)
    title._element.rPr.rFonts.set(qn("w:ascii"), FONT)
    title._element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
    title._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    title._element.rPr.rFonts.set(qn("w:cs"), FONT)

    for level, size in ((1, 20), (2, 14.5)):
        style = styles[f"Heading {level}"]
        style.font.name = FONT
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor(0, 0, 0)
        style._element.rPr.rFonts.set(qn("w:ascii"), FONT)
        style._element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
        style._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
        style._element.rPr.rFonts.set(qn("w:cs"), FONT)

    list_bullet = styles["List Bullet"]
    list_bullet.font.name = FONT
    list_bullet.font.size = Pt(10.9)
    list_bullet._element.rPr.rFonts.set(qn("w:ascii"), FONT)
    list_bullet._element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
    list_bullet._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    list_bullet._element.rPr.rFonts.set(qn("w:cs"), FONT)

    add_footer(section)


def build_leaflet() -> None:
    crop_banner(PHOTO_PATH, CROPPED_PHOTO)
    doc = Document()
    configure_document(doc)
    set_core_properties(doc)

    # Page 1: cover and company profile
    top = doc.add_paragraph()
    format_paragraph(top, after=4, align=WD_ALIGN_PARAGRAPH.CENTER)
    logo = top.add_run()
    logo.add_picture(str(LOGO_PATH), width=Inches(1.18))
    logo._element.xpath(".//wp:docPr")[0].set("descr", "Shri Ganpati Agro company logo")

    title = doc.add_paragraph(style="Title")
    format_paragraph(title, after=5, line=1.0, align=WD_ALIGN_PARAGRAPH.CENTER, keep=True)
    add_text(title, "श्री गणपती ॲग्रो प्रोड्युसर कंपनी शेतकरी माहिती पुस्तिका",
             size=24.5, bold=True, color="000000")
    sub = doc.add_paragraph()
    format_paragraph(sub, after=10, align=WD_ALIGN_PARAGRAPH.CENTER, keep=True)
    add_text(sub, "Farmer Information Leaflet", size=11, bold=True, color=MUTED)

    p = doc.add_paragraph()
    format_paragraph(p, after=10, align=WD_ALIGN_PARAGRAPH.CENTER)
    pic = p.add_run()
    pic.add_picture(str(CROPPED_PHOTO), width=Inches(6.95))
    pic._element.xpath(".//wp:docPr")[0].set("descr", "Farmers working together in an agricultural field")

    p = doc.add_paragraph()
    format_paragraph(p, after=5, align=WD_ALIGN_PARAGRAPH.CENTER, keep=True)
    add_text(p, "शेतकऱ्यांसाठी शेतकऱ्यांच्या सोबत", size=17, bold=True, color=GREEN)
    p = doc.add_paragraph()
    format_paragraph(p, after=12, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_text(p, "Growing Farmers  Building Futures", size=10.8, bold=True, color=EARTH)

    intro = (
        "गणपती ॲग्रो प्रोड्युसर कंपनी लिमिटेड ही २०१६ पासून बळीराजाच्या सेवेत असलेली "
        "शेतकरी केंद्रित कंपनी आहे. आम्ही शेतकऱ्यांना समूहांमध्ये जोडून उत्पादन खर्च कमी करणे, "
        "बाजारपेठेशी जोडणे आणि शेतमालाचे मूल्यवर्धन करणे यासाठी कार्यरत आहोत."
    )
    add_body(doc, intro, align=WD_ALIGN_PARAGRAPH.CENTER, size=11.6, after=6)
    add_body(doc, "Farmer focused since 2016  Registered under the Companies Act 2013",
             align=WD_ALIGN_PARAGRAPH.CENTER, size=9.2, after=8, color=MUTED)

    p = doc.add_paragraph()
    format_paragraph(p, after=7, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_text(p, "एकदाच सभासदत्व शुल्क ₹500", size=14.5, bold=True, color=DEEP_GREEN)
    add_text(p, "  One time membership fee", size=9.3, color=MUTED)
    p = doc.add_paragraph()
    format_paragraph(p, after=0, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_text(p, "CIN  U01403MH2016PTC272505", size=8.8, color=MUTED)

    # Page 2: purpose and work areas
    add_page_break(doc)
    add_page_kicker(doc, 2, "आमच्याबद्दल  ABOUT US")
    add_eyebrow(doc, "आमचा उद्देश  Our purpose")
    add_heading(doc, "एकत्रित शेतीमधून मजबूत भविष्य", "A stronger future through collective agriculture")
    add_body(doc,
             "कंपनीचा भर शेतकऱ्यांना योग्य माहिती, समूहाची ताकद, तंत्रज्ञान सहाय्य, बाजार जोडणी "
             "आणि मूल्यवर्धनाच्या संधी उपलब्ध करून देण्यावर आहे.",
             size=11.5, after=12)

    table = doc.add_table(rows=3, cols=2)
    style_table(table, widths=[4800, 4800])
    rows = [
        ("व्हिजन  Vision", "देशातील शेतकऱ्यांचे एकात्मिक साखळी समूह एकमेकांना जोडून शेतीचा विकास व मूल्यवर्धन करणे."),
        ("मिशन  Mission", "शेतकऱ्यांचा उत्पादन खर्च कमी करणे, फायदेशीर बाजारपेठ उपलब्ध करून देणे आणि मूल्यवर्धन साखळीचा विकास व व्यवस्थापन करणे."),
        ("मूल्ये  Values", "शेतकरी केंद्रित विचार, अखंडता, उत्कृष्टता, संघटित कार्य, उत्तरदायित्व आणि प्रामाणिक हेतू."),
    ]
    for ridx, (label, body) in enumerate(rows):
        set_cell_shading(table.cell(ridx, 0), PALE_GREEN if ridx != 1 else PALE_GOLD)
        replace_cell_text(table.cell(ridx, 0), label, size=12.3, bold=True, color=DEEP_GREEN,
                          align=WD_ALIGN_PARAGRAPH.CENTER)
        replace_cell_text(table.cell(ridx, 1), body, size=10.8, color=TEXT)

    add_heading(doc, "आमच्या कामाचे मुख्य क्षेत्र", "What we work on", level=2, before=14, after=7)
    add_bullets(doc, [
        "उत्पादन खर्च कमी करण्यासाठी बियाणे, खते, यंत्रसामग्री आणि तंत्रज्ञान सहाय्य.",
        "शेतमालासाठी फायदेशीर बाजारपेठ आणि खरेदीदारांशी जोडणी.",
        "प्रक्रिया, पॅकिंग आणि इतर मूल्यवर्धन संधींचा विकास.",
        "पीक आणि शेतीपूरक व्यवसायांनुसार शेतकरी समूहांमध्ये सहभाग.",
        "तज्ञ मार्गदर्शन आणि सामूहिक नियोजनाद्वारे शाश्वत प्रगती.",
    ], size=11.0, after=5)

    add_heading(doc, "पीक आणि व्यवसाय समूह", "Crop and allied clusters", level=2, before=9, after=6)
    clusters = doc.add_table(rows=4, cols=3)
    style_table(clusters, widths=[3200, 3200, 3200])
    cluster_items = [
        "तृणधान्ये  Cereals", "कडधान्ये  Pulses", "तेलबिया  Oilseeds",
        "फळे  Fruits", "भाजीपाला  Vegetables", "मसाला पिके  Spices",
        "फुले  Flowers", "औषधी वनस्पती  Medicinal", "संलग्न कृषी व्यवसाय  Allied",
        "संरक्षित शेती  Protected", "कृषी वनीकरण  Agroforestry", "मशरूम  Mushroom",
    ]
    for idx, item in enumerate(cluster_items):
        cell = clusters.cell(idx // 3, idx % 3)
        set_cell_shading(cell, WARM if idx % 2 == 0 else PALE_GREEN)
        replace_cell_text(cell, item, size=9.6, bold=True, color=TEXT,
                          align=WD_ALIGN_PARAGRAPH.CENTER)

    p = doc.add_paragraph()
    format_paragraph(p, before=10, after=0, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_text(p, "योग्य आणि प्रामाणिक हेतूने शेतकऱ्यांसोबत काम करणे ही आमची बांधिलकी आहे",
             size=10.6, bold=True, color=GREEN, italic=True)

    # Page 3: membership benefits
    add_page_break(doc)
    add_page_kicker(doc, 3, "सभासदत्व  MEMBERSHIP")
    add_eyebrow(doc, "सभासद होण्याचे फायदे  Membership benefits")
    add_heading(doc, "₹500 मध्ये सक्रिय सभासदत्व", "Active membership after successful payment")
    add_body(doc,
             "नोंदणी फॉर्म पूर्ण करून ₹500 चे सुरक्षित ऑनलाइन पेमेंट यशस्वी झाल्यानंतर सभासदत्व सक्रिय होते. "
             "सभासद क्रमांक आणि पावती नोंदणीनंतर उपलब्ध होते.",
             size=11.6, after=10)

    benefits = doc.add_table(rows=4, cols=3)
    style_table(benefits, widths=[2500, 3700, 3400])
    add_header_row(benefits, ["लाभ  Benefit", "काय मिळते  What it includes", "का उपयुक्त  Why it matters"])
    benefit_rows = [
        ("शेअर प्रमाणपत्र", "कंपनीतील शेअर मालकी हक्क आणि नॉमिनी नोंदणी सुविधा", "सभासदत्वाची औपचारिक आणि कायदेशीर नोंद"),
        ("कंपनी सभासदत्व", "सर्वसाधारण सभेत मतदान आणि सभासद रजिस्टरमध्ये नोंद", "कंपनीच्या सामूहिक निर्णय प्रक्रियेत सहभाग"),
        ("समूह सहभाग", "तज्ञ मार्गदर्शन, तंत्रज्ञान सहाय्य आणि सामूहिक नियोजन", "उत्पादन खर्च, गुणवत्ता आणि बाजार जोडणीत मदत"),
    ]
    for ridx, values in enumerate(benefit_rows, start=1):
        for cidx, value in enumerate(values):
            set_cell_shading(benefits.cell(ridx, cidx), WHITE if ridx % 2 else PALE_GREEN)
            replace_cell_text(benefits.cell(ridx, cidx), value, size=9.9,
                              bold=cidx == 0, color=DEEP_GREEN if cidx == 0 else TEXT,
                              align=WD_ALIGN_PARAGRAPH.CENTER if cidx == 0 else WD_ALIGN_PARAGRAPH.LEFT)

    add_heading(doc, "सभासदांसाठी मुख्य संधी", "Member opportunities", level=2, before=14, after=6)
    add_bullets(doc, [
        "बियाणे, खते, यंत्रसामग्री आणि शेती तंत्रज्ञानाबाबत सहाय्य.",
        "शेतमालाची बाजारपेठेशी जोडणी आणि मूल्यवर्धनासाठी सामूहिक प्रयत्न.",
        "पीक किंवा शेतीपूरक व्यवसायानुसार योग्य समूहात सहभागी होण्याची संधी.",
        "कंपनीच्या MOA AOA आणि लागू नियमांनुसार सभासद अधिकार.",
    ], size=11.0, after=5)

    add_heading(doc, "रेफरल कोड", "Referral code", level=2, before=10, after=5)
    add_body(doc,
             "नोंदणी करताना रेफरल कोड देणे ऐच्छिक आहे. वैध कोड असल्यास तो पेमेंटपूर्वी भरा. "
             "पात्र रेफरल कमाई कंपनीच्या नोंदीत जमा होते आणि तिचे वितरण ऑफलाइन नोंदवले जाते.",
             size=10.8, after=8)

    note = doc.add_paragraph()
    format_paragraph(note, before=5, after=0)
    add_text(note, "महत्त्वाचे  ", size=10.7, bold=True, color=EARTH)
    add_text(note,
             "विशिष्ट लाभ, हस्तांतरण, लाभांश किंवा सेवा उपलब्धता कंपनीचे नियम, बोर्ड मान्यता आणि लागू कायद्यांनुसार ठरते.",
             size=10.7, color=TEXT)

    # Page 4: registration and payment safety
    add_page_break(doc)
    add_page_kicker(doc, 4, "नोंदणी  REGISTRATION")
    add_eyebrow(doc, "सुरक्षित डिजिटल नोंदणी  Secure digital registration")
    add_heading(doc, "नोंदणी करण्याची सोपी पद्धत", "Five simple steps")

    steps = doc.add_table(rows=6, cols=3)
    style_table(steps, widths=[900, 3100, 5600])
    add_header_row(steps, ["टप्पा", "कृती  Action", "तपशील  Details"])
    step_rows = [
        ("1", "माहिती तयार ठेवा", "पूर्ण नाव, 10 अंकी मोबाईल, जन्मतारीख, आधार, गाव तालुका जिल्हा आणि उत्पन्नाचे साधन."),
        ("2", "शेत माहिती भरा", "गट किंवा सर्वे नंबर, क्षेत्रफळ, पिके, सिंचन स्रोत आणि योग्य समूह प्रकार."),
        ("3", "खाते तयार करा", "किमान 8 अक्षरांचा पासवर्ड ठेवा. रेफरल कोड असल्यास भरा."),
        ("4", "संमती आणि पेमेंट", "माहिती तपासा, संमती द्या आणि ₹500 चे सुरक्षित Razorpay पेमेंट पूर्ण करा."),
        ("5", "पावती जतन करा", "पेमेंट पडताळल्यानंतर सभासदत्व सक्रिय होते. पावती प्रिंट करा किंवा PDF म्हणून जतन करा."),
    ]
    for ridx, values in enumerate(step_rows, start=1):
        for cidx, value in enumerate(values):
            set_cell_shading(steps.cell(ridx, cidx), WHITE if ridx % 2 else PALE_GREEN)
            replace_cell_text(steps.cell(ridx, cidx), value,
                              size=10.0 if cidx else 12.5,
                              bold=cidx in (0, 1),
                              color=GREEN if cidx == 0 else TEXT,
                              align=WD_ALIGN_PARAGRAPH.CENTER if cidx < 2 else WD_ALIGN_PARAGRAPH.LEFT)

    add_heading(doc, "पेमेंट सुरक्षिततेचे नियम", "Payment safety", level=2, before=13, after=6)
    add_bullets(doc, [
        "खात्यातून रक्कम वजा झाली पण पावती मिळाली नाही तर पुन्हा पैसे भरू नका.",
        "Check payment status वापरा किंवा कंपनीच्या अधिकृत क्रमांकावर संपर्क करा.",
        "अधिकृत कर्मचारी नोंदणीस मदत करू शकतो. रोख दिल्यास कर्मचारीच कंपनीला ₹500 ऑनलाइन भरतो आणि तुम्हाला पावती मिळणे आवश्यक आहे.",
        "पावतीची खाजगी लिंक सोशल मीडिया किंवा अनोळखी व्यक्तींना पाठवू नका.",
    ], size=10.8, after=4)

    add_heading(doc, "तुमच्या माहितीची काळजी", "Your privacy", level=2, before=8, after=5)
    add_body(doc,
             "तुमची माहिती नोंदणी, सभासदत्व आणि रेफरल सेवांसाठी वापरली जाते. आधार क्रमांक पावतीवर छापला जात नाही. "
             "फॉर्म भरताना आणि कागदपत्रे शेअर करताना फक्त अधिकृत माध्यम वापरा.",
             size=10.7, after=0)

    # Page 5: contact and checklist
    add_page_break(doc)
    add_page_kicker(doc, 5, "संपर्क  CONTACT")
    add_eyebrow(doc, "आजच संपर्क करा  Get in touch")
    add_heading(doc, "सभासद होण्यासाठी आम्ही तुमच्या सोबत आहोत", "We are here to help you join")
    add_body(doc,
             "नोंदणी लिंक, सभासदत्व, पेमेंट स्थिती किंवा पावतीबाबत मदत हवी असल्यास खालील अधिकृत संपर्क वापरा.",
             size=11.6, after=10)

    contact = doc.add_table(rows=4, cols=2)
    style_table(contact, widths=[2700, 6900])
    contact_rows = [
        ("पत्ता  Address", "बार्शी नाका, बार्शी रोड, धाराशिव, महाराष्ट्र 413501"),
        ("फोन  Phone", "+91 70300 39005   |   +91 83903 35722"),
        ("ईमेल  Email", "sganpatiagropcl@gmail.com"),
        ("कंपनी क्रमांक  CIN", "U01403MH2016PTC272505"),
    ]
    for ridx, (label, value) in enumerate(contact_rows):
        set_cell_shading(contact.cell(ridx, 0), PALE_GREEN if ridx % 2 == 0 else PALE_GOLD)
        replace_cell_text(contact.cell(ridx, 0), label, size=10.7, bold=True, color=DEEP_GREEN,
                          align=WD_ALIGN_PARAGRAPH.CENTER)
        replace_cell_text(contact.cell(ridx, 1), value, size=11.0, bold=ridx in (1, 2), color=TEXT)

    add_heading(doc, "नोंदणीपूर्वीची तपासणी", "Before you register", level=2, before=14, after=6)
    checklist = [
        "□ मोबाईल नंबर सक्रिय आहे",
        "□ आधार क्रमांक जवळ आहे",
        "□ गाव तालुका जिल्हा माहिती तयार आहे",
        "□ सर्व प्लॉटचे सर्वे नंबर क्षेत्रफळ पिके आणि सिंचन माहिती तयार आहे",
        "□ सुरक्षित पासवर्ड ठरवला आहे",
        "□ ₹500 पेमेंटसाठी UPI कार्ड किंवा इतर Razorpay पद्धत उपलब्ध आहे",
    ]
    add_bullets(doc, checklist, size=10.8, after=4)

    add_heading(doc, "वारंवार विचारले जाणारे प्रश्न", "Quick answers", level=2, before=8, after=5)
    faqs = [
        ("सभासदत्व कधी सक्रिय होते", "₹500 चे पेमेंट यशस्वीरीत्या पडताळल्यानंतर लगेच."),
        ("मी स्वतः नोंदणी करू शकतो का", "हो. तुम्ही स्वतः किंवा अधिकृत कर्मचाऱ्याच्या मदतीने नोंदणी करू शकता."),
        ("पेमेंट अडकले तर काय करावे", "पुन्हा पैसे भरू नका. पेमेंट स्थिती तपासा आणि कंपनीशी संपर्क करा."),
    ]
    for question, answer in faqs:
        p = doc.add_paragraph()
        format_paragraph(p, after=4, line=1.08)
        add_text(p, question + "  ", size=10.4, bold=True, color=GREEN)
        add_text(p, answer, size=10.4, color=TEXT)

    p = doc.add_paragraph()
    format_paragraph(p, before=9, after=3, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_text(p, "सभासद व्हा आणि सामूहिक प्रगतीचा भाग बना", size=14.2, bold=True, color=DEEP_GREEN)
    p = doc.add_paragraph()
    format_paragraph(p, after=0, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_text(p, "Join Ganpati Agro", size=10.2, bold=True, color=EARTH)

    # Remove the empty paragraph Word creates before the first table in some cells.
    doc.save(DOCX_PATH)
    print(DOCX_PATH)


if __name__ == "__main__":
    build_leaflet()
