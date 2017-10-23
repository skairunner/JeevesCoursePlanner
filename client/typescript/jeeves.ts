import d3 = require("d3");
import Tether = require("tether");
import e6promise = require("es6-promise");
import * as Draw from "./Draw";
import * as utility from "./utility";
import * as CourseClasses from "./CourseClasses";

/**
 * This file is the main working file of Jeeves. It may need to be split up.
 */

/**Polyfills Promise. */
var Promise = e6promise.Promise;

/**
 * Represents the filter text and the result of a filter.
 */
class Filter {
	/**The filter text, eg "computer" */
	raw:string;
	/**All [[SearchResult]]s that match the filter. */
	results:SearchResult[];

	constructor() {
		this.raw = "";
		this.results = [];
	}
}

///////
/**Master list of all calendar data */
var calendars: Draw.Calendar[] = [];
/**The index of the current active calendar. */
var active = 0;
/**All courses to be used in this session. */
var coursecatalogue = new CourseClasses.CourseCatalogue();
var unitindex = null;

/**List of all filters active. */
var filters:Filter[] = [];
/**The current active filter that is still being modified.
 * Once 'enter' is pressed, this is moved to [[filters]] and
 * activefilter is set to a new [[Filter]].
*/
var activefilter = new Filter();
/**The current text buffer for the filter bar. */
var buffer = "";
/**Stores the setTimeout() index for the search bar. */
var searchboxTimeout = null;

/**
 * Takes the list of required components from [[Course]], and
 * compares it vs the currently selected components. If the
 * requirements aren't fully filled, it returns the components that
 * are missing.
 * @param courseinfo The course to check against.
 * @param sectionsSelected The selected course sections.
 * @returns List of missing components
 */
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

/**
 * Check if a given component overlaps with any of the already selected courses.
 * @param component Component to check collision for.
 * @param courses List of all selected courses.
 */
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

/**Returns the larger of a and b. */
function max(a, b) {
	if (a > b) return a;
	return b;
}

/**
 * Two Filters are merged, with the higher priority being adopted.
 * @param f1 
 * @param f2 
 * @returns List of SearchResult after merging, sorted by priority.
 */
function filterintersect(f1:SearchResult[], f2:SearchResult[]) {
	var ret:SearchResult[] = [];
	var f1Len = f1.length;
	var f2Len = f2.length;
	for (var i = 0; i < f1Len; i++) {
		for (var z = 0; z < f2Len; z++) {
			if (f1[i].coursename == f2[z].coursename) {
				var result = new SearchResult(f1[i].coursename, f1[i].priority);
				result.priority = max(f1[i].priority, f2[z].priority);
				ret.push(result);
				break;
			}
		}
	}
	return ret;
}

/**
 * Combines the various filters and displays the results in the search area.
 * @param includeActive Whether to also display the active filter's results.
 * @param scrollTo To prevent the search results from jumping around, 
 * the provided CSS selector `scrollTo` will be used to attempt to keep 
 * the results at roughly the 'same' location.
 */
function displaySearchResults(includeActive:boolean, scrollTo:string) {
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
			if (stillrequired.indexOf(comp.componentType) < 0) { // discard it if the component type has already been picked
				return false;
			}
			return true;
		});
		var filteredcourseids:number[];
		// If showconflicts is false, filter out those that conflict timewise
		if (!d3.select("#showconflicts").property("checked")) {
			sections = sections.filter(function(section){
				return !timeCollides(section, calendars[active].courses);
			});
			filteredcourseids = [];
		} else {
			let filteredcourses = sections.filter(function(section){
				return timeCollides(section, calendars[active].courses);
			});
			filteredcourseids = filteredcourses.map(function(d){
				return d.coursenumber;
			});
		}
		if (sections.length == 0) return null;
		let out:[string, CourseClasses.CourseComponent[], number[]] = [code, sections, filteredcourseids];
		return out;
	});

	// remove all null things.
	finalcoursecodes = finalcoursecodes.filter(utility.isNull);
	// each component needs its own entry.
	d3.select('#searchresults').html('').selectAll(".courseholder").data(finalcoursecodes).enter()
		.append("div").classed("courseholder",true).attr("id", function(d){
			return utility.sanitizeForSelector(d[0]);
		})
		.each(resultFormatter);

	// scroll to last selected course if possible
	if (scrollTo != undefined) {
		let el = document.getElementById(scrollTo);
		if (el != null) {
			let offsettop = el.offsetTop;
			console.log(offsettop, el.clientHeight, document.getElementById("searchresults").scrollTop)
			document.getElementById("searchresults").scrollTop = offsettop - el.clientHeight;
		}
	}

	// get number of child nodes. If zero, add a message.
	decideNothingMessage(d3.select("#searchresults"));
}

