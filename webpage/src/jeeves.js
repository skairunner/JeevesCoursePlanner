document.addEventListener("DOMContentLoaded", init)
///////
var coursedata = null;
var wordindex = null;
var unitindex = null;

var filters = [];
var expandedcourses = [];

var axistransitiontime = 1200;
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

var DayFromInt = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
var coursesSelected = [];
// Colors from colorbrewer2.org. 12 colors.
var colors = ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd','#ccebc5','#ffed6f'];
function pickColor(i) {
	return colors[i % colors.length];
}

function timestrFromTime(time) {
	var h = time[0];
	var m = time[1];
	var am = true;
	if (h >= 12) {
		// time shenaningans
		h -= 12;
		if (h == 0) h = 12;
		am = false;
	}
	if (am) {
		am = "am";
	} else {
		am = "pm";
	}
	if (m < 10) m = "0" + m;
	return h+":"+m+am;
}

function strFromSectionTime(sectiondata) {
	var start = sectiondata.starttime;
	var end = sectiondata.endtime;
	start = timestrFromTime(start);
	end = timestrFromTime(end);
	return start + "—" + end;
}

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


function expandOrContractText(d, i) {
	var me = d3.select(this);
	var text = d3.select(this.parentNode).select(".desctext");
	var fulldesc = coursedata[me.datum()].desc;
	if (me.text() == "▸") {
		me.text("▾");
		text.text(fulldesc);
	} else {
		me.text("▸");
		text.text(fulldesc.substring(0,100) + "...");
	}
}

