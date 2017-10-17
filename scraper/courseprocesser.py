import pprint
import json
import re
from dateutil.parser import parse as dateparse
import sys
from sanitizr import sanitize
import os
import bs4
from bs4 import BeautifulSoup as BS
import codecs

"""
This file is to turn the raw data dump from albertscraper.py
into a more refined, handleable format. Examples include extracting
the "Details" field into startdate, enddate, instructor and time components,
or splitting the "header" field into course code (eg, INTM-SHU 191) and title
(eg, Being There).

Calling the script using "python script.py min" will output a json
file with no indentation.
"""
DIRNAME   = os.path.dirname(os.path.abspath(__file__)) + "/"
SOURCEDIR = "spring2018out/raw/"
OUTPUTDIR = "spring2018out/permajor/"

# s is a set
def addWordsToSet(line, s):
    # line = unicode(line)
    line = sanitize(line)
    line = line.split()
    for x in line:
        s.add(x)

pattern_name = re.compile(r"(\w+), (\w+)") # eg, Zhang, Zheng or Non, Arkara
pattern_time = re.compile(r"(\d+\.\d+ [AP]M) - (\d+\.\d+ [AP]M)")

DayToNumber = {
    "Sun": 6, 
    "Mon": 0,
    "Tue": 1,
    "Wed": 2,
    "Thu": 3,
    "Fri": 4,
    "Sat": 5
}

# Turn a MM/DD/YYYY str to [YYYY, MM, DD] list
def DateFromStr(s):
    s = s.split("/")
    return [int(s[2]), int(s[0]), int(s[1])]

# Turn a hh.mm AP str to [HH, mm] list
def TimeFromStr(s):
    time, ap = s.split(" ")
    h, m = time.split(".")
    h = int(h)
    m = int(m)
    if ap == "PM":
        if h != 12:
            h = h + 12
    return [h, m]

# turn a list of tags, eg [tag, str, tag, tag, str, tag] into a single str
def stringFromTags(tags):
    out = []
    for t in tags:
        try:
            out.append(t.text)
        except:
            out.append(t)
    return "".join(out)

