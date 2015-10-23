import json
import sys
import codecs
from sanitizr import Sanitizr

"""
This file processes a courses.flat.json file to index its contents.
"""


SkippedWords = ['']
with open("skippedwords.txt") as f:
    for l in f:
        l = l.strip()
        SkippedWords.append(l)

with open("out/courses.flat.json") as f:
    data = json.load(f)

majornames = {}
with codecs.open("majors.txt", "r", "utf-8") as f:
    for l in f:
        l = l.strip()
        l = l.split("(")
        name = l[0][:-1]
        code = l[1][:-1]
        majornames[code] = name.translate(Sanitizr())

index = {}

unitindex = {
    0:set(),
    1:set(),
    2:set(),
    3:set(),
    4:set()
    }

def doIndex(info, code):
    info = info.translate(Sanitizr())
    info = info.split(" ")
    for word in info:
        if not word in SkippedWords:
            try:
                index[word].add(code)
            except:
                index[word] = set([code])


ValidFields = [
    "details",
    "notes",
    "desc",
    "title"
]

ValidComponentFields = [
    "status",
    "location",
    "componentType",
    "notes"
]

for coursecode in data:
    # Special case for the course code.
    major, number = coursecode.split(" ")
    withoutshu = major.split("-")[0]
    doIndex(major, coursecode)
    doIndex(withoutshu, coursecode)
    doIndex(majornames[major], coursecode)
    for field in data[coursecode]:
        fielddata = data[coursecode][field]
        if field in ValidFields:
            doIndex(fielddata, coursecode)
        if field == "components":
            for component in fielddata:
                for cf in component:
                    if cf in ValidComponentFields:
                        doIndex(component[cf], coursecode)
                    elif cf == "units":
                        unitindex[component[cf]].add(coursecode)
                    elif cf == "name":                        
                        doIndex(" ".join(component[cf]), coursecode)

for k in index:
    index[k] = list(index[k])
for i in unitindex:
    unitindex[i] = list(unitindex[i])
print len(index)

try:
    arg = sys.argv[1]
    if arg == "min":
        with open("out/courses.index.min.json", "w") as f:
            json.dump([index, unitindex], f)
            quit()
except:
    pass

with open("out/courses.index.json", "w") as f:
    json.dump([index, unitindex], f, indent=2)