/**
 * Handles text expander toggles.
 * @param d d3's d
 * @param i d3's i
 */
function expandOrContractText(d:[string, CourseClasses.CourseComponent[]], i:number) {
	var me = d3.select(this);
	var text = d3.select(this.parentNode).select(".desctext");
	var fulldesc = coursecatalogue.table[me.datum()[0]].desc;
	if (me.text() == "▸") {
		me.text("▾");
		text.text(fulldesc);
	} else {
		me.text("▸");
		text.text(fulldesc.substring(0,100) + "...");
	}
}

/**
 * Draws courses and components in search results.
 * @param d 
 * @param i 
 */
function resultFormatter(d:[string, CourseClasses.CourseComponent[], number[]], i:number) {
	var classcode:string = d[0];
	var sectiondata:CourseClasses.CourseComponent[] = d[1];
	var filtered:number[] = d[2];
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
	sections.append("span").classed("units", true).text(function(d){
		var units = d.units;
		if (units === undefined) {
			return "";
		}
		return d.units + " units";
	});
	sections.append("div").classed("details", true).text(function(d) {
		if (d.topic) {
			return d.topic + "\n" + d.notes;
		}
		return d.notes;
	});

	sections.classed("conflicting", function(d:CourseClasses.CourseComponent){
		if (filtered.indexOf(d.coursenumber) >= 0) {
			return true;
		}
		return false;
	}).attr("title", function(d:CourseClasses.CourseComponent){
		if (filtered.indexOf(d.coursenumber) >= 0) {
			return "This class conflicts with an already selected course!";
		}
		return "";
	});
}

/**
 * The function used to sanitize all input.
 * @param s The string to sanitize
 */
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

/**
 * Decides when to show "Enter something to get started!"
 * @param selection The css selector for the search bar, probably.
 * @todo figure out what selection is
 */
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

/**
 * Holds search results for filtering, including priority info.
 * Priority is currently decided by how early the search term
 * shows up in the course's "search text".
 */
class SearchResult {
	/**The course name for this result. */
	coursename:string;
	/**The priority score for this result. */
	priority:number;
	constructor(coursename:string, priority:number) {
		this.coursename = coursename;
		this.priority = priority;
	}
}

/**
 * Gets all courses that satisfy the filter.
 * @param filter 
 * @returns List of courses that satisfy the filter.
 */
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

/**
 * Testing function to programmatically add an active filter.
 * @param filter The filter to add.
 */
function setFilterTo(filter) {
	var filterobj = new Filter();
	filterobj.raw = filter;
	filterobj.results = search(filterobj.raw);
	filters.push(filterobj);
	d3.select("#filters").append("span")
		.datum(filter)
		.classed("filter", true)
		.html("<span class=\"x\">&#10005;</span>" + filter).on("click", removefilter);
	displaySearchResults(false, undefined);
	decideNothingMessage(d3.select("#searchresults"));
}

/**
 * Renders a filter's "blue tag" under the search bar and
 * re-initializes activeFilter.
 */
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

/**
 * Automatically sets a new filter once the user types a space.
 */
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

/**
 * On-click function for deleting a filter.
 * @param d d3's d
 * @param i d3's i
 */
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
	displaySearchResults(true, undefined);
}

/**
 * Handles keydown events for the search bar,
 * as well as executing searches.
 */
