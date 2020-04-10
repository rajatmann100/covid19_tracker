// Injects required polyfills for IE11
import "core-js/stable";
import "whatwg-fetch";
import "classlist-polyfill";

// Add all non-polyfill deps below.
import _ from "lodash";
import tippy from "tippy.js";
import * as d3 from "d3";
import * as c3 from "c3";
import { formatDistanceToNow, parse, parseISO } from "date-fns";
import { enUS, ja } from "date-fns/locale";

// Localization deps
import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import locI18next from "loc-i18next";
import translationEn from "./i18n/en.json";
import translationJa from "./i18n/ja.json";

// import static data
import travelRestrictions from "./data/travelRestrictions"; // refer to the keys under "countries" in the i18n files for names

mapboxgl.accessToken =
  "pk.eyJ1IjoicmV1c3RsZSIsImEiOiJjazZtaHE4ZnkwMG9iM3BxYnFmaDgxbzQ0In0.nOiHGcSCRNa9MD9WxLIm7g";
const PREFECTURE_JSON_PATH = "static/prefectures.geojson";
const JSON_PATH = "https://covidtracking.com/api/v1/states/current.json";
const COLOR_ACTIVE = "rgb(223,14,31)";
const COLOR_CONFIRMED = "rgb(244,67,54)";
const COLOR_RECOVERED = "rgb(25,118,210)";
const COLOR_DECEASED = "rgb(55,71,79)";
const COLOR_TESTED = "rgb(164,173,192)";
const COLOR_TESTED_DAILY = "rgb(209,214,223)";
const COLOR_INCREASE = "rgb(163,172,191)";
const PAGE_TITLE = "Coronavirus Disease (COVID-19) Japan Tracker";

const SUPPORTED_LANGS = ["en", "ja"];
let LANG = "en";

// Global vars
let ddb = {
  prefectures: undefined,
  trend: undefined,
  totals: {
    confirmed: 0,
    recovered: 0,
    deceased: 0,
    tested: 0,
    critical: 0,
  },
  totalsDiff: {
    confirmed: 0,
    recovered: 0,
    deceased: 0,
    tested: 0,
    critical: 0,
  },
  travelRestrictions,
};
let map = undefined;
let tippyInstances;

// IE11 forEach Polyfill
if ("NodeList" in window && !NodeList.prototype.forEach) {
  NodeList.prototype.forEach = function (callback, thisArg) {
    thisArg = thisArg || window;
    for (var i = 0; i < this.length; i++) {
      callback.call(thisArg, this[i], i, this);
    }
  };
}

// Added for adapting to world data
function refineData(data, ddata) {
  var daily = ddata.reverse().map((i, index) => {
    const formatDate = (d) => {
      let date = d.toString();
      date = date.slice(0, 4) + "-" + date.slice(4, 6) + "-" + date.slice(6, 8);
      return date;
    };
    debugger;
    return {
      confirmed: i.positiveIncrease,
      recoveredCumulative: i.recovered,
      deceasedCumulative: i.death,
      confirmedCumulative: i.positive,
      criticalCumulative: i.inIcuCumulative,
      testedCumulative: i.totalTestResults,
      date: formatDate(i.date),
      confirmedAvg3d: 0,
      confirmedCumulativeAvg3d: 0,
      confirmedAvg7d: 0,
      confirmedCumulativeAvg7d: 0,
    };
  });

  var states = data.map((s) => {
    return {
      confirmed: s.positive,
      deaths: s.death,
      dailyConfirmedCount: "NA",
      recovered: s.recovered,
      name_ja: s.state,
      name: s.state,
    };
  });

  return {
    prefectures: states,
    daily: daily,
    updated: "2020-04-06T22:48:36+09:00",
  };
}

// Fetches data from the JSON_PATH but applies an exponential
// backoff if there is an error.
function loadData(callback) {
  let delay = 2 * 1000; // 2 seconds

  const tryFetch = function (retryFn) {
    // Load the json data file
    fetch(JSON_PATH)
      .then(function (res) {
        return res.json();
      })
      .catch(function (networkError) {
        retryFn(delay, networkError);
        delay *= 2; // exponential backoff.
      })
      .then(function (data) {
        // If there was a network error, data will null.
        if (data) {
          fetch("https://covidtracking.com/api/us/daily")
            .then(function (res) {
              return res.json();
            })
            .catch(function (networkError) {
              retryFn(delay, networkError);
              delay *= 2; // exponential backoff.
            })
            .then(function (ddata) {
              if (ddata) {
                callback(refineData(data, ddata));
              }
            });
        }
      });
  };

  const retryFetchWithDelay = function (delay, err) {
    console.log(err + ": retrying after " + delay + "ms.");
    setTimeout(function () {
      tryFetch(retryFetchWithDelay);
    }, delay);
  };

  tryFetch(retryFetchWithDelay);
}

