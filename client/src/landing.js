document.addEventListener("DOMContentLoaded", init);

function init() {
	d3.json("src/majorcodes.json", function(e, d){
		// place all the choices
		d = _.filter(_.pairs(d), function(d){
			if (d[1][0] != "AD" && d[1][0] != "SHU")
				return true;
			return false;
		});

		d3.select("#loading").remove();
		var container = d3.select("#listcontainer");
		var divs = container.selectAll(".possibles")
			.data(d)
			.enter()
			.append("div")
			.attr("class", "buttoncontainer");
		divs.append("input").attr("type", "checkbox");
		divs.append("span")
			.text(function(d){ return d[0]; });
		// also append Abu Dhabi and Shanghai at the top.
		var VIP = d3.select("#SHU-AD")
			.selectAll(".buttoncontainer")
			.data([["NYU Abu Dhabi", ["AD"]], ["NYU Shanghai", ["SHU"]]])
			.enter()
			.append("div")
			.attr("class", "buttoncontainer");
		VIP.append("input")
			.attr("type", "checkbox");
		VIP.append("span").text(function(d) {return d[0];} );
		d3.select(".container").append("button").text("Go!").on("click", gotoJeeves);
		d3.select(".underline").on("click", function(){
			d3.select("#listcontainer").style("display", null);
			d3.select(this).classed(".underline", null).text("NYU New York");
		});
	});
}

function gotoJeeves() {
	var schools = [];
	var sel;
	d3.selectAll("input").each(function(selection){
		sel = d3.select(this);
		if(sel.property("checked")) {
			var d = sel.datum();
			var L = sel.datum()[1].length;
			for (var i = 0; i < L; i++) {
				schools.push(d[1][i]);
			}
		}
	});

	window.localStorage.setItem("schools", JSON.stringify(schools));
	window.location.assign("src/jeeves.html");
}