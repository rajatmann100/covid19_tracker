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
    width: "90%",
    borderTop: "5px solid slategrey"
  }
});

export default function SimpleTable(props) {
  const classes = useStyles();
  let data = [];
  for (var i = Object.keys(props.rawData).length - 1; i > 0; i--) {
    data.push(props.rawData[i]);
  }
  if (data.length) {
    return (
      <TableContainer component={Paper} className={classes.tableContainer}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center"
          }}
        >
          <button
            style={{ marginRight: "16px" }}
            onClick={_ => {
              props.setCountry(null);
            }}
          >
            Back
          </button>
          <h2>Data for {props.countrySelected}</h2>
        </div>

        <Table className={classes.table} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>
                <b>Date</b>
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
            {data.map((row, index) => (
              <TableRow key={index}>
                <TableCell component="th" scope="row">
                  {row.date}
                </TableCell>
                <TableCell align="right">{row.confirmed}</TableCell>
                <TableCell align="right">{row.deaths}</TableCell>
                <TableCell align="right">{row.recovered}</TableCell>
                {/* <TableCell align="right">
                {props[country][props[country].length - 1].deaths}
                &nbsp;(+
                {props[country][props[country].length - 1].deaths -
                  props[country][props[country].length - 2].deaths}
                )
              </TableCell>
              <TableCell align="right">
                {props[country][props[country].length - 1].recovered}
                &nbsp;(+
                {props[country][props[country].length - 1].recovered -
                  props[country][props[country].length - 2].recovered}
                )
              </TableCell> */}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }
  return null;
}