function calculateTotals(daily) {
  // Calculate the totals
  let totals = {
    confirmed: 0,
    recovered: 0,
    deceased: 0,
    critical: 0,
    tested: 0,
  };
  let totalsDiff = {
    confirmed: 1,
    recovered: 1,
    deceased: 1,
    critical: 1,
    tested: 1,
  };

  // If there is an empty cell, fall back to the previous row
  function pullLatestSumAndDiff(rowKey, totalKey) {
    let latest = {};
    let dayBefore = {};
    let twoDaysBefore = {};
    if (daily.length > 2) {
      twoDaysBefore = daily[daily.length - 3];
    }
    if (daily.length > 1) {
      dayBefore = daily[daily.length - 2];
    }
    if (daily.length > 0) {
      latest = daily[daily.length - 1];
    }

    if (latest && dayBefore && latest[rowKey] && dayBefore[rowKey]) {
      totals[totalKey] = latest[rowKey];
      totalsDiff[totalKey] = latest[rowKey] - dayBefore[rowKey];
    }

    if (totalsDiff[totalKey] <= 0 && twoDaysBefore && twoDaysBefore[rowKey]) {
      totalsDiff[totalKey] = latest[rowKey] - twoDaysBefore[rowKey];
    }
  }

  pullLatestSumAndDiff("testedCumulative", "tested");
  pullLatestSumAndDiff("criticalCumulative", "critical");
  pullLatestSumAndDiff("confirmedCumulative", "confirmed");
  pullLatestSumAndDiff("recoveredCumulative", "recovered");
  pullLatestSumAndDiff("deceasedCumulative", "deceased");

  return [totals, totalsDiff];
}

function drawMap() {
  // Initialize Map

  map = new mapboxgl.Map({
    container: "map-container",
    style: "mapbox://styles/mapbox/light-v10",
    zoom: 4,
    minZoom: 3.5,
    maxZoom: 7,
    center: {
      lng: 139.11792973051274,
      lat: 38.52245616545571,
    },
    maxBounds: [
      { lat: 12.118318014416644, lng: 100.01240618330542 }, // SW
      { lat: 59.34721256263214, lng: 175.3273570446982 }, // NE
    ],
  });

  map.dragRotate.disable();
  map.touchZoomRotate.disableRotation();
  map.scrollZoom.disable();
  map.addControl(
    new mapboxgl.NavigationControl({
      showCompass: false,
      showZoom: true,
    })
  );
}

// Keep a reference around to destroy it if we redraw this.
let trendChart = null;

