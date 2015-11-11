from subprocess import call

"""
    This file is used on the development machine to update the server with
    new css, html and js files.
"""

call(["scp", "client/jeeves/jeeves.html", "jeevesDroplet:~/webserver/jeeves"])
call(["scp", "client/src/jeeves.js", "client/src/jeeves.css", "jeevesDroplet:~/webserver/src"])