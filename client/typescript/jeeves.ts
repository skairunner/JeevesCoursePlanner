import d3 = require("d3");
import e6promise = require("es6-promise");
import * as Draw from "./Draw";
import * as utility from "./utility";
import * as CourseClasses from "./CourseClasses";

var Promise = e6promise.Promise;

class Filter {
	raw:string; // the actual filter. eg "computer science"
	results:SearchResult[];
	
	constructor() {
		this.raw = "";
		this.results = [];
	}
}

///////
var calendars: Draw.Calendar[] = []; // a list of all calendar datas.
var active = 0;

var coursecatalogue = new CourseClasses.CourseCatalogue();
var unitindex = null;

var filters:Filter[] = [];
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
var activefilter = new Filter(); // the filter buffer. if press enter, move it to @filters.
var buffer = "";
var searchboxTimeout = null;


// Gets a string representation of a time array


// Takes the list of required components from course, and compares it
// vs selected components. If not completely fulfilled, return
// the components that need to be selected still.
// sectionsSelected should a list of the actual components.
function satisfiedCourseRequirements(courseinfo:CourseClasses.Course, sectionsSelected:CourseClasses.SelectedCourse[]) {
	var reqs = courseinfo.requiredcomponents;
	var components:string[] = [];
	for (let i = 0; i < sectionsSelected.length; i++) {
		let component = sectionsSelected[i];
		if (component.course.name == courseinfo.name) {
			components.push(component.component.componentType);
		}
	}
	var stillrequired:string[] = [];
	for (let i = 0; i < reqs.length; i++) {
		if (components.indexOf(reqs[i]) == -1) {
			stillrequired.push(reqs[i]);
		}
	}

	return stillrequired;
}

function timeCollides(component:CourseClasses.CourseComponent, courses:CourseClasses.SelectedCourse[]) {
	let classtimes1 = component.classtimes;
	for (let i = 0; i < courses.length; i++) {
		let other = courses[i];
		let classtimes2 = other.component.classtimes;
		for (let x = 0; x < classtimes1.length; x++) {
			for (let y = 0; y < classtimes2.length; y++) {
				if (classtimes1[x].overlaps(classtimes2[y])) {
					return true;
				}
			}
		}
	}
	return false;
}

function max(a, b) {
	if (a > b) return a;
	return b;
}

function filterintersect(f1:SearchResult[], f2:SearchResult[]) {
	var ret:SearchResult[] = [];
	var f1Len = f1.length;
	var f2Len = f2.length;
	for (var i = 0; i < f1Len; i++) {
		for (var z = 0; z < f2Len; z++) {
			if (f1[0].coursename == f2[z].coursename) {
				var result = new SearchResult(f1[i].coursename, f1[i].priority);
				result.priority = max(f1[i].priority, f2[z].priority);
				ret.push(result);
				break;
			}
		}
	}
	return ret;
}

// Combines the various filters and displays the results in the search area.
function displaySearchResults(includeActive:boolean) {
	// filters looks like [[filter, [results]], [filter2, results2]]
	var results = filters.map(function(filter){
			return filter.results;
	});
	// now it looks like [[[c1],[c2],[c3]]], [[c5],[c6],[c7]]]]

	if (includeActive) {
		results.push(activefilter.results);
	}

	// turns empty filters into null
	var results = results.map(function(r) {
		if (r.length == 0)
			return null
		return r;
	});
	results = results.filter(utility.isNull); // remove empty filters
	// sort by priority
	for (let i = 0; i < results.length; i++) {
		results[i].sort(function(d1, d2){ return d2.priority - d1.priority; });
	}

	var intersection:SearchResult[];
	if (results.length >= 2) {
		intersection = filterintersect(results[0], results[1]);
		for (var i = 2; i < results.length; i++) {
			intersection = filterintersect(intersection, results[i])
		}
	} else if (results.length == 1) {
		intersection = results[0];
	} else {
		intersection = [];
	}
 

	var finalcoursecodes = intersection.map(function(result){
		var code = result.coursename;
		// If already taking course:
		// 1. if all requirements filled, return null
		var courseinfo:CourseClasses.Course = coursecatalogue.table[code];
		var stillrequired = satisfiedCourseRequirements(courseinfo, calendars[active].courses);
		// 2. if not, exclude already taken componentTypes.
		if (stillrequired.length == 0) {
			return null;
		}
		var sections = courseinfo.components.filter(function(comp){
			if (stillrequired.indexOf(comp.componentType) == -1) { // discard it if the component type has already been picked
				return false;
			}
			return true;
		});
		// If showconflicts is false, filter out those that conflict timewise
		if (!d3.select("#showconflicts").property("checked")) {
			sections = sections.filter(function(section){
				return !timeCollides(section, calendars[active].courses);
			});
		}
		if (sections.length == 0) return null;
		let out:[string, CourseClasses.CourseComponent[]] = [code, sections];
		return out;
	});

	// remove all null things.
	finalcoursecodes = finalcoursecodes.filter(utility.isNull);
	// each component needs its own entry.
	d3.select('#searchresults').html('').selectAll(".courseholder").data(finalcoursecodes).enter()
		.append("div").classed("courseholder",true).each(resultFormatter);
	
	// get number of child nodes. If zero, add a message.
	decideNothingMessage(d3.select("#searchresults"));
}


