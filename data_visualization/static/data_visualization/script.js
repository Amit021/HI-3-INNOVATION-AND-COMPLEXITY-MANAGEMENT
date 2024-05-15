function fetchAllergyData() {
    return fetch('/data_visualization/api/allergy-data/')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => data)
        .catch(error => {
            console.error('Error fetching allergy data:', error);
            throw error;
        });
}

function transformDataForTreemap(data) {
    console.log("Received data for transformation:", data);

    if (!Array.isArray(data) || data.length === 0) {
        console.error("Data is not an array or is empty");
        return null;
    }

    try {
        const nestedData = d3.rollup(data,
            v => v.length,
            d => d.category,
            d => d.specific_reason
        );

        const hierarchicalData = {
            name: "AllergyData",
            children: Array.from(nestedData, ([category, reasons]) => ({
                name: category,
                children: Array.from(reasons, ([reason, count]) => ({
                    name: reason,
                    value: count
                }))
            }))
        };

        return hierarchicalData;
    } catch (error) {
        console.error('Error in data transformation:', error);
        return null;
    }
}

function drawPieChart() {
    const pie_width = 1080,
          pie_height = 768,
          pie_margin = 100;

    const radius = Math.min(pie_width, pie_height) / 2 - pie_margin;

    var svg = d3.select("#my_dataviz")
      .append("svg")
        .attr("width", pie_width)
        .attr("height", pie_height)
      .append("g")
        .attr("transform", "translate(" + pie_width / 2 + "," + pie_height / 2 + ")");

    var data = d3.rollup(allergyData, v => v.length, d => d.category);

    var total = d3.sum(Array.from(data.values()));

    var color = d3.scaleOrdinal()
      .domain(Array.from(data.keys()))
      .range(d3.schemeDark2);
    
    var pie = d3.pie()
      .sort(null)
      .value(d => d[1]);
    var data_ready = pie(Array.from(data.entries()));

    var arc = d3.arc()
      .innerRadius(radius * 0.5)
      .outerRadius(radius * 0.8);

    var outerArc = d3.arc()
      .innerRadius(radius * 0.9)
      .outerRadius(radius * 0.9);
    
    svg.selectAll('allSlices')
      .data(data_ready)
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', function(d){ return(color(d.data[0])) })
      .attr("stroke", "white")
      .style("stroke-width", "2px")
      .style("opacity", 0.7);

    svg.selectAll('allPolylines')
      .data(data_ready)
      .enter()
      .append('polyline')
        .attr("stroke", "black")
        .style("fill", "none")
        .attr("stroke-width", 1)
        .attr('points', function(d) {
          var posA = arc.centroid(d);
          var posB = outerArc.centroid(d);
          var posC = outerArc.centroid(d);
          var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
          posC[0] = radius * 0.95 * (midangle < Math.PI ? 1 : -1);
          return [posA, posB, posC];
        });

    svg.selectAll('allLabels')
        .data(data_ready)
        .enter()
        .append('text')
          .text(function(d) { 
              var percentage = ((d.data[1] / total) * 100).toFixed(2);
              return `${d.data[0]}: ${percentage}%`; 
          })
          .attr('transform', function(d) {
              var pos = outerArc.centroid(d);
              var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
              pos[0] = radius * 0.99 * (midangle < Math.PI ? 1 : -1);
              return 'translate(' + pos + ')';
          })
          .style('text-anchor', function(d) {
              var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
              return (midangle < Math.PI ? 'start' : 'end');
          });

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr('font-size', '30px')
        .attr('y', 0)
        .text(`Total: ${total}`);
}


