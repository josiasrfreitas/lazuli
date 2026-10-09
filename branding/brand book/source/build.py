"""Build the Lazuli identity kit and brand book without a browser.
Run from any directory: uv run --with pypdf python 'branding/brand book/source/build.py'
Requires librsvg's rsvg-convert. Masters preserve the user-approved Ex-libris geometry.
"""
from pathlib import Path
from copy import deepcopy
from html import escape
from tempfile import TemporaryDirectory
import json
import shutil
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
PUBLIC = REPO / 'apps/web/public/brand'
SVG = ROOT / 'assets/svg'
PNG = ROOT / 'assets/png'
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
GOLD, NAVY, DARK, WHITE, INK, MIST = '#d8ad4a', '#0f1e3d', '#12151d', '#ffffff', '#e9edf6', '#f4f6fb'
MUTED = '#52627c'
SERIF = 'Georgia, Cambria, serif'
SANS = 'Helvetica Neue, Arial, sans-serif'
PAGES = []


def root_svg(width, height, title):
    return ET.Element(f'{{{NS}}}svg', {'width': str(width), 'height': str(height), 'viewBox': f'0 0 {width} {height}', 'role': 'img', 'aria-label': title})


def artwork(kind, tone):
    return ET.parse(SVG / f'lazuli-{kind}-{tone}.svg').getroot()


def write_svg(path, root):
    ET.ElementTree(root).write(path, encoding='unicode')


def render(source, target, width=None, fmt='png'):
    args = ['rsvg-convert', '-f', fmt]
    if width:
        args += ['-w', str(width)]
    subprocess.run(args + ['-o', str(target), str(source)], check=True)


def build_assets():
    for folder in (SVG, PNG, ROOT / 'pages', ROOT / 'applications', PUBLIC):
        folder.mkdir(parents=True, exist_ok=True)
    for source in (ROOT / 'source/masters').glob('*.svg'):
        root = ET.parse(source).getroot()
        root.set('aria-label', 'Lazuli — identidade Ex-líbris')
        root.find(f'{{{NS}}}title').text = 'Lazuli — identidade Ex-líbris'
        root.find(f'{{{NS}}}desc').text = 'Assinatura adotada em outubro de 2026. Coruja em selo oval e letreiro em curvas.'
        write_svg(SVG / source.name, root)
    for tone in ('light', 'dark'):
        horizontal = root_svg(420, 120, 'Lazuli — assinatura horizontal')
        symbol = ET.SubElement(horizontal, f'{{{NS}}}g', {'transform': 'translate(4 10)'})
        symbol.extend(deepcopy(list(artwork('symbol', tone)))[2:])
        word = ET.SubElement(horizontal, f'{{{NS}}}g', {'transform': 'translate(112 12) scale(.92)'})
        word.extend(deepcopy(list(artwork('wordmark', tone)))[2:])
        write_svg(SVG / f'lazuli-horizontal-{tone}.svg', horizontal)
        small = deepcopy(artwork('symbol', tone))
        small.set('aria-label', 'Lazuli — selo para 32 pixels')
        for element in small.iter():
            if element.get('stroke-width'):
                element.set('stroke-width', '3.5')
        for group in small.findall(f'{{{NS}}}g'):
            for path in list(group):
                if path.get('d') == 'M26 49Q30 68 50 74Q70 68 74 49':
                    group.remove(path)
        write_svg(SVG / f'lazuli-symbol-small-{tone}.svg', small)
    for tone, color in [('mono-navy', NAVY), ('mono-white', WHITE), ('mono-black', '#000000')]:
        for kind in ('symbol', 'symbol-small', 'stacked', 'horizontal', 'wordmark'):
            root = deepcopy(artwork(kind, 'light'))
            for element in root.iter():
                for attr in ('fill', 'stroke'):
                    if element.get(attr, '').startswith('#'):
                        element.set(attr, color)
            root.set('aria-label', f'Lazuli — {kind} — {tone}')
            write_svg(SVG / f'lazuli-{kind}-{tone}.svg', root)
    for path in SVG.glob('*.svg'):
        render(path, PNG / path.with_suffix('.png').name, 1024 if 'symbol' in path.name else 1920)
        shutil.copyfile(path, PUBLIC / path.name)
    for tone in ('light', 'dark'):
        render(SVG / f'lazuli-symbol-small-{tone}.svg', PNG / f'lazuli-symbol-small-{tone}-32px.png', 32)
    manifest = {'version': '0.1', 'adopted': '2026-10-09', 'concept': 'Ex-líbris nas cores do Lazuli', 'origin': 'Nome escolhido pelo azul usado no início do produto e pela pedra lápis-lazúli.', 'colors': {'gold': GOLD, 'navy': NAVY, 'dark': DARK, 'white': WHITE, 'lightInk': INK, 'mist': MIST}, 'minimumDigital': {'symbol': 48, 'symbol-small': 32, 'stacked': 120, 'horizontal': 200, 'wordmark': 100}, 'files': [p.name for p in sorted(SVG.glob('*.svg'))]}
    (ROOT / 'identity.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')


def rect(x, y, w, h, fill, radius=0, stroke=None):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}"' + (f' stroke="{stroke}"' if stroke else '') + '/>'


