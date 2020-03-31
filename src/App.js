import React, { Component } from "react";
import "./App.css";
import Table from "./components/Table";
import TableDetails from "./components/TableDetails";
import Summary from "./components/Summary";

class App extends Component {
  constructor(props) {
    super(props);
    this.setCountry = this.setCountry.bind(this);
  }
  state = {
    covidData: [],
    countrySelected: null
  };
  componentDidMount() {
    fetch("https://pomber.github.io/covid19/timeseries.json")
      .then(response => response.json())
      .then(data => {
        this.setState({ covidData: data });
      });
  }
  setCountry(c) {
    this.setState({
      countrySelected: c
    });
  }
  render() {
    return (
      <div className="App">
        <Summary {...this.state.covidData} />
        {this.state.countrySelected ? (
          <TableDetails
            rawData={this.state.covidData[this.state.countrySelected]}
            countrySelected={this.state.countrySelected}
            setCountry={this.setCountry}
          />
        ) : (
          <Table
            covidData={this.state.covidData}
            setCountry={this.setCountry}
          />
        )}
      </div>
    );
  }
}

export default App;