def processcourse(course):
    soup = BS(course["table"], "html5lib")
    for tag in soup("p"):
        tag.unwrap();

    course["name"]  = re.search(r"[\w]+-[\w]+\s+[\w]+", course["header"]).group(0)
    # print(course["header"].split(course["name"] + " "), course["name"])
    try:
        course["title"] = course["header"].split(course["name"] + " ")[1]
    except IndexError as e:
        course["title"] = course["header"].split(course["name"])[1]
    except:
        raise e
    # A dirty hack to easily find the innermost <td>s
    cmps = soup("td", style="background-color: white; font-family: arial; font-size: 12px;")
    course["components"] = []
    notes = []
    components = course["components"]
    componentTypes = set()
    for td in cmps:
        components.append({})
        component = components[-1]

        lines = []
        line = []
        for tag in td:
            if tag.name == "br":
                lines.append(line)
                line = []
            else:
                line.append(tag)
        if len(line) > 0:
            lines.append(line)

        s = 0 # starting line #
        # First line has course name, units, #, section
        flattened = stringFromTags(lines[s])
        if "Topic:" in flattened:
            for n in range(len(lines[s])):
                if "Topic:" in lines[s][n]:
                    component["topic"] = lines[s][n].text.split("Topic: ")[-1]
                    print(component["topic"])
                    break

        flattened = stringFromTags(lines[s])
        r = re.search(r"(\d+) units", flattened)
        if r:
            component["units"] = int(r.group(1))            
        r = re.search(r"Class#: (\d+)", flattened)
        if r:
            component["number"] = int(r.group(1))
        r = re.search(r"Section: (\w+)", flattened)
        if r:
            component["section"] = r.group(1)
        # second line has nothing important.
        # third line has location and component
        flattened = stringFromTags(lines[s+2])
        r = re.search(r"Location: (\w+)", flattened)
        if r:
            component["location"] = r.group(1)
        r = re.search(r"Component: (\w+)", flattened)
        if r:
            component["componentType"] = r.group(1)
            componentTypes.add(r.group(1))
        # Forth line has times and instructor.
        # Fifth line might have times, or it might have notes.
        # basically: figure out if the line is Notes or not, then figure out if
        # it's a test date or a proper date.
        for i in range(s+3, len(lines)):
            flattened = stringFromTags(lines[i])
            if "Notes:" in flattened:
                if "notes" in component:
                    component["notes"] += "\n" + flattened.split("Notes:")[1].strip()
                else:
                    component["notes"] = flattened.split("Notes:")[1].strip()
                notes.append(component["notes"])
            else:
                # possibly a date.
                r = re.findall(r"\d{2}\/\d{2}\/\d{4}", flattened)
                if len(r) == 2:
                    if r[0] == r[1]:
                        continue # it's a test date.
                    # otherwise add to class times.
                    # date is 24 characters long.
                    flattened = flattened[24:]
                    # might have a name in it
                    if "with" in flattened:
                        component["instructor"] = flattened.split("with ")[-1].strip()
                        index = flattened.index(" with")
                        flattened = flattened[:index]
                    # extract the times
                    times = re.search(r"((\w{3},?)+) (\d{1,2})\.(\d{2}) (\w{2}) - (\d{1,2})\.(\d{2}) (\w{2})", flattened)
                    if times:
                        if "notes" in component:
                            component["notes"] += "\n" + times.group(0)
                        else:
                            component["notes"] = times.group(0)
                        if "classtimes" not in component:
                            component["classtimes"] = []
                        startdays = times.group(1)
                        startH = times.group(3); startH = int(startH)
                        startM = times.group(4); startM = int(startM)
                        startAP = times.group(5)
                        endH = times.group(6); endH = int(endH)
                        endM = times.group(7); endM = int(endM)
                        endAP = times.group(8)

                        if startAP == "PM" and startH != 12:
                            startH += 12
                        if endAP == "PM" and endH != 12:
                            endH += 12

                        startdays = startdays.split(",")
                        for day in startdays:
                            classtime = {
                                "day": DayToNumber[day],
                                "starttime": [startH, startM],
                                "endtime": [endH, endM]
                            }
                            component["classtimes"].append(classtime)

    # Next, create the searchable corpus of the course.
    searchable = [course["title"], course["desc"]]
    units = []
    coursenumbers = []
    for component in components:
        if "topic" in component:
            searchable.append(component["topic"])
        if "notes" in component:
            searchable.append(component["notes"])
        if "instructor" in component:
            searchable.append(component["instructor"])
        if "location" in component:
            searchable.append(component["location"])
        if "units" in component:
            units.append(str(component["units"]) + " units") # separate because sanitization
        coursenumbers.append(str(component["number"]))
    searchableStr = sanitize(" ".join(searchable))
    searchableStr = " ".join([course["name"].lower(), " ".join(coursenumbers), "".join(units), searchableStr])
    course["searchable"] = searchableStr
    
    # Add required components
    course["requiredcomponents"] = list(componentTypes)

    # Clean up
    del course["table"]
    del course["header"]

if __name__ == "__main__":
    data = []
    for root, dirs, files in os.walk(DIRNAME + SOURCEDIR):
        for file in files:
            if file == "out-courses.json":
                continue
            if (os.stat(root + "/" + file).st_size == 0):
                continue
            print(file)
            with codecs.open(root + "/" + file, "r", "utf-8") as f:
                data.append(json.load(f))

    filecounter = 0
    for college in data:
        filecounter += 1
        for courseid in college:
            course = college[courseid]
            processcourse(course)
        if filecounter % 10 == 0:
            print(filecounter)

    # Next, sort by school/major (CSCI-SHU and CSCI-AB are different, one is in SHU and the other in AB) and output.
    with codecs.open(DIRNAME + "majorcodearray.json", "r", "utf-8") as f:
        majorcodes = json.load(f)

    output = {
        "other": {}
    }
    for major in majorcodes:
        output[major] = {}

    for college in data:
        for coursenumber in college:
            course = college[coursenumber]
            suffix = course["name"].split(" ")[0].split("-")[-1]
            if suffix not in majorcodes:
                output["other"][course["name"]] = course
            else:
                output[suffix][course["name"]] = course

    for key, val in output.items():
        with codecs.open(OUTPUTDIR + key + "_courses.flat.json", "w", "utf-8") as f:
            json.dump(val, f, indent=2)
        with codecs.open(OUTPUTDIR + "min_" + key + "_courses.flat.json", "w", "utf-8") as f:
            json.dump(val, f)