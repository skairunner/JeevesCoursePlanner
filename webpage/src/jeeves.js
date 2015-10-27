document.addEventListener("DOMContentLoaded", init)
///////
var coursedata = null;
var wordindex = null;
var unitindex = null;

var filters = [];

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
// carr = colorarray. if not provided, default to colors
function pickColor(i, carr) {	
	if (carr == undefined) {
		carr = colors;
	} 
	var index = i % carr.length;
	return carr[index];
}

// Returns the back ones first
function rpickColor(i, carr) {
	if (carr == undefined) {
		carr = colors;
	} 
	var index = carr.length - i% carr.length - 1;
	return carr[index];
}

var smartcolors = [
	['#f7fbff','#deebf7','#c6dbef','#9ecae1','#6baed6','#4292c6','#2171b5','#084594'],
	['#f7fcf5','#e5f5e0','#c7e9c0','#a1d99b','#74c476','#41ab5d','#238b45','#005a32'],
	['#fff5eb','#fee6ce','#fdd0a2','#fdae6b','#fd8d3c','#f16913','#d94801','#8c2d04'],
	['#fcfbfd','#efedf5','#dadaeb','#bcbddc','#9e9ac8','#807dba','#6a51a3','#4a1486'],
	['#fff5f0','#fee0d2','#fcbba1','#fc9272','#fb6a4a','#ef3b2c','#cb181d','#99000d'],
	['#ffffff','#f0f0f0','#d9d9d9','#bdbdbd','#969696','#737373','#525252','#252525']
]

var savedcolors = [];

// sequentially traverses colors. same course gets similar colors
function smartPickColor(coursecode, sectionid) {
	var index = savedcolors.indexOf(coursecode);
	if (index != -1) {
		return pickColor(sectionid+1, pickColor(index,smartcolors));
	}
	i = savedcolors.length;
	savedcolors.push(coursecode);
	return pickColor(sectionid+1, pickColor(i,smartcolors));
}

// Gets a string representation of a time array
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

// returns the string "hh:mm am ~ hh:mm pm"
function strFromSectionTime(sectiondata) {
	var start = sectiondata.starttime;
	var end = sectiondata.endtime;
	start = timestrFromTime(start);
	end = timestrFromTime(end);
	return start + "—" + end;
}

// Takes the list of required components from course, and compares it
// vs selected components. If not completely fulfilled, return
// the components that need to be selected still.
// sectionsSelected should a list of the actual components.
function satisfiedCourseRequirements(courseinfo, sectionsSelected) {
	var reqs = courseinfo.requiredcomponents;
	var components = _.map(sectionsSelected, function(component){
		if (component.coursedata.name == courseinfo.name) {
			return component.sectiondata.componentType;
		}
		return null;
	});
	var require =  _.reduce(reqs, function(memo, req){
		if (components.indexOf(req) == -1) {
			memo.push(req);
		}
		return memo;
	}, []);
	return require;
}

// is a <= comparison.
function cmptime(t1, t2) {
	console.log(t1, t2);
	if (t1[0] < t2[0]) {
		return true;
	} else if (t1[0] > t2[0]) {
		return false;
	}
	return t1[1] <= t2[1];
}

function timeCollides(component) {
	var days  = component.days;
	var start = component.starttime;
	var end   = component.endtime;
	for (var i in coursesSelected) {
		var selected = coursesSelected[i].sectiondata;
		var cdays   = selected.days;
		var cstart = selected.starttime;
		var cend   = selected.endtime;
		// if cdays or cstart or cend are null, continue to next iter.
		if (!cstart || !cdays || !cend) {
			continue;
		}
		var commondays = _.intersection(days, cdays);
		if (commondays.length == 0) { // if they have no days in common, continue
			continue;
		}
		// cases of collision: 
		// 1. if cstart is before end, while C doesn't end before it starts
		// cstart <= end && !(cend, start)
		if (cmptime(cstart, end) && !cmptime(cend, start)) return true;
		// 2. if cend is after start, while cstart isn't after end
		if (cmptime(start, cend) && !cmptime(end, cstart)) return true;
	}
	return false
}

