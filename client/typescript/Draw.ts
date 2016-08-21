import d3 = require("d3");
import * as utility from "./utility";
import * as CourseClasses from "./CourseClasses";

var dayscale = d3.scale.ordinal();
dayscale.domain(utility.DayFromInt);
dayscale.rangeBands([0, 700], 0, 0.01);
var tickformat = d3.time.format("%H:%M");

// ugly hack to be able to call the update display function
export var outsidefuncs = [];

var calendarwidth = 800;
var transitiontime = 1000;
var transitiontype = "cubic-out";

function TT(){return transitiontime;}
function TTy(){return transitiontype;}

function reassignIndexes(calendars: Calendar[]) {
		calendars.forEach(function(d, i){
		var oldsel = d.selector;
		d.selector = "#cal" + i;
		d.axisorigin = "translate(" + (50+i*calendarwidth) + ",40)";
		d.moveToNewSelector(d, oldsel);
		return d;
	});
}


var TEXTTRUNLEN = 15;
export class Calendar {
	selector:string;
	axisorigin:string;
	courses:Array<CourseClasses.SelectedCourse>;
	colors:utility.ColorPicker;
	master:Calendar[];
	timescale: d3.time.Scale<number, number>;
	timeaxis: d3.svg.Axis;
	dayaxis: d3.svg.Axis;

	constructor(calendars: Calendar[]){
		this.selector   = "#cal" + calendars.length;
		this.axisorigin = "translate(" + (50+calendars.length*calendarwidth) + ",40)";
		this.courses    = [];
		this.colors     = new utility.ColorPicker();
		this.master     = calendars;
		this.timescale  = d3.time.scale().domain([new Date(2015, 10, 14, 8, 0), new Date(2015, 10, 14, 18, 0)]);
		this.timescale.range([0, 500]);
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

	moveToNewSelector(calendar:Calendar, oldsel: string) {
		d3.select(oldsel)
			.attr("id", calendar.selector.slice(1, calendar.selector.length))
			.transition().duration(TT()).ease(TTy())
			.attr("transform", calendar.axisorigin);
	}

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

	// smoothly erase calendar from svg
	erase() {
		var svg = d3.select(this.selector);
		svg.selectAll("*").transition()
		.duration(TT())
		.ease('linear')
		.attr("transform", "scale(0, 0)");
		window.setTimeout(function(){svg.remove();}, TT());
	}

	changeTimeAxis(timestart: Date, timeend: Date) {
		this.timescale.domain([timestart, timeend]);
		var sel = d3.select(this.selector).select(".timeaxis");
		sel.transition().ease(TTy())
			.duration(TT()).delay(0).call(this.timeaxis);
	}

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
		// rectangle drawing
		allcourses_enter.append("g").classed("rectholder", true)
						.selectAll(".rect").data(function(d:CourseClasses.SelectedCourse){
							let out:{topY:number, botY:number, height:number, day:string, coursedata:CourseClasses.SelectedCourse, color:string}[] = [];
							for (let j = 0; j < d.component.classtimes.length; j++) {
								let time = d.component.classtimes[j];
								let topY = timescale(time.starttime.toDate());
								let botY = timescale(time.endtime.toDate());
								let rect = {
									topY: topY,
									botY: botY,
									height: botY - topY,
									day:time.getDayName(),
									coursedata: d,
									color:colors.pickColor(d.course.name, d.component.section)
								};
								out.push(rect);
							}
							return out;
						})
						.enter()
						.append("rect")
							.attr("height", function(d){return d.height/2;}) // half, & transition to full size
							.attr("fill", function(d){return d.color;})
							.attr("width", function(d){return dayscale.rangeBand();})
							.attr("transform", function(d){return "translate(" + dayscale(d.day) + "," + d.topY + ")";})
						.transition()
							.ease(TTy())
							.duration(TT())
							.attr("height", function(d){return d.height;});

		// Text
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
						.attr("transform", function(d){return "translate(" + dayscale(d.time.getDayName()) + "," + timescale(d.time.starttime.toDate()) + ")"; })
						.selectAll("text")
						.data(function(d:{selected:CourseClasses.SelectedCourse, time:CourseClasses.CourseTime}){ // the output is array of four or five lines of text
							let out:{text:string, fontsize:number, boxheight:number}[] = [];
							let lines = [
								d.selected.course.name + "-" + d.selected.sectionid,
								d.selected.course.title,
								d.selected.component.instructor,
								d.time.formattedString(),
								d.selected.component.componentType
							];

							for (let j = 0; j < lines.length; j++) {
								let topY = timescale(d.time.starttime.toDate());
								let botY = timescale(d.time.endtime.toDate());
								let dY = botY - topY;
								out.push({
									text:lines[j],
									fontsize:utility.findTextWidth(lines[j], "Open Sans", dayscale.rangeBand()),
									boxheight:dY
								});
							}

							return out;
						})
						.enter()
						.append("text")
							.attr("y", function(d, i){return i*d.boxheight/5.2;})
							.style("font-size", function(d){return d.fontsize + "px";})
							.classed("mousepassthru", function(d,i){
								return i != 1;
							})
							.text(function(d){return d.text;})
						.transition()
							.ease(TTy())
							.duration(TT())
							.attr("y", function(d, i){return i * d.boxheight / 5.2});
		
		/*.each(function(d,i){
			drawCourseBlock(d, this, i, self);
		});*/
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

export function transitionViewTo(index: number, calendars: Calendar[]) {
	d3.select("#calendarsvg").transition().duration(1000)
		.attr("viewBox", (index * calendarwidth) + " 0 800 600");
	d3.select("#calendarname").text(index);
	updateCreditsTotal(calendars[index]);
}

function updateCreditsTotal(obj:Calendar) {
	var credits = 0;
	for (let i = 0; i < obj.courses.length; i++) {
		let course = obj.courses[i];
		if (course.component.units != undefined) {
			credits += course.component.units;
		}
	}

	d3.select("#credits").datum(credits).transition().duration(TT())
		.ease(TTy()).tween('text', function(){return utility.tweenText;});
}

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

function redrawLines(axisorigin) {
	var verticalpositions = [];
	verticalpositions = utility.DayFromInt.map(function(day){
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