def line(x1, y1, x2, y2, color=GOLD, width=1):
    return f'<path d="M{x1} {y1}H{x2}" stroke="{color}" stroke-width="{width}"/>' if y1 == y2 else f'<path d="M{x1} {y1}L{x2} {y2}" stroke="{color}" stroke-width="{width}"/>'


def text(x, y, content, size=22, color=NAVY, family=SANS, spacing=0):
    return f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" fill="{color}" letter-spacing="{spacing}">{escape(content)}</text>'


def lines(x, y, content, size=24, color=NAVY, family=SANS, leading=None):
    leading = leading or size * 1.45
    return ''.join(text(x, y + i * leading, row, size, color, family) for i, row in enumerate(content))


def logo(kind, tone, x, y, width):
    root = artwork(kind, tone)
    natural_width = float(root.get('width'))
    body = ''.join(ET.tostring(e, encoding='unicode') for e in root if e.tag not in (f'{{{NS}}}title', f'{{{NS}}}desc'))
    return f'<g transform="translate({x} {y}) scale({width / natural_width})">{body}</g>'


def oval(x, y, w, h, color=GOLD, sw=2):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{w/2}" fill="none" stroke="{color}" stroke-width="{sw}"/>'


def page(slug, title, body, transcript, background=WHITE, source=None):
    number = len(PAGES) + 1
    light = background in (WHITE, MIST)
    ink, subtle = (NAVY, MUTED) if light else (INK, '#b8c1d2')
    svg = f'<svg xmlns="{NS}" width="1440" height="900" viewBox="0 0 1440 900" role="img" aria-label="{escape(title)}"><title>{escape(title)}</title>'
    svg += rect(0, 0, 1440, 900, background)
    svg += text(72, 40, 'LAZULI / BRAND BOOK', 12, ink, spacing=2)
    svg += text(1090, 40, 'IDENTIDADE 01 · OUT / 2026', 11, subtle, spacing=1)
    svg += line(72, 62, 1368, 62, '#d8dfec' if light else '#2c3444')
    svg += body
    if source:
        svg += f'<a href="{source[1]}">' + text(72, 824, f'Referência: {source[0]}', 12, subtle) + '</a>'
    svg += line(72, 840, 1368, 840, '#d8dfec' if light else '#2c3444')
    svg += text(72, 872, title.upper(), 11, subtle, spacing=1)
    svg += text(1328, 872, f'{number:02}', 12, subtle)
    svg += '</svg>'
    target = ROOT / 'pages' / f'{number:02}-{slug}.svg'
    target.write_text(svg)
    render(target, target.with_suffix('.png'), 1440)
    PAGES.append({'title': title, 'file': target.name, 'svg': svg, 'transcript': transcript, 'source': source})


def application(name, width, height, body):
    root = f'<svg xmlns="{NS}" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="Lazuli — {name}"><title>Lazuli — {name}</title>{body}</svg>'
    target = ROOT / 'applications' / f'{name}.svg'
    target.write_text(root)
    render(target, target.with_suffix('.png'), width)
    return root


def embed(svg, x, y, scale):
    root = ET.fromstring(svg)
    body = ''.join(ET.tostring(e, encoding='unicode') for e in root if e.tag != f'{{{NS}}}title')
    return f'<g transform="translate({x} {y}) scale({scale})">{body}</g>'


