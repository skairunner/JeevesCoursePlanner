document.addEventListener("DOMContentLoaded", init)
var coursedata = null;
var wordindex = null;
var unitindex = null;

var filters = [];
var expandedcourses = []; // ▶ ▼
/*
{
	"filtername": [
		"class1",
		"class2",
		... ]
	// next filter.
	...
}

*/
var activefilter = ""; // the filter buffer. if press enter, move it to @filters.
var activefilterResults = [];
var buffer = "";

var searchboxTimeout = null;

function displayCourses(includeActive) {
	if (includeActive) {
		var results = filters.concat([[activefilter, activefilterResults]]);
	} else {
		var results = filters;
	}

	var coursecodes = [];
	var finalcoursecodes = [];
	// get all non-duplicates
	for (x in results) {
		for (code in results[x][1]) {
			var code = results[x][1][code];
			if (coursecodes.indexOf(code) == -1) {
				coursecodes.push(code);
			}
		}	
	}
	// next, make sure every filter is satisfied.
	for (x in coursecodes) {
		var code = coursecodes[x];
		var fits = true;
		for (filter in results) {
			var satisfying = results[filter][1];
			if (satisfying.indexOf(code) == -1) {
				fits = false;
				break;
			}
		}
		if (fits) {
			finalcoursecodes.push(code);
		}
	}
	// each component needs its own entry.
	d3.select('#searchresults').html('').selectAll(".courseholder").data(finalcoursecodes).enter()
	  .append("div").classed("courseholder",true).each(resultFormatter);
    // get number of child nodes. If zero, add a message.

    decideNothingMessage(d3.select("#searchresults"));
}

function resultFormatter(d, i) {
	var classcode = d;
	var selection = d3.select(this);
	var data = coursedata[classcode];
	var header = selection.append("div").classed("header", true);
	header.append("span").classed("coursecode",true).text(classcode);
	header.append("span").classed("coursetitle", true).text(data.title);
	selection.append("span").classed("desc", true).text(data.desc);

	var sections = selection.append("div").classed("sections", true)
						.selectAll(".section").data(data.components).enter()
						.append("div").classed("section", true);
	sections.append("span").classed("sectionnum", true).text(function(d){
		return "Section " + d.section;
	});
	sections.append("span").classed("sectiontype", true).text(function(d){
		return d.componentType;
	});
}

function sanitize(s) {
	var out = "";
	s = s.toLowerCase();
	for (var i in s) {
		c = s[i];
		if ("abcdefghijklmnopqrstuvwxyz0123456789 ".indexOf(c)==-1) {
			out += "";
		} else {
			out += c;
		}
	}
	return out;
}

function decideNothingMessage(selection){
	var num = selection[0][0].childNodes.length;
	if (num > 1) {
		return;
	} else if (num == 1){
		if (d3.select(selection[0][0].childNodes[0]).attr("id") != "nothingmsg") {
			return;
		}
	} 

	var thing = selection.select("#nothingmsg");
	var msg = "";
	if (thing[0][0] == null) {
		thing = selection.append("span").attr("id", "nothingmsg");
	} 

	if (filters.length == 0) {
		msg = "Enter something to get started!";
	} else {
		msg = "No search results.";
	}
	thing.text(msg);
}

function search(d) {
	results = []
	// check for special keywords
	if (d.indexOf("units:") == 0) {
		activefilter = d;
		d = d.substring(6,7);
		// search for units only.
		for (var course in unitindex[+d]) {
			course = unitindex[+d][course]
			results.push(course);
		}
	} else {
		// Find all the things that have d, and display.
		activefilter = sanitize(d);
		results = [];
		// First check if it is in the index
		if (activefilter in wordindex) {
			for (var course in wordindex[activefilter]) {
				course = wordindex[activefilter][course];
				results.push(course);
			}
		} else {
			// if not in index, need to do it the hard way.
			for (var course in coursedata) {			
				course = coursedata[course];
				if (course.searchable.indexOf(activefilter) >= 0) {
					results.push(course.name);
				}
			}
		}
	}
	activefilterResults = results;
	// Display results.
	displayCourses(true);
}

function setFilter(box) {
	filters.push([activefilter,activefilterResults]);

	activefilterResults = [];
	box.value = "";
	d3.select("#filters").append("span")
	  .datum(activefilter)
	  .classed("filter", true)
	  .html("<span class=\"x\">&#10005;</span>" + activefilter).on("click", removefilter);
  	activefilter = "";

  	decideNothingMessage(d3.select("#searchresults"));
}

function removefilter(d, i) {
	var keys = [];
	for (x in filters) {
		keys.push(filters[x][0])
	}
	var index = keys.indexOf(d);
	filters.splice(index, 1);
	displayCourses();
	d3.select(this).remove();
}

function searchbox(){
	if(coursedata && wordindex) {
		if (event.keyCode == 13) {// 'enter' 
			clearTimeout(searchboxTimeout);
			buffer = this.value;
			search(buffer);
			setFilter(this); // move from activefilter to filterlist
		} else {
			buffer = this.value;
			clearTimeout(searchboxTimeout);
			searchboxTimeout = window.setTimeout(function(){search(buffer);}, 500);
		}
	}
}

function init() {
	d3.json("courses.flat.json", function(e,d){
		coursedata = d;
	});
	d3.json("courses.index.json", function(e,d){
		wordindex = d[0];
		unitindex = d[1];
	});
	d3.select("#searchbox").on("keyup", searchbox);
}