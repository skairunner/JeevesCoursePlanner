from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import selenium
import getpass
import time
import json
import subprocess
import os

"""
This file uses Selenium and Firefox Webdriver to scrape all course data for 
NYU Shanghai from Albert Course Finder into a json file. Further processing
via courseprocessor.py is highly recommended.

While the final result is put into courses.json, a json file is made for
each major, in out/. 
"""

DIRNAME = os.path.dirname(os.path.abspath(__file__)) + "/"

def dumpJsonAndChmod(obj, fname):
    fname = fname.replace("/", "-").replace("&", " ")
    with open(fname, "w") as f:
        json.dump(obj, f)
    subprocess.call(["chown", "skyrunner", DIRNAME + fname])

myid = "ki539"
print "ID is: " + myid
# mypass = getpass.getpass("Password: ")
mypass = None
with open(DIRNAME + "pass") as f:
    mypass = f.read()

driver = webdriver.Firefox()
driver.get("http://albert.nyu.edu/course-finder")
driver.select = driver.find_element_by_css_selector # too wordy

timeout = 60

loginid = WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.ID, "userid"))
    )
loginpass = WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.ID, "pwd"))
    )

loginid.send_keys(myid)
loginpass.send_keys(mypass, Keys.ENTER)

studentcenterbutton = WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.XPATH, """//*[@id="student_center_wsq"]/a"""))
    )
studentcenterbutton.click()

driver.switch_to_frame("TargetContent")
searchbutton = WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "#DERIVED_SSS_SCL_SSS_GO_4\$83\$"))
    )
searchbutton.click()

# We are now in the albert course search.
checkbox = WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "#NYU_CLS_WRK_NYU_FALL"))
    ) # selects the semester
checkbox.click()
time.sleep(5)

"""
    {
        "ART-SHU": {
            "2": {
                "name": "Introduction to Studio Art - Chinese Traditional Methods in Contemporary Art",
                "coursenum": "210",
                ...
            },
            "5": { ... }
        }
        "BIOL-SHU": {
            ...
        }
    }

"""

# On second thought, don't need to select the school.
selectables = []
with open(DIRNAME + "majors.txt") as f:
    for line in f:
        selectables.append(line.strip())

outdict = {}
for subject in selectables:
    print subject
    outdict[subject] = {}

    # Click on the subject link
    link = WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.PARTIAL_LINK_TEXT, subject))
    )
    link.click()
    WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.ID, "NYU_CLS_WRK_DESCR100"))
    ) # wait for the new page to load
    trianglebuttons = driver.find_elements_by_class_name("PSHYPERLINK")
    internalIDs = []
    for button in trianglebuttons:
        buttonid = button.get_attribute("id")
        if buttonid.startswith("NYU_CLS_DERIVED_TERM"):
            internalid = buttonid.split("$")[1]
            internalIDs.append(internalid) 
            outdict[subject][internalid] = {}
            # these 'buttonids' are actually used for each subject thing
            # so will be very useful

    # Get course name
    for ident in internalIDs:
        coursetable = WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.ID, "win0divNYU_CLS_DERIVED_HTMLAREA$" + ident))
        )
        fulldesc = None
        try:
            desc = coursetable.find_element_by_class_name("courseDescription")
            courseid = desc.get_attribute("id").split("_")[1] # to find the css id for long desc.
            coursetable.find_element_by_css_selector("a").click()
            longdesc = WebDriverWait(driver, timeout).until(
                EC.presence_of_element_located((By.ID, "fullDescription_" + courseid))
            )
            fulldesc = longdesc.text
        except selenium.common.exceptions.NoSuchElementException:
            fulldesc = coursetable.find_element_by_css_selector("p").text
        outdict[subject][ident]["desc"] = fulldesc
        outdict[subject][ident]["header"] = coursetable.find_element_by_css_selector("b").text

        
    # Get expanded table
    for ident in internalIDs:
        button = driver.find_element_by_id("NYU_CLS_DERIVED_TERM$" + ident)
        button.click()

        tableid = 'ACE_NYU_CLS_DERIVED_TERM$' + ident
        try:
            table = WebDriverWait(driver, timeout).until(
                        EC.presence_of_element_located((By.ID, tableid))
                    ) # get the term data
        except TimeoutException as e:
            print("Current: " + tableid)
            print("Retrying...")
            button = driver.find_element_by_id("NYU_CLS_DERIVED_TERM$" + ident
                ).find_element_by_css_selector("img")
            button.click()
            table = WebDriverWait(driver, timeout).until(
                        EC.presence_of_element_located((By.ID, tableid))
                    ) # get the term data
        outdict[subject][ident]["table"] = table.text

    # intermediate saving
    dumpJsonAndChmod(outdict[subject], "out/%s.json" % (subject))

    # Go back to original page
    returnbutton = WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "#win0divNYU_CLS_DERIVED_BACK"))
    )
    returnbutton.click()

print "Exporting to json"

dumpJsonAndChmod(outdict, "out/courses.json")
print "Done."
driver.close()