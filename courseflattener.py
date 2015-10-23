import json
import sys

"""
	hierarchy is changed from 
    = root
        - major1
            - course1
            - course2
        - major2
            -course3
            -course4

    to

    = root
        - course1
        - course2
        - course3
        - course4

    The keys will the the course's name (eg, INTM-SHU 191).
"""

with open("out/courses.processed.json") as f:
    data = json.load(f)

output = {}

for major in data:
    for course in data[major]:
        courseinfo = data[major][course]
        output[courseinfo["name"]] = courseinfo

try:
    arg = sys.argv[1]
    if arg == "min":
        with open("out/courses.flat.min.json", "w") as f:
            json.dump(output, f)
            quit()
except:
    pass

with open("out/courses.flat.json", "w") as f:
    json.dump(output, f, indent=2)