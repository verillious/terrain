/**
 * @module cities.js
 *
 *	This is based on a world-map structure called render,
 *	which contains:
 *	    params ... parameters
 *		ncities ... number of cities to create
 *		nterrs ... number of territories to create
 *	    h ...height map
 *	    cities ... list of city locations
 *	    terr ... list of territories
 */
"use strict";

/**
 * cityScore - evaluate attractiveness of city locations
 *
 * @param	height map
 * @param	list of existing city <x,y> locations
 * @return	score map
 */
function cityScore(h, cities) {
    var score = map(getFlux(h), Math.sqrt);	// sqrt river flux
    for (var i = 0; i < h.length; i++) {
	// under water or at edge is automatic lose
        if (h[i] <= 0 || isnearedge(h.mesh, i)) {
            score[i] = -999999;
            continue;
        }
	// maximize distance from center of map
        score[i] += 0.01 / (1e-9 + Math.abs(h.mesh.vxs[i][0]) - h.mesh.extent.width/2)
        score[i] += 0.01 / (1e-9 + Math.abs(h.mesh.vxs[i][1]) - h.mesh.extent.height/2)

	// maximize distance from other cities
        for (var j = 0; j < cities.length; j++) {
            score[i] -= 0.02 / (distance(h.mesh, cities[j], i) + 1e-9);
        }
    }
    return score;
}

/**
 * placeCity -	compute scores and place a city in the best location
 *
 * @param	world map and parameters
 * 		updates cities list in world map
 */
function placeCity(render) {
    render.cities = render.cities || [];
    var score = cityScore(render.h, render.cities);
    var newcity = d3.scan(score, d3.descending);
    render.cities.push(newcity);
}

/**
 * placeCities - create the configured number of cities
 *
 * @param	world map and parameters
 * 		updates cities list in world map
 */
function placeCities(render) {
    var params = render.params;
    var h = render.h;
    var n = params.ncities;
    for (var i = 0; i < n; i++) {
        placeCity(render);
    }
}

/**
 * getTerritories - define the territories
 *
 *	Recursively compute the cost of travel outwards
 *	from city, and assign ownership to the most easily
 *	reached capitol (using Priority Queues to ensure
 *	that the easiest option is assigned first)
 *
 * @param	world map and parameters
 * @return	territory map (which city each cell belongs to)
 */
function getTerritories(render) {
    var h = render.h;
    var cities = render.cities;
    var n = render.params.nterrs;
    if (n > render.cities.length) n = render.cities.length;

    var flux = getFlux(h);
    var terr = [];
    var queue = new PriorityQueue({comparator: function (a, b) {return a.score - b.score}});

    /**
     * weight - difficutly of travel from u to v
     *		proportional to distance
     *		proportional to square of slope
     *		proportional to river width (sqrt flux)
     *		very hard to go across ocean
     */
    function weight(u, v) {
        var horiz = distance(h.mesh, u, v);
        var vert = h[v] - h[u];
        if (vert > 0) vert /= 10;
        var diff = 1 + 0.25 * Math.pow(vert/horiz, 2);
        diff += 100 * Math.sqrt(flux[u]);
        if (h[u] <= 0) diff = 100;
        if ((h[u] > 0) != (h[v] > 0)) return 1000;
        return horiz * diff;
    }

    // for each desired territory
    for (var i = 0; i < n; i++) {
	// starts at its capital city
        terr[cities[i]] = cities[i];
	// queue travel to each neighbor
        var nbs = neighbours(h.mesh, cities[i]);
        for (var j = 0; j < nbs.length; j++) {
            queue.queue({
                score: weight(cities[i], nbs[j]),
                city: cities[i],
                vx: nbs[j]
            });
        }
    }

    // for each queued city and neighbor
    while (queue.length) {
        var u = queue.dequeue();
	// ignore any cell that has a territory
        if (terr[u.vx] != undefined) continue;

	// assign this cell to the proximate city
        terr[u.vx] = u.city;

	// for each neighbor of this cell
        var nbs = neighbours(h.mesh, u.vx);
        for (var i = 0; i < nbs.length; i++) {
            var v = nbs[i];
	    // ignore any cell that has a territory
            if (terr[v] != undefined) continue;
            var newdist = weight(u.vx, v);
            queue.queue({
                score: u.score + newdist,	// incremental cost
                city: u.city,
                vx: v
            });
        }
    }
    terr.mesh = h.mesh;
    return terr;
}

/**
 * getBorders - construct the territory borders
 *
 *	if this edge crosses a border, my other
 *	two edges are the border.
 *
 * @param	world map description
 * @return	smooth territory border paths
 */
function getBorders(render) {
    var terr = render.terr;
    var h = render.h;
    var edges = [];
    for (var i = 0; i < terr.mesh.edges.length; i++) {
        var e = terr.mesh.edges[i];
        if (e[3] == undefined) continue;
        if (isnearedge(terr.mesh, e[0]) || isnearedge(terr.mesh, e[1])) continue;
        if (h[e[0]] < 0 || h[e[1]] < 0) continue;
        if (terr[e[0]] != terr[e[1]]) {
            edges.push([e[2], e[3]]);
        }
    }
    return mergeSegments(edges).map(relaxPath);
}


/**
 * visualizeBorders - locate territories and draw borders
 *
 * @param	height map
 * @param	list of cities
 * @parm	max # of territories
 */
function visualizeBorders(h, cities, n) {
    var links = getBorders(h, getTerritories(h, cities, n));
    drawPaths('border', links);
}


/**
 * visualizeCities
 *
 * @param	stroke vector graphics
 * @param	world map info
 */
function visualizeCities(svg, render) {
    var cities = render.cities;
    var h = render.h;
    var n = render.params.nterrs;

    // remove all existing city circles from map
    var circs = svg.selectAll('circle.city').data(cities);
    circs.enter()
            .append('circle')
            .classed('city', true);
    circs.exit()
            .remove();

    // larger circles for capitols
    svg.selectAll('circle.city')
        .attr('cx', function (d) {return 1000*h.mesh.vxs[d][0]})
        .attr('cy', function (d) {return 1000*h.mesh.vxs[d][1]})
        .attr('r', function (d, i) {return i >= n ? 4 : 10})
        .style('fill', 'white')
        .style('stroke-width', 5)
        .style('stroke-linecap', 'round')
        .style('stroke', 'black')
        .raise();
}

/**
 * terrCenter - find centroid of teritory
 *	average the x/y coordinates of every point in territory
 *
 * @param	height map
 * @param	list of territories
 * @param	desired city
 * @param	ignore ocean?
 * @return	<x,y> of territory centroid
 */
function terrCenter(h, terr, city, landOnly) {
    var x = 0;
    var y = 0;
    var n = 0;
    for (var i = 0; i < terr.length; i++) {
        if (terr[i] != city) continue;
        if (landOnly && h[i] <= 0) continue;
        x += terr.mesh.vxs[i][0];
        y += terr.mesh.vxs[i][1];
        n++;
    }
    return [x/n, y/n];
}