function drawTrendChart(sheetTrend) {
  var cols = {
    Date: ["Date"],
    Confirmed: ["Confirmed"],
    Active: ["Active"],
    Critical: ["Critical"],
    Deceased: ["Deceased"],
    Recovered: ["Recovered"],
    Tested: ["Tested"],
  };

  for (var i = 0; i < sheetTrend.length; i++) {
    var row = sheetTrend[i];

    if (i === 0) {
      // Skip early feb data point
      continue;
    }

    cols.Date.push(row.date);
    cols.Confirmed.push(row.confirmedCumulative);
    cols.Critical.push(row.criticalCumulative);
    cols.Deceased.push(row.deceasedCumulative);
    cols.Recovered.push(row.recoveredCumulative);
    cols.Active.push(
      row.confirmedCumulative - row.deceasedCumulative - row.recoveredCumulative
    );
    cols.Tested.push(row.testedCumulative);
  }

  if (trendChart) {
    trendChart.destroy();
  }
  trendChart = c3.generate({
    bindto: "#trend-chart",
    data: {
      x: "Date",
      color: function (color, d) {
        if (d && d.index === cols.Date.length - 2) {
          let newColor = d3.color(color);

          newColor.opacity = 0.6;
          return newColor;
        } else {
          return color;
        }
      },
      columns: [
        cols.Date,
        cols.Confirmed,
        cols.Active,
        cols.Recovered,
        cols.Deceased,
        //cols.Tested
      ],
      regions: {
        [cols.Confirmed[0]]: [
          { start: cols.Date[cols.Date.length - 2], style: "dashed" },
        ],
        [cols.Active[0]]: [
          { start: cols.Date[cols.Date.length - 2], style: "dashed" },
        ],
        [cols.Recovered[0]]: [
          { start: cols.Date[cols.Date.length - 2], style: "dashed" },
        ],
        [cols.Deceased[0]]: [
          { start: cols.Date[cols.Date.length - 2], style: "dashed" },
        ],
        //[cols.Tested[0]]: [{'start': cols.Date[cols.Date.length-2], 'style':'dashed'}],
      },
    },
    color: {
      pattern: [COLOR_CONFIRMED, COLOR_ACTIVE, COLOR_RECOVERED, COLOR_DECEASED],
    },
    point: {
      r: 3,
    },
    axis: {
      x: {
        type: "timeseries",
        tick: {
          format: "%b %d",
          count: 6,
        },
      },
      y: {
        padding: {
          bottom: 0,
        },
        tick: {
          values: [
            0,
            100,
            500,
            1000,
            1500,
            2000,
            2500,
            3000,
            3500,
            4000,
            4500,
            5000,
          ],
        },
      },
    },
    tooltip: {
      format: {
        value: function (value, ratio, id, index) {
          if (index && cols[id][index]) {
            var diff = parseInt(value) - cols[id][index];
            return `${value} (${(diff >= 0 ? "+" : "") + diff}) ${
              index === cols.Date.length - 2 ? i18next.t("provisional") : ""
            }`;
          } else {
            return value;
          }
        },
      },
    },
    grid: {
      x: {
        show: true,
      },
      y: {
        show: true,
      },
    },
    padding: {
      right: 24,
    },
  });
}

// Keep reference to current chart in order to clean up when redrawing.
let dailyIncreaseChart = null;

function drawDailyIncreaseChart(sheetTrend) {
  var cols = {
    Date: ["Date"],
    Confirmed: ["New Cases"],
  };

  for (var i = 0; i < sheetTrend.length; i++) {
    var row = sheetTrend[i];

    if (i === 0) {
      // Skip early feb data point
      continue;
    }

    cols.Date.push(row.date);
    cols.Confirmed.push(row.confirmed);
  }

  if (dailyIncreaseChart) {
    dailyIncreaseChart.destroy();
  }

  dailyIncreaseChart = c3.generate({
    bindto: "#daily-increase-chart",
    data: {
      color: function (color, d) {
        if (d && d.index === cols.Date.length - 2) {
          return COLOR_TESTED_DAILY;
        } else {
          return COLOR_TESTED;
        }
      },
      columns: [cols.Confirmed],
      type: "bar",
      regions: {
        [cols.Confirmed[0]]: [
          { start: cols.Date[cols.Date.length - 2], style: "dashed" },
        ],
      },
    },
    bar: {
      width: {
        ratio: 0.8,
      },
    },
    axis: {
      x: {
        tick: {
          format: function (x) {
            var months = [
              "Jan",
              "Feb",
              "Mar",
              "Apr",
              "May",
              "Jun",
              "Jul",
              "Aug",
              "Sep",
              "Oct",
              "Nov",
              "Dec",
            ];

            // x+1 because the list is prefixed with the label
            var xDate = new Date(cols.Date[x + 1]);
            return months[xDate.getMonth()] + " " + xDate.getDate();
          },
        },
      },
      y: {
        tick: {
          values: [
            0,
            25,
            50,
            75,
            100,
            125,
            150,
            175,
            200,
            225,
            250,
            275,
            300,
            325,
            350,
            375,
            400,
          ],
        },
      },
    },
    tooltip: {
      format: {
        value: function (value, ratio, id, index) {
          return `${value} ${
            index === cols.Date.length - 2 ? i18next.t("provisional") : ""
          }`;
        },
      },
    },
    grid: {
      x: {
        show: true,
      },
      y: {
        show: true,
      },
    },
    legend: {
      hide: true,
    },
    padding: {
      right: 24,
    },
  });
}

// Keep reference to chart in order to destroy it when redrawing.
let prefectureTrajectoryChart = null;

