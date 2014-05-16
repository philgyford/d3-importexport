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
          // Make missing data null, ensure everything else is a number.
          year_data[kind] = row[k] === '' ? null : +row[k];
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
        // Make missing data null, ensure everything else is a number.
        year_data[year] = row[k] === '' ? null : +row[k];
      });

      countries[country] = year_data;
    })
    return countries;
  };

  return exports;
};

impexp.chart = function module() {
  var margin = {top: 10, right: 120, bottom: 20, left: 60},
      width = 800,
      height = 350,
      inner_width = width - margin.left - margin.right,
      inner_height = height - margin.top - margin.bottom,
      svg,
      main_g,
      xValue = function(d) { return d[0]; },
      yValue = function(d) { return d[1]; },
      xScale = d3.time.scale(),
      yScale = d3.scale.linear(),
      xAxis = d3.svg.axis()
                  .scale(xScale)
                  .orient('bottom')
                  .tickFormat(d3.time.format('%Y'))
                  .ticks(d3.time.years, 5),
      yAxis = d3.svg.axis()
                  .scale(yScale)
                  .orient('left')
                  .tickFormat(function(d){
                    return d3.format(',')(d / 1000000000)
                  }),
      // defined() ensures we only draw the lines where there is data.
      imports_line = d3.svg.line().x(X).y(YImports)
                        .defined(function(d){ return d.imports !== null; }),
      exports_line = d3.svg.line().x(X).y(YExports)
                        .defined(function(d){ return d.exports !== null; }),
      // defined() ensures we draw the area only when both lines have data.
      area = d3.svg.area().x(X).y1(YImports)
                        .defined(function(d){
                          return d.imports !== null && d.exports !== null; });

  var dispatch = d3.dispatch('customHover');

  function exports(_selection) {
    _selection.each(function(data) {
      
      // Select svg element if it exists.
      svg = d3.select(this)
                .selectAll('svg')
                  .data([data]);

      createMain();

      updateScales(data);

      renderAxes();

      renderBody();
    });
  };

  // We'll make a structure like: svg > g > g.lines > path.line.imports
  function createMain() {
    // Create skeletal chart, with no data applied.
    main_g = svg.enter()
                  .append('svg')
                    .append('g')
                      .attr('class', 'main');

    // If this happens after the following svg.select('g.main'), then we end
    // up with mulitple g.axes elements, one each time we select a new
    // country. I don't know why.
    axes_g = main_g.append("g")
                      .attr("class", "axes");

    // If g.main already exists, we need to explicitly select it:
    main_g = svg.select('g.main');

    // Update outer and inner dimensions.
    svg.transition().attr({ width: width, height: height });
    main_g.attr('transform', 'translate(' + margin.left +','+ margin.top + ')');
  };
  
  function updateScales(data) {
    inner_width = width - margin.left - margin.right;
    inner_height = height - margin.top - margin.bottom;

    // Use min/max of the years from all countries we're displaying.
    xScale.domain([
      d3.min(data, function(country){
        return d3.min(country.values, function(v) { return v.year; })
      }),
      d3.max(data, function(country){
        return d3.max(country.values, function(v) { return v.year; })
      })
    ]).range([0, inner_width]);

    // Use maximum value of all imports or exports from all countries.
    yScale.domain([
      0,
      d3.max(data, function(country){
        return d3.max(country.values, function(v) {
          return Math.max(v.imports, v.exports);
        })
      }),
    ]).range([inner_height, 0]);
  };

  function renderAxes() {
    renderXAxis(axes_g);
    renderYAxis(axes_g);
  };

  function renderXAxis(axes_g) {
    axes_g.append('g')
            .attr('class', 'x axis');

    main_g.select('.x.axis')
            .attr('transform', 'translate(0,' + yScale.range()[0] + ')')
            .call(xAxis);
  };

  function renderYAxis(axes_g) {
    axes_g.append('g')
            .attr('class', 'y axis')
            .append("text")
              .attr("transform", "rotate(-90)")
              .attr("y", 0 - margin.left)
              .attr("x", 0 - (inner_height / 2))
              .attr("dy", "1em")
              .style("text-anchor", "middle")
              .text("US$ Billion");;

    main_g.select('.y.axis')
            .call(yAxis);
  };

  function renderBody() {
    // Create lines group and assign the data for each country to each group.
    // Each g.lines will contain a pair of lines and a pair of clipped areas.
    var lines_g = main_g.selectAll("g.lines")
                      .data(function(d) { return d; },
                            function(d) { return d.name; });

    lines_g.enter().append("g")
                      .attr("class", "lines");

    lines_g.exit().remove();

    renderLines(lines_g);

    renderLineLabels(lines_g);

    renderAreas(lines_g);
  };

  // The pairs of import/export lines for each country.
  function renderLines(lines_g) {

    // Create each of the two lines within each lines group,
    // and assign the values from that country to that line.

    lines_g.selectAll("path.line.imports")
        .data(function(d) { return [d]; }, function(d) { return d.name; })
        .enter().append("path")
          .attr('class', 'line imports');

    lines_g.selectAll('path.line.imports')
        .data(function(d) { return [d]; }, function(d) { return d.name; })
        .transition()
        .attr("d", function(d) { return imports_line(d.values); });

    lines_g.selectAll("path.line.exports")
        .data(function(d) { return [d]; }, function(d) { return d.name; })
        .enter().append("path")
          .attr('class', 'line exports');

    lines_g.selectAll('path.line.exports')
        .data(function(d) { return [d]; }, function(d) { return d.name; })
        .transition()
        .attr("d", function(d) { return exports_line(d.values); });
  };

  // Add country name labels to right-hand end of lines.
  function renderLineLabels(lines_g) {
    lines_g.selectAll('text.label')
            .data(function(d) { return [d]; }, function(d) { return d.name; })
            .enter().append('text')
              .attr('class', 'label')
              .attr('x', 7)
              .attr('dy', '0.5em')
              .attr('transform', function(d){
                // Starting position before transform, at bottom of right-hand
                // edge of chart.
                var values = d.values[d.values.length - 1];
                var y_val = 0;
                var x_val = values.year;
                return 'translate(' + xScale(x_val) +','+ yScale(y_val) + ')';
              });

    lines_g.selectAll('text.label')
            .data(function(d) { return [d]; }, function(d) { return d.name; })
            .transition()
            .text(function(d) { return d.name; })
            .attr('transform',function(d) {
                // Get the final set of data (year, imports, exports) for this
                // line/country:
                var values = d.values[d.values.length - 1];
                // Position label between final import and export values.
                var y_val = (values.imports + values.exports) / 2;
                var x_val = values.year;
                return 'translate(' + xScale(x_val) +','+ yScale(y_val) + ')';
            })
            // After movement has finished, check there's no overlap.
            .each('end', function(){ arrangeLineLabels(lines_g); });

  };

  // If line labels are overlapping, move them until they're not.
  function arrangeLineLabels(lines_g) {

    // Based on http://stackoverflow.com/a/23373686/250962
    // Code: http://bl.ocks.org/larskotthoff/11406992
    var move = 1;
    while(move > 0) {
      move = 0;
      lines_g
        .selectAll('text.label')
        .each(function(){
          var label_a = this,
              a = this.getBoundingClientRect();
          lines_g
            .selectAll('text.label')
            .each(function(){
              var label_b = this;
              if (label_b != label_a) {
                var b = label_b.getBoundingClientRect();
                if((Math.abs(a.left - b.left) * 2 < (a.width + b.width)) &&
                   (Math.abs(a.top - b.top) * 2 < (a.height + b.height))) {
                  // The labels are overlapping.
                  var dx = (Math.max(0, a.right - b.left) +
                           Math.min(0, a.left - b.right)) * 0.01,
                      dy = (Math.max(0, a.bottom - b.top) +
                           Math.min(0, a.top - b.bottom)) * 0.02,
                      tt = d3.transform(d3.select(label_b).attr("transform")),
                      to = d3.transform(d3.select(label_a).attr("transform"));
                  move += Math.abs(dx) + Math.abs(dy);
                
                  to.translate = [ to.translate[0] + dx, to.translate[1] + dy ];
                  tt.translate = [ tt.translate[0] - dx, tt.translate[1] - dy ];
                  d3.select(label_b).attr("transform", "translate(" + tt.translate + ")");
                  d3.select(label_a).attr("transform", "translate(" + to.translate + ")");
                  a = label_b.getBoundingClientRect();
                };
              };
            });
        });
    };
  
  };

  // The shaded areas between pairs of lines.
  function renderAreas(lines_g) {

    // Make clipPaths for the shaded areas.

    // This did select 'clipPath.clip.surplus' but this results in creating
    // NEW clippaths with every transition. No idea.
    //lines_g.selectAll('#clip-surplus')
      //.data(function(d) { return [d]; }, function(d) { return d.name; })
      //.enter().append('clipPath')
        //.attr('id', 'clip-surplus')
        //.append('path')
          //.attr('class', 'clip surplus');
    //lines_g.selectAll('path.clip.surplus')
      //.data(function(d) { return [d]; }, function(d) { return d.name; })
      //.transition()
      //.attr('d', area.y0(0));


    
    // This did select 'clipPath.clip.deficit' but this results in creating
    // NEW clippaths with every transition. No idea.

    var area3 = d3.svg.area()
                        .x(X)
                        .y1(YImports)
                        .y0(function(d){ return yScale(d.exports); });

    lines_g.selectAll('.clippath.surplus')
      .data(function(d) { return [d]; }, function(d) { return d.name; })
      .enter()
        .append('clipPath')
        .attr('id', function(d) { return "surplusclip" + d.name.replace(/[^a-zA-Z]/g,''); })
        .attr('class', 'clippath surplus')
        .append('path')
          .attr('class', 'clip surplus');
    lines_g.selectAll('path.clip.surplus')
      .data(function(d) { return [d]; }, function(d) { return d.name; })
      .transition()
      .attr('d', function(d){ return area3(d.values); }); 

    // Draw the shaded areas, using the clipPaths.
    var area2 = d3.svg.area()
                        .x(X)
                        .y1(YExports)
                        .y0(function(d){ return yScale(0); });

    lines_g.selectAll('path.area.surplus')
      .data(function(d) { return [d]; }, function(d) { return d.name; })
      .enter().append('path')
        .attr('class', 'area surplus')
        .attr('clip-path', function(d) { return "url(#surplusclip" + d.name.replace(/[^a-zA-Z]/g,'') + ")"; });
    lines_g.selectAll('path.area.surplus')
      .transition()
      .attr('d', function(d){ return area2(d.values); });
        

    var area5 = d3.svg.area()
                        .x(X)
                        .y1(YExports)
                        .y0(function(d){ return yScale(d.imports); });

    lines_g.selectAll('.clippath.deficit')
      .data(function(d) { return [d]; }, function(d) { return d.name; })
      .enter()
        .append('clipPath')
        .attr('id', function(d) { return "deficitclip" + d.name.replace(/[^a-zA-Z]/g,''); })
        .attr('class', 'clippath deficit')
        .append('path')
          .attr('class', 'clip deficit');
    lines_g.selectAll('path.clip.deficit')
      .data(function(d) { return [d]; }, function(d) { return d.name; })
      .transition()
      .attr('d', function(d){ return area5(d.values); }); 

    var area4 = d3.svg.area()
                        .x(X)
                        .y1(YImports)
                        .y0(function(d){ return yScale(0); });

    lines_g.selectAll('path.area.deficit')
      .data(function(d) { return [d]; }, function(d) { return d.name; })
      .enter().append('path')
        .attr('class', 'area deficit')
        .attr('clip-path', function(d) { return "url(#deficitclip" + d.name.replace(/[^a-zA-Z]/g,'') + ")"; });
    lines_g.selectAll('path.area.deficit')
      .transition()
      .attr('d', function(d) { return area4(d.values); });
  };

  // The x-accessor for the path generator; xScale âˆ˜ xValue.
  function X(d) {
    return xScale(d.year);
  }

  // The x-accessor for the path generator; yScale âˆ˜ yValue.
  function YImports(d) {
    return yScale(d.imports);
  }
  function YExports(d) {
    return yScale(d.exports);
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


impexp.controller = function module() {
  var exports = {},
      chart,
      data,
      container,
      // How many columns of, er, checkboxes do we want?
      checkbox_columns = 4,
      default_countries = ['China', 'United States'],
      importsDataManager = impexp.dataManager(),
      exportsDataManager = impexp.dataManager();

  /**
   * Call this to start everything going.
   */
  exports.init = function() {
    // Could be used to clean the data, but we don't need to.
    var csvCleaner = function(d){};

    // Load both files.
    // After this you could do importsDataManager.getCleanedData() to see
    // what was loaded.
    importsDataManager.loadCsvData('imports.csv', csvCleaner);
    exportsDataManager.loadCsvData('exports.csv', csvCleaner);

    // Once the data has loaded, each manager will send 'dataReady' events.
    // So, once both have happened, we want to draw the chart:

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
  };

  /**
   * Called once all the CSV data has been loaded.
   */
  var draw_chart = function() {
    $('#wait').hide();
    $('#loaded').fadeIn(500);

    var combiner = impexp.dataCombiner();
    data = combiner.combine(importsDataManager.getCleanedData(),
                            exportsDataManager.getCleanedData());

    init_form();

    chart = impexp.chart();

    // Get the data just for these countries.
    chart_data = make_chart_data(default_countries);

    container = d3.select('#container')
                  .datum(chart_data)
                  .call(chart);
  };

  var init_form = function() {
    var country_names = d3.keys(data);
    var checkboxes_per_column = Math.ceil(
                                      country_names.length / checkbox_columns);
    var columns = [];
    var count = 1;
    var $ul;

    country_names.forEach(function(country) {
      if (count == 1) {
        $ul = $('<ul/>').addClass('column')
                        .css('width', (100/checkbox_columns) + '%');
      };
      var $checkbox = $('<input/>').attr('type', 'checkbox')
                                    .attr('value', country);
      if (default_countries.indexOf(country) >= 0) {
        $checkbox.attr('checked', 'checked');
      };
      $ul.append(
        $('<li/>').append(
          $('<label/>').append($checkbox).append($('<span/>').text(country))
        )
      );
      if (count >= checkboxes_per_column) {
        columns.push($ul);
        count = 1;
      } else {
        count++;
      }
    });
    columns.push($ul);

    columns.forEach(function($ul) {
      $('#countries').append($ul);
    });

    // When a new country is selected, change the chart.
    $('#countries input').on('click', change_countries);
  };

  var change_countries = function(ev) {
    var countries = [];
    $('#countries li input').each(function(idx){
      if ($(this).is(':checked')) {
        countries.push($(this).val());
      };
    });
    var chart_data = make_chart_data(countries);
    update_chart(chart_data);
  };


  // countries is an array of country names.
  //
  // Returns an array something like:
  // [
  //  {name: 'United Kingdom',
  //   values: [...]},
  //   {name: 'United States',
  //   values: [...]}
  // ]
  var make_chart_data = function(countries) {
    var chart_data = [];

    countries.forEach(function(country) {
      if (country in data) {
        chart_data.push({
          name: country,
          values: data[country]
        });
      };
    });

    return chart_data;
  };

  var update_chart = function(chart_data) {
    container.datum(chart_data)
              .transition()
              .ease('linear')
              .call(chart);
  };

  return exports;
}

// Let's go!
var controller = impexp.controller();
controller.init();