function searchbox(){
	if(coursecatalogue) {
		activefilter.raw = this.value;
		clearTimeout(searchboxTimeout);
		this.event = event as KeyboardEvent;
		if (this.event.keyCode == 13) {// 'enter'
			setFilterIfSpaces(); // move from activefilter to filterlist
			activefilter.results = search(activefilter.raw);
			setFilter();
			displaySearchResults(false, undefined);
		} else {
			searchboxTimeout = window.setTimeout(function(){
				setFilterIfSpaces();
				activefilter.results = search(activefilter.raw);
				displaySearchResults(true, undefined);
			}, 100);
		}
	}
}

/**
 * Adds a course to the calendar.
 * Also redraws search results.
 * @param code The course name (eg, CSCI-SH 101)
 * @param sectionindex The section code, not necessarily a number.
 * @param sectiondata 
 * @todo figure out if sectiondata is still needed. seems no.
 */
function addToCourses(code:string, sectionindex:string, sectiondata) {
	var courseprofile = new CourseClasses.SelectedCourse(coursecatalogue.table[code], sectionindex);
	calendars[active].courses.push(courseprofile);
	displaySearchResults(true, utility.sanitizeForSelector(code)); // because need to update conflicting classes
	calendars[active].draw();

	updateURLExport();
}

/**
 * Updates the base 64 URL export.
 */
function updateURLExport() {
	var exportArray = [];
	for (var i = 0; i < calendars[active].courses.length; i++) {

		exportArray.push([
			calendars[active].courses[i].course.name,
			calendars[active].courses[i].sectionid
		]);
	}
	window.location.hash = btoa(JSON.stringify(exportArray));
}

//////////////////////////////

/**
 * Updates the modal table that displays all course selected.
 */
function exportCourseNumbers() {

	var out = calendars[active].courses.map(function(d){
		return [d.course.name + "-" + d.component.section,
		d.course.title,
		d.component.componentType,
		d.component.coursenumber]
	});

	let table = d3.select("#coursenums").html('');
	table.append("tr").selectAll("th").data(["Course code", "Course name", "Component type", "ID"]).enter()
		 .append("th").text(function(d){return d;});
	table.selectAll(".coursetr").data(out)
		.enter().append("tr").classed("coursetr", true).selectAll("td").data(function(d:(string|number)[]){return d;}) // intermediate data type specified
		.enter()
		.append("td").text(function(d) {return d;});

	d3.select("#courseexport").style("display", "");
	courseexportTether.position();
	d3.select("#menumodal").style("display", "none");
}

/**
 * Converts a byte string to base 64.
 * @see MDN https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/btoa
 * @param str 
 */
function utoa(str) {
    return window.btoa(encodeURIComponent(str));
}

/**
 * Renders a copy of the calendar and triggers a download.
 */
function exportImage() {
	d3.text("https://fonts.googleapis.com/css?family=Open+Sans", function(e, fontcss){
		d3.text("jeeves.css", function(e, jeevescss){
			// clone svg
			var svg2 = document.querySelector('#calendarsvg').cloneNode(true);
			let css = document.createElement("style");
			css.innerHTML = "/* <![CDATA[ */" + fontcss + jeevescss + "/* ]]> */";
			svg2.appendChild(css);
			// var svgString = new XMLSerializer().serializeToString(document.querySelector('#calendarsvg'));
			var svgString = new XMLSerializer().serializeToString(svg2);
			var canvas = document.createElement("canvas");
			canvas.width = 880; canvas.height = 880;
			var ctx = canvas.getContext("2d");
			var DOMURL = self.URL || (self as any).webkitURL || self;
			var svg = new Blob([svgString], {type: "image/svg+xml;charset=utf-8"});
			var url = DOMURL.createObjectURL(svg);
			let img = document.createElement("img");
			img.width = 820; img.height = 820;
			img.src = url;
			img.onload = function() {
				ctx.drawImage(img, 10, 100, 810, 810);
				let imgdata = canvas.toDataURL();
				let a = document.createElement("a");
				a.download = "schedule.png";
				a.href = imgdata;
				a.click();
			}
		})
	})
}

/**
 * Initializes a new calendar and pans camera to it.
 */
function newcalendar() {
	new Draw.Calendar(calendars);
	Draw.transitionViewTo(calendars.length-1, calendars);
	active = calendars.length - 1;
	displaySearchResults(true, undefined);
	updateURLExport();
}