function drawPrefectureTrajectoryChart(prefectures) {
  const minimumConfirmed = 100;
  const filteredPrefectures = _.filter(prefectures, function (prefecture) {
    return prefecture.confirmed >= minimumConfirmed;
  });
  const trajectories = _.reduce(
    filteredPrefectures,
    function (t, prefecture) {
      const cumulativeConfirmed = _.reduce(
        prefecture.dailyConfirmedCount,
        function (result, value) {
          if (result.length > 0) {
            const sum = result[result.length - 1] + value;
            result.push(sum);
            return result;
          } else {
            return [value];
          }
        },
        []
      );
      const cumulativeConfirmedFromMinimum = _.filter(
        cumulativeConfirmed,
        function (value) {
          return value >= minimumConfirmed;
        }
      );
      t[prefecture.name] = {
        name: prefecture.name,
        name_ja: prefecture.name_ja,
        confirmed: prefecture.confirmed,
        cumulativeConfirmed: cumulativeConfirmedFromMinimum,
        lastIndex: cumulativeConfirmedFromMinimum.length - 1,
      };
      return t;
    },
    {}
  );

  const columns = _.map(Object.values(trajectories), function (prefecture) {
    return [prefecture.name].concat(prefecture.cumulativeConfirmed);
  });

  const regions = _.mapValues(trajectories, function (prefecture) {
    const value = prefecture.lastIndex;
    if (value > 0) {
      return [{ start: value - 1, end: value, style: "dashed" }];
    } else {
      return [];
    }
  });

  const maxDays = _.reduce(
    _.values(trajectories),
    function (a, b) {
      return Math.max(a, b.lastIndex);
    },
    0
  );

  const nameMap = _.reduce(
    trajectories,
    function (result, value) {
      if (LANG === "en") {
        result[value.name] = value.name;
      } else {
        result[value.name] = value.name_ja;
      }
      return result;
    },
    {}
  );

  if (prefectureTrajectoryChart) {
    prefectureTrajectoryChart.destroy();
  }

  prefectureTrajectoryChart = c3.generate({
    bindto: "#prefecture-trajectory",
    color: {
      pattern: d3.schemeTableau10,
    },
    axis: {
      y: {
        min: minimumConfirmed,
        padding: {
          bottom: 0,
        },
      },
      x: {
        // Set max x value to be 2 greater to avoid label cutoff
        max: maxDays + 2,
        label: `Number of Days since ${minimumConfirmed}th case`,
      },
    },
    data: {
      columns: columns,
      labels: {
        format: function (v, id, i) {
          if (id) {
            const lastIndex = trajectories[id].lastIndex;
            if (lastIndex === 0 || i === lastIndex - 1) {
              return id;
            }
          }
        },
      },
      names: nameMap,
      color: function (originalColor, d) {
        let color = d3.hsl(originalColor);
        if (!d || !d.id) {
          return color;
        }
        const lastIndex = trajectories[d.id].lastIndex;
        // Grey out when less than 1 week over minimumConfirmed
        if (lastIndex < 7) {
          color.l = 0.8;
          color.s = 0.1;
        }

        if (d.index === lastIndex) {
          color.opacity = 0.4;
        } else {
          color.opacity = 1;
        }
        return color;
      },
      regions: regions,
    },
    grid: {
      x: {
        show: true,
      },
      y: {
        show: true,
      },
    },
    padding: {
      right: 24,
    },
    tooltip: {
      format: {
        value: function (value, ratio, id, index) {
          const prefecture = trajectories[id];
          if (index && prefecture.cumulativeConfirmed[index - 1]) {
            const diff =
              parseInt(value) - prefecture.cumulativeConfirmed[index - 1];
            const annotation =
              index === prefecture.lastIndex ? i18next.t("provisional") : "";
            const diffText = diff >= 0 ? `+${diff}` : diff;
            return `${value} (${diffText}) ${annotation}`;
          } else {
            return value;
          }
        },
      },
    },
  });
}

// Dictionary of all the trend charts so that we can cleanup when redrawing.
let prefectureTrendCharts = {};

