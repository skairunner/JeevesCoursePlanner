import json
import sys
import os
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
DIRNAME = os.path.dirname(os.path.abspath(__file__)) + "/"

with open(DIRNAME + "spring2016out/courses.processed.json") as f:
    data = json.load(f)

output = {}

for major in data:
    for course in data[major]:
        courseinfo = data[major][course]
        output[courseinfo["name"]] = courseinfo

try:
    arg = sys.argv[1]
    if arg == "min":
        with open(DIRNAME + "out/courses.flat.min.json", "w") as f:
            json.dump(output, f)
            quit()
except:
    pass

with open(DIRNAME + "spring2016out/courses.flat.json", "w") as f:
    json.dump(output, f, indent=2)