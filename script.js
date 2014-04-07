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
  var margin = {top: 20, right: 20, bottom: 30, left: 50},
      width = 400,
      height = 300,
      xValue = function(d) { return d[0]; },
      yValue = function(d) { return d[1]; },
      xScale = d3.scale.ordinal(),
      yScale = d3.scale.linear(),
      xAxis = d3.svg.axis().scale(xScale).orient('bottom'),
      yAxis = d3.svg.axis().scale(yScale).orient('left'),
      line = d3.svg.line().x(X).y(Y);

  var dispatch = d3.dispatch('customHover');

  function exports(_selection) {
    _selection.each(function(data) {
      var inner_width = width - margin.left - margin.right,
          inner_height = height - margin.top - margin.bottom;

      // Update scales.
      xScale.domain(data.map(function (d) { return d[0]; }))
            .rangePoints([0, inner_width]);
      yScale.domain([0, d3.max(data, function(d) { return d[1]; })])
            .range([inner_height, 0]);

      // Select svg element if it exists.
      var svg = d3.select(this)
                  .selectAll('svg')
                  .data([data]);

      // Or create skeletal chart.
      var gEnter = svg.enter().append('svg').append('g');
      gEnter.append('path').attr('class', 'line');
      gEnter.append('g').attr('class', 'x axis');
      gEnter.append('g').attr('class', 'y axis');

      // Update outer dimensions.
      svg.transition()
          .attr({ width: width, height: height });

      // Update inner dimensions.
      var g = svg.select('g')
                .attr('transform',
                  'translate(' + margin.left + ',' + margin.right + ')');

      // Update line path.
      g.select('.line').attr('d', line);

      // Update axes.
      g.select('.x.axis')
        .attr('transform', 'translate(0,' + yScale.range()[0] + ')')
        .call(xAxis);
      g.select('.y.axis')
        .call(yAxis);
    });
  };

  // The x-accessor for the path generator; xScale âˆ˜ xValue.
  function X(d) {
    return xScale(d[0]);
  }

  // The x-accessor for the path generator; yScale âˆ˜ yValue.
  function Y(d) {
    return yScale(d[1]);
  }

  exports.margin = function(_) {
    if (!arguments.length) return margin;
    margin = _;
    return this;
  };

  exports.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    return this;
  };

  exports.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return this;
  };

  exports.x = function(_) {
    if (!arguments.length) return xValue;
    xValue = _;
    return chart;
  };

  exports.y = function(_) {
    if (!arguments.length) return yValue;
    yValue = _;
    return chart;
  };
  
  d3.rebind(exports, dispatch, "on");

  return exports;
};

var chart = impexp.chart()
                  .width(600).height(400)
                  .margin({top: 50, right: 50, bottom: 50, left: 50});

var data = [['a', 10], ['b', 20], ['c', 10], ['d', 20], ['e', 30]];

var container = d3.select('#container')
                  .data([data])
                  .call(chart);