function drawPrefectureTrend(elementId, seriesData, maxConfirmedIncrease) {
  let yMax = maxConfirmedIncrease;
  let prefectureMax = _.max(seriesData);
  if (prefectureMax / maxConfirmedIncrease < 0.1) {
    yMax = prefectureMax * 5; // artificially scale up low values to make it look ok.
  }

  const period = 30; // days
  let last30days = _.takeRight(seriesData, period);

  if (prefectureTrendCharts[elementId]) {
    prefectureTrendCharts[elementId].destroy();
  }
  prefectureTrendCharts[elementId] = c3.generate({
    bindto: elementId,
    interaction: { enabled: false },
    data: {
      type: "bar",
      columns: [_.concat(["confirmed"], last30days)],
      colors: { confirmed: COLOR_CONFIRMED },
    },
    bar: {
      width: { ratio: 0.65 },
      zerobased: true,
    },
    axis: {
      x: {
        show: false,
        min: 0,
        padding: 5,
      },
      y: {
        show: false,
        min: 0,
        max: yMax,
        padding: 1,
      },
    },
    size: {
      height: 40,
    },

    legend: { show: false },
    tooltip: { show: false },
    point: { show: false },
  });
}

function drawPrefectureTable(prefectures, totals) {
  // Draw the Cases By Prefecture table
  let dataTable = document.querySelector("#prefectures-table");
  let dataTableFoot = document.querySelector("#prefectures-table tfoot");

  // Abort if dataTable or dataTableFoot is not accessible.
  if (!dataTable || !dataTableFoot) {
    return;
  }

  // Remove any tbody elements (including the loading indicator).
  for (let tbody of document.querySelectorAll("#prefectures-table tbody")) {
    tbody.parentNode.removeChild(tbody);
  }

  let prefectureRows = document.createElement("tbody");
  prefectureRows.id = "prefecture-rows";
  dataTable.insertBefore(prefectureRows, dataTableFoot);

  let portOfEntryRows = document.createElement("tbody");
  portOfEntryRows.id = "portofentry-rows";
  dataTable.insertBefore(portOfEntryRows, dataTableFoot);

  let unspecifiedRows = document.createElement("tbody");
  unspecifiedRows.id = "unspecified-rows";
  dataTable.insertBefore(unspecifiedRows, dataTableFoot);

  // Work out the largest daily increase
  let maxConfirmedIncrease = _.max(
    _.map(prefectures, (pref) => {
      return _.max(pref.dailyConfirmedCount);
    })
  );

  // Parse values so we can sort
  _.map(prefectures, function (pref) {
    pref.confirmed = pref.confirmed ? parseInt(pref.confirmed) : 0;
    pref.recovered = pref.recovered ? parseInt(pref.recovered) : 0;
    // TODO change to deceased
    pref.deceased = pref.deaths ? parseInt(pref.deaths) : 0;
  });

  // Iterate through and render table rows

  _.orderBy(prefectures, "confirmed", "desc").map(function (pref) {
    if (!pref.confirmed && !pref.recovered && !pref.deceased) {
      return;
    }

    let increment =
      pref.dailyConfirmedCount[pref.dailyConfirmedCount.length - 1];
    let incrementString = "";
    if (increment > 0) {
      incrementString = `<span class='increment'>(+${increment})</span>`;
    }

    if (pref.name == "Unspecified") {
      unspecifiedRows.innerHTML = `<tr>
        <td class="prefecture" data-i18n="unspecified">${i18next.t(
          "unspecified"
        )}</td>
        <td class="trend"><div id="Unspecified-trend"></div></td>
        <td class="count">${pref.confirmed} ${incrementString}</td>
        <td class="count">${pref.recovered ? pref.recovered : ""}</td>
        <td class="count">${pref.deceased ? pref.deceased : ""}</td>
        </tr>`;
      drawPrefectureTrend(
        `#Unspecified-trend`,
        pref.dailyConfirmedCount,
        maxConfirmedIncrease
      );
    } else if (pref.name == "Port Quarantine" || pref.name == "Port of Entry") {
      // Override Port Quartantine name as "Port of Entry". The name in the spreadsheet is
      //  confusing.
      //
      // TODO(liquidx): move this hack into covid19japan-data.
      portOfEntryRows.innerHTML = `<tr>
        <td class="prefecture" data-i18n="port-of-entry">${i18next.t(
          "port-of-entry"
        )}</td>
        <td class="trend"><div id="PortOfEntry-trend"></div></td>
        <td class="count">${pref.confirmed} ${incrementString}</td>
        <td class="count">${pref.recovered ? pref.recovered : ""}</td>
        <td class="count">${pref.deceased ? pref.deceased : ""}</td>
        </tr>`;
      drawPrefectureTrend(
        `#PortOfEntry-trend`,
        pref.dailyConfirmedCount,
        maxConfirmedIncrease
      );
    } else if (pref.name == "Total") {
      // Skip
    } else {
      let row = document.createElement("tr");
      prefectureRows.appendChild(row);
      row.innerHTML = `
        <td class="prefecture" >
        ${pref.name}</td>
        <td class="trend"></div></td>
        <td class="count">${pref.confirmed} ${incrementString}</td>
        <td class="count">${pref.recovered ? pref.recovered : ""}</td>
        <td class="count">${pref.deceased ? pref.deceased : ""}</td>
      `;
      // drawPrefectureTrend(
      //   `#${pref.name}-trend`,
      //   pref.dailyConfirmedCount,
      //   maxConfirmedIncrease
      // );
    }
    return true;
  });

  dataTableFoot.innerHTML = `<tr class='totals'>
        <td data-i18n="total">${i18next.t("total")}</td>
        <td class="trend"></td>
        <td class="count">${totals.confirmed}</td>
        <td class="count">${totals.recovered}</td>
        <td class="count">${totals.deceased}</td>
        </tr>`;
}

