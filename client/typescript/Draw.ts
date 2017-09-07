import d3 = require("d3");
import * as utility from "./utility";
import * as CourseClasses from "./CourseClasses";

/**A standard scale to use for the calendar's Days.*/ 
var dayscale = d3.scale.ordinal();
dayscale.domain(utility.DayFromInt);
dayscale.rangeBands([0, 700], 0, 0.01);
/**Formatter for the time labels.*/
var tickformat = d3.time.format("%H:%M");

/**Ugly hack to allow Draw-related functions to call the update display function.
 * At startup, `outsidefuncs` is assigned a reference to the update display function.
 */
export var outsidefuncs = [];

/**Hardcoded SVG-space calendar width. */
var calendarwidth = 800;
/**Hardcoded transition time. */
var transitiontime = 1000;
/**Hardcoded transition easing function. */
var transitiontype = "cubic-out";

/**Shorthand for returning `transitiontime`. */
function TT(){return transitiontime;}
/**Shorthand for returning `transitiontype`.*/
function TTy(){return transitiontype;}

/**"Moves up" rendered calendars so that there are no gaps.
 * Usually called after removing a calendar.
 */
function reassignIndexes(calendars: Calendar[]) {
		calendars.forEach(function(d, i){
		var oldsel = d.selector;
		d.selector = "#cal" + i;
		d.axisorigin = "translate(" + (50+i*calendarwidth) + ",-70)";
		d.moveToNewSelector(d, oldsel);
		return d;
	});
}

/**Hardcoded text truncation threshold for course blocks. */
var TEXTTRUNLEN = 15;

/**
 * Each [[Calendar]] object represents the information displayed on one calendar,
 * including the courses selected and colors used to render. It also includes various d3
 * object instances, such as axes, required for rendering.
 */
export class Calendar {
	/**The selector for the [[Calendar]] on the SVG. */
	selector:string;
	/**The origin of the axes, represented in CSS `translate()` format. */
	axisorigin:string;
	/**An array of the selected courses for this calendar. */
	courses:Array<CourseClasses.SelectedCourse>;
	/**The [[ColorPicker]] used to select colors. */
	colors:utility.ColorPicker;
	/**A reference to the global list of [[Calendar]]. */
	master:Calendar[];
	/**The current time-to-coordinates [Scale](https://github.com/d3/d3-scale/blob/master/README.md#scaleLinear). */
	timescale: d3.time.Scale<number, number>;
	/**d3 Axis object for rendering the time axis.*/
	timeaxis: d3.svg.Axis;
	/**d3 Axis object for rendering the day axis.*/
	dayaxis: d3.svg.Axis;

	/**
	 * @param calendars The master list of [[Calendar]]s, to be passed in by reference.
	 * Is mostly used to facilitate deletion of Calendars.
	 */
	constructor(calendars: Calendar[]){
		this.selector   = "#cal" + calendars.length;
		this.axisorigin = "translate(" + (50+calendars.length*calendarwidth) + ",-70)";
		this.courses    = [];
		this.colors     = new utility.LimitedColorPicker();
		this.master     = calendars;
		this.timescale  = d3.time.scale().domain([new Date(2015, 10, 14, 8, 0), new Date(2015, 10, 14, 18, 0)]);
		this.timescale.range([0, 650]);
		this.timeaxis = d3.svg.axis().scale(this.timescale).tickFormat(tickformat).orient("left");
		this.dayaxis = d3.svg.axis().scale(dayscale).orient("top");
		var svg = d3.select("#calendarsvg").append("g")
					.attr("id", this.selector.slice(1, this.selector.length)).attr("class", "calendar")
					.attr("transform", this.axisorigin + " scale(0, 0)");
		svg.append("g").attr("class", "removed");
		svg.transition()
			.duration(TT())
			.ease(TTy())
			.attr("transform", this.axisorigin + " scale(1, 1)");
		svg.append("g").attr("class", "verticallines");
		svg.append("g").attr("class", "coursearea");
		svg.append("g").attr("class", "timeaxis axis").call(this.timeaxis);
		svg.append("g").attr("class", "dayaxis axis").call(this.dayaxis);

		calendars.push(this);
	}

	/**
	 * Changes a calendar's old selector to a new one, and "slide"
	 * the SVG representation to the new position.
	 * @todo Figure out why this function doesn't operate on "this" calendar object, 
	 * instead operating on a param-provided one.
	 * @param calendar The calendar to move
	 * @param oldsel The previous selector.
	 */
	moveToNewSelector(calendar:Calendar, oldsel: string) {
		d3.select(oldsel) // selects the old element
			.attr("id", calendar.selector.slice(1, calendar.selector.length)) // then replace with new one.
			.transition().duration(TT()).ease(TTy())
			.attr("transform", calendar.axisorigin);
	}

