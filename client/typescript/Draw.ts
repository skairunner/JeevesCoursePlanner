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
		allcourses.enter().append("g").classed("classblock", true);
		
		let self = this;
		allcourses.each(function(d,i){
			drawCourseBlock(d, this, i, self);
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

var TEXTTRUNLEN = 15;
function drawCourseBlock(cdata:CourseClasses.SelectedCourse, self, i:number, obj:Calendar) {
	function fontsizecallback(d) {
		return d[1] + "px";
	}

	var colors    = obj.colors;
	var timescale = obj.timescale;
	// var me        = d3.select(obj.selector);
	var me        = d3.select(self); // a classblock
	
	var days = cdata.component.classtimes.map(function(classtime){
		return classtime.getDayName();
	});
	// get times per day
	var starttimes = cdata.component.classtimes.map(function(classtime){
		return classtime.starttime.toDate();
	});
	var endtimes = cdata.component.classtimes.map(function(classtime){
		return classtime.endtime.toDate();
	});
	
	var color = obj.colors.pickColor(cdata.course.name, cdata.sectionid);
	// nifty scale usage
	var startYs = starttimes.map(function(time){return timescale(time);});
	var endYs   = endtimes.map(function(time){return timescale(time);});
	var dYs:number[]     = [];
	for (let i = 0; i < endYs.length; i++) {
		dYs.push(endYs[i] - startYs[i]);
	}
	var timestrings:string[] = [];
	for (let i = 0; i < cdata.component.classtimes.length; i++) {
		timestrings.push(cdata.component.classtimes[i].formattedString());
	}
	var data:{day:string, start:number, dY:number, timeStr:string, courseCode:string}[] = [];
	for (let i = 0; i < endYs.length; i++) {
		data.push({day:days[i],
			start:startYs[i],
			dY:dYs[i],
			timeStr:timestrings[i],
			courseCode: cdata.component.coursenumber.toString()
		});
	}
	// append a colored block for each class.
	//var update = me.select(".coursearea").selectAll(".classblock").data(data, function(d){ return d.courseCode + d.day; }); // needs key function to prevent jumping around

	//var enter  = update.enter();
	// me.attr("transform", function(d){
	// 		return "translate(" + dayscale(d.day) + "," + d.start + ")";
	// });

	// me.datum() is a SelectedCourse
	var rectupdate = me.append("g")
					   .classed("rectholder", true)
					   .selectAll("rect")
					   .data(data, function(d){ return  d.courseCode + d.day + "rect";});
	
	// zip up dY, time and cdata for textupdate.
	let textdata:[number, CourseClasses.CourseTime, CourseClasses.SelectedCourse, number][] = [];
	for (let i = 0; i < cdata.component.classtimes.length; i++) {
		textdata.push([dYs[i], cdata.component.classtimes[i], cdata, startYs[i]]);
	}

	let textdata2 = textdata.map(function(tdata){
				var texts = [cdata.course.name + "-" + cdata.sectionid,
							 cdata.course.title,
							 cdata.component.instructor,
							 tdata[1].formattedString(),
							 cdata.component.componentType];
				var sizes = texts.map(function(text) {
					return utility.findTextWidth(text, "Open Sans", dayscale.rangeBand())
				});
				// b.c. the 1th text is usually very long
				sizes[1] = utility.findTextWidth(texts[1].substr(0,TEXTTRUNLEN), "Open Sans", dayscale.rangeBand());
				let out:[string, number, number, CourseClasses.CourseTime, number][] = []
				for (let j = 0; j < texts.length; j++) {
					out.push([texts[j], sizes[j], tdata[0], tdata[1], tdata[3]]); // 2 used to be d.dY
				}
				return out;
			});


	var textholder = me.selectAll(".blocktextholder")
					   .data(textdata2, function(d){return cdata.component.coursenumber + d[0][3].getDayName();})
					   .enter()
					   .append("g")
					   .classed("blocktextholder", true)
					   .attr("transform", function(d){return "translate(" + dayscale(d[0][3].getDayName()) + "," + d[0][4] + ")";});

	// resize existing squares
	rectupdate.transition().ease(TTy()).duration(TT()).attr("height", function(d,i){ return d.dY;});
    me.selectAll(".blocktext").transition().ease(TTy()).duration(TT()).attr("y", function(d,i){return (i+1)*d[2]/6;});

	rectupdate.enter()
			.append("rect")
			.attr("height", function(d,i){return d.dY/2;})
			.on("click", function(d,i){removeCourseBlock(cdata, i, obj);})
			.attr("fill", color)
			.attr("width", dayscale.rangeBand())
			.attr("transform", function(d){ return "translate(" + dayscale(d.day) + "," + d.start + ")";})
			.transition().ease(TTy()).duration(TT())
			.attr("height", function(d,i){return d.dY;});

	let textupdate = textholder.selectAll(".blocktext")
						.data(function(datum:[string, number, number, CourseClasses.CourseTime, number][], i){ return datum;})
						.enter()
						.append("text")
						.classed("blocktext", true)
						.attr("y", function(d,i){console.log(d); return (i+1)*d[2]/6/2;})
						.on("mouseover", function(d,i){
							if (i == 1) {
								d3.select(this).text(d[0]);
							}
						})
						.on("mouseout", function(d,i){
							if (i == 1) {					
								d3.select(this).text(d[0].substr(0,TEXTTRUNLEN));
							}})
						.style("font-size", fontsizecallback)
						.text(function(d,i){
							if (i==1) {
								return d[0].substr(0,TEXTTRUNLEN);
							}
							return d[0];
						})
						.classed("mousepassthru", function(d,i){
							if (i != 1) { return true;}
							return false;
							})
						.transition().ease(TTy()).duration(TT())
						.attr("y", function(d,i){return (i+1)*d[2]/6;});;
	
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