def make_story_pages():
    body = rect(868, 63, 572, 777, NAVY)
    body += logo('horizontal', 'dark', 58, 110, 300)
    body += lines(72, 365, ['Cuidar da escola.', 'Abrir espaço', 'para aprender.'], 64, INK, SERIF, 78)
    body += lines(76, 665, ['Uma identidade que nasce do azul,', 'encontra a sabedoria e se expressa no cuidado.'], 22, '#b8c1d2')
    body += logo('symbol', 'dark', 950, 230, 400)
    body += text(994, 716, 'A PEDRA. A CORUJA. A ESCOLA.', 12, GOLD, spacing=2)
    page('cover', 'O começo da identidade', body, ['Lazuli. Cuidar da escola. Abrir espaço para aprender.', 'Uma identidade que nasce do azul, encontra a sabedoria e se expressa no cuidado.', 'Ex-líbris nas cores do Lazuli: direção adotada. Esta primeira edição desenvolve sua narrativa, seu sistema visual e aplicações de referência.'], DARK)

    body = text(72, 159, 'Tudo começou com o azul.', 54, NAVY, SERIF)
    body += rect(72, 223, 430, 545, NAVY)
    body += oval(117, 286, 340, 400, GOLD, 1.5)
    body += lines(151, 428, ['Lazuli'], 67, INK, SERIF)
    body += lines(147, 509, ['Uma cor no início.', 'Uma pedra no nome.'], 24, INK)
    body += text(563, 266, 'A ORIGEM REAL', 12, MUTED, spacing=2)
    body += lines(563, 321, ['O nome veio do azul usado no começo', 'do produto e da inspiração na pedra', 'lápis-lazúli. Essa é a primeira camada', 'da história do Lazuli.'], 29, NAVY, SERIF, 43)
    body += text(563, 545, 'O QUE A IDENTIDADE ACRESCENTA', 12, MUTED, spacing=2)
    body += lines(563, 590, ['O azul guarda essa origem. O amarelo cria presença.', 'A coruja aproxima a marca do conhecimento.', 'O selo dá a esse encontro uma assinatura própria.', '', 'A identidade cresce a partir de um motivo que já existia.'], 23, MUTED, leading=35)
    page('origin', 'O nome e a pedra', body, ['Origem contada pelo criador: o nome Lazuli foi escolhido pelo azul usado no início do produto e pela pedra lápis-lazúli.', 'A narrativa visual preserva essa origem no azul profundo. A coruja acrescenta a relação com conhecimento e educação. O amarelo é o acento da identidade atual.'])

    body = text(72, 159, 'Sabedoria com atenção.', 54, NAVY, SERIF)
    body += logo('symbol', 'light', 492, 245, 410)
    body += text(72, 295, 'SABEDORIA', 13, MUTED, spacing=2)
    body += lines(72, 343, ['Aprender, pensar,', 'fazer boas perguntas.'], 30, NAVY, SERIF)
    body += lines(72, 460, ['A coruja traz uma associação', 'com o saber e com quem ensina.', 'Atena e a coruja aparecem juntas', 'em moedas da antiga Atenas.'], 21, MUTED, leading=33)
    body += text(1000, 295, 'ATENÇÃO', 13, MUTED, spacing=2)
    body += lines(1000, 343, ['Perceber.', 'Acompanhar.', 'Cuidar.'], 30, NAVY, SERIF)
    body += lines(1000, 505, ['No Lazuli, essa atenção', 'se traduz em clareza', 'para a rotina da escola.'], 21, MUTED, leading=33)
    body += line(520, 710, 876, 710)
    body += text(450, 760, 'SERENIDADE PARA GUIAR. PRESENÇA PARA APOIAR.', 13, NAVY, spacing=1.2)
    source = ('British Museum — moeda de Atenas com Atena e coruja', 'https://www.britishmuseum.org/collection/object/C_1896-0703-233')
    page('owl', 'A coruja e a educação', body, ['A coruja representa, nesta identidade, sabedoria, atenção e serenidade. A associação com educadores foi trazida pelo criador da marca.', 'Atena e a coruja aparecem juntas em moedas da antiga Atenas, como o exemplar do British Museum citado nesta página.', 'A leitura para o Lazuli é contemporânea: perceber o que precisa de acompanhamento e apoiar as pessoas que fazem a escola acontecer.'], source=source)

    body = text(72, 165, 'A escola começa antes da aula.', 54, INK, SERIF)
    body += lines(76, 260, ['Antes da primeira palavra em outro idioma,', 'há uma turma encontrando seu horário.', 'Uma pessoa preparando o próximo encontro.', 'Uma família esperando uma resposta.'], 25, INK, leading=40)
    body += lines(76, 469, ['O aprendizado acontece com gente.', 'E gente precisa de tempo, atenção e continuidade.', '', 'Lazuli nasce para cuidar do que sustenta esse caminho:', 'ajudar a escola a organizar sua rotina e acompanhar', 'cada etapa com clareza.'], 24, '#b8c1d2', leading=39)
    body += rect(925, 230, 443, 530, NAVY)
    body += logo('symbol', 'dark', 1093, 278, 105)
    body += lines(972, 478, ['Cuidar', 'da escola.', 'Abrir espaço', 'para aprender.'], 43, INK, SERIF, 59)
    page('story', 'A história que queremos contar', body, ['Antes da primeira palavra em outro idioma, há uma turma encontrando seu horário. Uma pessoa preparando o próximo encontro. Uma família esperando uma resposta.', 'O aprendizado acontece com gente. E gente precisa de tempo, atenção e continuidade.', 'Lazuli nasce para cuidar do que sustenta esse caminho: ajudar a escola a organizar sua rotina e acompanhar cada etapa com clareza.', 'Seu nome preserva o azul do começo e a inspiração na pedra. Sua coruja traz sabedoria e atenção. Seu selo assina um compromisso de cuidado.', 'Cuidar da escola. Abrir espaço para aprender.', 'Esta é a narrativa proposta para a primeira edição, construída a partir da origem real do nome e da direção visual escolhida.'], DARK)


def contrast(a, b):
    def luminance(value):
        channels = [int(value[i:i+2], 16) / 255 for i in (1, 3, 5)]
        linear = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in channels]
        return sum(x * y for x, y in zip(linear, (.2126, .7152, .0722)))
    values = sorted((luminance(a), luminance(b)))
    return (values[1] + .05) / (values[0] + .05)