	/**
	 * Remove this calendar from the list.
	 * @todo Figure out why function accepts `calendars` instead of using `master`.
	 * @param calendars Master list of calendars.
	 * @param active The calendar to focus the camera on after deletion.
	 */
	delete(calendars: Calendar[], active: number) {
		var i = calendars.indexOf(this);
		calendars.splice(i, 1);
		this.erase();
		if (calendars.length != 0) transitionViewTo(active, calendars);
		window.setTimeout(function(){
			reassignIndexes(calendars);
			if (calendars.length == 0){
				var newcalendar = new Calendar(calendars);
				updateCreditsTotal(calendars[0]);
			}
		}, TT());
	}

	/**
	 * Make a calendar "shrink" via transformations, then remove it
	 */
	erase() {
		var svg = d3.select(this.selector);
		svg.selectAll("*").transition()
		.duration(TT())
		.ease('linear')
		.attr("transform", "scale(0, 0)");
		window.setTimeout(function(){svg.remove();}, TT());
	}

	/**
	 * Rescale the time axis.
	 * @param timestart The start time of the axis.
	 * @param timeend The end time of the axis.
	 */
	changeTimeAxis(timestart: Date, timeend: Date) {
		this.timescale.domain([timestart, timeend]);
		var sel = d3.select(this.selector).select(".timeaxis");
		sel.transition().ease(TTy())
			.duration(TT()).delay(0).call(this.timeaxis);
	}

	/**
	 * Redraw the calendar in the SVG.
	 */
	draw() {
		var svg        = d3.select(this.selector);
		var axisorigin = this.axisorigin;
		var courses    = this.courses;
		var colors     = this.colors;
		var dayaxis    = this.dayaxis;
		var timeaxis   = this.timeaxis;
		var timescale  = this.timescale;
		updateCreditsTotal(this);

		if (courses.length == 0){
			// reset axis to original 8 to 6
			this.changeTimeAxis(new Date(2015, 10, 14, 8, 0)
				, new Date(2015, 10, 14, 18, 0));

		} else {
			// else, need to find new min and max times.
			let mintimes = courses.map(function(d:CourseClasses.SelectedCourse){
				return d.component.getMinStartTime().toMinutes();
			});
			let maxtimes = courses.map(function(d:CourseClasses.SelectedCourse){
				return d.component.getMaxEndTime().toMinutes();
			});

			var mintime = utility.arrmin(mintimes, utility.identity);
			var maxtime = utility.arrmax(maxtimes, utility.identity);
			// If doing mintime, round down. If doing maxtime, round up.
			mintime = Math.floor(mintime/60);
			maxtime = Math.ceil(maxtime/60);
			if (mintime > 8) mintime = 9;
			if (maxtime < 17) maxtime = 17;
			this.changeTimeAxis(new Date(2015, 10, 14, mintime, 0)
				, new Date(2015, 10, 14, maxtime, 0));
		}

		// Next, draw the courses.
		var allcourses = svg.select(".coursearea")
			.selectAll(".classblock")
			.data(courses, function(k){
				if (courses.length == 0) return "";
				return k.course.name + " " + k.sectionid;
			});
		let allcourses_enter = allcourses.enter().append("g").classed("classblock", true);
		let calendar = this;

		// rectangle drawing
		let allrects = allcourses_enter.append("g").classed("rectholder", true)
						.selectAll("rect").data(function(d:CourseClasses.SelectedCourse, i){
							let out:{day:string,time:CourseClasses.CourseTime, coursedata:CourseClasses.SelectedCourse, color:string}[] = [];
							let rectcolor = colors.pickColor(d.course.name, d.component.section);
							for (let j = 0; j < d.component.classtimes.length; j++) {
								let time = d.component.classtimes[j];
								let rect = {
									time:time,
									day:time.getDayName(),
									coursedata: d,
									color:rectcolor
								};
								out.push(rect);
							}
							console.log(out)
							return out;
						})
					.enter()
						.append("rect")
							.attr("height", function(d){return (timescale(d.time.endtime.toDate()) - timescale(d.time.starttime.toDate()))/2; }) // half, & transition to full size
							.attr("fill", function(d){return d.color;})
							.attr("width", function(d){return dayscale.rangeBand();})
							.on("click", function(d,i){removeCourseBlock(d.coursedata, i, calendar);});

		allcourses_enter.selectAll("rect").attr("transform", function(d){return "translate(" + dayscale(d.day) + "," + timescale(d.time.starttime.toDate()) + ")";})
				.transition()
					.ease(TTy())
					.duration(TT())
					.attr("height", function(d){return timescale(d.time.endtime.toDate()) - timescale(d.time.starttime.toDate());}); // must recalculate height

		// Text
		// first the things that only need to be added once.


		allcourses_enter.append("g").classed("textholder", true)
						.selectAll(".blocktext").data(function(d:CourseClasses.SelectedCourse){ // one for each classtime
							let out:{selected:CourseClasses.SelectedCourse, time:CourseClasses.CourseTime}[] = [];
							for (let j = 0; j < d.component.classtimes.length; j++) {
								let time = d.component.classtimes[j];
								out.push({
									selected:d,
									time:time
								});
							}
							return out;
						})
						.enter()
						.append("g")
						.classed("blocktext", true)
						// common translation amount for all lines of text in one box
						.selectAll("text")
						.data(function(d:{selected:CourseClasses.SelectedCourse, time:CourseClasses.CourseTime}){ // the output is array of four or five lines of text
							let out:{text:string, fontsize:number, time:CourseClasses.CourseTime}[] = [];
							let lines = [
								d.selected.course.name + "-" + d.selected.sectionid,
								d.selected.course.title,
								d.selected.component.instructor,
								d.time.formattedString(),
								d.selected.component.componentType
							];
							if (d.selected.component.topic) {
								lines[1] = d.selected.component.topic;
							}

							for (let j = 0; j < lines.length; j++) {
								let topY = timescale(d.time.starttime.toDate());
								let botY = timescale(d.time.endtime.toDate());
								let dY = botY - topY;
								let text = lines[j]
								if (j == 1) {
									text = lines[j].substr(0, TEXTTRUNLEN);
								}
								out.push({
									text:text,
									fontsize:utility.findTextWidth(text, "Open Sans", dayscale.rangeBand()),
									time:d.time
								});
							}

							return out;
						})
						.enter()
						.append("text")
							.style("font-size", function(d){return d.fontsize + "px";})
							.classed("mousepassthru", function(d,i){
								return i != 1;
							})
							.text(function(d, i){
								if (i==1) return d.text.substr(0, TEXTTRUNLEN);
								return d.text;
							})
				  			.attr("y", function(d, i){return (i+1) * (timescale(d.time.endtime.toDate()) - timescale(d.time.starttime.toDate()))/5.2/2;})
						.on("mouseover", function(d, i:number){
							if (i == 1) d3.select(this).text(d.text);
						})
						.on("mouseout", function(d, i){
							if (i == 1) d3.select(this).text(d.text.substr(0, TEXTTRUNLEN));
						});

		allcourses_enter.selectAll(".blocktext")
				  .attr("transform", function(d){return "translate(" + dayscale(d.time.getDayName()) + "," + timescale(d.time.starttime.toDate()) + ")"; });
		allcourses_enter.selectAll(".blocktext")
				  .selectAll("text")
				  .transition()
					.ease(TTy())
					.duration(TT())
					.attr("y", function(d, i){
						console.log()
						return (i+1) * ((timescale(d.time.endtime.toDate()) - timescale(d.time.starttime.toDate()))/5.2);
					});

		var exit = allcourses.exit();
		// there are nodes to remove
		if (exit[0].length != 0) {
			var removed = exit.remove();
			if (removed.node() != null) {
				svg.select(".removed").append(function(){
					return removed.node();
				});
				exit.selectAll("*")
				.transition().duration(TT()).ease(TTy())
				.style("opacity", "0")
				.remove();
				exit.transition().duration(TT()).ease(TTy()).remove();
			}
		}
	}
}