// Combines the various filters and displays the results in the search area.
function displayCourses(includeActive) {
	if (includeActive) {
		var results = filters.concat([[activefilter, activefilterResults]]);
	} else {
		var results = filters;
	}
	results = _.map(results, function(r) {
		return r[1];
	})
	var coursecodes = [];
	var filteredcoursecodes = [];
	// get all non-duplicates
	for (x in results) {
		_.each(results[x], function(code) {
			if (coursecodes.indexOf(code) == -1) {
				coursecodes.push(code);
			}
		});
	}
	// next, make sure every filter is satisfied.
	filteredcoursecodes = _.intersection.apply(_, results);
	// single line of code that finds intersection of all course arrays! :D

	// finalcoursecodes: each element is a [code, sections].
	// sections is the list of sections ids to actually display
	// If the sections is empty, return null.
	var finalcoursecodes = _.map(filteredcoursecodes, function(code){
		// If already taking course:
		// 1. if all requirements filled, return null
		var courseinfo = coursedata[code];
		var required = satisfiedCourseRequirements(courseinfo, coursesSelected);
		// 2. if not, exclude already taken componentTypes.
		if (required.length == 0) {
			return null;
		}
		var sections = _.map(courseinfo.components, function(comp){
			if (required.indexOf(comp.componentType) == -1) {
				return null;
			}
			return comp;
		});
		// If showconflicts is false, filter out those that conflict timewise
		if (!d3.select("#showconflicts").property("checked")) {
			sections = _.map(sections, function(section){
				if (section == null) {
					return null;
				}
				if (timeCollides(section)) {
					return null;
				}
				return section;
			});
			sections = _.without(sections, null);
		}
		if (sections.length == 0) return null;
		return [code, sections];
	});

	// remove all null things.
	finalcoursecodes = _.without(finalcoursecodes, null);
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
	var classcode = d[0];
	var sectiondata = d[1];
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
						.selectAll(".section").data(sectiondata).enter()
						.append("div").classed("section", true);
	// hook up the onclick function
	sections.on("click", function(d){
		// 'data' is the course info, 'd' the component info
		addToCourses(data.name, +d.section, d, this);
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
		if ("abcdefghijklmnopqrstuvwxyz0123456789 -".indexOf(c)==-1) {
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

// Gets all courses that satisfy filter "d"
function search(d, noindex) {
	var results = []
	// check for special keywords
	if (d.indexOf("units:") == 0) {
		d = d.substring(6,7);
		// search for units only.
		for (var course in unitindex[+d]) {
			course = unitindex[+d][course]
			results.push(course);
		}
	} else if (d.indexOf("startsafter:") == 0) {
		d = d.substring(12,20);
	}

	else {
		// Find all the things that have d, and display.
		d = sanitize(d);
		results = [];
		// First check if it is in the index
		if ((!noindex) && (d in wordindex)) {
			for (var course in wordindex[d]) {
				course = wordindex[d][course];
				results.push(course);
			}
		} else {
			// if not in index, need to do it the hard way.
			for (var course in coursedata) {			
				course = coursedata[course];
				if (course.searchable.indexOf(d) >= 0) {
					results.push(course.name);
				}
			}
		}
	}
	return results
}

// for testing purposes
function setFilterTo(filter) {
	filters.push([filter, search(filter, true)]);
	d3.select("#filters").append("span")
	  .datum(filter)
	  .classed("filter", true)
	  .html("<span class=\"x\">&#10005;</span>" + filter).on("click", removefilter);
	displayCourses();
  	decideNothingMessage(d3.select("#searchresults"));
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
	var index = _.findIndex(filters, function(f){
		return f[0]
	});
	filters.splice(index, 1);
	d3.select(this).remove();
	displayCourses(false);
}

function searchbox(){
	if(coursedata && wordindex) {
		activefilter = this.value;
		clearTimeout(searchboxTimeout);	
		if (event.keyCode == 13) {// 'enter' 	
			activefilterResults = search(activefilter);
			setFilter(this); // move from activefilter to filterlist
			displayCourses();
		} else {
			searchboxTimeout = window.setTimeout(function(){
				activefilterResults = search(activefilter);
				displayCourses(true);
			}, 500);
		}
	}
}

function addToCourses(code, sectionindex, sectiondata, element) {
	var courseprofile = {
		"coursedata"  : coursedata[code],
		"sectionindex": sectionindex,
		"sectiondata" : sectiondata
	};
	coursesSelected.push(courseprofile);
	displayCourses(); // because need to update conflicting stuff
	svgDrawCourses();
}

function minutesFromTime(time) {
	if (time == undefined) {
		return "No time";
	}
	return time[0] * 60 + time[1];
}


///////////////////////////

function svgDrawCourses() {
	if (coursesSelected.length == 0){ 
		d3.select("#coursearea").html('');
		// reset axis to original 8 to 6
		changeTimeAxis(new Date(2015, 10, 14, 8, 0)
			, new Date(2015, 10, 14, 18, 0), 0, axistransitiontime);
		return;
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
	var allcourses =  d3.select("#coursearea")
						.selectAll(".classblocks")
						.data(coursesSelected, function(k){
							return k.coursedata.name + " " + k.sectionindex;
						});		
	allcourses.enter().append("g")
      .classed("classblocks", true)
      .attr("transform", axisorigin)
  	allcourses.each(drawCourseBlock);		
  	allcourses.exit().remove();
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
	var me = d3.select(this).html('');
	var days = _.map(d.sectiondata.days, function(x){return DayFromInt[x];});
	// get times for scale stuff
	var t = d.sectiondata.starttime;
	if (t == undefined) {
		console.warn("The course " + d.coursedata.name + " does not have time info.");
		return;
	}
	var starttime = new Date(2015, 10, 14, t[0], t[1]);
	t = d.sectiondata.endtime;
	var endtime = new Date(2015, 10, 14, t[0], t[1]);
	var color = smartPickColor(d.coursedata.name, d.sectionindex+1);
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
		   .attr("height", dY)
		   .on("click", removeCourseBlock);
		rect.attr("fill", color);

		// Finds text size by trial & error.
		var texts = [d.coursedata.name + "-" + d.sectiondata.section,
					 d.coursedata.title,
					 d.sectiondata.name,
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
			})
			.each(function(d,i){
				if (i != 1) {
					d3.select(this).classed("mousepassthru", true);
				}
			});
	});

}

function removeCourseBlock(d, i) {
	// As the context is an individual block, not all the blocks for
	// this class, we need to get the parent node.
	var me = d3.select(this.parentNode);
	coursesSelected = _.without(coursesSelected, d);
	svgDrawCourses();
	displayCourses(); // to update collision and stuff
}

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




//////////////////////////////

function init() {
	d3.json("src/courses.flat.json", function(e,d){
		coursedata = d;
		// for testing.
		if (false) {
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
				},
				{
					"coursedata": coursedata["INTM-SHU 120"],
					"sectionindex": 0,
					"sectiondata": coursedata["INTM-SHU 120"].components[0]
				},
				{
					"coursedata": coursedata["INTM-SHU 120"],
					"sectionindex": 1,
					"sectiondata": coursedata["INTM-SHU 120"].components[1]
				},
				{
					"coursedata": coursedata["INTM-SHU 214"],
					"sectionindex": 0,
					"sectiondata": coursedata["INTM-SHU 214"].components[0]
				}
			];
			svgDrawCourses();
			setFilterTo("chin");
			setFilterTo("201");

		setFilterTo("lehman");
		}
	});
	d3.json("src/courses.index.json", function(e,d){
		wordindex = d[0];
		unitindex = d[1];
	});
	initSVG();
	d3.select("#searchbox").on("keyup", searchbox);
	d3.select("#showconflicts").on("click", function(){displayCourses();})
}