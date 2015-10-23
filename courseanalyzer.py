import json
from pprint import pprint

"""
This file is used to analyze courses.processed.json to get the unique kinds
of component combinations: eg, one course may have Lab and Seminar, while another
is a choice between Recitations and one Lecture.
"""

with open("courses.processed.json") as f:
    data = json.load(f)

componentFreq  = {}

def AnalyzeComponents(components):
    comptuple = tuple(set(component["componentType"] for component in components))
    try:
        componentFreq[comptuple] += 1
    except:
        componentFreq[comptuple] = 1

for major in data:
    for course in data[major]:
        try:
            AnalyzeComponents(data[major][course]["components"])
        except:
            pprint(data[major][course])
            quit()

pprint(componentFreq)