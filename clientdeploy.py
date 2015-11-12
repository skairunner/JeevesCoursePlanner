from subprocess import call, Popen

"""
    This file is used on the development machine to update the server with
    new css, html and js files.
"""

Popen(["scp", "client/jeeves/jeeves.html", "jeevesDroplet:~/webserver/jeeves"])
jsroot = "client/src/"
files = ["drawcourse.js", "jeeves.css", "jeeves.js", "load.js", "utility.js"]
callthing = ["scp"]
for f in files:
    callthing.append(jsroot + f)
callthing.append("jeevesDroplet:~/webserver/src")
call(callthing)