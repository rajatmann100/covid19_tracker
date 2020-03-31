import React from "react";

export default function Summary(props) {
  var countries = Object.keys(props).sort();
  var total = 0;
  var deaths = 0;
  var recovered = 0;
  countries.forEach(c => {
    total += props[c][props[c].length - 1].confirmed;
    deaths += props[c][props[c].length - 1].deaths;
    recovered += props[c][props[c].length - 1].recovered;
  });

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-around",
        flexWrap: "wrap"
      }}
    >
      <div style={{ color: "slategrey", minWidth: "300px" }}>
        <h1>Confirmed</h1>
        <h3>{total}</h3>
      </div>
      <div style={{ color: "red", minWidth: "300px" }}>
        <h1>Deaths</h1>
        <h3>{deaths}</h3>
      </div>
      <div style={{ color: "green", minWidth: "300px" }}>
        <h1>Recovered</h1>
        <h3>{recovered}</h3>
      </div>
    </div>
  );
}
