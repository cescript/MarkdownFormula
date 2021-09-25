import { HyperFormula, SimpleCellAddress } from 'hyperformula';

// table struct
type TableCell = {
    line: number;
    column: number;
    content: string;
};

type TableContent = {
    sheet: string;
    data: TableCell[][];
};

type FormulaReturn = {
    indices: number[][];
    locations: number[][];
    data: string [][];
}

// return the locations of the found formulas and the replacement values
// locations: [lineNumber, column]
// data: [#val]({#formula})
export type MarkdownReturn = {
    locations: number[];
    data: string;
}

// given the document, parse valid tables
export function MarkdownFormula(document:string):MarkdownReturn[] {

    // find the tables
    let tableCanditates = SplitValidMarkdownTables(document);

    // print the tables
    console.log("markdown-formula detected %d valid tables!", tableCanditates.length);

    // create hyperformula option
    const options = {
        precisionRounding: 4,
        licenseKey: 'gpl-v3',
    };

    // build an instance with defined options
    const hfInstance = HyperFormula.buildEmpty(options);

    // create output
    let output:MarkdownReturn[] = [];

    // formulas in table
    let formulas: SimpleCellAddress[] = [];

    // create data pointer for table content
    for(let i = 0; i < tableCanditates.length; i++)
    {
        let formulaData = GetFormulaData(tableCanditates[i]);

        // add the current table to hfInstance
        const sheetNameI = hfInstance.addSheet(tableCanditates[i].sheet);
        const sheetIdI = hfInstance.getSheetId(sheetNameI);

        // not possible but ts forces this check
        if(typeof sheetIdI !== "undefined")
        {
            hfInstance.setSheetContent(sheetIdI, formulaData.data);

            // we found a table that contains formula
            if(formulaData.indices.length > 0)
            {
                // add the cell address to list
                for(let k = 0; k < formulaData.indices.length; k++)
                {
                    formulas.push({ col: formulaData.indices[k][1], row: formulaData.indices[k][0], sheet: sheetIdI });
                    output.push({data:formulaData.data[formulaData.indices[k][0]][formulaData.indices[k][1]], locations: formulaData.locations[k]});
                }
            }
        }
    }

    // go over all formulas and get the results
    for(let k = 0; k < formulas.length; k++)
    {
        const val = hfInstance.getCellValue(formulas[k]);
        output[k].data = ' [' + val + ']' + '({' + output[k].data + '}) ';
    }

    // return the result
    return output;
}

// split the table into columns
function GetFormulaData(table:TableContent):FormulaReturn {

    let tableData = table.data;

    // create data array
    let allData: string[][] = [];
    let formulaIndices: number[][] = [];
    let formulaLocations: number[][] = [];

    for(let r = 0; r < tableData.length; r++)
    {
        let columnData: string[] = [];

        // loop on the columns
        for(let c = 0; c < tableData[r].length; c++)
        {
            // get the content
            let content = tableData[r][c].content.trim();

            // is formula?
            let formulaPattern = /\[.*?\]\(\{(\=.*?)\}\)/
            if(content.match(formulaPattern))
            {
                formulaIndices.push([r,c]);
                formulaLocations.push([tableData[r][c].line, tableData[r][c].column, tableData[r][c].content.length]);
                content = content.replace(formulaPattern, '$1');
            }

            // set the content
            columnData.push(content);
        }
        allData.push(columnData);
    }

    // split the content into columns
    return {indices:formulaIndices, locations:formulaLocations, data:allData};
}

// returns all consecutive blocks in given array
// [1,2,4,5,6,7,9] => [[1,2],[4,5,6,7]]
function FindConsecutiveBlocks(array:number[]) {
    let consecutiveLineArray: number[][] = [];
    let consecutiveLines = [array[0]];

    // go over the all elements
    for (let k = 1; k < array.length; k++) {
        // if the current element matches the previous element in the block
        if ((consecutiveLines[consecutiveLines.length - 1] + 1) == array[k]) {
            consecutiveLines.push(array[k])
        } else {
            // if block contains at least two lines, accept it
            if (consecutiveLines.length >= 2) {
                consecutiveLineArray.push(consecutiveLines);
            }
            // restart the block since it is not consecutive anymore
            consecutiveLines = [array[k]]
        }
    }

    // add the last part if it is not empty
    if (consecutiveLines.length >= 2) {
        consecutiveLineArray.push(consecutiveLines);
    }

    return consecutiveLineArray;
}

// create array of table cells that contains the all the data in the row
function GetTableColumns(allContent:string[], lineNumber:number) {
    
    let column:TableCell[] = [];

    // get the cells
    let splits = allContent[lineNumber].split('|')

    // parse each column, skip first and last |
    var index=0
    for(let i = 1; i < splits.length - 1; i++) {
        column.push({line:lineNumber, column: index + 1, content:splits[i]});
        index += splits[i].length + 1;
    }

    // return the column
    return column;
}

// get the table content
function GetTableContent(allLines:string[], dataLines:number[], sheetID:number)
{
    // create a table
    let table: TableContent = {sheet:'Sheet' + sheetID, data:[]};

    // fill the table cells, skip the first two rows
    for(let i = 2; i < dataLines.length; i++)
    {
        table.data.push(GetTableColumns(allLines, dataLines[i]));
    }

    // find the sheet name if exist
    if(dataLines[0] > 0)
    {
        // get the line just before the header
        let possibleSheetName = allLines[dataLines[0]-1];
        // is that line a markdown comment
        let matchPattern = possibleSheetName.match(/<!--(.+?)-->/)
        if(matchPattern != null)
        {
            table.sheet = matchPattern[1].trim();
        }
    }

    return table;
}

// splits the given document into smaller text groups that can be markdown tables
// returns an array of candidate table content and line numbers
function SplitValidMarkdownTables(document:string) {
    // split document into lines
    let allLines: string[] = document.split(/\r?\n/gm)
    let candidateLines: number[] = [];

    // check all the lines and test for table pattern
    let tablePattern = /^\|(.*)\|$/m
    for (let l = 0; l < allLines.length; l++) {
        if (tablePattern.test(allLines[l])) {
            candidateLines.push(l);
        }
    }

    // get the consecutive lines as arrays
    let blocks = FindConsecutiveBlocks(candidateLines);

    // create table object
    let tables: TableContent[] = [];

    // find the blocks that contains formulas
    for(let i = 0; i < blocks.length; i++)
    {
        // check that table contains |---****---| pattern
        if(allLines[blocks[i][1]].match(/(?:\|.+?[-]+.+?)+\|/))
        {
            // create table if table contains more than two rows (header and ----)
            if(blocks[i].length > 2)
            {
                tables.push(GetTableContent(allLines, blocks[i], tables.length));
            }
        }
    }

    // return the valid table
    return tables;
}