/**
 * Makes a deep copy of an existing calendar and pans camera to it.
 */
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
	displaySearchResults(true, undefined);
	updateURLExport();
}

/**
 * Clicking Remove causes it to turn into a red button that says "Really delete?"
 * This function resets remove button to the original state.
 * @param target The button to affect.
 */
function resetremovebutton(target:d3.Selection<any>) {
	target.text("Delete")
	.on("click", function(){askremove(calendars[active]);})
	.classed("button-warning", false);
}

/**
 * Resets remove button after some time.
 * @param target The button.
 */
function wait(target) {
	window.setTimeout(function(){
	resetremovebutton(target);
	}, 500);
}

/**
 * See [[resetremovebutton]]().
 * @param d The calendar to remove.
 */
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

/**
 * Handles the logic of deleting a calendar.
 * @param d Calendar to delete
 * @param target
 * @todo figure out what target is. 
 */
function removecalendar(d:Draw.Calendar, target:d3.Selection<any>) {
	if (active >= calendars.length-1) active = calendars.length - 2;
	if (active < 0) active = 0;
	d.delete(calendars, active);
	displaySearchResults(true, undefined);
}

/**
 * Pans camera to the calendar to the left.
 */
function scrollleft() {
	active = active - 1;
	if (active < 0) active = 0;
	Draw.transitionViewTo(active, calendars);
	displaySearchResults(true, undefined);
	updateURLExport();
}

/**
 * Pans camera to the calendar to the right.
 */
function scrollright() {
	active = active + 1;
	if (active >= calendars.length) active = calendars.length - 1;
	Draw.transitionViewTo(active, calendars);
	displaySearchResults(true, undefined);
	updateURLExport();
}

/**
 * Displays the menu modal.
 */
function showMenu() {
	d3.select("#menumodal").style("display", "");
	d3.select("#modal_background").style("display", "");
	modalmenuTether.position();
}

/**
 * Hides the menu modal.
 */
function hideModals() {
	d3.select("#modal_background").style("display", "none");
	d3.select("#menumodal").style("display", "none");
	d3.select("#courseexport").style("display", "none");
}

/**
 * Tethers (from Tether.js) used in the modals.
 */
var modalmenuTether, courseexportTether;
/**
 * Initializes modals.
 */
function activateModals() {
	modalmenuTether = new Tether({
		element: "#menumodal",
		target: "#tools",
		attachment: "top center",
		targetAttachment: "bottom right",
		offset: "-10px 0"
	});
	courseexportTether = new Tether({
		element: "#courseexport",
		target: "#tools",
		attachment: "top right",
		targetAttachment: "bottom right",
		offset: "-25px -25px"
	});
}

/**
 * Returns a Promise for reading a file rom courses/
 * and importing into the course catalogue.
 * @param filename The file from courses/ to read.
 * @returns a Promise.
 */
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

/**
 * Reads all files in parallel.
 * @param filenames List of files to read.
 */
function promiseJson(filenames) {
	return Promise.all(filenames.map(readJson));
}

/**
 * Initializes the entire Jeeves app.
 * @param testing 
 */
export function init(testing:boolean) {
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
		d3.select("#showconflicts").on("click", function(){displaySearchResults(true, undefined);});
		d3.select("#exportbutton").on("click", function(){exportCourseNumbers();});
		d3.select("#clone").on("click", function(){clonecalendar();});
		d3.select("#delete").on("click", function(){askremove(calendars[active])});
		d3.select("#prev").on("click", function(){scrollleft();});
		d3.select("#next").on("click", function(){scrollright();});
		d3.select("#new").on("click", newcalendar);
		d3.select("#tools").on("click", showMenu);
		d3.select("#saveasimgbutton").on("click", exportImage);
		d3.select("#modal_background").on("click", hideModals);
		activateModals();
		if (window.location.hash.length !== 0) {
			// Load CourseClasses
			var json = JSON.parse(atob(window.location.hash.substr(1)));
			for (var key in json) {
				addToCourses(json[key][0], json[key][1], null);
			}
		}
	}).catch(function(error) {
		throw new Error(error);
	});
}
