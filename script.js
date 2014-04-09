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

    loadCsv.get(function(_error, _response) {
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

/**
 * For combining our sets of import and export data into one data structure.
 *  var combiner = impexp.dataCombiner();
 *  var data = combiner.combine(imports_data, exports_data);
 */
impexp.dataCombiner = function module() {
  var exports = {};

  /**
   * Both imports_data and exports_data are like:
   * [
   *  {1999: '15', 2000: '25', 2001: '30', 'Country': 'France'}
   *  {1999: '16', 2000: '18', 2001: '22', 'Country': 'UK'}
   * ]
   * and it returns this:
   * {
   *  'France': [
   *    {
   *      year: 1999,
   *      imports: 15,
   *      exports: 33
   *    }...
   *  ],
   *  'UK': [
   *    ...
   *  ]
   * }
   */
  exports.combine = function(imports_data, exports_data) {

    // The basis for what we'll return:
    combined_data = keyByCountryWithArrays('imports', imports_data);
    // So we can access its data more easily:
    exports_by_country = keyByCountry(exports_data);

    // Add the export data to the transformed import data:
    d3.keys(combined_data).forEach(function(country) {
      if (country in exports_by_country) {
        combined_data[country].forEach(function(year_data, n) {
          var year = year_data['year'];
          if (year in exports_by_country[country]) {
            combined_data[country][n]['exports'] = exports_by_country[country][year];
          };
        });
      };
    });
    return combined_data;
  };

  /**
   * `kind` is one of 'imports' or 'exports'.
   * `rows` is an array or objects.
   *
   * Changes from:
   * [
   *  {1999: '15', 2000: '25', 2001: '30', 'Country': 'France'}
   *  {1999: '16', 2000: '18', 2001: '22', 'Country': 'UK'}
   * ]
   *
   * to (if `kind` is 'imports'):
   * {
   *  'France': [
   *    {'year': 1999, 'imports': 15},
   *    {'year': 2000, 'imports': 25}, ...
   *  ],
   *  'UK': [ ...
   * }
   */
  keyByCountryWithArrays = function(kind, rows) {
    var countries = {};
    rows.forEach(function(row) {
      var years = [];
      // k will be either a year or 'Country':
      d3.keys(row).forEach(function(k) {
        if (k !== 'Country') {
          var year_data = {year: new Date(+k, 0, 1)};
          year_data[kind] = +row[k];
          // year_data will be like {'year': DateObj, 'imports': 15}
          years.push(year_data);
        };
      });
      countries[row['Country']] = years;
    });
    return countries;
  };

  /**
   * Takes this:
   * [
   *  {1999: '15', 2000: '25', 2001: '30', 'Country': 'France'}
   *  {1999: '16', 2000: '18', 2001: '22', 'Country': 'UK'}
   * ]
   * and returns this:
   * { 
   *  'France': {1999: 15, 2000: 25, 2001: 30},
   *  'UK':     {1999: 16, 2000: 18, 2001: 22}
   * }
   */
  keyByCountry = function(rows) {
    var countries = {};
    rows.forEach(function(row) {
      // Get the country name and remove from the row's data.
      var country = row['Country'];
      delete row['Country'];

      // Make sure all years and values are numeric:
      var year_data = {};
      d3.keys(row).forEach(function(k) {
        // Make a Date object for 1st Jan for the corresponding year.
        var year = new Date(+k, 0, 1);
        year_data[year] = +row[k];
      });

      countries[country] = year_data;
    })
    return countries;
  };

  return exports;
};

impexp.chart = function module() {
  var margin = {top: 20, right: 20, bottom: 30, left: 50},
      width = 400,
      height = 300,
      xValue = function(d) { return d[0]; },
      yValue = function(d) { return d[1]; },
      xScale = d3.time.scale(),
      yScale = d3.scale.linear(),
      xAxis = d3.svg.axis().scale(xScale).orient('bottom')
                  .tickFormat(d3.time.format('%Y'))
                  .ticks(d3.time.years, 1),
      yAxis = d3.svg.axis().scale(yScale).orient('left'),
      line = d3.svg.area().x(X).y(Y);
      //area = d3.svg.area().x(X).y1(Y);

  var dispatch = d3.dispatch('customHover');

  function exports(_selection) {
    _selection.each(function(data) {

      var inner_width = width - margin.left - margin.right,
          inner_height = height - margin.top - margin.bottom;

      // Update scales.
      xScale.domain(d3.extent(data, function(d) { return d.year; }))
            .range([0, inner_width]);

      yScale.domain([
        d3.min(data, function(d) { return Math.min(d['imports'], d['exports']); }),
        d3.max(data, function(d) { return Math.max(d['imports'], d['exports']); })
      ]).range([inner_height, 0]);

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
    return xScale(d.year);
  }

  // The x-accessor for the path generator; yScale âˆ˜ yValue.
  function Y(d) {
    return yScale(d.imports);
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

var draw_chart = function() {
  d3.select('#wait').style('visibility', 'hidden');
  d3.select('#ready').style('visibility', 'visible');

  var combiner = impexp.dataCombiner();
  var data = combiner.combine(importsDataManager.getCleanedData(),
                              exportsDataManager.getCleanedData());

  var chart = impexp.chart()
                    .width(800).height(400)
                    .margin({top: 50, right: 50, bottom: 50, left: 50});

  var container = d3.select('#container')
                    .data([data['France']])
                    .call(chart);
};

var importsDataManager = impexp.dataManager(),
    exportsDataManager = impexp.dataManager();

// We don't really use this cleaning function.
var csvCleaner = function(d){};
importsDataManager.loadCsvData('imports.csv', csvCleaner);
exportsDataManager.loadCsvData('exports.csv', csvCleaner);


var loaded = 0;

importsDataManager.on('dataReady', function() {
  loaded++;
  if (loaded == 2) {
    draw_chart();
  };
});

exportsDataManager.on('dataReady', function() {
  loaded++;
  if (loaded == 2) {
    draw_chart();
  };
});

