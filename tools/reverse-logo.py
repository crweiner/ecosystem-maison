#!/usr/bin/env python3
"""
Reverse an official product mark for the forest's dark ground.

The page sets every logo as one light ink, the way each brand's own
reversed (white) mark works: coloured and dark shapes become ink, and shapes
the brand draws in white on top of them (the N in a disc, the A in a square)
become knockouts, so the forest shows through them.

    python3 tools/reverse-logo.py <source.svg|png> <out> "<source url>"

SVG in, SVG out: the original paths are kept untouched inside a mask.
PNG in, PNG out: alpha is rebuilt from how far each pixel is from white.
"""
import re
import sys
import xml.etree.ElementTree as ET

SVG_NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', SVG_NS)
WHITE = {'white', '#fff', '#ffffff', '#FFF', '#FFFFFF'}


def reverse_svg(src: str, out: str, source_url: str) -> None:
    root = ET.parse(src).getroot()
    view_box = root.get('viewBox') or f"0 0 {root.get('width')} {root.get('height')}"
    x, y, w, h = view_box.split()

    def paint(el: ET.Element) -> None:
        # Inline classes and styles belong to the source page; the mask decides colour.
        for attr in ('class', 'style', 'role', 'aria-label', 'aria-hidden'):
            el.attrib.pop(attr, None)
        for attr in ('fill', 'stroke'):
            value = el.get(attr)
            if value is None or value == 'none' or value.startswith('url('):
                continue
            el.set(attr, '#000' if value in WHITE else '#fff')
        for child in el:
            paint(child)

    defs = [c for c in root if c.tag == f'{{{SVG_NS}}}defs']
    art = [c for c in root if c.tag != f'{{{SVG_NS}}}defs']
    group = ET.Element('g', {'fill': '#000' if root.get('fill') in WHITE else ('none' if root.get('fill') == 'none' else '#fff')})
    for el in art:
        paint(el)
        group.append(el)

    svg = ET.Element(f'{{{SVG_NS}}}svg', {'viewBox': view_box, 'width': w, 'height': h})
    svg.append(ET.Comment(f' Official mark, reversed to one light ink for a dark ground. Source: {source_url} '))
    out_defs = ET.SubElement(svg, 'defs')
    for d in defs:
        for child in d:
            out_defs.append(child)
    mask = ET.SubElement(out_defs, 'mask', {'id': 'ink', 'maskUnits': 'userSpaceOnUse', 'x': x, 'y': y, 'width': w, 'height': h})
    mask.append(group)
    ET.SubElement(svg, 'rect', {'x': x, 'y': y, 'width': w, 'height': h, 'fill': '#fff', 'mask': 'url(#ink)'})
    text = ET.tostring(svg, encoding='unicode')
    open(out, 'w').write(re.sub(r'\s+', ' ', text) + '\n')


def reverse_png(src: str, out: str) -> None:
    from PIL import Image

    im = Image.open(src).convert('RGBA')
    px = im.load()
    darkest = 255
    for j in range(im.height):
        for i in range(im.width):
            r, g, b, a = px[i, j]
            if a == 255:
                darkest = min(darkest, max(r, g, b))
    for j in range(im.height):
        for i in range(im.width):
            r, g, b, a = px[i, j]
            # 0 at pure white, 1 at the mark's own darkest ink.
            ink = (255 - min(r, g, b)) / (255 - min(darkest, 200) or 1)
            px[i, j] = (255, 255, 255, round(a * max(0.0, min(1.0, ink))))
    im.save(out, optimize=True)


if __name__ == '__main__':
    source, target, url = sys.argv[1:4]
    if source.endswith('.svg'):
        reverse_svg(source, target, url)
    else:
        reverse_png(source, target)
