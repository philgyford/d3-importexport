var impexp = {};

impexp.dataManager = function module() {
  var exports = {},
    // Custom events:
    dispatch = d3.dispatch('dataReady', 'dataLoading'),
    data;

  exports.loadCsvData = function(_file, _cleaningFunc) {
    var loadCsv = d3.csv(_file);

    loadCsv.on('progress', function() {
                                    dispatch.dataLoading(d3.event.loaded); });

    loadCsv.get(function(_error, _reponse) {
      // Apply the cleaning function supplied in the _cleaningFunc parameter.
      _response.forEach(function(d) {
        _cleaningFunc(d);
      });

      // Assign cleaned response to data.
      data = _response;

      dispatch.dataReady(_response);
    });
  };

  exports.getCleanedData = function() {
    return data;
  };

  d3.rebind(exports, dispatch, 'on');

  return exports;
};

impexp.chart = function module() {
  var width = 400,
      height = 300;
  var dispatch = d3.dispatch('customHover');

  function exports(_selection) {
    _selection.each(function(_data) {
      var barW = width / _data.length,
          scaling = height / d3.max(_data);

      var svg = d3.select(this)
                  .selectAll('svg')
                  .data([_data]);
      svg.enter().append('svg')
         .classed('chart', true);
      svg.transition().attr({width: width, height: height});

      var bars = svg.selectAll('.bar')
                    .data(function(d, i) {
                      // d === _data
                      return d;
                    });

      bars.enter().append('rect')
          .classed('bar', true)
          .attr({
            x: width,
            width: barW,
            y: function(d, i) { return height - d * scaling; },
            height: function(d, i) { return d * scaling; }
          })
          .on('mouseover', dispatch.customHover);

      bars.transition()
          .attr({
            x: function(d, i) { return i * barW; },
            width: barW,
            y: function(d, i) { return height - d * scaling; },
            height: function(d, i) { return d * scaling; }
          });
      bars.exit().transition().style({opacity: 0}).remove();
    });
  };

  exports.width = function(_x) {
    if (!arguments.length) return w;
    width = _x;
    return this;
  };

  exports.height = function(_x) {
    if (!arguments.length) return h;
    height = _x;
    return this;
  };
  
  d3.rebind(exports, dispatch, "on");

  return exports;
};

var chart = impexp.chart()
                  .width(500).height(200)
                  .on('customHover', function(d, i) {
                    d3.select('#message').text(d); 
                  });

var data = [1, 2, 3, 4];
var container = d3.select('#container')
                  .datum(data)
                  .call(chart);
