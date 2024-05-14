
function fetchAllergyData() {
    return fetch('/data_visualization/api/allergy-data/')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => data)  // This automatically returns the fetched data
        .catch(error => {
            console.error('Error fetching allergy data:', error);
            throw error;  // Continue to propagate the error to be caught by the caller
        });
}

function transformDataForTreemap(data) {
    // Log the input data to ensure it's in the expected format
    console.log("Received data for transformation:", data);

    // Check if the data is an array and not empty
    if (!Array.isArray(data) || data.length === 0) {
        console.error("Data is not an array or is empty");
        return null;
    }

    try {
        // Perform the rollup operation
        const nestedData = d3.rollup(data, 
            v => v.length, // Count the occurrences of each specific reason
            d => d.category, 
            d => d.specific_reason
        );

        // Transform the nested data into a hierarchical structure
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

function drawPieChart(data) {
    const pie_width = 960,
          pie_height = 500,
          pie_margin = 100;

    const radius = Math.min(pie_width, pie_height) / 2 - pie_margin;

    var svg = d3.select("#my_dataviz")
      .append("svg")
        .attr("width", pie_width)
        .attr("height", pie_height)
      .append("g")
        .attr("transform", "translate(" + pie_width / 2 + "," + pie_height / 2 + ")");

    var data = d3.rollup(allergyData, v => v.length, d => d.category);

    // Calculate total
    var total = d3.sum(Array.from(data.values()));

    // Set the color scale
    var color = d3.scaleOrdinal()
      .domain(Array.from(data.keys()))
      .range(d3.schemeDark2);
    
    var pie = d3.pie()
      .sort(null) // Do not sort group by size
      .value(d => d[1]);
    var data_ready = pie(Array.from(data.entries()));


    var arc = d3.arc()
      .innerRadius(radius * 0.5)         // This is the size of the donut hole
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
          var posA = arc.centroid(d) // line insertion in the slice
          var posB = outerArc.centroid(d) // line break: we use the other arc generator that has been built only for that
          var posC = outerArc.centroid(d); // Label position = almost the same as posB
          var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2 // we need the angle to see if the X position will be at the extreme right or extreme left
          posC[0] = radius * 0.95 * (midangle < Math.PI ? 1 : -1); // multiply by 1 or -1 to put it on the right or on the left
          return [posA, posB, posC]
        });
    svg.selectAll('allLabels')
        .data(data_ready)
        .enter()
        .append('text')
          .text( function(d) { return d.data[0]; })
          .attr('transform', function(d) {
              var pos = outerArc.centroid(d);
              var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2
              pos[0] = radius * 0.99 * (midangle < Math.PI ? 1 : -1);
              return 'translate(' + pos + ')';
          })
          .style('text-anchor', function(d) {
              var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2
              return (midangle < Math.PI ? 'start' : 'end')
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

    const groupedData = d3.group(data, d => d.specific_reason);
    console.log("Grouped data:", groupedData);

    const treemapContainer = d3.select("#treemapSVG");
    if (treemapContainer.empty()) {
        console.error("Treemap container not found.");
        return; // Exit the function if the container does not exist
    }

    const width = 800, height = 500;
    const svg = treemapContainer.append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("class", "treemapSVG");

    const treemapData = {
        "name": category,
        "children": Array.from(groupedData, ([reason, entries]) => ({
            "name": reason,
            "size": entries.length
        }))
    
    
    };
    const treemapLayout = d3.treemap().size([width, height]).paddingInner(2);

    const root = d3.hierarchy(treemapData).sum(d => d.size).sort((a, b) => b.size - a.size);

    treemapLayout(root);

    const nodes = svg.selectAll(".treemap-rect")
        .data(root.leaves())
        .enter().append("g")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    nodes.append("rect")
        .attr("class", "treemap-rect")
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        .style("fill", (d, i) => d3.schemeCategory10[i % 10]);

    nodes.append("text")
        .attr("x", 6)
        .attr("y", 20)
        .text(d => d.data.name)
        .style("font-size", "15px");
    console.log("Treemap data structured:", treemapData);
}
    

// Function to draw the bar chart
function drawBarChart(data) {
    const margin = { top: 10, right: 30, bottom: 20, left: 50 },
        width = 800 - margin.left - margin.right,
        height = 1000 - margin.top - margin.bottom;

    const svg = d3.select("#my_dataviz2")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
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
        .domain([0, 1000])
        .range([ height, 0 ]);
    
    svg.append("g")
        .call(d3.axisLeft(y));

    const color_rect = d3.scaleOrdinal()
        .domain(criticalities)
        .range(d3.schemeSet2);

    const stackedData = d3.stack()
        .keys(criticalities)
        .value((group, crit) => group[crit] || 0) // Use the count of items for the given criticality, defaulting to 0 if undefined
        (categories.map(cat => ({
            category: cat,
            ...criticalities.reduce((acc, crit) => ({
                ...acc,
                [crit]: allergyData.filter(item => item.category === cat && item.criticality === crit).length
            }), {})
        })));

    svg.append("g")
        .selectAll("g")
        .data(stackedData)
        .join("g")
        .attr("fill", d => color_rect(d.key))
        .attr("class", d => "myRect " + d.key) // Add a class to each subgroup: their name
        .selectAll("rect")
        .data(d => d)
        .join("rect")
        .attr("x", d => x(d.data.category))
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]))
        .attr("width", x.bandwidth())
        .attr("stroke", "grey")
        .on("mouseover", function (event, d) { // What happens when user hovers over a bar
            // What subgroup are we hovering?
            const subGroupName = d3.select(this.parentNode).datum().key;
            // Reduce opacity of all rects to 0.2
            d3.selectAll(".myRect").style("opacity", 0.2);
            // Highlight all rects of this subgroup with opacity 1. It is possible to select them since they have a specific class = their name.
            d3.selectAll("." + subGroupName).style("opacity", 1);
        })
        .on("mouseleave", function (event, d) { // When user does not hover anymore
            // Back to normal opacity: 1
            d3.selectAll(".myRect").style("opacity", 1);
        });

 

}

        
document.addEventListener('DOMContentLoaded', function () {
    // Fetch allergyData and then call drawing functions
    fetchAllergyData().then(data => {
        allergyData = data; // Assign fetched data to allergyData variable
        drawPieChart(); // Call drawPieChart after data is loaded
        drawBarChart(); // Call drawBarChart after data is loaded

        // Call drawTreemap for each category
        const groupedByCategory = d3.group(allergyData, d => d.category);
        for (const [category, data] of groupedByCategory) {
            drawTreemap(category, data);
        }
    }).catch(error => {
        console.error("Error loading data for visualization:", error);
    });
});