def make_identity_pages():
    body = text(72, 155, 'Uma marca, várias assinaturas.', 52, NAVY, SERIF)
    body += rect(72, 210, 600, 406, DARK, 6) + rect(696, 210, 672, 406, MIST, 6)
    body += logo('stacked', 'dark', 222, 241, 300) + logo('stacked', 'light', 882, 241, 300)
    body += text(96, 587, 'VERTICAL · PARA CAPAS E ABERTURAS', 12, INK, spacing=1)
    body += text(720, 587, 'A MESMA MARCA NO FUNDO CLARO', 12, NAVY, spacing=1)
    body += logo('horizontal', 'light', 68, 667, 400) + logo('symbol', 'light', 760, 650, 92)
    body += logo('wordmark', 'light', 1006, 662, 285)
    body += text(86, 797, 'Horizontal · app e cabeçalhos', 17, MUTED)
    body += text(725, 797, 'Selo · reconhecimento', 17, MUTED)
    body += text(1025, 797, 'Letreiro · assinatura', 17, MUTED)
    page('signatures', 'Sistema de assinaturas', body, ['A assinatura principal reúne o selo oval e o letreiro LAZULI. A vertical aparece em capas e aberturas; a horizontal cabe em cabeçalhos e espaços estreitos.', 'O selo pode aparecer sozinho quando o contexto já identifica o Lazuli. O letreiro isolado assina materiais com pouco espaço vertical.', 'As versões clara, escura e monocromáticas estão em assets/svg e assets/png. O letreiro é fornecido em curvas; deve ser usado a partir desses arquivos.'])

    body = text(72, 155, 'O azul é a origem. O amarelo, o acento.', 47, NAVY, SERIF)
    swatches = [(72, NAVY, 'Azul Lazuli', '#0F1E3D', '15 · 30 · 61', INK), (402, GOLD, 'Amarelo Lazuli', '#D8AD4A', '216 · 173 · 74', NAVY), (732, DARK, 'Carvão', '#12151D', '18 · 21 · 29', INK), (1062, WHITE, 'Branco', '#FFFFFF', '255 · 255 · 255', NAVY)]
    for x, color, name, code, rgb, ink in swatches:
        body += rect(x, 230, 306, 312, color, stroke='#d8dfec' if color == WHITE else None)
        body += text(x+24, 433, name, 24, ink, SERIF)
        body += text(x+24, 480, code, 20, ink) + text(x+24, 513, f'RGB {rgb}', 14, ink)
    body += lines(72, 604, ['Bases amplas em azul, carvão ou branco.', 'O amarelo marca a assinatura e pontos de atenção.', 'Cinza claro #F4F6FB e tinta clara #E9EDF6 apoiam a interface.'], 24, NAVY, leading=38)
    body += line(72, 725, 1368, 725, '#d8dfec')
    body += text(72, 774, f'Contraste calculado: azul/branco {contrast(NAVY, WHITE):.1f}:1 · amarelo/carvão {contrast(GOLD, DARK):.1f}:1 · amarelo/branco {contrast(GOLD, WHITE):.1f}:1.', 18, MUTED)
    body += text(72, 806, 'Em fundo branco, use azul para textos e controles pequenos; reserve o amarelo para a marca e acentos.', 17, MUTED)
    page('colors', 'Paleta e contraste', body, ['As cores vêm da interface atual do Lazuli. Azul #0F1E3D. Amarelo #D8AD4A. Carvão #12151D. Branco #FFFFFF. Apoios: #F4F6FB e #E9EDF6.', 'Bases amplas em azul, carvão ou branco; amarelo concentrado na assinatura e em pontos de atenção.', f'Contrastes calculados pela luminância relativa sRGB: azul/branco {contrast(NAVY, WHITE):.2f}:1; amarelo/carvão {contrast(GOLD, DARK):.2f}:1; amarelo/branco {contrast(GOLD, WHITE):.2f}:1.', 'Para textos e controles pequenos em fundo branco, usar azul. Arquivos digitais em RGB; a conversão para impressão depende do perfil e da prova da gráfica.'])

    body = text(72, 155, 'Letras que dão tempo à leitura.', 52, NAVY, SERIF)
    body += logo('wordmark', 'light', 58, 236, 520)
    body += text(72, 447, 'A ASSINATURA', 12, MUTED, spacing=2)
    body += lines(72, 493, ['Baskerville, em desenho convertido em curvas.', 'Maiúsculas com respiro entre as letras.', 'Usar o arquivo; manter proporções e espaçamento.'], 21, NAVY, leading=35)
    body += text(746, 270, 'Gestão com clareza.', 48, NAVY, SERIF)
    body += lines(747, 337, ['Títulos editoriais em Georgia.', 'No produto, preservar Cambria e os fallbacks', 'definidos no sistema tipográfico existente.'], 22, MUTED, leading=35)
    body += text(747, 512, 'Uma rotina que faz sentido.', 29, NAVY)
    body += lines(747, 559, ['Helvetica Neue / Segoe UI para apoio editorial.', 'Calibri / Segoe UI para números no produto.', 'Sem dependência de fontes carregadas da web.'], 21, MUTED, leading=35)
    body += line(72, 700, 1368, 700, '#d8dfec')
    body += text(72, 760, 'A marca tem uma assinatura própria. A interface conserva sua tipografia de trabalho.', 25, NAVY, SERIF)
    page('type', 'Tipografia', body, ['Letreiro da marca: desenho derivado de Baskerville, convertido em curvas nos arquivos oficiais. Não reconstruir digitando LAZULI com outra fonte.', 'Para materiais editoriais: Georgia nos títulos e Helvetica Neue com fallback Segoe UI nos textos de apoio.', 'No app, preservar os tokens existentes: Cambria/Georgia para texto e títulos; Calibri/Segoe UI para dados numéricos. O app não recebe novas fontes nesta promoção.', 'O kit inclui desenhos em curvas e não distribui arquivos de fontes.'])

    body = text(72, 155, 'Presença sem perder a delicadeza.', 51, NAVY, SERIF)
    body += rect(120, 223, 360, 360, MIST)
    body += f'<rect x="150" y="253" width="300" height="300" fill="none" stroke="{MUTED}" stroke-dasharray="5 5"/>'
    body += logo('symbol', 'light', 150, 253, 300)
    body += text(115, 637, 'Proteção mínima: 1/10 da altura do selo.', 20, NAVY)
    body += text(115, 675, 'Aplicar essa margem ao redor da assinatura inteira.', 17, MUTED)
    body += text(657, 245, 'REDUÇÕES DIGITAIS', 12, MUTED, spacing=2)
    body += logo('symbol', 'light', 660, 293, 48) + text(740, 329, 'Selo completo: a partir de 48 px.', 22, NAVY)
    body += logo('symbol-small', 'light', 668, 401, 32) + text(740, 428, 'Selo pequeno: 32 px, com ajuste óptico.', 22, NAVY)
    body += lines(657, 526, ['Assinatura vertical: largura mínima de 120 px.', 'Horizontal: 200 px. Letreiro isolado: 100 px.', 'Abaixo de 32 px, usar um suporte maior.', '', 'Na impressão, começar com selo de 8 mm e', 'confirmar a definição em uma prova física.'], 21, MUTED, leading=36)
    body += text(72, 793, 'A versão pequena reforça o traço e elimina uma linha interna; o selo principal mantém o desenho escolhido.', 18, MUTED)
    page('scale', 'Proteção e redução', body, ['Área de proteção: reservar ao menos um décimo da altura do selo ao redor da composição completa. O espaço já contido no arquivo não substitui a margem externa.', 'Larguras mínimas digitais propostas: selo completo 48 px; selo pequeno 32 px; assinatura vertical 120 px; horizontal 200 px; letreiro 100 px.', 'O selo pequeno é uma adaptação óptica: traço de 3,5 unidades no desenho de 100 unidades e uma linha interna a menos. É a versão aplicada na barra lateral a 32 px.', 'Evitar reduzir abaixo de 32 px. Para impressão, iniciar a avaliação em 8 mm de altura para o selo e ajustar depois de uma prova física.'])

    body = text(72, 155, 'Regras que preservam a marca.', 52, NAVY, SERIF)
    for x, bg, tone, caption in [(72, MIST, 'mono-navy', 'Uma cor, sem perder a forma.'), (514, NAVY, 'mono-white', 'Branco sobre uma base escura.'), (956, DARK, 'dark', 'Amarelo e tinta clara no app.')]:
        body += rect(x, 229, 412, 285, bg, 4)
        body += logo('horizontal', tone, x+26, 294, 360)
        body += text(x+20, 485, caption, 16, NAVY if bg == MIST else INK)
    body += lines(72, 597, ['Preservar o oval, o traço e o espaçamento do nome.', 'Usar o arquivo monocromático em carimbos e gravações.', 'Escolher um fundo limpo, com contraste suficiente.'], 23, NAVY, leading=39)
    body += lines(780, 597, ['Evitar distorção, inclinação e sombras.', 'Evitar gradientes e contornos adicionais.', 'Não trocar o bico, os olhos ou as letras.', 'Fotografias pedem uma área limpa para a assinatura.'], 23, MUTED, leading=39)
    page('usage', 'Usos e integridade', body, ['Preservar as proporções do selo e do letreiro. Não esticar, inclinar, alterar letras, adicionar sombra, gradiente ou contorno.', 'Usar versões monocromáticas para reprodução em uma tinta, carimbo ou gravação. A versão preta também está incluída no kit.', 'Usar fundos limpos; sobre fotografia, reservar uma área lisa. A marca não precisa estar dentro de um novo emblema ou acompanhada de adereços.', 'Os tamanhos e o uso em materiais físicos são pontos de partida desta edição e dependem da prova de produção.'])


