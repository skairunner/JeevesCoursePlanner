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

with open(DIRNAME + "fall2016out/courses.processed.json") as f:
    data = json.load(f)
with open(DIRNAME + "majorcodearray.json") as f:
    majorcodes = json.load(f)
output = {
    "other": {}
}    
for major in majorcodes:
    output[major] = {}


for major in data:
    for coursenumber in major:
        courseinfo = major[coursenumber]
        suffix = courseinfo["name"].split(" ")[0].split("-")[-1]
        if suffix not in majorcodes:
            output["other"][courseinfo["name"]] = courseinfo
        else:
            output[suffix][courseinfo["name"]] = courseinfo

for key, val in output.items():
    with open(DIRNAME + "fall2016out/permajor/" + key + "_courses.flat.json", "w") as f:
        json.dump(val, f, indent=2)
    with open(DIRNAME + "fall2016out/permajor/min_" + key + "_courses.flat.json", "w") as f:
        json.dump(val, f)