function expandOrContractText(d:[string, CourseClasses.CourseComponent[]], i:number) {
	var me = d3.select(this);
	var text = d3.select(this.parentNode).select(".desctext");
	var fulldesc = coursecatalogue[me.datum()[0]].desc;
	if (me.text() == "▸") {
		me.text("▾");
		text.text(fulldesc);
	} else {
		me.text("▸");
		text.text(fulldesc.substring(0,100) + "...");
	}
}

// Draws courses and components
function resultFormatter(d, i:number) {
	var classcode:string = d[0];
	var sectiondata:CourseClasses.CourseComponent[] = d[1];
	var selection = d3.select(this);
	var data:CourseClasses.Course = coursecatalogue.table[classcode];

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
		addToCourses(data.name, d.section, d);
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
		return d.notes;
	});
}

function sanitize(s) {
	var out = "";
	s = s.toLowerCase();
	for (var i in s) {
		let c = s[i];
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


class SearchResult {
	coursename:string;
	priority:number;
	constructor(coursename:string, priority:number) {
		this.coursename = coursename;
		this.priority = priority;
	}
}

// Gets all courses that satisfy filter "d"
function search(filter:string) {
	var results:SearchResult[] = []
	// Find all the things that have d, and display.
	filter = sanitize(filter);
	results = [];
	// if not in index, need to do it the hard way.
	for (let i in coursecatalogue.list) {
		let coursedata = coursecatalogue.list[i];
		let coursename = coursedata.name;
		var index = coursedata.searchable.indexOf(filter);
		if (index >= 0) {
			var priority = 200 - index;
			if (priority < 0) {
				priority = 0;
			}
			results.push(new SearchResult(coursedata.name, priority));
		}
	}
	return results
}

// for testing purposes
function setFilterTo(filter) {
	var filterobj = new Filter();
	filterobj.raw = filter;
	filterobj.results = search(filterobj.raw);
	filters.push(filterobj);
	d3.select("#filters").append("span")
		.datum(filter)
		.classed("filter", true)
		.html("<span class=\"x\">&#10005;</span>" + filter).on("click", removefilter);
	displaySearchResults(false);
	decideNothingMessage(d3.select("#searchresults"));
}

function setFilter() {
	filters.push(activefilter);
	d3.select("#filters").append("span")
		.datum(activefilter)
		.classed("filter", true)
		.html("<span class=\"x\">&#10005;</span>" + activefilter.raw).on("click", removefilter);

	activefilter = new Filter();
	d3.select("#searchbox").property("value", activefilter.raw);
	decideNothingMessage(d3.select("#searchresults"));
}

function setFilterIfSpaces() {
	var strs = activefilter.raw.split(" ");
	if (strs.length > 1) {
		var i = 0;
		for (; i < strs.length - 1; i++) {
			var filter = new Filter();
			filter.raw = strs[i];
			filter.results = search(strs[i]);
			filters.push(filter);
			d3.select("#filters").append("span")
				.datum(filter.raw)
				.classed("filter", true)
				.html("<span class=\"x\">&#10005;</span>" + strs[i]).on("click", removefilter);
		}
		filter = new Filter();
		filter.raw = strs[i];
		activefilter = filter;
		d3.select("#searchbox").property("value", activefilter.raw);
		activefilter.results = search(activefilter.raw);
	}
	decideNothingMessage(d3.select("#searchresults"));
}

function removefilter(d, i:number) {
	var index = -1;
	// questionable for loop.
	for (let i = 0; i < filters.length; i++) {
		if (filters[i].raw) {
			index = i;
			break;
		}
	}
	filters.splice(index, 1);
	d3.select(this).remove();
	displaySearchResults(true);
}

function searchbox(){
	if(coursecatalogue) {
		activefilter.raw = this.value;
		clearTimeout(searchboxTimeout);	
		if (event.keyCode == 13) {// 'enter'
			setFilterIfSpaces(); // move from activefilter to filterlist
			activefilter.results = search(activefilter.raw);
			setFilter();
			displaySearchResults(false);
		} else {
			searchboxTimeout = window.setTimeout(function(){
				setFilterIfSpaces();
				activefilter.results = search(activefilter.raw);
				displaySearchResults(true);
			}, 100);
		}
	}
}

function addToCourses(code, sectionindex, sectiondata) {
	var courseprofile = new CourseClasses.SelectedCourse(coursecatalogue.table[code], sectionindex);
	calendars[active].courses.push(courseprofile);
	displaySearchResults(true); // because need to update conflicting stuff
	calendars[active].draw();
}	

//////////////////////////////

function exportCourseNumbers() {
	var out = calendars[active].courses.map(function(d){
		return [d.course.name + "-" + d.component.section,
		d.course.title,
		d.component.componentType,
		d.component.coursenumber]
	});

	d3.select("#coursenums").html('').selectAll("tr").data(out)
		.enter().append("tr").selectAll("td").data(function(d:(string|number)[]){return d;}) // intermediate data type specified
		.enter()
		.append("td").text(function(d) {return d;});
}

function newcalendar() {
	new Draw.Calendar(calendars);
	Draw.transitionViewTo(calendars.length-1, calendars);
	active = calendars.length - 1;
	displaySearchResults(true);
}

function clonecalendar() {
	var current = calendars[active];
	new Draw.Calendar(calendars);
	var calendar = calendars[calendars.length-1];
	// shallow copy
	calendar.courses = current.courses.map(function(d){return d;});
	// deep copy
	calendar.colors = current.colors.copy();
	calendars[calendars.length-1].draw();
	Draw.transitionViewTo(calendars.length-1, calendars);
	active = calendars.length - 1;
	displaySearchResults(true);
}

function resetremovebutton(target:d3.Selection<any>) {
	target.text("Delete")
	.on("click", function(){askremove(calendars[active]);})
	.classed("button-warning", false);
}

function wait(target) {
	window.setTimeout(function(){
	resetremovebutton(target);
	}, 500);
}

function askremove(d:Draw.Calendar) {
	var target = d3.select("#delete");
	var timeout = window.setTimeout(function(){
		resetremovebutton(target);
	}, 3000);
	target.text("Delete??").on("click", function(){
		removecalendar(d, target);
		target.on("click",null);
		wait(target);
		window.clearTimeout(timeout);
	}).classed("button-warning", true);
}

function removecalendar(d:Draw.Calendar, target:d3.Selection<any>) {
	if (active >= calendars.length-1) active = calendars.length - 2;
	if (active < 0) active = 0;
	d.delete(calendars, active);
	displaySearchResults(true);
}

function scrollleft() {
	active = active - 1;
	if (active < 0) active = 0;
	Draw.transitionViewTo(active, calendars);
	displaySearchResults(true);
}

function scrollright() {
	active = active + 1;
	if (active >= calendars.length) active = calendars.length - 1;
	Draw.transitionViewTo(active, calendars);
	displaySearchResults(true);
}

function readJson(filename) {
	return new Promise(function(fulfill, reject) {
		d3.json("../courses/" + filename, function(e, d){
			if (e != null) {
				reject(e);
			}
			coursecatalogue.bulkAddCourses(d);
			fulfill("filename");
	})});
}

function promiseJson(filenames) {
	return Promise.all(filenames.map(readJson));
}

export function init(testing) {
	Draw.outsidefuncs.push(displaySearchResults);
	// load all files with a Promise.
	var filenames:string[] = [];
	var schools = JSON.parse(window.localStorage.getItem("schools"));
	if (schools.length == 0) {
		filenames = ["min_SHU_courses.flat.json"];
	} else {
		for (var i in schools) {
			var abbv = schools[i];
			filenames.push("min_" + abbv + "_courses.flat.json");
		}
	}
	promiseJson(filenames).then(function(results){
		d3.select("#loading").remove();
		d3.select("#main").style("display", null);
		new Draw.Calendar(calendars);
		calendars[0].draw();
		d3.select("#searchbox").on("keyup", searchbox);
		d3.select("#showconflicts").on("click", function(){displaySearchResults(true);});
		d3.select("#export").on("click", function(){exportCourseNumbers();});
		d3.select("#clone").on("click", function(){clonecalendar();});
		d3.select("#delete").on("click", function(){askremove(calendars[active])});
		d3.select("#prev").on("click", function(){scrollleft();});
		d3.select("#next").on("click", function(){scrollright();});
		// d3.select("#new").on("click", function(){newcalendar();});
		d3.select("#new").on("click", newcalendar);
	}).catch(function(error) {
		throw new Error(error);
	});
}