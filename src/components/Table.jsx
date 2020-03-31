import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Paper from "@material-ui/core/Paper";

const useStyles = makeStyles({
  table: {
    minWidth: 650,

    borderTop: "5px solid slategrey"
  },
  tableContainer: {
    width: "90%"
  }
});

export default function SimpleTable(props) {
  const classes = useStyles();

  var covidData = props.covidData;
  var countries = Object.keys(covidData);
  countries = countries.sort((a, b) => {
    return (
      covidData[b][covidData[b].length - 1].confirmed -
      covidData[a][covidData[a].length - 1].confirmed
    );
  });

  return (
    <TableContainer component={Paper} className={classes.tableContainer}>
      <Table className={classes.table} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>
              <b>Country</b>
            </TableCell>
            <TableCell align="right">
              <b>Confirmed</b>
            </TableCell>
            <TableCell align="right">
              <b>Deaths</b>
            </TableCell>
            <TableCell align="right">
              <b>Recovered</b>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {countries.map(country => (
            <TableRow key={country}>
              <TableCell component="th" scope="row">
                <button
                  onClick={_ => {
                    props.setCountry(country);
                  }}
                >
                  {country}
                </button>
              </TableCell>
              <TableCell align="right">
                {covidData[country][covidData[country].length - 1].confirmed}
                &nbsp;(+
                {covidData[country][covidData[country].length - 1].confirmed -
                  covidData[country][covidData[country].length - 2].confirmed}
                )
              </TableCell>
              <TableCell align="right">
                {covidData[country][covidData[country].length - 1].deaths}
                &nbsp;(+
                {covidData[country][covidData[country].length - 1].deaths -
                  covidData[country][covidData[country].length - 2].deaths}
                )
              </TableCell>
              <TableCell align="right">
                {covidData[country][covidData[country].length - 1].recovered}
                &nbsp;(+
                {covidData[country][covidData[country].length - 1].recovered -
                  covidData[country][covidData[country].length - 2].recovered}
                )
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
