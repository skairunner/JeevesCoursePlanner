import cherrypy
import random
import os, time, sys
from os.path import abspath, dirname, basename
import datetime
import glob
from urllib import quote
from simplejson.decoder import JSONDecodeError
from cherrypy.lib.static import serve_file
import logging
from hashlib import md5

class Root(object):
    def __init__(self):
        pass

    @cherrypy.expose
    def index(self):
        return "The index of the root object"

if __name__ =='__main__':
    conf = {'/src': {'tools.staticdir.on': True,
        'tools.staticdir.dir': '/home/skyrunner/Coding/ScavengeAlbert/webpage/src'}}
    cherrypy.config.update({'tools.sessions.on' : True})
    cherrypy.config.update({'server.socket_host': '127.0.0.1',
                        'server.socket_port': 8080,
                       })
    root = Root()
    cherrypy.quickstart(Root(), "/", conf)
