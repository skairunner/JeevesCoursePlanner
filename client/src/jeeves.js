define(['d3', 'underscore', 'utility', 'drawcourse'], 
function(d3, _, util, draw){
	///////
	var calendars = []; // a list of all calendar datas.
	var active    = 0;

	var coursedata = null;
	var unitindex = null;

	var filters = [];
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
	

	// Gets a string representation of a time array
	

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

	function timeCollides(component, courses) {
		var days  = component.days;
		var start = component.starttime;
		var end   = component.endtime;
		for (var i in courses) {
			var selected = courses[i].sectiondata;
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
			if (util.cmptime(cstart, end) && !util.cmptime(cend, start)) return true;
			// 2. if cend is after start, while cstart isn't after end
			if (util.cmptime(start, cend) && !util.cmptime(end, cstart)) return true;
		}
		return false
	}

	// Combines the various filters and displays the results in the search area.
	function displayCourses(includeActive) {
		if (includeActive) {
			var results = filters.concat([[activefilter, activefilterResults]]);
		} else {
			var results = filters.concat();
		}
		results = _.map(results, function(r) {
			if (r[1].length == 0) return null;
			return r[1];
		});
		results = _.compact(results); // remove empty filters
		// get all non-duplicates
		var coursecodes = _.uniq(results);
		// next, make sure every filter is satisfied.
		var filteredcoursecodes = _.intersection.apply(_, results);
		// single line of code that finds intersection of all course arrays! :D

		// finalcoursecodes: each element is a [code, sections].
		// sections is the list of sections ids to actually display
		// If the sections is empty, return null.
		var finalcoursecodes = _.map(filteredcoursecodes, function(code){
			// If already taking course:
			// 1. if all requirements filled, return null
			var courseinfo = coursedata[code];
			var required = satisfiedCourseRequirements(courseinfo, calendars[active].courses);
			// 2. if not, exclude already taken componentTypes.
			if (required.length == 0) {
				return null;
			}
			var sections = _.filter(courseinfo.components, function(comp){
				if (required.indexOf(comp.componentType) == -1) {
					return false
				}
				return true;
			});
			// If showconflicts is false, filter out those that conflict timewise
			if (!d3.select("#showconflicts").property("checked")) {
				sections = _.filter(sections, function(section){
					return !timeCollides(section, calendars[active].courses);
				});
			}
			if (sections.length == 0) return null;
			return [code, sections];
		});

		// remove all null things.
		finalcoursecodes = _.compact(finalcoursecodes);
		// each component needs its own entry.
		d3.select('#searchresults').html('').selectAll(".courseholder").data(finalcoursecodes).enter()
		  .append("div").classed("courseholder",true).each(resultFormatter);
	    
	    // get number of child nodes. If zero, add a message.
	    decideNothingMessage(d3.select("#searchresults"));
	}


	function expandOrContractText(d, i) {
		var me = d3.select(this);
		var text = d3.select(this.parentNode).select(".desctext");
		var fulldesc = coursedata[me.datum()[0]].desc;
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
			addToCourses(data.name, +d.section, d);
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
				// if not in index, need to do it the hard way.
			for (var course in coursedata) {			
				course = coursedata[course];
				if (course.searchable.indexOf(d) >= 0) {
					results.push(course.name);
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
		displayCourses(true);
	}

	function searchbox(){
		if(coursedata) {
			activefilter = this.value;
			clearTimeout(searchboxTimeout);	
			if (event.keyCode == 13) {// 'enter' 	
				activefilterResults = search(activefilter);
				setFilter(this); // move from activefilter to filterlist
				displayCourses(false);
			} else {
				searchboxTimeout = window.setTimeout(function(){
					activefilterResults = search(activefilter);
					displayCourses(true);
				}, 100);
			}
		}
	}

	function addToCourses(code, sectionindex, sectiondata) {
		var courseprofile = {
			"coursedata"  : coursedata[code],
			"sectionindex": sectionindex,
			"sectiondata" : sectiondata
		};
		calendars[active].courses.push(courseprofile);
		displayCourses(true); // because need to update conflicting stuff
		draw.drawcalendar(calendars[active]);
	}	

	//////////////////////////////

	function exportCourseNumbers() {
		var out = _.map(calendars[active].courses, function(d){
			return [d.coursedata.name + "-" + d.sectiondata.section,
			d.coursedata.title,
			d.sectiondata.componentType,
			d.sectiondata.number]
		});

		d3.select("#coursenums").html('').selectAll("tr").data(out)
		  .enter().append("tr").selectAll("td").data(function(d){return d;})
		  .enter()
		  .append("td").text(function(d) {return d;});
	}

	function newcalendar() {
		draw.initcalendar(calendars);
		util.transitionViewTo(calendars.length-1, calendars);
		displayCourses(true);
	}

	function clonecalendar() {
		var current = calendars[active];
		draw.initcalendar(calendars);
		var calendar = calendars[calendars.length-1];
		// shallow copy
		calendar.courses = _.map(current.courses, function(d){return d;});
		draw.drawcalendar(calendars[calendars.length-1]);
		draw.transitionViewTo(calendars.length-1, calendars);
		active = calendars.length - 1;
		displayCourses(true);
	}

	function resetremovebutton(target) {
		target.text("Delete").on("click", function(){askremove(calendars[active], this);});
	}

	function wait(target) {
		window.setTimeout(function(){
		resetremovebutton(target);
		}, 500);
	}

	function askremove(d) {
		var target = d3.select("#delete");
		var timeout = window.setTimeout(function(){
			resetremovebutton(target);
		}, 3000);
		target.text("Really delete?").on("click", function(){
			removecalendar(d, target);
			wait(target);
			window.clearTimeout(timeout);
		});
	}

	function removecalendar(d, target) {
		if (active >= calendars.length-1) active = calendars.length - 2;
		if (active < 0) active = 0;
		draw.deletecalendar(d, calendars, active);
		displayCourses(true);
	}

	function scrollleft() {
		active = active - 1;
		if (active < 0) active = 0;
		draw.transitionViewTo(active, calendars);
		displayCourses(true);
	}

	function scrollright() {
		active = active + 1;
		if (active >= calendars.length) active = calendars.length - 1;
		draw.transitionViewTo(active, calendars);
		displayCourses(true);
	}

	function init(testing) {
		draw.outsidefuncs.push(displayCourses);
		d3.json("src/courses.flat.json", function(e,d){
			coursedata = d;
			// for testing.
			if (testing) {
				calendars[0].courses = [
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
				draw.updateCreditsTotal(calendars[0]);
				draw.drawcalendar(calendars[0]);
				setFilterTo("lehman");
			}
		});
		d3.json("src/courses.index.json", function(e,d){
			unitindex = d[1];
		});
		draw.initcalendar(calendars);
		draw.drawcalendar(calendars[0]);
		d3.select("#searchbox").on("keyup", searchbox);
		d3.select("#showconflicts").on("click", function(){displayCourses(true);});
		d3.select("#export").on("click", function(){exportCourseNumbers();});
		d3.select("#clone").on("click", function(){clonecalendar();});
		d3.select("#delete").on("click", function(){askremove(calendars[active])});
		d3.select("#prev").on("click", function(){scrollleft();});
		d3.select("#next").on("click", function(){scrollright();});
		d3.select("#new").on("click", function(){newcalendar();});
	}

	return {startjeeves: init};
});