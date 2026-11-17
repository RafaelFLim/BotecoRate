"""Gera os cinco Word a partir do subconjunto Markdown usado em docs.

Execute de qualquer diretório. --check valida hash e texto dos Word existentes.
O parser aceita títulos, parágrafos, listas, tabelas, código e links explícitos.
Sintaxe estrutural não suportada é recusada para evitar perda silenciosa.
"""
from __future__ import annotations

import argparse
import hashlib
import re
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor
from docx.opc.constants import RELATIONSHIP_TYPE as RT

DOCS = Path(__file__).resolve().parents[1] / 'docs'
NAMES = ('README', 'REGRAS_DE_NEGOCIO', 'BANCO_E_ARQUITETURA',
         'DESENVOLVIMENTO_E_TESTES', 'HISTORICO_E_DECISOES')
INLINE = re.compile(r'(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^\s)]+\))')
LINK = re.compile(r'\[([^\]]+)\]\(([^\s)]+)\)')
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
      'cp': 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties'}


def inline_parts(text):
    for part in INLINE.split(text):
        if not part:
            continue
        link = LINK.fullmatch(part)
        if link:
            yield 'link', link[1], link[2]
        elif part.startswith('`'):
            yield 'code', part[1:-1], None
        elif part.startswith('**'):
            yield 'bold', part[2:-2], None
        else:
            yield 'text', part, None


def visible(text):
    return ''.join(value for _, value, _ in inline_parts(text))


def cells(line):
    return [cell.strip() for cell in line.strip().strip('|').split('|')]


def parse(source):
    lines = source.splitlines()
    blocks = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith('```'):
            start = i
            code = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                code.append(lines[i])
                i += 1
            if i == len(lines):
                raise ValueError(f'Bloco de código aberto na linha {start + 1}')
            blocks.append(('code', code))
            i += 1
        elif line.startswith('#'):
            heading = re.fullmatch(r'(#{1,3}) (.+)', line)
            if not heading:
                raise ValueError(f'Título não suportado na linha {i + 1}')
            blocks.append(('heading', (len(heading[1]), heading[2])))
            i += 1
        elif line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                rows.append(cells(lines[i]))
                i += 1
            if len(rows) < 2 or not all(re.fullmatch(r':?-{3,}:?', c) for c in rows[1]):
                raise ValueError('Tabela Markdown sem separador válido')
            del rows[1]
            if any(len(row) != len(rows[0]) for row in rows):
                raise ValueError('Tabela com quantidades diferentes de colunas')
            blocks.append(('table', rows))
        elif re.match(r'^(?:- |\d+\. )', line):
            match = re.match(r'^(-|\d+\.) (.+)$', line)
            blocks.append(('list', ('• ' if match[1] == '-' else match[1] + ' ', match[2])))
            i += 1
        else:
            if re.match(r'^(?:>|<|!\[|---$|\s{2,})', line):
                raise ValueError(f'Sintaxe não suportada na linha {i + 1}')
            paragraph = [line]
            i += 1
            while i < len(lines) and lines[i].strip():
                if re.match(r'^(?:#|\||```|- |\d+\. )', lines[i]):
                    break
                paragraph.append(lines[i])
                i += 1
            blocks.append(('paragraph', ' '.join(paragraph)))
    if not blocks or blocks[0][0] != 'heading' or blocks[0][1][0] != 1:
        raise ValueError('Documento deve começar com título de nível 1')
    return blocks


def expected_text(blocks):
    values = []
    for kind, value in blocks:
        if kind == 'heading':
            values.append(visible(value[1]))
        elif kind == 'table':
            values.extend(visible(cell) for row in value for cell in row)
        elif kind == 'code':
            values.extend(value)
        elif kind == 'list':
            values.append(value[0] + visible(value[1]))
        else:
            values.append(visible(value))
    return values


