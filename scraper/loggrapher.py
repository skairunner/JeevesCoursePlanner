# should be a python 3 file.
import random
import numpy
import math
from dateutil.parser import parse
import datetime

if __name__=="__main__":
    import sys
    import matplotlib.pyplot as plt
    data = []
    timediff = datetime.timedelta(hours=12)
    with open("jeeves.log") as log:
        for line in log:
            line = line.strip().split("\t")
            time = line[0]
            time = time.split(",")[0] # remove ms.
            data.append(parse(time) + timediff)
    start, end = min(data), max(data)
    tdiff = end - start
    #hours = math.ceil(tdiff.days*24 + tdiff.seconds/60/60)
    hours = math.ceil(tdiff.days)
    numpydata = [x.timestamp() for x in data]
    hist, edges = numpy.histogram(numpydata, hours)
    edges = edges[:-1]
    binsize = edges[1] - edges[0]

    references = [plt.axhline(x*5) for x in range(4)]
    for x in references:
        x.set_zorder(5)

    plt.axhline(5)
    plt.axhline(10)
    plt.axhline(15)
    plt.axhline(20)

    plt.bar(edges, hist, binsize)

    labels = [edges[x] for x in range(len(edges))]
    plt.xticks(labels, 
        [datetime.datetime.fromtimestamp(x).strftime("%m-%d") for x in labels],
        rotation=30)
    plt.show()