function drawTreemap(category, data) {
    console.log("Drawing treemap for category:", category);
    console.log("Data received for treemap:", data);

    // Create a new container div for the category
    const treemapContainer = d3.select("#treemapsContainer").append("div")
        .attr("class", "treemap-category");

    // Append the category name as a heading with a specific class
    treemapContainer.append("h3")
        .attr("class", "category-heading")
        .text(category);

    const groupedData = d3.group(data, d => d.specific_reason);
    console.log("Grouped data:", groupedData);

    const width = 1080;
    const height = 768; // Adjust this value to change the height of the treemap
    const svg = treemapContainer.append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("class", "treemapSVG");

    const total = data.length; // Total count for the entire category

    const treemapData = {
        "name": category,
        "children": Array.from(groupedData, ([reason, entries]) => ({
            "name": reason,
            "size": entries.length,
            "percentage": ((entries.length / total) * 100).toFixed(2) // Calculate percentage based on the entire category total
        }))
    };

    const treemapLayout = d3.treemap().size([width, height]).paddingInner(2);

    const root = d3.hierarchy(treemapData).sum(d => d.size).sort((a, b) => b.size - a.size);

    treemapLayout(root);

    const nodes = svg.selectAll(".treemap-rect")
        .data(root.leaves())
        .enter().append("g")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    nodes.append("rect")
        .attr("class", "treemap-rect")
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        .style("fill", (d, i) => d3.schemeCategory10[i % 10])
        .on("mouseover", function (event, d) {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`${d.data.name}: ${d.data.percentage}%`)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", function (event) {
            tooltip.style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    nodes.append("text")
        .attr("x", 6)
        .attr("y", 20)
        .text(d => d.data.name)
        .style("font-size", "15px");

    console.log("Treemap data structured:", treemapData);
}


function drawBarChart() {
    const margin = { top: 100, right: 30, bottom: 20, left: 50 },
          width = 1080 * 0.9,
          height = 768 * 0.8;

    const svg = d3.select("#my_dataviz2")
        .append("svg")
        .attr("width", 1080)
        .attr("height", 768)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const categories = Array.from(new Set(allergyData.map(item => item.category)));
    const criticalities = Array.from(new Set(allergyData.map(item => item.criticality)));

    const x = d3.scaleBand()
        .domain(categories)
        .range([0, width])
        .padding(0.2);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickSizeOuter(0));

    const y = d3.scaleLinear()
        .domain([0, 200])
        .range([height, 0]);

    svg.append("g")
        .call(d3.axisLeft(y));

    const color_rect = d3.scaleOrdinal()
        .domain(criticalities)
        .range(d3.schemeSet2);

    const categoryCounts = {};
    categories.forEach(cat => {
        categoryCounts[cat] = allergyData.filter(item => item.category === cat).length;
    });

    const stackedData = d3.stack()
        .keys(criticalities)
        .value((group, crit) => group[crit] || 0)
        (categories.map(cat => ({
            category: cat,
            ...criticalities.reduce((acc, crit) => ({
                ...acc,
                [crit]: allergyData.filter(item => item.category === cat && item.criticality === crit).length
            }), {})
        })));

    // Tooltip setup
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    svg.append("g")
        .selectAll("g")
        .data(stackedData)
        .join("g")
        .attr("fill", d => color_rect(d.key))
        .attr("class", d => "myRect " + d.key)
        .selectAll("rect")
        .data(d => d)
        .join("rect")
        .attr("x", d => x(d.data.category))
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]))
        .attr("width", x.bandwidth())
        .attr("stroke", "grey")
        .on("mouseover", function (event, d) {
            const subGroupName = d3.select(this.parentNode).datum().key;
            const count = d[1] - d[0];
            const categoryTotal = categoryCounts[d.data.category];
            const percentage = ((count / categoryTotal) * 100).toFixed(2);
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`Category: ${d.data.category}<br>Criticality: ${subGroupName}<br>Count: ${count}<br>Percentage: ${percentage}%`)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
            d3.selectAll(".myRect").style("opacity", 0.2);
            d3.selectAll("." + subGroupName).style("opacity", 1);
        })
        .on("mousemove", function (event) {
            tooltip.style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
            d3.selectAll(".myRect").style("opacity", 1);
        });
}

document.addEventListener('DOMContentLoaded', function () {
    fetchAllergyData().then(data => {
        allergyData = data;
        drawPieChart();
        drawBarChart();

        const groupedByCategory = d3.group(allergyData, d => d.category);
        for (const [category, data] of groupedByCategory) {
            drawTreemap(category, data);
        }
    }).catch(error => {
        console.error("Error loading data for visualization:", error);
    });
});