def make_language_pages():
    body = text(72, 155, 'O selo também ensina a compor.', 52, INK, SERIF)
    for x, bg, ink in [(72, NAVY, INK), (514, WHITE, NAVY), (956, DARK, INK)]:
        body += rect(x, 224, 412, 402, bg, 5)
    body += oval(131, 255, 290, 328, GOLD, 2)
    body += lines(198, 382, ['Espaço', 'para', 'aprender.'], 35, INK, SERIF, 47)
    body += line(552, 324, 888, 324, GOLD, 3)
    body += text(552, 303, 'PRÓXIMO CAPÍTULO', 11, MUTED, spacing=2)
    body += lines(552, 392, ['Uma escola.', 'Muitas', 'possibilidades.'], 36, NAVY, SERIF, 48)
    body += oval(998, 257, 320, 327, GOLD, 1)
    body += oval(1033, 294, 250, 253, GOLD, 1)
    body += logo('symbol', 'dark', 1106, 371, 104)
    body += text(72, 682, 'MOLDURAS', 13, GOLD, spacing=2)
    body += text(514, 682, 'LINHAS', 13, GOLD, spacing=2)
    body += text(956, 682, 'CONTORNOS', 13, GOLD, spacing=2)
    body += lines(72, 725, ['O oval acolhe uma mensagem.', 'Um motivo por composição.'], 21, INK)
    body += lines(514, 725, ['Linhas organizam o conteúdo.', 'O amarelo indica uma passagem.'], 21, INK)
    body += lines(956, 725, ['Ritmo derivado do selo.', 'Usar com espaço e moderação.'], 21, INK)
    page('language', 'Linguagem gráfica', body, ['A linguagem gráfica é uma extensão proposta a partir do selo: molduras ovais, linhas finas e contornos espaçados.', 'Molduras acolhem mensagens. Linhas organizam capítulos e blocos. Contornos criam ritmo em capas e fundos institucionais.', 'Usar um motivo dominante por composição, com espaço em branco. Os grafismos são elementos de apoio; a assinatura oficial permanece íntegra.'], DARK)

    body = text(72, 155, 'Uma voz clara, atenta e próxima.', 52, NAVY, SERIF)
    body += lines(72, 260, ['Clara para orientar.', 'Atenta aos detalhes.', 'Próxima de quem trabalha.'], 41, NAVY, SERIF, 62)
    body += lines(72, 516, ['Falar com adultos, de pessoa para pessoa.', 'Nomear a ação e explicar o próximo passo.', 'Usar frases curtas e palavras conhecidas.', 'Dar à escola o protagonismo da mensagem.'], 22, MUTED, leading=39)
    examples = [('CONFIRMAÇÃO', 'Presença registrada.'), ('ESTADO VAZIO', 'Ainda não há turmas neste período.'), ('ERRO RECUPERÁVEL', 'Não foi possível salvar. Tente novamente.'), ('APRESENTAÇÃO', 'Organização para o dia a dia da escola.')]
    for i, (label, copy) in enumerate(examples):
        y = 259 + i*130
        body += text(760, y, label, 11, MUTED, spacing=1.5)
        body += text(760, y+47, copy, 23, NAVY, SERIF)
        body += line(760, y+79, 1368, y+79, '#d8dfec')
    page('voice', 'Tom de voz', body, ['A voz do Lazuli é clara, atenta e próxima. Ela fala com adultos, explica o próximo passo e evita grandiloquência.', 'Confirmação: Presença registrada. Estado vazio: Ainda não há turmas neste período. Erro recuperável: Não foi possível salvar. Tente novamente.', 'Apresentação: Organização para o dia a dia da escola.', 'Mensagem institucional curta: Do azul que deu origem ao nome à coruja que representa o saber, Lazuli reúne clareza e atenção para cuidar da rotina da escola.', 'Assinatura verbal proposta: Cuidar da escola. Abrir espaço para aprender. Não é necessário acrescentá-la a mensagens operacionais.'])


