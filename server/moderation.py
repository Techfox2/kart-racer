"""Local DE/EN/FR username filter. No password inspection or external service."""
import re
import unicodedata

# Stems are intentionally specific: innocent substrings such as 'ass' and 'con'
# are not blanket-blocked (e.g. 'ClassicRacer', 'Falcon', 'Assassin').
STEMS = ('fuck', 'fuk', 'fick', 'scheiss', 'scheis', 'scheisz', 'schlampe',
         'arschloch', 'hurensohn', 'hurenkind', 'wichser', 'fotze', 'bitch',
         'shit', 'cunt', 'motherf', 'nigger', 'nigga', 'faggot', 'kike',
         'putain', 'salope', 'salaud', 'connard', 'connasse',
         'encule', 'merde', 'pdophile', 'negre', 'bougnoul', 'heilhitler',
         'hitler', 'siegheil')
RESERVED = {'admin', 'administrator', 'moderator', 'support', 'system', 'official', 'kartracer'}

def blocked_username(value):
    text = unicodedata.normalize('NFKD', value.casefold())
    text = ''.join(c for c in text if not unicodedata.combining(c))
    parts = re.findall(r'[a-z]+', text)
    if any(p in RESERVED for p in parts):
        return True
    normalized = text.translate(str.maketrans({'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','8':'b','9':'g'}))
    normalized = re.sub('[^a-z]', '', normalized)
    variants = {normalized, re.sub(r'(.)\1+', r'\1', normalized)}
    return (any(word in variant for variant in variants for word in STEMS)
            or normalized in RESERVED or normalized in {'pute', 'ass', 'piss', 'con', 'pd'})