// Draws courses and components
function resultFormatter(d, i) {
	var classcode = d;
	var selection = d3.select(this);
	var data = coursedata[classcode];
	var header = selection.append("div").classed("header", true);
	header.append("span").classed("coursecode",true).text(classcode);
	header.append("span").classed("coursetitle", true).text(data.title);
	var span = selection.append("span").classed("desc", true);
	if (data.desc.length > 100) {
		span.append("span").classed("expandable", true).on("click", expandOrContractText).text("▸");
		span.append("span").classed("desctext", true).text(data.desc.substring(0,100) + "...");	
	} else {
		span.append("span").classed("desctext", true).text(data.desc);
	}

	var sections = selection.append("div").classed("sections", true)
						.selectAll(".section").data(data.components).enter()
						.append("div").classed("section", true);
	// hook up the onclick function
	sections.on("click", function(d, i){
		// 'data' is the course info, 'd' the component info
		addToCourses(data.name, i, d, this);
	;});
	// fill out info
	sections.append("span").classed("sectionnum", true).text(function(d){
		return "Section " + d.section;
	});
	sections.append("span").classed("sectiontype", true).text(function(d){
		return d.componentType;
	});
	sections.append("span").classed("units", true).text(function(d){
		var units = d.units;
		if (units === undefined) {
			return "";
		}
		return d.units + " units";
	});
	sections.append("div").classed("details", true).text(function(d) {
		return d.details;
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

function addToCourses(code, sectionindex, sectiondata, element) {
	var courseprofile = {
		"coursedata": coursedata[code],
		"sectionindex": sectionindex,
		"sectiondata" : sectiondata
	};
	expandedcourses.push(courseprofile);
}

function minutesFromTime(time) {
	return time[0] * 60 + time[1];
}

function svgDrawCourses() {
	if (coursesSelected.length == 0){ 
		// reset axis to original 8 to 6
		changeTimeAxis([new Date(2015, 10, 14, 8, 0)
		, new Date(2015, 10, 14, 18, 0)], 0, axistransitiontime);
	}
	// else, need to find new min and max times.
	var min = _.min(coursesSelected, function(d){
		return minutesFromTime(d.sectiondata.starttime);
	});
	var max = _.max(coursesSelected, function(d){
		return minutesFromTime(d.sectiondata.endtime);
	});
	min = minutesFromTime(min.sectiondata.starttime);
	max = minutesFromTime(max.sectiondata.endtime);
	// If doing mintime, round down. If doing maxtime, round up.
	var mintime = Math.floor(min/60);
	var maxtime = Math.ceil(max/60);
	changeTimeAxis(new Date(2015, 10, 14, mintime, 0)
		, new Date(2015, 10, 14, maxtime, 0), 0, axistransitiontime);

	// Next, draw the courses.
	d3.select("#coursearea").selectAll(".classblocks").data(coursesSelected)
	  .enter().append("g")
	          .classed(".classblocks", true)
	          .attr("transform", axisorigin)
	          .each(drawCourseBlock);
}

/**
 * Uses canvas.measureText to compute and return the width of the given text of given font in pixels.
 * 
 * @param {String} text The text to be rendered.
 * @param {String} font The css font descriptor that text is to be rendered with (e.g. "bold 14px verdana").
 * 
 * @see http://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
 */
function getTextWidth(text, font) {
    // re-use canvas object for better performance
    var canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
    var context = canvas.getContext("2d");
    context.font = font;
    var metrics = context.measureText(text);
    return metrics.width;
};

// Find font size so that width is equal to or smaller than target.
function findTextWidth(text, font, target) {
	var size = 16;
	var textsize = target * 10;
	while (textsize > target) {
		size -= 1;
		textsize = getTextWidth(text, size + "px " + font);
	}
	return size
}

var TEXTTRUNLEN = 15;
function drawCourseBlock(d, i) {
	var me = d3.select(this);
	var days = _.map(d.sectiondata.days, function(x){return DayFromInt[x];});
	// get times for scale stuff
	var t = d.sectiondata.starttime;
	var starttime = new Date(2015, 10, 14, t[0], t[1]);
	t = d.sectiondata.endtime;
	var endtime = new Date(2015, 10, 14, t[0], t[1]);
	var color = pickColor(i);
	// nifty scale usage
	var startY = timescale(starttime);
	var endY = timescale(endtime);
	var dY = endY - startY;
	// append a colored block for each class.
	_.each(days, function(day, index) {
		var rect = me.append("rect").classed("classblock", true)
		   .attr("x", dayscale(day))
		   .attr("y", startY)
		   .attr("width", dayscale.rangeBand())
		   .attr("height", dY);
		rect.attr("fill", color);

		// Finds text size by trial & error.
		var texts = [d.coursedata.name + "-" + d.sectiondata.section,
					 d.coursedata.title,
					 strFromSectionTime(d.sectiondata),
					 d.sectiondata.componentType];
		var sizes = [];

		_.each(texts, function(text) {
			sizes.push(findTextWidth(text, "Times New Roman"
								, dayscale.rangeBand()))
		})
		sizes[1] = findTextWidth(texts[1].substr(0,TEXTTRUNLEN)
								, "Times New Roman", dayscale.rangeBand());

		var textdata = _.zip(texts, sizes);

		// put text.
		me.selectAll(".blocktext" + index).data(textdata).enter()
		    .append("text").classed("blocktext", true)
			.attr("x", dayscale(day))
			.attr("y", function(d,i){return startY + (i+0.5)*dY/texts.length;})
			.on("mouseover", function(d,i){
				if (i == 1) {					
					d3.select(this).text(d[0]);
				}
			})
			.on("mouseout", function(d,i){
				if (i == 1) {					
					d3.select(this).text(d[0].substr(0,TEXTTRUNLEN));
				}
			})
			.style("font-size", function(d){
				if (i==1) {
					return 
				}
				return d[1] + "px";
			})
			.text(function(d,i){
				if (i==1) {
					return d[0].substr(0,TEXTTRUNLEN);
				}
				return d[0];
			});
	});

}

///////////////////////////

var timescale, timeaxis, dayscale, dayaxis;
var axisorigin = "translate(50, 40)";

function changeTimeAxis(timestart, timeend, delay, duration) {
	timescale.domain([timestart, timeend]);
	d3.select("#timeaxis").transition().ease("cubic-out")
	  .duration(duration).delay(delay).call(timeaxis);
}

function redrawLines() {
	var verticalpositions = [];
	verticalpositions = _.map(DayFromInt, function(day){
		return dayscale(day)+dayscale.rangeBand();
	})
	d3.select("#verticallines").selectAll(".verticalline")
	  .data(verticalpositions)
	  .enter()
	  .append("line").attr("transform", axisorigin)
	  .classed("verticalline", true)
	  .attr("x1", function(d){return d;})
	  .attr("x2", function(d){return d;})
	  .attr("y1", function(d){return 0;})
	  .attr("y2", function(d){return 500;});
}

function initSVG() {
	var svg = d3.select("#calendarsvg");	
    svg.append("g").attr("id", "verticallines");
    svg.append("g").attr("id", "coursearea");
	// initialize time scale and axis.
	timescale = d3.time.scale().domain([new Date(2015, 10, 14, 8, 0)
		, new Date(2015, 10, 14, 18, 0)]);
	timescale.range([0, 500]);
	var tickformat = d3.time.format("%H:%M");
	timeaxis = d3.svg.axis().scale(timescale);
	timeaxis.tickFormat(tickformat);
	timeaxis.orient("left");
	svg.append("g").attr("id", "timeaxis").classed("axis", true)
	   .attr("transform", axisorigin)
	   .call(timeaxis);
	// initialize day scale and axis
	dayscale = d3.scale.ordinal();
	dayscale.domain(DayFromInt);
	dayscale.rangeBands([0, 500], 0, 0.01);
	dayaxis = d3.svg.axis().scale(dayscale).orient("top");
	svg.append("g").attr("id", "dayaxis").classed("axis", true)
	   .attr("transform", axisorigin)
	   .call(dayaxis);
   // draw lines for graph.
   redrawLines();

}

//////////////////////////////

function init() {
	d3.json("courses.flat.json", function(e,d){
		coursedata = d;
		// for testing.
		if (true) {
			coursesSelected = [
				{
					"coursedata": coursedata["INTM-SHU 240"],
					"sectionindex": 0,
					"sectiondata": coursedata["INTM-SHU 240"].components[0]
				},
				{
					"coursedata": coursedata["INTM-SHU 240"],
					"sectionindex": 1,
					"sectiondata": coursedata["INTM-SHU 240"].components[1]
				},
				{
					"coursedata": coursedata["CHIN-SHU 201"],
					"sectionindex": 1,
					"sectiondata": coursedata["CHIN-SHU 201"].components[1]
				},
				{
					"coursedata": coursedata["INTM-SHU 127"],
					"sectionindex": 0,
					"sectiondata": coursedata["INTM-SHU 127"].components[0]
				},
				{
					"coursedata": coursedata["INTM-SHU 127"],
					"sectionindex": 1,
					"sectiondata": coursedata["INTM-SHU 127"].components[1]
				}
			];
			svgDrawCourses();
		}
	});
	d3.json("courses.index.json", function(e,d){
		wordindex = d[0];
		unitindex = d[1];
	});
	initSVG();
	d3.select("#searchbox").on("keyup", searchbox);
}