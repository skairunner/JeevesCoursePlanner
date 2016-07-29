import unittest
from courseprocesser import processcourse
import codecs
import json

class TestCourseProcessing(unittest.TestCase):
    def test_Single(self):
        course = codecs.open("testdata/BUSF-SHU 206.testjson", "r", "utf-8").read()
        course = json.loads(course)
        processcourse(course)
        self.assertEqual(course["name"], "BUSF-SHU 206")
        self.assertEqual(course["title"], "Investing And Financing In And With China")
        section = course["components"][0]
        self.assertEqual(section["number"], 19819)
        self.assertEqual(section["section"], "001")
        # self.assertEqual(section["status"], "Wait List (5)")
        self.assertEqual(section["location"], "Shanghai")
        self.assertEqual(section["componentType"], "Lecture")
        self.assertEqual(section["notes"], "This course satisfies the following: Major: BUSF: additional finance elective;BUSM: non-marketing elective")
        self.assertEqual(section["units"], 4)
        self.assertEqual(section["classtimes"], [{
                "day": 0,
                "starttime": [13, 15],
                "endtime": [16, 15]
            }])
        self.assertEqual(section["instructor"], "Yu, Da")

    def test_ignoreTestdates(self):
        course = codecs.open("testdata/CHIN-SHU 2-1S1.testjson", "r", "utf-8").read()
        course = json.loads(course)
        processcourse(course)

        self.assertEqual(len(section["classtimes"]), 2)

unittest.main()