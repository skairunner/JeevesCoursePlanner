import cherrypy
import os, time, sys
import json
from cherrypy.lib.static import serve_file
import logging

logger = logging.getLogger("jeeves")
logger.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s %(message)s\t')
logfile = open("jeeves.log", "a")
ch = logging.StreamHandler(logfile)
ch.setLevel(logging.DEBUG)
ch.setFormatter(formatter)
logger.addHandler(ch)

class Root(object):
    def __init__(self):
        pass

    @cherrypy.expose
    def index(self):
        return "The index of the root object"

    @cherrypy.expose
    def jeeves(self):
        ip = cherrypy.request.headers["Remote-Addr"]
        logger.info("%s\tAccess to Jeeves" % ip)
        return serve_file(os.path.abspath("jeeves/jeeves.html"), "text/html")


if __name__ =='__main__':
    with open("webserver.conf") as f:
        data = json.load(f)
    conf = {'/src': {'tools.staticdir.on': True,
        'tools.staticdir.dir': data["jeevesdir"]}}
    cherrypy.config.update({'tools.sessions.on' : True})
    cherrypy.config.update({'server.socket_host': str(data["sockethost"]),
                        'server.socket_port': data["port"],
                       })
    root = Root()
    cherrypy.quickstart(Root(), "/", conf)
