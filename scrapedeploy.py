from subprocess import call
import sys
import shutil
import os
import json

"""
    Use this file on the server to update the course data.
"""

try:
    with open("deploydir") as f:
        path = json.load(f)[0]
except:
    print "Create a json file deploydir with the content [<deploy directory>]"


scrape = True
if len(sys.argv) > 1:
    if sys.argv[1] == "reindex":
        scrape = False

outdir = os.path.abspath(path)
if scrape:
    call(["sudo", "python", "scraper/albertscraper.py"])
call(["python", "scraper/courseprocesser.py", "min"])
call(["python", "scraper/courseflattener.py", "min"])
call(["python", "scraper/courseindexer.py", "min"])

shutil.copy("scraper/out/courses.flat.min.json", outdir + "/courses.flat.json")
shutil.copy("scraper/out/courses.index.min.json", outdir + "/courses.index.json")