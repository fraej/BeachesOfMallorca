"""Adds a <descripcions> block (ca/en/es/de/fr) to every <platja> in BoMdata.xml.

Descriptions are built only from the data already stored for each beach
(surface, environment, size, location, alternative names, naturism flag)
plus the nearest other beach computed from the coordinates.
"""
import math
import re
import sys
from xml.sax.saxutils import escape

path = sys.argv[1]
src = open(path, encoding='utf-8').read()

LANGS = ['ca', 'en', 'es', 'de', 'fr']

# ---------------------------------------------------------------- parsing
mun_re = re.compile(r'<municipi nom="([^"]+)">(.*?)</municipi>', re.S)
platja_re = re.compile(r'(<platja nom="([^"]+)">)(.*?)(\n?[ \t]*</platja>)', re.S)


def tag(body, name):
    m = re.search(rf'<{name}>([^<]*)</{name}>', body)
    return m.group(1).strip() if m else ''


beaches = []
for mm in mun_re.finditer(src):
    mun = mm.group(1)
    for pm in platja_re.finditer(mm.group(2)):
        body = pm.group(3)
        beaches.append({
            'nom': pm.group(2),
            'mun': mun,
            'barri': tag(body, 'barri'),
            'sup': tag(body, 'superficie_tipus'),
            'entorn': tag(body, 'entorn'),
            'L': int(tag(body, 'llargaria') or 0),
            'W': int(tag(body, 'amplada_mitjana') or 0),
            'lat': float(tag(body, 'latitud').replace(',', '.')),
            'lon': float(tag(body, 'longitud').replace(',', '.')),
            'nat': tag(body, 'nat') == 'true',
            'alts': re.findall(r'<nom_alt>([^<]*)</nom_alt>', body),
        })


def dist(a, b):
    r = 6371000
    p1, p2 = math.radians(a['lat']), math.radians(b['lat'])
    dp = p2 - p1
    dl = math.radians(b['lon'] - a['lon'])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


for b in beaches:
    others = [(dist(b, o), o) for o in beaches if o is not b and o['nom'] != b['nom']]
    d, o = min(others, key=lambda x: x[0])
    b['near'] = (o['nom'], d)

# ---------------------------------------------------------------- helpers
REGION_BY_MUN = {
    'Andratx': 'sw', 'Calvià': 'sw',
    'Banyalbufar': 'nw', 'Estellencs': 'nw', 'Valldemossa': 'nw', 'Deià': 'nw',
    'Sóller': 'nw', 'Escorca': 'nw',
    'Pollença': 'n', 'Alcúdia': 'n',
    'Muro': 'balcudia', 'Santa Margalida': 'balcudia',
    'Artà': 'ne', 'Capdepera': 'ne',
    'Son Servera': 'e', 'Sant Llorenç des Cardassar': 'e', 'Manacor': 'e', 'Felanitx': 'e',
    'Santanyí': 'se', 'Ses Salines': 's', 'Campos': 's',
    'Palma': 'bpalma',
}


def region(b):
    # Fornalutx's own short coast is in the Tramuntana, but some Fornalutx
    # entries in the data carry Llucmajor coastline coordinates
    if b['mun'] == 'Fornalutx' and b['lat'] > 39.6:
        return 'nw'
    if b['mun'] in ('Llucmajor', 'Fornalutx'):
        return 'bpalma' if b['lat'] > 39.45 else 's'
    return REGION_BY_MUN[b['mun']]