def make_application_pages():
    body = text(72, 155, 'A identidade encontra a rotina.', 52, NAVY, SERIF)
    body += rect(72, 215, 1296, 546, MIST, 8, '#d8dfec') + rect(72, 215, 244, 546, DARK, 8)
    body += logo('symbol-small', 'dark', 95, 246, 32) + logo('wordmark', 'dark', 141, 244, 135)
    for i, label in enumerate(['Início', 'Alunos', 'Turmas', 'Calendário', 'Financeiro']):
        y = 350 + i*57
        if i == 0:
            body += rect(88, y-29, 211, 43, '#1a1f2a', 4)
        body += text(111, y, label, 19, INK)
    body += text(353, 276, 'Bom dia.', 34, NAVY, SERIF)
    body += text(353, 315, 'Uma visão do que precisa de atenção hoje.', 19, MUTED)
    body += rect(353, 355, 976, 337, WHITE, 6)
    body += text(380, 401, 'Próximas turmas', 26, NAVY, SERIF)
    for i, row in enumerate([('14:00', 'Inglês · Turma A', 'Sala 01'), ('16:00', 'Inglês · Turma B', 'Sala 02'), ('18:00', 'Inglês · Turma C', 'Sala 01')]):
        y = 469 + i*73
        body += text(382, y, row[0], 19, NAVY) + text(525, y, row[1], 21, NAVY, SERIF) + text(1190, y, row[2], 18, MUTED)
        body += line(380, y+25, 1305, y+25, '#e7ecf5')
    body += text(72, 801, 'Estudo visual com conteúdo ilustrativo. A barra lateral do app recebe o selo de 32 px e o letreiro oficial.', 18, MUTED)
    page('product', 'Aplicação no produto', body, ['O selo pequeno de 32 px identifica a barra recolhida. Na barra expandida, aparece com o letreiro oficial. As cores se adaptam ao tema claro ou escuro.', 'A marca ocupa pouco espaço para que os dados da escola sejam o foco. A tipografia funcional do app permanece igual.', 'A imagem desta página é um estudo ilustrativo, com turmas e horários fictícios. A alteração real nesta entrega é a assinatura da barra lateral.'])

    report = rect(0, 0, 794, 1123, WHITE)
    report += text(65, 96, 'ESCOLA DE IDIOMAS · EXEMPLO', 14, MUTED, spacing=2)
    report += line(65, 128, 729, 128, GOLD, 3)
    report += lines(65, 263, ['Planejamento', 'do semestre'], 59, NAVY, SERIF, 76)
    report += text(65, 489, 'Coordenação pedagógica', 23, MUTED)
    report += text(65, 532, 'Material de referência da equipe', 21, MUTED)
    report += oval(507, 673, 204, 266, GOLD, 1.5)
    report += logo('symbol', 'light', 560, 746, 98)
    report += line(65, 1000, 729, 1000, '#d8dfec')
    report += text(65, 1044, 'Preparado com', 16, MUTED) + logo('wordmark', 'light', 195, 1019, 138)
    report_svg = application('report-a4', 794, 1123, report)
    notebook = rect(0, 0, 794, 1123, NAVY)
    notebook += oval(78, 73, 638, 976, GOLD, 2)
    notebook += logo('stacked', 'dark', 232, 154, 330)
    notebook += lines(188, 727, ['Ideias que', 'merecem espaço.'], 47, INK, SERIF, 66)
    notebook += text(285, 993, 'CADERNO DE APOIO', 13, GOLD, spacing=2)
    notebook_svg = application('notebook-cover', 794, 1123, notebook)
    body = text(72, 155, 'Papel para organizar. Espaço para pensar.', 48, NAVY, SERIF)
    body += rect(72, 210, 1296, 563, '#e7ecf5', 5)
    body += embed(report_svg, 230, 237, .454) + embed(notebook_svg, 843, 237, .454)
    body += text(126, 807, 'Documentos da escola preservam sua autoria; Lazuli aparece como assinatura do sistema.', 18, MUTED)
    page('paper', 'Documentos e materiais', body, ['Estudo de capa A4 para planejamento do semestre. O nome da escola tem prioridade; Lazuli aparece no rodapé como assinatura do sistema.', 'Estudo de capa de caderno institucional: azul profundo, moldura oval, marca vertical e a frase Ideias que merecem espaço.', 'As artes estão em applications/report-a4 e applications/notebook-cover, em SVG e PNG. São conceitos de aplicação, sem sangria ou perfil de impressão definidos.'])

    social = rect(0, 0, 1080, 1080, NAVY)
    social += logo('horizontal', 'dark', 66, 72, 318)
    social += lines(81, 388, ['Tempo para', 'acompanhar', 'cada conquista.'], 79, INK, SERIF, 106)
    social += line(82, 776, 995, 776, GOLD, 2)
    social += lines(83, 864, ['Cuidar da escola.', 'Abrir espaço para aprender.'], 31, INK, leading=46)
    social_svg = application('social-square', 1080, 1080, social)
    slide = rect(0, 0, 1600, 900, DARK) + rect(1092, 0, 508, 900, NAVY)
    slide += logo('horizontal', 'dark', 56, 56, 340)
    slide += lines(80, 368, ['Uma rotina', 'com mais clareza.'], 83, INK, SERIF, 108)
    slide += text(86, 697, 'Apresentação do Lazuli para a equipe', 30, '#b8c1d2')
    slide += logo('symbol', 'dark', 1180, 242, 328)
    slide_svg = application('presentation-cover', 1600, 900, slide)
    avatar = rect(0, 0, 512, 512, NAVY, 64) + logo('symbol', 'dark', 96, 96, 320)
    application('avatar', 512, 512, avatar)
    email = rect(0, 0, 1200, 360, WHITE) + line(56, 292, 1144, 292, GOLD, 3)
    email += logo('horizontal', 'light', 42, 43, 320) + text(56, 258, 'Um novo capítulo para a nossa rotina.', 39, NAVY, SERIF)
    application('email-header', 1200, 360, email)
    body = text(72, 155, 'A mesma voz em outros encontros.', 51, NAVY, SERIF)
    body += embed(social_svg, 72, 223, .48)
    body += embed(slide_svg, 654, 223, .44625)
    body += embed(f'<svg xmlns="{NS}">{avatar}</svg>', 654, 672, .16)
    body += text(769, 711, 'Post, apresentação, avatar e cabeçalho de e-mail.', 19, MUTED)
    body += text(769, 748, 'Arquivos separados, prontos para adaptar.', 19, MUTED)
    body += text(72, 800, 'Estudos de comunicação. A história se mantém; a escala e a composição mudam conforme o encontro.', 18, MUTED)
    page('communications', 'Comunicação e presença', body, ['Post quadrado: Tempo para acompanhar cada conquista. Uma frase curta, área ampla de azul e assinatura pequena.', 'Apresentação: Uma rotina com mais clareza. O selo ganha escala para marcar uma abertura.', 'Avatar: selo isolado sobre azul profundo, com respiro. Cabeçalho de e-mail: marca horizontal e uma mensagem direta.', 'As artes estão em applications, em SVG e PNG. Conteúdo demonstrativo, sem publicações ou envios realizados.'])