/**
 * Smoothly change the "camera" to focus on the given calendar.
 * @param index The index of the calendar to focus on.
 * @param calendars The master list of calendars.
 */
export function transitionViewTo(index: number, calendars: Calendar[]) {
	d3.select("#calendarsvg").transition().duration(1000)
		.attr("viewBox", (index * calendarwidth) + " 0 800 600");
	d3.select("#calendarname").text(index);
	updateCreditsTotal(calendars[index]);
}

/**
 * Sums up the selected credits and transitions the counter's number.
 * @param obj The calendar whose credits are to be summed.
 */
function updateCreditsTotal(obj:Calendar) {
	var credits = 0;
	for (let i = 0; i < obj.courses.length; i++) {
		let course = obj.courses[i];
		if (course.component.units != undefined) {
			credits += course.component.units;
		}
	}

	d3.select("#credits").datum(credits).transition().duration(TT())
		.ease(TTy()).tween('text', utility.tweenText);
}

/**
 * A d3 callback function to handle removal of a course on click.
 * @param d d3 data parameter
 * @param i d3 index parameter
 * @param obj The calendar the course block resides in.
 */
function removeCourseBlock(d:CourseClasses.SelectedCourse, i:number, obj: Calendar) {
	let newcourses:CourseClasses.SelectedCourse[] = [];
	for (let j = 0; j < obj.courses.length; j++) {
		if (!obj.courses[j].isEquivalent(d)) {
			newcourses.push(obj.courses[j]);
		}
	}
	obj.courses = newcourses;
	obj.draw();
	outsidefuncs[0](true); // update search results
}

/**
 * @deprecated #verticallines seems to be null on runtime.
 * @param axisorigin CSS transform-formatted string
 */
function redrawLines(axisorigin: string) {
	var verticalpositions = [];
	verticalpositions = utility.DayFromInt.map(function(day){
		return dayscale(day) as number + dayscale.rangeBand();
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