REGION = {
    'nw': {'ca': "a la costa nord-oest de Mallorca, a la serra de Tramuntana",
           'en': "on the north-west coast of Mallorca, along the Serra de Tramuntana",
           'es': "en la costa noroeste de Mallorca, en la Serra de Tramuntana",
           'de': "an der Nordwestküste Mallorcas, an der Serra de Tramuntana",
           'fr': "sur la côte nord-ouest de Majorque, le long de la Serra de Tramuntana"},
    'sw': {'ca': "a la costa sud-oest de Mallorca",
           'en': "on the south-west coast of Mallorca",
           'es': "en la costa suroeste de Mallorca",
           'de': "an der Südwestküste Mallorcas",
           'fr': "sur la côte sud-ouest de Majorque"},
    'bpalma': {'ca': "a la badia de Palma",
               'en': "on the Bay of Palma",
               'es': "en la bahía de Palma",
               'de': "an der Bucht von Palma",
               'fr': "dans la baie de Palma"},
    'n': {'ca': "a la costa nord de Mallorca",
          'en': "on the north coast of Mallorca",
          'es': "en la costa norte de Mallorca",
          'de': "an der Nordküste Mallorcas",
          'fr': "sur la côte nord de Majorque"},
    'balcudia': {'ca': "a la badia d'Alcúdia, al nord de Mallorca",
                 'en': "on the Bay of Alcúdia, in the north of Mallorca",
                 'es': "en la bahía de Alcúdia, al norte de Mallorca",
                 'de': "an der Bucht von Alcúdia im Norden Mallorcas",
                 'fr': "dans la baie d'Alcúdia, au nord de Majorque"},
    'ne': {'ca': "a la costa nord-est de Mallorca",
           'en': "on the north-east coast of Mallorca",
           'es': "en la costa noreste de Mallorca",
           'de': "an der Nordostküste Mallorcas",
           'fr': "sur la côte nord-est de Majorque"},
    'e': {'ca': "a la costa de llevant de Mallorca",
          'en': "on the east coast of Mallorca",
          'es': "en la costa de levante de Mallorca",
          'de': "an der Ostküste Mallorcas",
          'fr': "sur la côte est de Majorque"},
    'se': {'ca': "a la costa sud-est de Mallorca",
           'en': "on the south-east coast of Mallorca",
           'es': "en la costa sureste de Mallorca",
           'de': "an der Südostküste Mallorcas",
           'fr': "sur la côte sud-est de Majorque"},
    's': {'ca': "a la costa sud de Mallorca",
          'en': "on the south coast of Mallorca",
          'es': "en la costa sur de Mallorca",
          'de': "an der Südküste Mallorcas",
          'fr': "sur la côte sud de Majorque"},
}

VOWEL = tuple('AEIOUÀÁÈÉÍÒÓÚaeiouàáèéíòóúHh')


def ca_de(name):
    """Catalan 'de' + name with elision / article contraction."""
    if name.startswith('Es '):
        return 'des ' + name[3:]
    if name.startswith(("S'", "s'")):
        return "de s'" + name[2:]
    if name.startswith(('Sa ', 'Ses ')):
        return 'de ' + name[0].lower() + name[1:]
    if name.startswith(VOWEL):
        return "d'" + name
    return 'de ' + name


def fr_de(name):
    return ("d'" + name) if name.startswith(VOWEL) else ('de ' + name)


def cap(s):
    return s[:1].upper() + s[1:]


def location(b, lang):
    mun, barri = b['mun'], cap(b['barri'])
    if barri.lower() in b['nom'].lower():
        barri = ''
    if lang == 'ca':
        s = 'al municipi ' + ca_de(mun)
        return (f"a la zona {ca_de(barri)}, " + s) if barri else s
    if lang == 'en':
        s = f'in the municipality of {mun}'
        return (f'in the {barri} area, ' + s) if barri else s
    if lang == 'es':
        s = f'en el municipio de {mun}'
        return (f'en la zona de {barri}, ' + s) if barri else s
    if lang == 'de':
        s = f'in der Gemeinde {mun}'
        return (f'im Gebiet {barri}, ' + s) if barri else s
    if lang == 'fr':
        s = 'dans la commune ' + fr_de(mun)
        return (f'dans le secteur {fr_de(barri)}, ' + s) if barri else s


def num(n, lang):
    s = f'{n:,}'
    if lang in ('ca', 'es', 'de'):
        return s.replace(',', '.')
    if lang == 'fr':
        return s.replace(',', ' ')
    return s


def distance(d, lang):
    if d < 1000:
        return f'{int(round(d / 50.0) * 50)} m'
    km = f'{d / 1000:.1f}'
    if lang != 'en':
        km = km.replace('.', ',')
    return f'{km} km'


def join(items, lang):
    if len(items) == 1:
        return items[0]
    last = items[-1]
    conj = {'ca': 'i', 'en': 'and', 'es': 'y', 'de': 'und', 'fr': 'et'}[lang]
    if lang == 'es' and re.match(r'(?i)h?i(?![aeiou])', last):
        conj = 'e'
    return ', '.join(items[:-1]) + f' {conj} ' + last


def size_key(L):
    if L <= 0:
        return None
    if L < 50:
        return 'tiny'
    if L < 200:
        return 'small'
    if L < 600:
        return 'medium'
    if L < 1500:
        return 'large'
    return 'long'


SIZE = {
    'tiny': {'ca': 'una cala diminuta', 'en': 'a tiny cove', 'es': 'una cala diminuta',
             'de': 'eine winzige Bucht', 'fr': 'une toute petite crique'},
    'small': {'ca': 'una platja petita', 'en': 'a small beach', 'es': 'una playa pequeña',
              'de': 'ein kleiner Strand', 'fr': 'une petite plage'},
    'medium': {'ca': 'una platja de mida mitjana', 'en': 'a medium-sized beach',
               'es': 'una playa de tamaño medio', 'de': 'ein mittelgroßer Strand',
               'fr': 'une plage de taille moyenne'},
    'large': {'ca': 'una platja gran', 'en': 'a large beach', 'es': 'una playa grande',
              'de': 'ein großer Strand', 'fr': 'une grande plage'},
    'long': {'ca': 'una platja molt llarga', 'en': 'a very long beach',
             'es': 'una playa muy larga', 'de': 'ein sehr langer Strand',
             'fr': 'une très longue plage'},
}