def make_closing():
    body = text(72, 156, 'Um começo com continuidade.', 55, INK, SERIF)
    body += lines(72, 251, ['01  Nasceu azul.', '02  Encontrou a sabedoria.', '03  Assina o cuidado.'], 43, INK, SERIF, 78)
    body += lines(77, 543, ['A origem do nome e a direção Ex-líbris estão registradas.', 'A narrativa, a voz e os usos aqui apresentados desenvolvem', 'essa base e podem amadurecer com a experiência da marca.'], 23, '#b8c1d2', leading=37)
    body += logo('stacked', 'dark', 1018, 214, 276)
    body += text(886, 587, 'O KIT DESTA EDIÇÃO', 12, GOLD, spacing=2)
    body += lines(886, 632, ['Assinaturas em SVG e PNG', 'Versões claras, escuras e de uma cor', 'Aplicações editáveis', 'Brand book em HTML e PDF'], 20, INK, leading=37)
    body += text(77, 785, 'Cuidar da escola. Abrir espaço para aprender.', 27, GOLD, SERIF)
    page('continuity', 'Arquivos e próximos capítulos', body, ['Direção adotada pelo criador em 9 de outubro de 2026: Ex-líbris nas cores atuais do Lazuli. Nome escolhido pela cor azul usada no início do produto e pela pedra lápis-lazúli.', 'Esta edição propõe narrativa, assinatura verbal, regras de uso, adaptação óptica para 32 px e aplicações. A base visual escolhida foi preservada.', 'O kit contém masters da composição aprovada, assinaturas SVG e PNG, versões monocromáticas, aplicações editáveis, brand book HTML e PDF e instruções de regeneração.', 'A frase que orienta o próximo capítulo: Cuidar da escola. Abrir espaço para aprender.'], DARK)


