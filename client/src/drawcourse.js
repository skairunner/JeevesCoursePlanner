define(['d3', 'utility'], function(d3, util){

	var dayscale = d3.scale.ordinal();
	dayscale.domain(util.DayFromInt);
	dayscale.rangeBands([0, 500], 0, 0.01);
	var tickformat = d3.time.format("%H:%M");


	var calendarwidth = 600;


	function initcalendar(index, calendars) {
		var obj = {};
		obj.index = index;
		obj.selector = "#cal" + index;
		obj.axisorigin = "translate(" + (50+index*calendarwidth) + ",40)";
		obj.courses = [];
		obj.colors = [];
		obj.timescale = d3.time.scale().domain([new Date(2015, 10, 14, 8, 0)
			, new Date(2015, 10, 14, 18, 0)]);
		obj.timescale.range([0, 500]);
		obj.timeaxis = d3.svg.axis()
		.scale(obj.timescale)
		.tickFormat(tickformat)
		.orient("left");
		obj.dayaxis = d3.svg.axis().scale(dayscale).orient("top");
		var svg = d3.select("#calendarsvg").append("g")
		.attr("id", "cal" + index).attr("class", "calendar");
		svg.append("g").attr("class", "verticallines");
	    svg.append("g").attr("class", "coursearea");
	    svg.append("g").attr("class", "timeaxis axis")
		   .attr("transform", obj.axisorigin)
		   .call(obj.timeaxis);
	    svg.append("g").attr("class", "dayaxis axis")
		   .attr("transform", obj.axisorigin)
		   .call(obj.dayaxis);

	   calendars.push(obj);
	}

	function drawcalendar(calendar) {
		var index      = calendar.index;
		var svg        = d3.select(calendar.selector);
		var axisorigin = calendar.axisorigin;
		var courses    = calendar.courses;
		var colors     = calendar.colors;
		var dayaxis    = calendar.dayaxis;
		var timeaxis   = calendar.timeaxis;

		if (courses.length == 0){ 
			svg.select('.coursearea').html('');
			// reset axis to original 8 to 6
			changeTimeAxis(calendar, new Date(2015, 10, 14, 8, 0)
				, new Date(2015, 10, 14, 18, 0));
			console.log(".");
			return;
		}

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
		changeTimeAxis(calendar, new Date(2015, 10, 14, mintime, 0)
			, new Date(2015, 10, 14, maxtime, 0));

		// Next, draw the courses.
		var allcourses = svg.select(".coursearea")
			.selectAll(".classblocks")
			.data(courses, function(k){
				return k.coursedata.name + " " + k.sectionindex;
			});
		allcourses.enter().append("g")
	      .classed("classblocks", true)
	      .attr("transform", axisorigin)
	  	allcourses.each(function(d,i){
	  		drawCourseBlock(d, i, this, calendar);
	  	});		
	  	allcourses.exit().remove();
	}

	function changeTimeAxis(calendar, timestart, timeend) {
		calendar.timescale.domain([timestart, timeend]);
		var sel = d3.select(calendar.selector).select(".timeaxis");
		sel.transition().ease("cubic-out")
		  .duration(1000).delay(0).call(calendar.timeaxis);
	}

	function updateCreditsTotal(obj) {
		var credits = _.reduce(obj.courses, function(memo, course){
			if (course.sectiondata.units == undefined) {
				return memo;
			}
			return memo + course.sectiondata.units
		}, 0);
		d3.select("#credits").text(credits);
	}

	function removeCourseBlock(d, i, me, obj) {
		// As the context is an individual block, not all the blocks for
		// this class, we need to get the parent node.
		var me = d3.select(this.parentNode);
		obj.courses = _.without(obj.courses, d);
		updateCreditsTotal(obj);
		drawcalendar(obj);
		//displayCourses(); // to update collision and stuff
	}

	var TEXTTRUNLEN = 15;
	function drawCourseBlock(d, i, me, obj) {
		var courses   = obj.courses;
		var colors    = obj.colors;
		var timescale = obj.timescale;
		me = d3.select(me).html('');
		
		var days = _.map(d.sectiondata.days, function(x){
			return util.DayFromInt[x];});
		// get times for scale stuff
		var t = d.sectiondata.starttime;
		if (t == undefined) {
			console.warn("The course " + d.coursedata.name + " does not have time info.");
			return;
		}
		var starttime = new Date(2015, 10, 14, t[0], t[1]);
		t = d.sectiondata.endtime;
		var endtime = new Date(2015, 10, 14, t[0], t[1]);
		var color = util.smartPickColor(d.coursedata.name, 
			d.sectionindex+1,
			colors);
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
			   .on("click", function(d,i){removeCourseBlock(d, i, this, obj)});
			rect.attr("fill", color);
			// Finds text size by trial & error.
			var texts = [d.coursedata.name + "-" + d.sectiondata.section,
						 d.coursedata.title,
						 d.sectiondata.name,
						 util.strFromSectionTime(d.sectiondata),
						 d.sectiondata.componentType];
			var sizes = [];
			_.each(texts, function(text) {
				sizes.push(util.findTextWidth(text, "Times New Roman"
									, dayscale.rangeBand()))
			})
			sizes[1] = util.findTextWidth(texts[1].substr(0,TEXTTRUNLEN)
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
		initcalendar: initcalendar,
		updateCreditsTotal: updateCreditsTotal
	}
});