INTRO = {  # "{name} is a <surface> beach"
    'arena': {'ca': "és una platja d'arena", 'en': 'is a sandy beach', 'es': 'es una playa de arena',
              'de': 'ist ein Sandstrand', 'fr': 'est une plage de sable'},
    'còdols': {'ca': 'és una platja de còdols', 'en': 'is a pebble beach',
               'es': 'es una playa de guijarros', 'de': 'ist ein Kieselstrand',
               'fr': 'est une plage de galets'},
    'grava': {'ca': 'és una platja de grava', 'en': 'is a gravel beach',
              'es': 'es una playa de grava', 'de': 'ist ein Kiesstrand',
              'fr': 'est une plage de gravier'},
    'roques': {'ca': 'és una platja rocosa', 'en': 'is a rocky beach', 'es': 'es una playa rocosa',
               'de': 'ist ein Felsstrand', 'fr': 'est une plage rocheuse'},
}

ENTORN = {
    'urbà': {
        'ca': "Està situada dins una zona urbanitzada, amb edificis i carrers a tocar.",
        'en': "It lies within a built-up area, with buildings and streets right next to it.",
        'es': "Se encuentra dentro de una zona urbanizada, con edificios y calles justo al lado.",
        'de': "Er liegt in einem bebauten Gebiet, Gebäude und Straßen reichen bis direkt heran.",
        'fr': "Elle se trouve en pleine zone urbanisée, avec des immeubles et des rues juste à côté.",
    },
    'semi-urbà': {
        'ca': "El seu entorn és semiurbà: hi ha edificacions a prop, però encara conserva part del paisatge natural.",
        'en': "Its surroundings are semi-urban: there are buildings nearby, but part of the natural landscape is still preserved.",
        'es': "Su entorno es semiurbano: hay edificaciones cerca, pero todavía conserva parte del paisaje natural.",
        'de': "Die Umgebung ist halbstädtisch: In der Nähe gibt es Bebauung, doch ein Teil der natürlichen Landschaft ist erhalten geblieben.",
        'fr': "Son environnement est semi-urbain : il y a des constructions à proximité, mais une partie du paysage naturel est encore préservée.",
    },
    'natural': {
        'ca': "Es troba en un entorn natural, sense edificacions al costat, i per això sol ser un racó tranquil i poc alterat.",
        'en': "It is set in a natural environment with no buildings right next to it, so it tends to be a quiet, unspoilt spot.",
        'es': "Se encuentra en un entorno natural, sin edificaciones al lado, por lo que suele ser un rincón tranquilo y poco alterado.",
        'de': "Er liegt in naturbelassener Umgebung ohne direkt angrenzende Bebauung und ist daher meist ein ruhiger, unberührter Ort.",
        'fr': "Elle se trouve dans un cadre naturel, sans constructions à proximité immédiate, ce qui en fait généralement un endroit calme et préservé.",
    },
}

SURFACE_TIP = {
    'arena': {
        'ca': "La seva arena la fa còmoda per estendre la tovallola i passar-hi el dia.",
        'en': "Its sand makes it comfortable for spreading out a towel and spending the day.",
        'es': "Su arena la hace cómoda para extender la toalla y pasar el día.",
        'de': "Der Sand lädt dazu ein, das Handtuch auszubreiten und den Tag hier zu verbringen.",
        'fr': "Son sable en fait un endroit confortable pour étendre sa serviette et y passer la journée.",
    },
    'còdols': {
        'ca': "La vorera és de còdols arrodonits, així que les sabates d'aigua poden ser útils.",
        'en': "The shore is made up of rounded pebbles, so water shoes can come in handy.",
        'es': "La orilla está formada por guijarros redondeados, así que el calzado de agua puede resultar útil.",
        'de': "Das Ufer besteht aus runden Kieselsteinen, daher sind Badeschuhe empfehlenswert.",
        'fr': "Le rivage est fait de galets arrondis : des chaussures aquatiques peuvent être utiles.",
    },
    'grava': {
        'ca': "La vorera és de grava, així que les sabates d'aigua poden ser útils.",
        'en': "The shore is covered in gravel, so water shoes can come in handy.",
        'es': "La orilla es de grava, así que el calzado de agua puede resultar útil.",
        'de': "Das Ufer ist mit Kies bedeckt, daher sind Badeschuhe empfehlenswert.",
        'fr': "Le rivage est couvert de gravier : des chaussures aquatiques peuvent être utiles.",
    },
    'roques': {
        'ca': "És un indret rocós, més adequat per prendre el sol damunt les roques i fer snorkel que no per estirar-se a l'arena.",
        'en': "It is a rocky spot, better suited to sunbathing on the rocks and snorkelling than to lying on the sand.",
        'es': "Es un lugar rocoso, más adecuado para tomar el sol sobre las rocas y hacer snorkel que para tumbarse en la arena.",
        'de': "Es ist ein felsiger Ort, der sich eher zum Sonnenbaden auf den Felsen und zum Schnorcheln eignet als zum Liegen im Sand.",
        'fr': "C'est un endroit rocheux, plus adapté pour bronzer sur les rochers et faire du snorkeling que pour s'allonger sur le sable.",
    },
}

