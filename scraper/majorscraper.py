from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
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
    with open(fname, "w") as f:
        json.dump(obj, f)
    subprocess.call(["chown", "skyrunner", DIRNAME + fname])

# myid = "ki539"
# print "ID is: " + myid
# # mypass = getpass.getpass("Password: ")
# mypass = None
# with open(DIRNAME + "pass") as f:
#     mypass = f.read()

driver = webdriver.Firefox()
driver.get("http://albert.nyu.edu/course-finder")
driver.select = driver.find_element_by_css_selector # too wordy

timeout = 60

coursesearchlink = WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.XPATH, """//*[@id="NYU_PUBLIC_ALBERT_PW_HMPG_Data"]/div/table/tbody/tr/td/table/tbody/tr[1]/td/table/tbody/tr/td/table/tbody/tr/td[2]/a"""))
    )
coursesearchlink.click()

driver.switch_to_frame("TargetContent")

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

links = []
# On second thought, don't need to select the school.
for tag in driver.find_elements_by_tag_name("a"):
    tagid = tag.get_attribute("id")
    if "LINK" in tagid:
        links.append(tag.text.replace("\n", ""))
        
with open("possiblemajors.txt", "w") as f:
    for link in links:
            f.write(link + "\n")
# subprocess.call(["chown", "skyrunner", DIRNAME + "possiblemajors.txt"])
print "Done."
driver.close()