def put_inline(paragraph, text, table=False):
    for kind, value, target in inline_parts(text):
        if kind == 'link':
            link = OxmlElement('w:hyperlink')
            link.set(qn('r:id'), paragraph.part.relate_to(target, RT.HYPERLINK, is_external=True))
            run = OxmlElement('w:r')
            props = OxmlElement('w:rPr')
            color = OxmlElement('w:color')
            color.set(qn('w:val'), '18599A')
            props.append(color)
            run.append(props)
            text_el = OxmlElement('w:t')
            text_el.text = value
            run.append(text_el)
            link.append(run)
            paragraph._p.append(link)
        else:
            run = paragraph.add_run(value)
            if kind == 'bold':
                run.bold = True
            if kind == 'code':
                run.font.name = 'Consolas'
                run.font.size = Pt(8 if table else 9)


def no_split(row):
    node = OxmlElement('w:cantSplit')
    row._tr.get_or_add_trPr().append(node)


def make_doc(name, source, blocks):
    doc = Document()
    section = doc.sections[0]
    section.page_width, section.page_height = Cm(21), Cm(29.7)
    section.top_margin, section.bottom_margin = Cm(1.9), Cm(1.9)
    section.left_margin, section.right_margin = Cm(1.9), Cm(1.9)
    section.header_distance, section.footer_distance = Cm(.8), Cm(.8)
    normal = doc.styles['Normal']
    normal.font.name, normal.font.size = 'Calibri', Pt(10.5)
    normal.font.color.rgb = RGBColor(0, 0, 0)
    normal.paragraph_format.space_after = Pt(7)
    normal.paragraph_format.line_spacing = 1.1
    normal.paragraph_format.widow_control = True
    for style_name, size in [('Title', 24), ('Heading 1', 15), ('Heading 2', 12)]:
        style = doc.styles[style_name]
        style.font.name, style.font.size = 'Calibri', Pt(size)
        style.font.color.rgb = RGBColor(0, 0, 0)
        for border in list(style.element.findall('.//' + qn('w:pBdr'))):
            border.getparent().remove(border)
        style.font.underline = False
        style.paragraph_format.space_before = Pt(12 if style_name != 'Title' else 0)
        style.paragraph_format.space_after = Pt(7)
        style.paragraph_format.keep_with_next = True
    section.header.paragraphs[0].text = 'BotecoRate  •  Documentação do projeto'
    section.header.paragraphs[0].runs[0].font.size = Pt(8)
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    footer.add_run('BotecoRate  •  ')
    field = OxmlElement('w:fldSimple')
    field.set(qn('w:instr'), 'PAGE')
    footer._p.append(field)
    for run in footer.runs:
        run.font.size = Pt(8)
    doc.core_properties.title = visible(blocks[0][1][1])
    doc.core_properties.author = 'Rafael Ferreira e Emanuel Franco'
    doc.core_properties.subject = 'Documentação consolidada do BotecoRate'
    doc.core_properties.keywords = 'source-sha256:' + hashlib.sha256(source.encode('utf-8')).hexdigest()
    for kind, value in blocks:
        if kind == 'heading':
            level, text = value
            put_inline(doc.add_paragraph(style='Title' if level == 1 else f'Heading {level - 1}'), text)
        elif kind == 'paragraph':
            put_inline(doc.add_paragraph(), value)
        elif kind == 'list':
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(.35)
            p.paragraph_format.first_line_indent = Cm(-.35)
            p.add_run(value[0])
            put_inline(p, value[1])
        elif kind == 'code':
            for index, line in enumerate(value):
                p = doc.add_paragraph()
                p.paragraph_format.space_after = Pt(0 if index < len(value) - 1 else 7)
                p.paragraph_format.line_spacing = 1
                p.paragraph_format.keep_with_next = index < len(value) - 1
                run = p.add_run(line)
                run.font.name, run.font.size = 'Consolas', Pt(8.5)
                shade = OxmlElement('w:shd')
                shade.set(qn('w:fill'), 'F2F4F7')
                p._p.get_or_add_pPr().append(shade)
        elif kind == 'table':
            rows = value
            table = doc.add_table(rows=0, cols=len(rows[0]))
            table.style = 'Table Grid'
            table.autofit = False
            count = len(rows[0])
            weights = [0.34, 0.66] if count == 2 else ([.23, .39, .38] if count == 3 else [.18, .30, .26, .26])
            # Identificadores de arquivos precisam de espaço maior no índice.
            if name == 'README' and count == 4:
                weights = [.18, .38, .22, .22]
            widths = [Cm(17.2 * weight) for weight in weights]
            for col, width in zip(table.columns, widths):
                col.width = width
            for row_index, values in enumerate(rows):
                row = table.add_row()
                no_split(row)
                if row_index == 0:
                    repeat = OxmlElement('w:tblHeader')
                    row._tr.get_or_add_trPr().append(repeat)
                for cell, text, width in zip(row.cells, values, widths):
                    cell.width = width
                    p = cell.paragraphs[0]
                    p.paragraph_format.space_after = Pt(4)
                    p.paragraph_format.space_before = Pt(4)
                    p.paragraph_format.line_spacing = 1.04
                    if row_index == len(rows) - 2:
                        p.paragraph_format.keep_with_next = True
                    put_inline(p, text, table=True)
                    for run in p.runs:
                        if run.font.name != 'Consolas':
                            run.font.size = Pt(9)
                        run.bold = row_index == 0 or run.bold
                    if row_index == 0:
                        shade = OxmlElement('w:shd')
                        shade.set(qn('w:fill'), 'E9EDF2')
                        cell._tc.get_or_add_tcPr().append(shade)
    target = DOCS / f'{name}.docx'
    doc.save(target)
    return target


