class Sanitizr:
    def __getitem__(self, c):
        char = unichr(c)
        char = char.lower()
        if char in u"abcdefghijklmnopqrstuvwxyz'- ":
            return char
        return None

def sanitize(string):
    return string.translate(Sanitizr())