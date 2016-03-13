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

ADoutput = {}
SHUoutput = {}
otheroutput = {}
alloutput = {
    "AD": ADoutput,
    "SHU": SHUoutput,
    "other": otheroutput
}

for major in data:
    for coursenumber in major:
        courseinfo = major[coursenumber]
        suffix = courseinfo["name"].split(" ")[0].split("-")[-1]
        if suffix in ["AD", "SHU"]:
            alloutput[suffix][courseinfo["name"]] = courseinfo
        else:
            otheroutput[courseinfo["name"]] = courseinfo

for key, val in alloutput.items():
    with open(DIRNAME + "fall2016out/" + key + "_courses.flat.json", "w") as f:
        json.dump(val, f, indent=2)
    with open(DIRNAME + "fall2016out/" + key + "_courses.flat.min.json", "w") as f:
        json.dump(val, f)