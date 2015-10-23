import pprint
import json
import re
from dateutil.parser import parse as dateparse
import sys
from sanitizr import Sanitizr

"""
This file is to turn the raw data dump from albertscraper.py
into a more refined, handleable format. Examples include extracting
the "Details" field into startdate, enddate, instructor and time components,
or splitting the "header" field into course code (eg, INTM-SHU 191) and title
(eg, Being There).

Calling the script using "python script.py min" will output a json
file with no indentation.
"""

# s is a set
def addWordsToSet(line, s):
    line = unicode(line)
    line = line.translate(Sanitizr())
    line = line.split()
    for x in line:
        s.add(x)

with open("out/courses.json") as f:
	data = json.load(f)

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
    dtime = dateparse(s)
    return [dtime.hour, dtime.minute]

for subject in data:
    for sitecourseid in data[subject]:
        course = data[subject][sitecourseid]
        course["name"]  = course["table"].split(" | ")[0].split("\n")[1]
        course["title"] = " ".join(course["header"].split(" ")[2:])
        components = course["table"].split(course["name"])
        course["components"] = [] 
        for comp in components:
            table = comp.split(" | ")
            course["components"].append({})
            component = course["components"][-1]
            try:
                if len(table) == 7:
                    component["number"] = table[1]
                    component["period"] = table[2]
                    temp = table[3].split("\n")
                    component["section"] = temp[0]
                    component["status"] = temp[1]
                    component["location"] = table[5].split("\n")[1]
                    temp = table[6].split("\n")
                    component["componentType"] = temp[0]
                    component["details"] = temp[1]
                    try:
                        component["notes"] = temp[2]
                    except:
                        component["notes"] = "" # has no notes
                elif len(table) == 8:
                    component["units"] = int(table[1].split(" ")[0])
                    component["number"] = table[2]
                    component["period"] = table[3]
                    temp = table[4].split("\n")
                    component["section"] = temp[0]
                    component["status"] = temp[1]
                    component["location"] = table[6].split("\n")[1].split(": ")[1]
                    temp = table[7].split("\n")
                    component["componentType"] = temp[0]
                    component["details"] = temp[1]
                    try:
                        component["notes"] = temp[2].split("Notes: ")[1]
                    except:
                        component["notes"] = ""
            except ValueError:
                pass
            except IndexError as e:
                print temp
            except BaseException as e:
                print table
                print course["name"]
                raise e
            if "status" in component:
                if "Open" in component["status"]:
                    component["status"] = "Open"
            if "section" in component:
                component["section"] = component["section"].split(": ")[1]
            if "componentType" in component:
                component["componentType"] = component["componentType"].split(": ")[1]
            if "number" in component:
                component["number"] = component["number"].split("#: ")[1]
            if "period" in component:
                temp = component["period"].split(" ")[2:]
                component["startdate"] = DateFromStr(temp[0])
                component["enddate"]   = DateFromStr(temp[2])
                del component["period"]
            try:
                if "details" in component:
                    name = pattern_name.search(component["details"])
                    time = pattern_time.search(component["details"]).group(0).split(" - ")
                    days = []
                    for x in ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]:
                        if x in component["details"]:
                            days.append(DayToNumber[x])
                    component["days"] = days
                    component["name"] = [name.group(1), name.group(2)]

                    component["starttime"] = TimeFromStr(time[0])
                    component["endtime"] = TimeFromStr(time[1])
            except AttributeError:
                pass
            if not len(component):
                course["components"].pop()

        course["desc"] = course["desc"].split("less description")[0]

        # An array of component types
        s = set()
        for component in course["components"]:
            s.add(component["componentType"])
        course["requiredcomponents"] = list(s)


        myset = set()
        addWordsToSet(course["desc"], myset)
        addWordsToSet(course["desc"], myset)
        addWordsToSet(course["title"], myset)
        for c in course["components"]:
            addWordsToSet(c["componentType"], myset)
            addWordsToSet(c["notes"], myset)
            addWordsToSet(c["details"], myset)
            try:
                addWordsToSet(c["name"], myset)
            except:
                pass # no name
        course["searchable"] = " ".join(myset)

        del course["table"]
        del course["header"]


try:
    arg = sys.argv[1]
    if arg == "min":
        with open("out/courses.processed.min.json", "w") as f:
            json.dump(data, f)
        quit()
except:
    pass
with open("out/courses.processed.json", "w") as f:
    json.dump(data, f, indent=2)