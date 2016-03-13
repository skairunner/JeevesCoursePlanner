define(['d3', 'utility'], function(d3, util){

	var dayscale = d3.scale.ordinal();
	dayscale.domain(util.DayFromInt);
	dayscale.rangeBands([0, 700], 0, 0.01);
	var tickformat = d3.time.format("%H:%M");

	// ugly hack to be able to call the update display function
	var outsidefuncs = [];

	var calendarwidth = 800;
	var transitiontime = 1000;
	var transitiontype = "cubic-out";
	function TT(){return transitiontime;}
	function TTy(){return transitiontype;}

	function reassignIndexes(calendars) {
		 _.each(calendars, function(d, i){
			oldsel = d.selector;
			d.selector = "#cal" + i;
			d.axisorigin = "translate(" + (50+i*calendarwidth) + ",40)";
			movecalendar(d, oldsel);
			return d;
		});
	}

	function initcalendar(calendars) {
		var obj = {};
		obj.selector = "#cal" + calendars.length;
		obj.axisorigin = "translate(" + (50+calendars.length*calendarwidth) + ",40)";
		obj.courses = [];
		obj.colors = [];
		obj.master = calendars;
		obj.timescale = d3.time.scale().domain([new Date(2015, 10, 14, 8, 0)
			, new Date(2015, 10, 14, 18, 0)]);
		obj.timescale.range([0, 500]);
		obj.timeaxis = d3.svg.axis()
		.scale(obj.timescale)
		.tickFormat(tickformat)
		.orient("left");
		obj.dayaxis = d3.svg.axis().scale(dayscale).orient("top");
		var svg = d3.select("#calendarsvg").append("g")
					.attr("id", obj.selector.slice(1,obj.selector.length)).attr("class", "calendar")
					.attr("transform", obj.axisorigin + " scale(0, 0)");
		svg.append("g").attr("class", "removed");
		svg.transition().duration(TT()).ease(TTy())
			.attr("transform", obj.axisorigin + " scale(1, 1)");
		svg.append("g").attr("class", "verticallines");
	    svg.append("g").attr("class", "coursearea");
	    svg.append("g").attr("class", "timeaxis axis")
		   .call(obj.timeaxis);
	    svg.append("g").attr("class", "dayaxis axis")
		   .call(obj.dayaxis);
	   calendars.push(obj);
	}

	function movecalendar(calendar, oldsel) {
		d3.select(oldsel)
			.attr("id", calendar.selector.slice(1,calendar.selector.length))
			.transition().duration(TT()).ease(TTy())
			.attr("transform", calendar.axisorigin);
	}

	function deletecalendar(calendar, calendars, active) {
		var i =calendars.indexOf(calendar);
		calendars.splice(i, 1);
		drawerase(calendar);
		if (calendars.length != 0) transitionViewTo(active, calendars);
		window.setTimeout(function(){
			reassignIndexes(calendars);
			if (calendars.length == 0){
				initcalendar(calendars);
				updateCreditsTotal(calendars[0]);
			}
		}, TT());
	}

	// smoothly delete a calendar
	function drawerase(calendar) {
		var svg = d3.select(calendar.selector);
		svg.selectAll("*").transition()
		   .duration(TT())
		   .ease('linear')
		   .attr("transform", "scale(0, 0)");
	    window.setTimeout(function(){svg.remove();}, TT());
	}

	function drawcalendar(calendar) {
		var svg        = d3.select(calendar.selector);
		var axisorigin = calendar.axisorigin;
		var courses    = calendar.courses;
		var colors     = calendar.colors;
		var dayaxis    = calendar.dayaxis;
		var timeaxis   = calendar.timeaxis;
		updateCreditsTotal(calendar);

		if (courses.length == 0){ 
			// reset axis to original 8 to 6
			changeTimeAxis(calendar, new Date(2015, 10, 14, 8, 0)
				, new Date(2015, 10, 14, 18, 0));

		} else {
			// else, need to find new min and max times.
			var min = _.min(courses, function(d){
				return util.toMinutes(d.sectiondata.starttime);
			});
			var max = _.max(courses, function(d){
				return util.toMinutes(d.sectiondata.endtime);
			});
			min = util.toMinutes(min.sectiondata.starttime);
			max = util.toMinutes(max.sectiondata.endtime);
			// If doing mintime, round down. If doing maxtime, round up.
			var mintime = Math.floor(min/60);
			var maxtime = Math.ceil(max/60);
			if (mintime > 8) mintime = 9;
			if (maxtime < 17) maxtime = 17;
			changeTimeAxis(calendar, new Date(2015, 10, 14, mintime, 0)
				, new Date(2015, 10, 14, maxtime, 0));
		}	

		// Next, draw the courses.
		var allcourses = svg.select(".coursearea")
			.selectAll(".classblocks")
			.data(courses, function(k){
				return k.coursedata.name + " " + k.sectionindex;
			});
		allcourses.enter().append("g")
	      .classed("classblocks", true);
  		allcourses.each(function(d,i){
	  		drawCourseBlock(d, i, this, calendar);
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

	function transitionViewTo(index, calendars) {
		d3.select("#calendarsvg").transition().duration(1000)
		  .attr("viewBox", (index * calendarwidth) + " 0 800 600");
	    d3.select("#calendarname").text(index);
	    updateCreditsTotal(calendars[index]);
	}

	function changeTimeAxis(calendar, timestart, timeend) {
		calendar.timescale.domain([timestart, timeend]);
		var sel = d3.select(calendar.selector).select(".timeaxis");
		sel.transition().ease(TTy())
		  .duration(TT()).delay(0).call(calendar.timeaxis);
	}

	function updateCreditsTotal(obj) {
		var credits = _.reduce(obj.courses, function(memo, course){
			if (course.sectiondata.units == undefined) {
				return memo;
			}
			return memo + course.sectiondata.units
		}, 0);
		d3.select("#credits").datum(credits).transition().duration(TT())
		  .ease(TTy()).tween('text', util.tweenText);
	}

	function removeCourseBlock(d, i, me, obj) {
		obj.courses = _.without(obj.courses, d);
		drawcalendar(obj);
		outsidefuncs[0](true);
	}

	function DateFromTimeArr(t, d) {
		if (t == undefined) {
			console.warn("The course " + d.coursedata.name + " does not have time info.");
			return undefined;
		}
		return new Date(2015, 10, 14, t[0], t[1]);
	}

	var TEXTTRUNLEN = 15;
	function drawCourseBlock(cdata, i, me, obj) {
		function fontsizecallback(d, i) {
			return d[1] + "px";
		}

		var courses   = obj.courses;
		var colors    = obj.colors;
		var timescale = obj.timescale;
		me = d3.select(me);
		
		var days = _.map(cdata.sectiondata.days, function(x){
			return util.DayFromInt[x];});
		// get times for scale stuff
		var starttime = DateFromTimeArr(cdata.sectiondata.starttime, cdata);
		var endtime = DateFromTimeArr(cdata.sectiondata.endtime, cdata);
		if (starttime==undefined || endtime==undefined) {
			return;
		}

		var color = util.smartPickColor(cdata.coursedata.name, 
										cdata.sectionindex+1,
										colors);
		// nifty scale usage
		var startY = timescale(starttime);
		var endY   = timescale(endtime);
		var dY     = endY - startY;
		// append a colored block for each class.
		var update = me.selectAll(".classblock").data(days);
		var enter  = update.enter();
		enter.append("g").classed("classblock", true)
		     .attr("transform", function(d){
		     	return "translate(" + dayscale(d) + "," + startY + ")";
		     });
		// update selection
		update.transition().ease(TTy()).duration(TT())
		                .attr("transform", function(d){
					return "translate(" + dayscale(d) + "," + startY + ")";});


        var rectupdate = update.selectAll('rect')
				 .data(['.']);

	    var textupdate = update.selectAll(".blocktext").data(function(d){
					var texts = [cdata.coursedata.name + "-" + cdata.sectiondata.section,
							 cdata.coursedata.title,
							 cdata.sectiondata.name,
							 util.strFromSectionTime(cdata.sectiondata),
							 cdata.sectiondata.componentType];
					var sizes = _.map(texts, function(text) {
						return util.findTextWidth(text, "Open Sans", dayscale.rangeBand())
					});
					// b.c. the 1th text is usually very long
					sizes[1] = util.findTextWidth(texts[1].substr(0,TEXTTRUNLEN), "Open Sans", dayscale.rangeBand());
					return _.zip(texts, sizes);
				});

	    rectupdate.transition().ease(TTy()).duration(TT()).attr("height", dY);
		textupdate.transition().ease(TTy()).duration(TT()).attr("y", function(d,i){return (i+1)*dY/6;});
		

		rectupdate.enter()
		     .append("rect")
		     .attr("height", dY/2)
		     .on("click", function(d,i){removeCourseBlock(cdata, i, this, obj);})
		     .attr("fill", color)
		     .attr("width", dayscale.rangeBand())
		     .transition().ease(TTy()).duration(TT())
		     .attr("height", dY);

		textupdate.enter()
		 	 .append("text").classed("blocktext", true)
		     .attr("y", function(d,i){return (i+1)*dY/6/2;})
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
			 .attr("y", function(d,i){return (i+1)*dY/6;});
	}

	function redrawLines(axisorigin) {
		var verticalpositions = [];
		verticalpositions = _.map(util.DayFromInt, function(day){
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

	return {
		drawcalendar: drawcalendar,
		deletecalendar: deletecalendar,
		initcalendar: initcalendar,
		outsidefuncs: outsidefuncs,
		transitionViewTo: transitionViewTo,
		updateCreditsTotal: updateCreditsTotal
	}
});