def check_doc(target, source, blocks):
    with ZipFile(target) as archive:
        root = ET.fromstring(archive.read('word/document.xml'))
        body = root.find('w:body', NS)
        # Inclui hyperlinks, tabelas, código e caracteres de tabulação.
        actual = []
        for paragraph in body.findall('.//w:p', NS):
            pieces = []
            for node in paragraph.iter():
                if node.tag == qn('w:t'):
                    pieces.append(node.text or '')
                elif node.tag == qn('w:tab'):
                    pieces.append('\t')
                elif node.tag == qn('w:br'):
                    pieces.append('\n')
            actual.append(''.join(pieces))
        expected = expected_text(blocks)
        if actual != expected:
            mismatch = next((i for i, pair in enumerate(zip(actual, expected)) if pair[0] != pair[1]), min(len(actual), len(expected)))
            raise ValueError(f'{target.name}: texto diferente na posição {mismatch}')
        props = ET.fromstring(archive.read('docProps/core.xml'))
        expected_hash = 'source-sha256:' + hashlib.sha256(source.encode('utf-8')).hexdigest()
        if props.findtext('cp:keywords', namespaces=NS) != expected_hash:
            raise ValueError(f'{target.name}: fonte Markdown desatualizada')
        links = [target for kind, value in blocks for text in
                 ([value[1]] if kind in ('heading', 'list') else
                  [cell for row in value for cell in row] if kind == 'table' else
                  [value] if kind == 'paragraph' else [])
                 for part, _, target in inline_parts(text) if part == 'link']
        rel_root = ET.fromstring(archive.read('word/_rels/document.xml.rels'))
        actual_links = {r.attrib['Target'] for r in rel_root if r.attrib.get('Type') == RT.HYPERLINK}
        if actual_links != set(links):
            raise ValueError(f'{target.name}: destinos de links diferentes')
    return len(expected)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verifica os Word existentes sem escrever')
    args = parser.parse_args()
    for name in NAMES:
        source = (DOCS / f'{name}.md').read_text(encoding='utf-8')
        blocks = parse(source)
        target = DOCS / f'{name}.docx'
        if not args.check:
            make_doc(name, source, blocks)
        count = check_doc(target, source, blocks)
        print(f'{target.name}: OK ({count} blocos de texto; hash e links conferidos)')


if __name__ == '__main__':
    main()