function drawTravelRestrictions() {
  travelRestrictionsHelper(
    "#banned-entry",
    ddb.travelRestrictions.japan.banned
  );
  travelRestrictionsHelper(
    "#visa-required",
    ddb.travelRestrictions.japan.visaRequired
  );
  travelRestrictionsHelper(
    "#self-quarantine",
    ddb.travelRestrictions.japan.selfQuarantine
  );
  travelRestrictionsHelper(
    "#other-restrictions",
    ddb.travelRestrictions.japan.other
  );

  /*travelRestrictionsHelper('#foreign-banned-entry', ddb.travelRestrictions.foreignBorders.banned);
  travelRestrictionsHelper('#foreign-visa-required', ddb.travelRestrictions.foreignBorders.visaRequired);
  travelRestrictionsHelper('#foreign-self-quarantine', ddb.travelRestrictions.foreignBorders.selfQuarantine);
  travelRestrictionsHelper('#foreign-other-restrictions', ddb.travelRestrictions.foreignBorders.other);
  */
}

function travelRestrictionsHelper(elementId, countries) {
  let countryList = [];
  // Iterate through and render country links
  _.orderBy(countries, "name", "desc").map(function (country) {
    let name = i18next.t(`countries.${country.name}`);
    countryList.unshift(
      `<a href="${country.link}">${country.emoji}${name}</a>`
    );
    return true;
  });

  let banned = document.querySelector(elementId);
  if (banned) {
    banned.innerHTML = countryList.join(", ");
  }
}

function drawKpis(totals, totalsDiff) {
  // Draw the KPI values

  function setKpi(key, value) {
    document.querySelector("#kpi-" + key + " .value").innerHTML = value;
  }
  function setKpiDiff(key, value) {
    let diffDir = value >= 0 ? "+" : "";
    document.querySelector("#kpi-" + key + " .diff").innerHTML =
      "( " + diffDir + value + " )";
  }

  setKpi("confirmed", totals.confirmed);
  setKpiDiff("confirmed", totalsDiff.confirmed);
  setKpi("recovered", totals.recovered);
  setKpiDiff("recovered", totalsDiff.recovered);
  setKpi("deceased", totals.deceased);
  setKpiDiff("deceased", totalsDiff.deceased);
  setKpi("critical", totals.critical);
  setKpiDiff("critical", totalsDiff.critical);
  setKpi("tested", totals.tested);
  setKpiDiff("tested", totalsDiff.tested);
  setKpi("active", totals.confirmed - totals.recovered - totals.deceased);
  setKpiDiff(
    "active",
    totalsDiff.confirmed - totalsDiff.recovered - totalsDiff.deceased
  );
}

/**
 * @param {string} lastUpdatedString - MMM DD YYYY, HH:mm JST (e.g. Mar 29 2020, 15:53 JST)
 */
