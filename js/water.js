/**
 * @module water.js - water flow, erosion, and sedimentation
 *
 *	Water effects are computed based on a few derived maps:
 *	   1. downHill[i] is the index of the cell downHill from i
 *	   2. flux[i] is the total amount of water entering cell i
 *		(where 1 is the amount of water entering the map)
 *	   3. erosionRate[i] is the rate of soil removal in cell i
 */
"use strict";

/**
 * findSinks - find the bottoms of all sinks
 *	for each point ... find the bottom of the slope
 *		if it is an edge, sinks[i] = -2
 #		if it is a local minimum sinks[i] = minimum node #
 *
 * @param	height map
 *
 * NOTE: this appears to be unused
 */
function findSinks(h) {
    var dh = downhill(h);
    var sinks = [];
    for (var i = 0; i < dh.length; i++) {
        var node = i;
        while (true) {
	    // stop when we hit an edge
            if (isedge(h.mesh, node)) {
                sinks[i] = -2;
                break;
            }
	    // stop when we hit a local minimum
            if (dh[node] == -1) {
                sinks[i] = node;
                break;
            }
	    // move down-hill
            node = dh[node];
        }
    }
}

/**
 * fillsinks
 *
 *	find nodes that are lower than ALL of their neighbors
 *	and raise them to the level of their lowest neighbor.
 *
 * @param	height map
 * @param	deminimus altitude difference
 * @return	updated height map
 */
function fillSinks(h, epsilon) {
    epsilon = epsilon || 1e-5;

    // start by setting all non-edge points to infinity
    var infinity = 999999;
    var newh = zero(h.mesh);
    for (var i = 0; i < h.length; i++) {
        if (isnearedge(h.mesh, i)) {
            newh[i] = h[i];
        } else {
            newh[i] = infinity;
        }
    }

    // interate until we stop making changes
    while (true) {
        var changed = false;
	// for each cell in height map
        for (var i = 0; i < h.length; i++) {
	    // that has not yet returned to its original height
            if (newh[i] == h[i]) continue;

	    // consider all of its neighbors
            var nbs = neighbours(h.mesh, i);
            for (var j = 0; j < nbs.length; j++) {
		// if I am higher than any neighbor, return to my original height
                if (h[i] >= newh[nbs[j]] + epsilon) {
                    newh[i] = h[i];
                    changed = true;
                    break;
                }

		// If I still have an exaggerated height, and this neighbor is
		// taller than me, reduce my claimed height to his claimed height.
		// This will end when I claim to be no taller than the shortest
		// neighbor who is taller than I am.
                var oh = newh[nbs[j]] + epsilon;
                if ((newh[i] > oh) && (oh > h[i])) {
                    newh[i] = oh;
                    changed = true;
                }
            }
        }
        if (!changed) return newh;
    }
}

/**
 * getFlux - compute water entering each cell
 *
 * @param	height map
 * @return	water influx map
 */
function getFlux(h) {
    var dh = downhill(h);

    // all cells start out getting equal water
    var idxs = [];
    var flux = zero(h.mesh); 
    for (var i = 0; i < h.length; i++) {
        idxs[i] = i;
        flux[i] = 1/h.length;
    }

    // sort mesh points by height
    idxs.sort(function (a, b) {
        return h[b] - h[a];
    });

    // compute transitive closure of down-hill flow
    for (var i = 0; i < h.length; i++) {
        var j = idxs[i];
        if (dh[j] >= 0) {
            flux[dh[j]] += flux[j];
        }
    }
    return flux;
}

/**
 * erosionRate - compute erosion rate in each cell
 *	Vflow is proportional to slope
 *	erosion force is proportional to Vflow**2
 *	erosion is proportional to flow * erosion force
 *
 * @param	height map
 * @return	new map of erosion rate per cell
 */
function erosionRate(h) {
    var flux = getFlux(h);	// get water flow per cell
    var slope = getSlope(h);	// get slope per cell
    var newh = zero(h.mesh);
    for (var i = 0; i < h.length; i++) {
        var river = Math.sqrt(flux[i]) * slope[i];	// vol * velocity
        var creep = slope[i] * slope[i]			// velocity ** 2
        var total = 1000 * river + creep;		// removal rate
        total = total > 200 ? 200 : total;		// capped at 200
        newh[i] = total;
    }
    return newh;
}

/**
 * erode - reduce per cell height by erosion
 *	scale per-cell erosion rates to amount
 *	and then subtract each cell's erosion from height
 *
 * @param	height map
 * @param	max per-cell erosion
 * @return	updated height map
 */
function erode(h, amount) {
    var er = erosionRate(h);
    var newh = zero(h.mesh);
    var maxr = d3.max(er);
    for (var i = 0; i < h.length; i++) {
        newh[i] = h[i] - amount * (er[i] / maxr);
    }
    return newh;
}

/**
 * doErosion - erode rivers and fill depressions
 *
 * @param	height map
 * @param	max erosion amount
 * @param	number of erosion cycles
 * @return	updated height map
 */
function doErosion(h, amount, n) {
    n = n || 1;
    h = fillSinks(h);
    for (var i = 0; i < n; i++) {
        h = erode(h, amount);
        h = fillSinks(h);
    }
    return h;
}


/**
 * getRivers - construct water flow paths
 *	threshold water flux is a fraction of the total
 *	rainfall landing above sea-level
 *	
 * @param	height map
 * @param	threshold water flux
 * @return	list of (relatively smooth) paths
 */
function getRivers(h, limit) {
    var dh = downhill(h);	// where does water flow
    var flux = getFlux(h);	// per cell water flux
    var links = [];		// list of flow segments

    // compute threshold water flux
    var above = 0;
    for (var i = 0; i < h.length; i++) {
        if (h[i] > 0) above++;
    }
    limit *= above / h.length;


    // figure out which cells contain rivers
    for (var i = 0; i < dh.length; i++) {
        if (isnearedge(h.mesh, i)) continue;

	// above threshold, above sea level, has enough neighbors
        if (flux[i] > limit && h[i] > 0 && dh[i] >= 0) {
            var up = h.mesh.vxs[i];		// this coordinate
            var down = h.mesh.vxs[dh[i]];	// downhill coordinate
            if (h[dh[i]] > 0) {
		// if above sea level, water flows through this cell
                links.push([up, down]);	
            } else {
		// if at sea level, water flows 1/2 way into this cell
                links.push([up, [(up[0] + down[0])/2, (up[1] + down[1])/2]]);
            }
        }
    }

    // merge and smoothe the individual links
    return mergeSegments(links).map(relaxPath);
}


/**
 * visualizeDownHill - display water paths
 *	rivers are cells w/99th percentile water flow
 *
 * @param	height map
 */
function visualizeDownhill(h) {
    var links = getRivers(h, 0.01);
    drawPaths('river', links);
}

/**
 * visualizeContour - display a contour line
 *
 * @param	height map
 * @param	contour level (e.g. 0.5)
 */
function visualizeContour(h, level) {
    level = level || 0;		// default: sea level
    var links = contour(h, level);
    drawPaths('coast', links);
}