def export_book():
    from pypdf import PdfWriter

    preview = root_svg(1440, 1500, 'Lazuli — visão geral das 15 páginas do brand book')
    for index, item in enumerate(PAGES):
        group = ET.SubElement(preview, f'{{{NS}}}g', {'transform': f'translate({index % 3 * 480} {index // 3 * 300}) scale(.333333)'})
        group.append(ET.parse(ROOT / 'pages' / item['file']).getroot())
    write_svg(ROOT / 'preview.svg', preview)
    render(ROOT / 'preview.svg', ROOT / 'preview.png')
    with TemporaryDirectory() as tmp:
        writer = PdfWriter()
        for i, item in enumerate(PAGES):
            pdf = Path(tmp) / f'{i:02}.pdf'
            render(ROOT / 'pages' / item['file'], pdf, fmt='pdf')
            writer.append(str(pdf))
        writer.add_metadata({'/Title': 'Lazuli — Brand book 01', '/Author': 'Lazuli', '/Subject': 'Identidade Ex-líbris: origem, história e aplicações'})
        with (ROOT / 'lazuli-brand-book.pdf').open('wb') as target:
            writer.write(target)
    nav = ''.join(f'<a href="#chapter-{i+1}">{i+1:02} {escape(p["title"])}</a>' for i, p in enumerate(PAGES))
    chapters = []
    for i, item in enumerate(PAGES):
        paragraphs = ''.join(f'<p>{escape(p)}</p>' for p in item['transcript'])
        source = item['source']
        if source:
            paragraphs += f'<p>Referência histórica: <a href="{source[1]}">{escape(source[0])}</a>.</p>'
        chapters.append(f'<section id="chapter-{i+1}" aria-labelledby="title-{i+1}"><h2 id="title-{i+1}">{i+1:02} / {escape(item["title"])}</h2>{item["svg"]}<details><summary>Ler o conteúdo desta página</summary><div>{paragraphs}</div></details></section>')
    css = '''*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#0a0c12;color:#e9edf6;font:16px/1.6 "Helvetica Neue","Segoe UI",sans-serif}a{color:inherit;text-underline-offset:4px}a:focus-visible,summary:focus-visible{outline:2px solid #d8ad4a;outline-offset:5px}header{padding:32px clamp(20px,5vw,80px);border-bottom:1px solid #2c3444}header p{margin:0;color:#b8c1d2}h1{font:clamp(32px,5vw,56px)/1.15 Georgia,serif;margin:12px 0 24px}header nav{display:flex;flex-wrap:wrap;gap:12px 24px}header nav a{padding:10px 0}main{max-width:1440px;margin:auto;padding:32px 16px 80px}.contents{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:6px 24px;padding:0 16px 40px}.contents a{padding:8px;color:#b8c1d2;text-decoration:none}.contents a:hover{color:#d8ad4a}section{scroll-margin-top:24px;margin-bottom:48px}h2{font-size:14px;font-weight:400;letter-spacing:.08em;margin:0 0 12px 8px}section>svg{display:block;width:100%;height:auto;border:1px solid #2c3444}details{padding:12px 16px;background:#12151d}summary{cursor:pointer;min-height:32px}details div{max-width:76ch;color:#e9edf6;padding:8px 0}details p{margin:12px 0}footer{padding:32px;color:#b8c1d2;border-top:1px solid #2c3444}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}@media print{header,.contents,h2,details,footer{display:none}body,main{padding:0;margin:0;background:white}section{margin:0;break-after:page}section>svg{border:0}@page{size:landscape;margin:0}}'''
    html = f'<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Lazuli — Brand book 01</title><style>{css}</style></head><body><header><p>LAZULI / IDENTIDADE 01 / OUTUBRO DE 2026</p><h1>Cuidar da escola.<br>Abrir espaço para aprender.</h1><nav aria-label="Arquivos"><a href="lazuli-brand-book.pdf" download>Baixar brand book em PDF</a><a href="#contents">Ver capítulos</a></nav></header><main><nav class="contents" id="contents" aria-label="Capítulos">{nav}</nav>{"".join(chapters)}</main><footer>Base adotada: Ex-líbris nas cores do Lazuli. Narrativa e aplicações: primeira edição em desenvolvimento.<br>Origem do nome registrada a partir do relato do criador. Os materiais de aplicação são demonstrativos.</footer></body></html>'
    (ROOT / 'index.html').write_text(html)
    shutil.copyfile(ROOT / 'index.html', PUBLIC / 'brand-book.html')
    shutil.copyfile(ROOT / 'lazuli-brand-book.pdf', PUBLIC / 'lazuli-brand-book.pdf')
    print(f'Built {len(PAGES)} pages, {len(list(SVG.glob("*.svg")))} logo assets, 6 applications, HTML and PDF.')


if __name__ == '__main__':
    build_assets()
    make_story_pages()
    make_identity_pages()
    make_language_pages()
    make_application_pages()
    make_closing()
    export_book()