function drawLastUpdated(lastUpdatedString) {
  // Draw the last updated time

  const display = document.getElementById("last-updated");
  if (!display) {
    return;
  }

  // If this is called before data is loaded, lastUpdated can be null.
  if (!lastUpdatedString) {
    return;
  }

  let lastUpdated;
  try {
    lastUpdated = parseISO(lastUpdatedString);

    // If the timestamp is not ISO, fall back on the old date format
    // TODO: remove after ISO time format is fully deployed
    if (lastUpdated == "Invalid Date") {
      lastUpdated = parse(
        lastUpdatedString.slice(0, -4),
        "MMMM d yyyy, HH:mm",
        new Date()
      );
    }
  } catch (e) {
    // Fall back to raw value on failed parse
    display.textContent = lastUpdatedString;
    return;
  }
  const relativeTime = {
    en: formatDistanceToNow(lastUpdated, {
      local: enUS,
      addSuffix: true,
    }),
    ja: formatDistanceToNow(lastUpdated, { locale: ja, addSuffix: true }),
  };

  display.textContent = relativeTime[LANG];
  display.setAttribute("title", lastUpdatedString);
  i18next.addResource(
    "en",
    "translation",
    "last-updated-time",
    relativeTime["en"]
  );
  i18next.addResource(
    "ja",
    "translation",
    "last-updated-time",
    relativeTime["ja"]
  );
  display.setAttribute("data-i18n", "last-updated-time");
}

function drawPageTitleCount(confirmed) {
  // Update the number of confirmed cases in the title

  document.title = "(" + confirmed + ") " + PAGE_TITLE;
}

/**
 * drawMapPrefectures
 * @param {*} pageDraws - number of redraws to screen
 */
function drawMapPrefectures(pageDraws) {
  // Find the index of the first symbol layer
  // in the map style so we can draw the
  // prefecture colors behind it

  var firstSymbolId;
  var layers = map.getStyle().layers;
  for (var i = 0; i < layers.length; i++) {
    if (layers[i].type === "symbol") {
      firstSymbolId = layers[i].id;
      break;
    }
  }

  // Start the Mapbox search expression
  let prefecturePaint = ["match", ["get", "NAME_1"]];

  // Go through all prefectures looking for cases
  ddb.prefectures.map(function (prefecture) {
    let cases = parseInt(prefecture.confirmed);
    if (cases > 0) {
      prefecturePaint.push(prefecture.name);

      if (cases <= 50) {
        // 1-50 cases
        prefecturePaint.push("rgb(253,234,203)");
      } else if (cases <= 100) {
        // 51-100 cases
        prefecturePaint.push("rgb(251,155,127)");
      } else if (cases <= 200) {
        // 101-200 cases
        prefecturePaint.push("rgb(244,67,54)");
      } else {
        // 201+ cases
        prefecturePaint.push("rgb(186,0,13)");
      }
    }
  });

  // Add a final value to the list for the default color
  prefecturePaint.push("rgba(0,0,0,0)");

  if (pageDraws === 0) {
    // If it is the first time drawing the map

    map.addSource("prefectures", {
      type: "geojson",
      data: PREFECTURE_JSON_PATH,
    });

    // Add the prefecture color layer to the map
    map.addLayer(
      {
        id: "prefecture-layer",
        type: "fill",
        source: "prefectures",
        layout: {},
        paint: {
          "fill-color": prefecturePaint,
          "fill-opacity": 0.8,
        },
      },
      firstSymbolId
    );

    // Add another layer with type "line"
    // to provide a styled prefecture border
    let prefBorderLayer = map.addLayer(
      {
        id: "prefecture-outline-layer",
        type: "line",
        source: "prefectures",
        layout: {},
        paint: {
          "line-width": 0.5,
          "line-color": "#c0c0c0",
          "line-opacity": 0.5,
        },
      },
      firstSymbolId
    );
  } else {
    // Update prefecture paint properties

    map.setPaintProperty("prefecture-layer", "fill-color", prefecturePaint);
  }
}

// localize must be accessible globally
const localize = locI18next.init(i18next);
function initDataTranslate() {
  // load translation framework
  i18next
    .use(LanguageDetector)
    .init({
      fallbackLng: "en",
      lowerCaseLng: true,
      detection: {
        order: ["querystring", "navigator"],
      },
      resources: {
        en: {
          translation: translationEn,
        },
        ja: {
          translation: translationJa,
        },
      },
    })
    .then(() => {
      setLang(i18next.language);
    });

  // Language selector event handler
  if (document.querySelectorAll("[data-lang-picker]")) {
    document.querySelectorAll("[data-lang-picker]").forEach(function (pick) {
      pick.addEventListener("click", function (e) {
        e.preventDefault();
        setLang(e.target.dataset.langPicker);
      });
    });
  }
}