NAT = {
    'ca': "També és un indret conegut per la pràctica del naturisme.",
    'en': "It is also a well-known spot for naturism.",
    'es': "También es un lugar conocido por la práctica del naturismo.",
    'de': "Außerdem ist er als FKK-Strand bekannt.",
    'fr': "C'est aussi un lieu connu pour la pratique du naturisme.",
}


def dims(b, lang):
    L, W, sk = b['L'], b['W'], size_key(b['L'])
    if not sk:
        return ''
    Ls, Ws, sz = num(L, lang), num(W, lang), SIZE[sk][lang]
    if lang == 'ca':
        w = f" i té una amplada mitjana de {Ws} metres" if W else ''
        return f"Fa uns {Ls} metres de llargària{w}, cosa que la converteix en {sz}."
    if lang == 'en':
        w = f" and {Ws} metres wide on average" if W else ''
        return f"It is about {Ls} metres long{w}, making it {sz}."
    if lang == 'es':
        w = f" y tiene una anchura media de {Ws} metros" if W else ''
        return f"Mide unos {Ls} metros de longitud{w}, lo que la convierte en {sz}."
    if lang == 'de':
        w = f" und durchschnittlich {Ws} Meter breit" if W else ''
        return f"Er ist etwa {Ls} Meter lang{w} und damit {sz}."
    if lang == 'fr':
        w = f" pour une largeur moyenne de {Ws} mètres" if W else ''
        return f"Elle mesure environ {Ls} mètres de long{w}, ce qui en fait {sz}."


def alts(b, lang):
    a = b['alts']
    if not a:
        return ''
    j = join(a, lang)
    if lang == 'ca':
        return f"També se la coneix com a {j}."
    if lang == 'en':
        return f"It is also known as {j}."
    if lang == 'es':
        return f"También se la conoce como {j}."
    if lang == 'de':
        return f"Er ist auch unter {'dem Namen' if len(a) == 1 else 'den Namen'} {j} bekannt."
    if lang == 'fr':
        return f"Elle est aussi connue sous {'le nom' if len(a) == 1 else 'les noms'} {fr_de(j)}."


def nearest(b, lang):
    n, d = b['near']
    if d < 50:
        return ''
    ds = distance(d, lang)
    return {
        'ca': f"La platja més propera d'aquest catàleg és {n}, a uns {ds}.",
        'en': f"The nearest beach in this catalogue is {n}, about {ds} away.",
        'es': f"La playa más cercana de este catálogo es {n}, a unos {ds}.",
        'de': f"Der nächstgelegene Strand in diesem Katalog ist {n}, etwa {ds} entfernt.",
        'fr': f"La plage la plus proche de ce catalogue est {n}, à environ {ds}.",
    }[lang]


def describe(b, lang):
    first = f"{b['nom']} {INTRO[b['sup']][lang]} {REGION[region(b)][lang]}, {location(b, lang)}."
    parts = [first, ENTORN[b['entorn']][lang], dims(b, lang), SURFACE_TIP[b['sup']][lang],
             NAT[lang] if b['nat'] else '', alts(b, lang), nearest(b, lang)]
    return ' '.join(p for p in parts if p)


# ---------------------------------------------------------------- writing
it = iter(beaches)


def add_block(pm):
    b = next(it)
    assert b['nom'] == pm.group(2)
    body = pm.group(3)
    if '<descripcions>' in body:
        return pm.group(0)
    indent = re.search(r'\n([ \t]*)<superficie_tipus>', body).group(1)
    body = body.rstrip()
    lines = [f'\n{indent}<descripcions>']
    for lang in LANGS:
        lines.append(f'\n{indent}    <descripcio idiomaCodi="{lang}">{escape(describe(b, lang))}</descripcio>')
    lines.append(f'\n{indent}</descripcions>')
    close = '\n' + indent[:-4] + '</platja>'
    return pm.group(1) + body + ''.join(lines) + close


out = mun_re.sub(lambda mm: mm.group(0).replace(mm.group(2), platja_re.sub(add_block, mm.group(2))), src)
open(path, 'w', encoding='utf-8').write(out)
print(len(beaches), 'beaches')