function setLang(lng) {
  if (lng && lng.length > 1) {
    // Clip to first two letters of the language.
    let proposedLng = lng.slice(0, 2);
    // Don't set the lang if it's not the supported languages.
    if (SUPPORTED_LANGS.indexOf(proposedLng) != -1) {
      LANG = proposedLng;
    }
  }

  toggleLangPicker();

  // set i18n framework lang
  i18next.changeLanguage(LANG).then(() => {
    localize("html");
    // Update the map
    if (styleLoaded) {
      map.getStyle().layers.forEach(function (thisLayer) {
        if (thisLayer.type == "symbol") {
          map.setLayoutProperty(thisLayer.id, "text-field", [
            "get",
            "name_" + LANG,
          ]);
        }
      });
    }

    // Redraw all components that need rerendering to be localized the prefectures table
    if (!document.body.classList.contains("embed-mode")) {
      if (document.getElementById("travel-restrictions")) {
        drawTravelRestrictions();
      }
      drawPrefectureTrajectoryChart(ddb.prefectures);
    }

    updateTooltipLang();
  });
}

function updateTooltipLang() {
  // Destroy current tooltips
  if (Array.isArray(tippyInstances)) {
    tippyInstances.forEach((instance) => instance.destroy());
  }

  // Set tooltip content to current language
  document.querySelectorAll(`[data-tippy-i18n]`).forEach((node) => {
    const i18nKey = node.getAttribute("data-tippy-i18n");
    const dataTippyContent = i18next.t(i18nKey);
    node.setAttribute("data-tippy-content", dataTippyContent);
  });

  // Activate tooltips
  tippyInstances = tippy("[data-tippy-content]");
}

function toggleLangPicker() {
  // Toggle the lang picker
  if (document.querySelectorAll("a[data-lang-picker]")) {
    document.querySelectorAll("a[data-lang-picker]").forEach(function (el) {
      el.style.display = "inline";
    });

    let currentLangPicker = document.querySelector(
      "a[data-lang-picker=" + LANG + "]"
    );
    if (currentLangPicker) {
      currentLangPicker.style.display = "none";
    }
  }
}

function loadDataOnPage() {
  loadData(function (data) {
    jsonData = data;

    ddb.prefectures = jsonData.prefectures;
    let newTotals = calculateTotals(jsonData.daily);
    ddb.totals = newTotals[0];
    ddb.totalsDiff = newTotals[1];
    ddb.trend = jsonData.daily;
    ddb.lastUpdated = jsonData.updated;

    drawKpis(ddb.totals, ddb.totalsDiff);
    if (!document.body.classList.contains("embed-mode")) {
      drawLastUpdated(ddb.lastUpdated);
      drawPageTitleCount(ddb.totals.confirmed);
      drawPrefectureTable(ddb.prefectures, ddb.totals);
      drawTravelRestrictions();
      drawTrendChart(ddb.trend);
      drawDailyIncreaseChart(ddb.trend);
      drawPrefectureTrajectoryChart(ddb.prefectures);
    }

    whenMapAndDataReady();
  });
}

var pageDraws = 0;
var styleLoaded = false;
var jsonData = undefined;
function whenMapAndDataReady() {
  // This runs drawMapPref only when
  // both style and json data are ready

  if (!styleLoaded || !jsonData) {
    return;
  }

  drawMapPrefectures(pageDraws);
}

window.onload = function () {
  initDataTranslate();
  drawMap();

  map.once("style.load", function (e) {
    styleLoaded = true;

    map.getStyle().layers.forEach(function (thisLayer) {
      if (thisLayer.type == "symbol") {
        map.setLayoutProperty(thisLayer.id, "text-field", [
          "get",
          "name_" + LANG,
        ]);
      }
    });

    whenMapAndDataReady();
  });

  loadDataOnPage();

  // Reload data every INTERVAL
  const FIVE_MINUTES_IN_MS = 300000;
  setInterval(function () {
    pageDraws++;
    loadDataOnPage();
  }, FIVE_MINUTES_IN_MS);
};
